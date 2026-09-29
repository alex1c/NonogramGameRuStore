/**
 * GameProgressService — hydrate / mutate / persist orchestration.
 * Single root authority for Campaign + Daily (no competing repositories).
 */

import {
	createEmptyPlayerState,
	deserializePlayerState,
} from '../domain/nonogram/playerState'
import type { PlayerState, Puzzle } from '../domain/nonogram/types'
import { getProductionPuzzleById } from '../content/playable'
import { PaintTool } from '../gameplay/tools'
import {
	DAILY_EPOCH_DAY,
	localDayKey,
	type DayKey,
} from '../daily/dateUtils'
import {
	selectDailyPuzzle,
	DAILY_SELECTION_VERSION,
} from '../daily/selector'
import {
	computeCurrentStreak,
	computeLongestStreak,
	getRestoreEligibility,
} from '../daily/streak'
import type { Clock } from './clock'
import { createRealClock } from './clock'
import type { SaveRepository } from './repository'
import type { HydrationStatus, SaveRoot } from './schema'
import { createDefaultSave } from './createDefaultSave'
import { sanitizeSaveAgainstCatalog } from './sanitize'
import type {
	CompletionEventResult,
	DailyCompletionEventResult,
} from './completionResult'
import { findNextCampaignPuzzleId } from './nextCampaign'
import {
	clearActiveDailyGame,
	completeDaily,
	completePuzzle,
	createActiveDailyGameSave,
	createActiveGameSave,
	ensureDailyStartedDay,
	markPuzzleStarted,
	persistActiveDailyPlayerState,
	persistActivePlayerState,
	recordDailyRestart,
	recordHintApplied as bumpHintApplied,
	recordHintAssistanceUsed as bumpHintAssistanceUsed,
	recordHintRequest as bumpHintRequest,
	recordRedoAction,
	recordRestart,
	recordTeachMeView as bumpTeachMeView,
	recordUndoAction,
	resetProgress,
	restoreDailyDay,
	setActiveDailyGame,
	setActiveGame,
} from './progressReducers'
import {
	contextFromSave,
	evaluateAchievements,
	getNewlyUnlockedAchievements,
	materializeStickyAchievementIds,
} from '../achievements/evaluate'
import { mergeStickyAchievementIds } from '../achievements/sticky'
import { freezeSave } from './validate'
import { collectionJustCompleted } from '../gallery/viewModel'
import { getGalleryItemDef } from '../gallery/definitions'

/**
 * After a progress mutation: celebrate newly unlocked, then persist sticky ∪ derived.
 * Celebration uses before/after snapshots; sticky write is atomic with the same commit.
 */
function withStickyAchievementTransition(
	beforeSave: SaveRoot,
	afterProgress: SaveRoot,
	day: DayKey,
): {
	readonly save: SaveRoot
	readonly newlyUnlocked: ReturnType<typeof getNewlyUnlockedAchievements>
} {
	const beforeAchievements = evaluateAchievements(
		contextFromSave(beforeSave, day),
	)
	const afterDerived = evaluateAchievements(
		contextFromSave(afterProgress, day),
	)
	const newlyUnlocked = getNewlyUnlockedAchievements(
		beforeAchievements,
		afterDerived,
	)
	const sticky = mergeStickyAchievementIds(
		materializeStickyAchievementIds(contextFromSave(afterProgress, day)),
		newlyUnlocked.map((item) => item.id),
	)
	const save = freezeSave({
		...afterProgress,
		unlockedAchievementIds: sticky,
	})
	return { save, newlyUnlocked }
}

export interface PersistGameSnapshotInput {
	readonly puzzle: Puzzle
	readonly player: PlayerState
	readonly accumulatedActiveMs: number
	readonly tool: PaintTool
	readonly restartCountThisRun: number
}

export type DailyStartResult =
	| {
			readonly kind: 'started' | 'resumed'
			readonly dayKey: DayKey
			readonly puzzleId: string
			readonly save: SaveRoot
	  }
	| {
			readonly kind: 'completed'
			readonly dayKey: DayKey
			readonly puzzleId: string
			readonly save: SaveRoot
	  }
	| {
			readonly kind: 'unavailable'
			readonly reason:
				| 'FUTURE'
				| 'PAST'
				| 'BEFORE_EPOCH'
				| 'SELECTOR_FAILED'
				| 'PUZZLE_MISSING'
			readonly save: SaveRoot
	  }

export interface GameProgressService {
	hydrate(): Promise<{ status: HydrationStatus; save: SaveRoot; reason?: string }>
	getSave(): SaveRoot
	todayDayKey(): DayKey
	startPuzzle(puzzleId: string): Promise<SaveRoot>
	resumeActivePuzzle(): {
		readonly puzzle: Puzzle
		readonly player: PlayerState
		readonly tool: PaintTool
		readonly accumulatedActiveMs: number
		readonly restartCountThisRun: number
	} | null
	persistGameState(input: PersistGameSnapshotInput): Promise<SaveRoot>
	restartPuzzle(puzzle: Puzzle): Promise<SaveRoot>
	completePuzzle(input: {
		readonly puzzleId: string
		readonly activeTimeMs: number
		readonly isReplay?: boolean
	}): Promise<{ readonly save: SaveRoot; readonly event: CompletionEventResult }>
	replaceActivePuzzle(puzzleId: string): Promise<SaveRoot>
	recordUndo(): Promise<SaveRoot>
	recordRedo(): Promise<SaveRoot>
	/** +1 hintRequests after STEP / CONTRADICTION / STALLED response. */
	recordHintRequest(): Promise<SaveRoot>
	/** +1 teachMeViews when Teach Me showed a STEP explanation. */
	recordTeachMeView(): Promise<SaveRoot>
	/**
	 * Apply counters: global hintsApplied + hintsUsedThisRun on Campaign/Daily.
	 * Replay uses branch 'none' (global only).
	 */
	recordHintApplied(branch: 'campaign' | 'daily' | 'none'): Promise<SaveRoot>
	/**
	 * Contradiction/STALLED diagnostic: bump hintsUsedThisRun without hintsApplied.
	 */
	recordHintAssistanceUsed(
		branch: 'campaign' | 'daily' | 'none',
	): Promise<SaveRoot>
	flush(): Promise<void>
	resetProgressDevOnly(): Promise<SaveRoot>

	/** Mark user Daily participation start (first Daily screen open). */
	openDailyScreen(): Promise<SaveRoot>
	startOrResumeDaily(dayKey?: DayKey): Promise<DailyStartResult>
	resumeActiveDaily(): {
		readonly dayKey: DayKey
		readonly puzzle: Puzzle
		readonly player: PlayerState
		readonly tool: PaintTool
		readonly accumulatedActiveMs: number
		readonly restartCountThisRun: number
		readonly selectionVersion: string
	} | null
	persistDailyState(input: PersistGameSnapshotInput & {
		readonly dayKey: DayKey
		readonly selectionVersion: string
	}): Promise<SaveRoot>
	restartDaily(input: {
		readonly dayKey: DayKey
		readonly puzzle: Puzzle
		readonly selectionVersion: string
	}): Promise<SaveRoot>
	completeDailyPuzzle(input: {
		readonly dayKey: DayKey
		readonly puzzleId: string
		readonly selectionVersion: string
		readonly activeTimeMs: number
	}): Promise<{
		readonly save: SaveRoot
		readonly event: DailyCompletionEventResult
	}>
	restoreStreakDay(): Promise<{
		readonly ok: boolean
		readonly save: SaveRoot
		readonly missingDayKey: DayKey | null
	}>
	discardStaleDailyIfNeeded(): Promise<SaveRoot>
}

export function createGameProgressService(
	repository: SaveRepository,
	clock: Clock = createRealClock(),
): GameProgressService {
	let current: SaveRoot = createDefaultSave()
	let hydrated = false

	const commit = async (next: SaveRoot): Promise<SaveRoot> => {
		current = next
		await repository.save(current)
		return current
	}

	const today = (): DayKey => localDayKey(new Date(clock.now()))

	return {
		async hydrate() {
			const loaded = await repository.load()
			let status: HydrationStatus = 'READY'
			let reason: string | undefined

			if (loaded.kind === 'recovered' || loaded.kind === 'unsupported') {
				status = 'ERROR_RECOVERED'
				reason = loaded.reason
			}

			const sanitized = sanitizeSaveAgainstCatalog(loaded.save, clock)
			if (
				sanitized.clearedActiveGame ||
				sanitized.clearedActiveDailyGame
			) {
				status = status === 'READY' ? 'ERROR_RECOVERED' : status
				reason = sanitized.reason ?? reason
				current = sanitized.save
				await repository.save(current)
			} else {
				current = sanitized.save
				if (loaded.kind === 'recovered' || loaded.kind === 'unsupported') {
					await repository.save(current)
				}
			}

			hydrated = true
			return { status, save: current, reason }
		},

		getSave(): SaveRoot {
			return current
		},

		todayDayKey(): DayKey {
			return today()
		},

		async startPuzzle(puzzleId: string) {
			ensureHydrated(hydrated)
			const puzzle = requirePuzzle(puzzleId)
			const now = clock.now()
			const player = createEmptyPlayerState(puzzle.width, puzzle.height)
			const active = createActiveGameSave({
				puzzle,
				player,
				accumulatedActiveMs: 0,
				startedAtMs: now,
				savedAtMs: now,
				tool: PaintTool.FILLED,
				restartCountThisRun: 0,
			})
			let next = markPuzzleStarted(current, puzzleId)
			next = setActiveGame(next, active)
			return commit(next)
		},

		resumeActivePuzzle() {
			ensureHydrated(hydrated)
			const active = current.activeGame
			if (active === null) {
				return null
			}
			const puzzle = getProductionPuzzleById(active.puzzleId)
			if (puzzle === null) {
				return null
			}
			return {
				puzzle,
				player: deserializePlayerState(active.player),
				tool: active.tool,
				accumulatedActiveMs: active.accumulatedActiveMs,
				restartCountThisRun: active.restartCountThisRun,
			}
		},

		async persistGameState(input) {
			ensureHydrated(hydrated)
			const next = persistActivePlayerState(current, {
				puzzle: input.puzzle,
				player: input.player,
				accumulatedActiveMs: input.accumulatedActiveMs,
				tool: input.tool,
				savedAtMs: clock.now(),
				restartCountThisRun: input.restartCountThisRun,
			})
			return commit(next)
		},

		async restartPuzzle(puzzle) {
			ensureHydrated(hydrated)
			const now = clock.now()
			let next = recordRestart(current)
			const player = createEmptyPlayerState(puzzle.width, puzzle.height)
			const active = createActiveGameSave({
				puzzle,
				player,
				accumulatedActiveMs: 0,
				startedAtMs: now,
				savedAtMs: now,
				tool: PaintTool.FILLED,
				restartCountThisRun: next.activeGame?.restartCountThisRun ?? 0,
			})
			next = setActiveGame(next, active)
			return commit(next)
		},

		async completePuzzle(input) {
			ensureHydrated(hydrated)
			const beforeSave = current
			const day = today()
			const firstCompletion = !beforeSave.completedPuzzleIds.includes(
				input.puzzleId,
			)
			const firstPuzzleSolve = !beforeSave.solvedPuzzleIds.includes(
				input.puzzleId,
			)
			const previousBest =
				beforeSave.bestTimes.find(
					(item) => item.puzzleId === input.puzzleId,
				)?.bestActiveTimeMs ?? null

			const progressed = completePuzzle(beforeSave, input)
			const { save: next, newlyUnlocked } = withStickyAchievementTransition(
				beforeSave,
				progressed,
				day,
			)
			await commit(next)

			const newBest =
				next.bestTimes.find((item) => item.puzzleId === input.puzzleId)
					?.bestActiveTimeMs ?? input.activeTimeMs
			const bestTimeImproved =
				previousBest === null || newBest < previousBest
			const galleryIncluded = getGalleryItemDef(input.puzzleId) !== null

			const event: CompletionEventResult = {
				mode: input.isReplay ? 'REPLAY' : 'CAMPAIGN',
				puzzleId: input.puzzleId,
				firstCompletion,
				firstPuzzleSolve,
				galleryJustUnlocked: firstPuzzleSolve && galleryIncluded,
				bestTimeImproved,
				previousBestTimeMs: previousBest,
				newBestTimeMs: newBest,
				newlyUnlockedAchievements: newlyUnlocked,
				collectionJustCompletedTitle: collectionJustCompleted(
					beforeSave.solvedPuzzleIds,
					next.solvedPuzzleIds,
					input.puzzleId,
				),
				nextCampaignPuzzleId: input.isReplay
					? null
					: findNextCampaignPuzzleId(next, input.puzzleId),
				galleryIncluded,
			}
			return { save: next, event }
		},

		async replaceActivePuzzle(puzzleId: string) {
			ensureHydrated(hydrated)
			return this.startPuzzle(puzzleId)
		},

		async recordUndo() {
			ensureHydrated(hydrated)
			return commit(recordUndoAction(current))
		},

		async recordRedo() {
			ensureHydrated(hydrated)
			return commit(recordRedoAction(current))
		},

		async recordHintRequest() {
			ensureHydrated(hydrated)
			return commit(bumpHintRequest(current))
		},

		async recordTeachMeView() {
			ensureHydrated(hydrated)
			return commit(bumpTeachMeView(current))
		},

		async recordHintApplied(branch) {
			ensureHydrated(hydrated)
			return commit(bumpHintApplied(current, branch))
		},

		async recordHintAssistanceUsed(branch) {
			ensureHydrated(hydrated)
			return commit(bumpHintAssistanceUsed(current, branch))
		},

		async flush() {
			ensureHydrated(hydrated)
			await repository.save(current)
		},

		async resetProgressDevOnly() {
			ensureHydrated(hydrated)
			return commit(resetProgress())
		},

		async openDailyScreen() {
			ensureHydrated(hydrated)
			const next = ensureDailyStartedDay(current, today())
			if (next === current) {
				return current
			}
			return commit(next)
		},

		async startOrResumeDaily(dayKey) {
			ensureHydrated(hydrated)
			const day = dayKey ?? today()
			const nowToday = today()

			if (day < DAILY_EPOCH_DAY) {
				return {
					kind: 'unavailable',
					reason: 'BEFORE_EPOCH',
					save: current,
				}
			}
			if (day > nowToday) {
				return { kind: 'unavailable', reason: 'FUTURE', save: current }
			}
			if (day < nowToday) {
				return { kind: 'unavailable', reason: 'PAST', save: current }
			}

			const existingRecord = current.dailyCompletionRecords.find(
				(r) => r.dayKey === day,
			)
			if (existingRecord !== undefined) {
				return {
					kind: 'completed',
					dayKey: day,
					puzzleId: existingRecord.puzzleId,
					save: current,
				}
			}

			const active = current.activeDailyGame
			if (active !== null && active.dayKey === day) {
				return {
					kind: 'resumed',
					dayKey: day,
					puzzleId: active.puzzleId,
					save: current,
				}
			}

			// Discard stale other-day active before starting today
			let base = current
			if (active !== null && active.dayKey !== day) {
				base = clearActiveDailyGame(base)
			}

			let selection
			try {
				selection = selectDailyPuzzle(day)
			} catch {
				return {
					kind: 'unavailable',
					reason: 'SELECTOR_FAILED',
					save: current,
				}
			}
			const puzzle = getProductionPuzzleById(selection.puzzleId)
			if (puzzle === null) {
				return {
					kind: 'unavailable',
					reason: 'PUZZLE_MISSING',
					save: current,
				}
			}
			const now = clock.now()
			const player = createEmptyPlayerState(puzzle.width, puzzle.height)
			const dailyActive = createActiveDailyGameSave({
				dayKey: day,
				puzzle,
				selectionVersion: selection.selectionVersion,
				player,
				accumulatedActiveMs: 0,
				startedAtMs: now,
				savedAtMs: now,
				tool: PaintTool.FILLED,
				restartCountThisRun: 0,
			})
			const next = setActiveDailyGame(base, dailyActive)
			await commit(next)
			return {
				kind: 'started',
				dayKey: day,
				puzzleId: selection.puzzleId,
				save: next,
			}
		},

		resumeActiveDaily() {
			ensureHydrated(hydrated)
			const active = current.activeDailyGame
			if (active === null) {
				return null
			}
			const puzzle = getProductionPuzzleById(active.puzzleId)
			if (puzzle === null) {
				return null
			}
			return {
				dayKey: active.dayKey,
				puzzle,
				player: deserializePlayerState(active.player),
				tool: active.tool,
				accumulatedActiveMs: active.accumulatedActiveMs,
				restartCountThisRun: active.restartCountThisRun,
				selectionVersion: active.selectionVersion,
			}
		},

		async persistDailyState(input) {
			ensureHydrated(hydrated)
			const next = persistActiveDailyPlayerState(current, {
				dayKey: input.dayKey,
				puzzle: input.puzzle,
				selectionVersion: input.selectionVersion,
				player: input.player,
				accumulatedActiveMs: input.accumulatedActiveMs,
				tool: input.tool,
				savedAtMs: clock.now(),
				restartCountThisRun: input.restartCountThisRun,
			})
			return commit(next)
		},

		async restartDaily(input) {
			ensureHydrated(hydrated)
			const now = clock.now()
			let next = recordDailyRestart(current)
			const player = createEmptyPlayerState(
				input.puzzle.width,
				input.puzzle.height,
			)
			const active = createActiveDailyGameSave({
				dayKey: input.dayKey,
				puzzle: input.puzzle,
				selectionVersion: input.selectionVersion,
				player,
				accumulatedActiveMs: 0,
				startedAtMs: now,
				savedAtMs: now,
				tool: PaintTool.FILLED,
				restartCountThisRun:
					next.activeDailyGame?.restartCountThisRun ?? 0,
			})
			next = setActiveDailyGame(next, active)
			return commit(next)
		},

		async completeDailyPuzzle(input) {
			ensureHydrated(hydrated)
			const beforeSave = current
			const day = today()
			const streakBefore = computeCurrentStreak({
				today: day,
				completions: beforeSave.dailyCompletionRecords,
				restoredDays: beforeSave.restoredDailyDays,
				dailyStartedDay: beforeSave.dailyStartedDay,
			})
			const firstDailyCompletion = !beforeSave.dailyCompletionRecords.some(
				(r) => r.dayKey === input.dayKey,
			)
			const firstPuzzleSolve = !beforeSave.solvedPuzzleIds.includes(
				input.puzzleId,
			)
			const galleryIncluded = getGalleryItemDef(input.puzzleId) !== null

			const progressed = completeDaily(beforeSave, input)
			const { save: next, newlyUnlocked } = withStickyAchievementTransition(
				beforeSave,
				progressed,
				day,
			)
			await commit(next)

			const streakAfter = computeCurrentStreak({
				today: day,
				completions: next.dailyCompletionRecords,
				restoredDays: next.restoredDailyDays,
				dailyStartedDay: next.dailyStartedDay,
			})
			const restore = getRestoreEligibility({
				today: day,
				completions: next.dailyCompletionRecords,
				restoredDays: next.restoredDailyDays,
				dailyStartedDay: next.dailyStartedDay,
			})

			const event: DailyCompletionEventResult = {
				mode: 'DAILY',
				dayKey: input.dayKey,
				puzzleId: input.puzzleId,
				firstDailyCompletion,
				firstPuzzleSolve,
				galleryJustUnlocked: firstPuzzleSolve && galleryIncluded,
				newlyUnlockedAchievements: newlyUnlocked,
				collectionJustCompletedTitle: collectionJustCompleted(
					beforeSave.solvedPuzzleIds,
					next.solvedPuzzleIds,
					input.puzzleId,
				),
				streakBefore,
				streakAfter,
				streakExtended: streakAfter > streakBefore,
				galleryIncluded,
				activeTimeMs: input.activeTimeMs,
				restoreEligible: restore.eligible,
				restoreMissingDayKey: restore.missingDayKey,
			}
			void computeLongestStreak
			void DAILY_SELECTION_VERSION
			return { save: next, event }
		},

		async restoreStreakDay() {
			ensureHydrated(hydrated)
			const day = today()
			const eligibility = getRestoreEligibility({
				today: day,
				completions: current.dailyCompletionRecords,
				restoredDays: current.restoredDailyDays,
				dailyStartedDay: current.dailyStartedDay,
			})
			if (!eligibility.eligible || eligibility.missingDayKey === null) {
				return {
					ok: false,
					save: current,
					missingDayKey: eligibility.missingDayKey,
				}
			}
			const next = restoreDailyDay(current, eligibility.missingDayKey)
			await commit(next)
			return {
				ok: true,
				save: next,
				missingDayKey: eligibility.missingDayKey,
			}
		},

		async discardStaleDailyIfNeeded() {
			ensureHydrated(hydrated)
			const active = current.activeDailyGame
			if (active === null) {
				return current
			}
			const day = today()
			if (active.dayKey < day) {
				return commit(clearActiveDailyGame(current))
			}
			return current
		},
	}
}

function ensureHydrated(hydrated: boolean): void {
	if (!hydrated) {
		throw new Error('GameProgressService must hydrate() before use')
	}
}

function requirePuzzle(puzzleId: string): Puzzle {
	const puzzle = getProductionPuzzleById(puzzleId)
	if (puzzle === null) {
		throw new Error(`Puzzle unavailable: ${puzzleId}`)
	}
	return puzzle
}
