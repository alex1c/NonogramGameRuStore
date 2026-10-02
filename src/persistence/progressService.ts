/**
 * GameProgressService — hydrate / mutate / persist orchestration.
 * Single root authority for Campaign + Daily (no competing repositories).
 */

import {
	createEmptyPlayerState,
	deserializePlayerState,
} from '../domain/nonogram/playerState'
import type { PlayerState, Puzzle } from '../domain/nonogram/types'
import { getProductionPuzzleById, resolvePlayablePuzzleById } from '../content/playable'
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
import { DailyRolloverError } from '../daily/rollover'
import type { Clock } from './clock'
import { createRealClock } from './clock'
import type { SaveRepository } from './repository'
import type { HydrationStatus, SaveRoot } from './schema'
import { createDefaultSave } from './createDefaultSave'
import {
	PersistenceBlockedError,
	type PersistenceHealth,
} from './persistenceHealth'
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
	markTutorialCompleted as markTutorialCompletedReducer,
	dismissTutorialOffer as dismissTutorialOfferReducer,
	markTutorialFirstRunSkipped as markTutorialFirstRunSkippedReducer,
	resetTutorialProgressDevOnly as resetTutorialProgressDevOnlyReducer,
	ensureHelpAllowanceDay as ensureHelpAllowanceDayReducer,
	consumeHintApplyAllowance as consumeHintApplyAllowanceReducer,
	consumeTeachMeRevealAllowance as consumeTeachMeRevealAllowanceReducer,
	grantRewardedHintAllowance as grantRewardedHintAllowanceReducer,
	grantRewardedTeachMeAllowance as grantRewardedTeachMeAllowanceReducer,
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
	/** Explicit durable-write readiness (N1). READY means commits may succeed. */
	getPersistenceHealth(): PersistenceHealth
	isWritable(): boolean
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
	markTutorialCompleted(tutorialVersion: number): Promise<SaveRoot>
	dismissTutorialOffer(): Promise<SaveRoot>
	markTutorialFirstRunSkipped(): Promise<SaveRoot>
	resetTutorialProgressDevOnly(): Promise<SaveRoot>
	ensureHelpAllowanceDay(): Promise<SaveRoot>
	/**
	 * Synchronous gate (H3): true when Hint Apply may draw from free or pending
	 * rewarded Hint allowance right now (today's roll applied, no I/O).
	 */
	canConsumeHintApplyAllowance(): boolean
	/**
	 * Consume one Hint Apply allowance. The in-memory save mutates
	 * synchronously when the call is made; only persistence is async.
	 */
	consumeHintApplyAllowance(): Promise<SaveRoot | null>
	consumeTeachMeRevealAllowance(): Promise<SaveRoot | null>
	/**
	 * Atomically acquire one Teach Me reveal entitlement (H3).
	 * Concurrent callers: at most one `granted` per overlapping window.
	 * Does not reveal UI — caller must verify run/revision after GRANTED.
	 */
	tryAcquireTeachMeReveal(): Promise<'granted' | 'denied'>
	grantRewardedHintAllowance(): Promise<SaveRoot>
	grantRewardedTeachMeAllowance(): Promise<SaveRoot>

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
	/**
	 * True when the stored payload could not be classified as safe to replace
	 * (storage read failed, newer schema, or corrupt payload that could not be
	 * backed up). While set, durable mutations REJECT — never report success
	 * for a memory-only fake save (N1).
	 * Cleared by the next successful hydrate() that restores READY.
	 */
	let writesBlocked = false
	let persistenceHealth: PersistenceHealth = 'READY'
	/** Sync lock so concurrent Teach Me reveals cannot both consume (H3). */
	let teachMeRevealInFlight = false
	/**
	 * Serializes durable mutations so concurrent completePuzzle / commit calls
	 * cannot both read the same pre-commit `current` and double-apply (H6).
	 */
	let mutationChain: Promise<void> = Promise.resolve()
	let mutationDepth = 0

	const runExclusive = async <T,>(fn: () => Promise<T>): Promise<T> => {
		const run = async (): Promise<T> => {
			mutationDepth += 1
			try {
				return await fn()
			} finally {
				mutationDepth -= 1
			}
		}
		const result = mutationChain.then(run, run)
		mutationChain = result.then(
			() => undefined,
			() => undefined,
		)
		return result
	}

	const assertWritable = (): void => {
		if (writesBlocked) {
			throw new PersistenceBlockedError(
				persistenceHealth === 'READY'
					? 'WRITE_ERROR'
					: persistenceHealth,
			)
		}
	}

	/**
	 * Durable commit: write first, then publish in-memory.
	 * On write failure memory is unchanged and the caller sees rejection (N1/M4).
	 * Nested calls from an already-exclusive mutation skip re-queueing.
	 */
	const commitUnlocked = async (next: SaveRoot): Promise<SaveRoot> => {
		assertWritable()
		try {
			await repository.save(next)
		} catch (error) {
			throw error instanceof Error
				? error
				: new Error('Storage write failed')
		}
		current = next
		return current
	}

	const commit = async (next: SaveRoot): Promise<SaveRoot> => {
		if (mutationDepth > 0) {
			return commitUnlocked(next)
		}
		return runExclusive(() => commitUnlocked(next))
	}

	const today = (): DayKey => localDayKey(new Date(clock.now()))

	/**
	 * Rejects Daily mutations once the local day has rolled over.
	 * Both the caller's session day and any stored active Daily must still be
	 * "today"; otherwise progress would be credited to the wrong day/streak.
	 */
	const assertDailyDayIsToday = (sessionDayKey: DayKey): void => {
		const day = today()
		if (sessionDayKey !== day) {
			throw new DailyRolloverError(sessionDayKey, day)
		}
		const active = current.activeDailyGame
		if (active !== null && active.dayKey !== day) {
			throw new DailyRolloverError(active.dayKey, day)
		}
	}

	return {
		async hydrate() {
			writesBlocked = false
			persistenceHealth = 'READY'
			const loaded = await repository.load()
			let status: HydrationStatus = 'READY'
			let reason: string | undefined

			// IO / future-schema: never overwrite durable storage (H1).
			if (loaded.kind === 'io_error' || loaded.kind === 'unsupported') {
				writesBlocked = true
				persistenceHealth =
					loaded.kind === 'io_error'
						? 'READ_ERROR'
						: 'UNSUPPORTED_SCHEMA'
				hydrated = true
				current = loaded.save
				// In-memory default only; durable storage stays untouched.
				return {
					status:
						loaded.kind === 'io_error'
							? 'ERROR_IO_READ'
							: 'ERROR_UNSUPPORTED_SCHEMA',
					save: current,
					reason: loaded.reason,
				}
			}

			if (loaded.kind === 'recovered') {
				status = 'ERROR_RECOVERED'
				reason = loaded.reason
				if (loaded.rawPayload !== undefined) {
					try {
						await repository.backupCorruptPayload(
							loaded.rawPayload,
							clock.now(),
						)
					} catch {
						// Backup failed — do not overwrite the only evidence.
						writesBlocked = true
						persistenceHealth = 'CORRUPT_RECOVERY_BLOCKED'
						hydrated = true
						current = loaded.save
						return { status, save: current, reason }
					}
				} else {
					// No raw evidence available — still avoid blind overwrite.
					writesBlocked = true
					persistenceHealth = 'CORRUPT_RECOVERY_BLOCKED'
					hydrated = true
					current = loaded.save
					return { status, save: current, reason }
				}
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
				if (loaded.kind === 'empty' || loaded.kind === 'recovered') {
					await repository.save(current)
				} else if (loaded.kind === 'ok' && loaded.migrated) {
					await repository.save(current)
				}
			}

			const rolled = ensureHelpAllowanceDayReducer(current, today())
			if (rolled !== current) {
				current = rolled
				await repository.save(current)
			}

			hydrated = true
			persistenceHealth = 'READY'
			writesBlocked = false
			return { status, save: current, reason }
		},

		getSave(): SaveRoot {
			return current
		},

		getPersistenceHealth(): PersistenceHealth {
			return persistenceHealth
		},

		isWritable(): boolean {
			return (
				hydrated &&
				!writesBlocked &&
				persistenceHealth === 'READY'
			)
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
			const puzzle = resolvePlayablePuzzleById(active.puzzleId)
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
			return runExclusive(async () => {
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

				const progressed = completePuzzle(beforeSave, {
					puzzleId: input.puzzleId,
					activeTimeMs: input.activeTimeMs,
					isReplay: input.isReplay === true,
				})
				const { save: next, newlyUnlocked } =
					withStickyAchievementTransition(beforeSave, progressed, day)
				await commit(next)

				const nextBest =
					next.bestTimes.find((item) => item.puzzleId === input.puzzleId)
						?.bestActiveTimeMs ?? null
				const newBest = nextBest ?? input.activeTimeMs
				const bestTimeImproved =
					nextBest !== null &&
					(previousBest === null || nextBest < previousBest)
				const galleryIncluded =
					getGalleryItemDef(input.puzzleId) !== null

				const event: CompletionEventResult = {
					mode: input.isReplay ? 'REPLAY' : 'CAMPAIGN',
					puzzleId: input.puzzleId,
					firstCompletion: input.isReplay ? false : firstCompletion,
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
			})
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
			assertWritable()
			await repository.save(current)
		},

		async resetProgressDevOnly() {
			ensureHydrated(hydrated)
			return commit(resetProgress())
		},

		async markTutorialCompleted(tutorialVersion) {
			ensureHydrated(hydrated)
			return commit(markTutorialCompletedReducer(current, tutorialVersion))
		},

		async dismissTutorialOffer() {
			ensureHydrated(hydrated)
			return commit(dismissTutorialOfferReducer(current))
		},

		async markTutorialFirstRunSkipped() {
			ensureHydrated(hydrated)
			return commit(markTutorialFirstRunSkippedReducer(current))
		},

		async resetTutorialProgressDevOnly() {
			ensureHydrated(hydrated)
			return commit(resetTutorialProgressDevOnlyReducer(current))
		},

		async ensureHelpAllowanceDay() {
			ensureHydrated(hydrated)
			const next = ensureHelpAllowanceDayReducer(current, today())
			if (next === current) {
				return current
			}
			return commit(next)
		},

		canConsumeHintApplyAllowance() {
			ensureHydrated(hydrated)
			return (
				consumeHintApplyAllowanceReducer(current, today()) !== null
			)
		},

		async consumeHintApplyAllowance() {
			return runExclusive(async () => {
				ensureHydrated(hydrated)
				const next = consumeHintApplyAllowanceReducer(current, today())
				if (next === null) {
					return null
				}
				return commit(next)
			})
		},

		async consumeTeachMeRevealAllowance() {
			return runExclusive(async () => {
				ensureHydrated(hydrated)
				const next = consumeTeachMeRevealAllowanceReducer(
					current,
					today(),
				)
				if (next === null) {
					return null
				}
				return commit(next)
			})
		},

		async tryAcquireTeachMeReveal() {
			return runExclusive(async () => {
				ensureHydrated(hydrated)
				assertWritable()
				if (teachMeRevealInFlight) {
					return 'denied'
				}
				teachMeRevealInFlight = true
				try {
					const next = consumeTeachMeRevealAllowanceReducer(
						current,
						today(),
					)
					if (next === null) {
						return 'denied'
					}
					await commit(next)
					return 'granted'
				} finally {
					teachMeRevealInFlight = false
				}
			})
		},

		async grantRewardedHintAllowance() {
			ensureHydrated(hydrated)
			return commit(grantRewardedHintAllowanceReducer(current, today()))
		},

		async grantRewardedTeachMeAllowance() {
			ensureHydrated(hydrated)
			return commit(grantRewardedTeachMeAllowanceReducer(current, today()))
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
			const puzzle = resolvePlayablePuzzleById(active.puzzleId)
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
			assertDailyDayIsToday(input.dayKey)
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
			assertDailyDayIsToday(input.dayKey)
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
			return runExclusive(async () => {
				ensureHydrated(hydrated)
				assertDailyDayIsToday(input.dayKey)
				const beforeSave = current
				const day = today()
				const streakBefore = computeCurrentStreak({
					today: day,
					completions: beforeSave.dailyCompletionRecords,
					restoredDays: beforeSave.restoredDailyDays,
					dailyStartedDay: beforeSave.dailyStartedDay,
				})
				const firstDailyCompletion =
					!beforeSave.dailyCompletionRecords.some(
						(r) => r.dayKey === input.dayKey,
					)
				const firstPuzzleSolve = !beforeSave.solvedPuzzleIds.includes(
					input.puzzleId,
				)
				const galleryIncluded =
					getGalleryItemDef(input.puzzleId) !== null

				const progressed = completeDaily(beforeSave, input)
				const { save: next, newlyUnlocked } =
					withStickyAchievementTransition(beforeSave, progressed, day)
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
			})
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
