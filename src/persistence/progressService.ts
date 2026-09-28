/**
 * GameProgressService — hydrate / mutate / persist orchestration.
 * UI talks to this layer; never to storage keys or AsyncStorage.
 */

import {
	createEmptyPlayerState,
	deserializePlayerState,
} from '../domain/nonogram/playerState'
import type { PlayerState, Puzzle } from '../domain/nonogram/types'
import { getProductionPuzzleById } from '../content/playable'
import { PaintTool } from '../gameplay/tools'
import type { Clock } from './clock'
import { createRealClock } from './clock'
import type { SaveRepository } from './repository'
import type { HydrationStatus, SaveRoot } from './schema'
import { createDefaultSave } from './createDefaultSave'
import { sanitizeSaveAgainstCatalog } from './sanitize'
import type { CompletionEventResult } from './completionResult'
import { findNextCampaignPuzzleId } from './nextCampaign'
import {
	completePuzzle,
	createActiveGameSave,
	markPuzzleStarted,
	persistActivePlayerState,
	recordRedoAction,
	recordRestart,
	recordUndoAction,
	resetProgress,
	setActiveGame,
} from './progressReducers'
import {
	contextFromSave,
	evaluateAchievements,
	getNewlyUnlockedAchievements,
} from '../achievements/evaluate'
import { collectionJustCompleted } from '../gallery/viewModel'
import { getGalleryItemDef } from '../gallery/definitions'

export interface PersistGameSnapshotInput {
	readonly puzzle: Puzzle
	readonly player: PlayerState
	readonly accumulatedActiveMs: number
	readonly tool: PaintTool
	readonly restartCountThisRun: number
}

export interface GameProgressService {
	hydrate(): Promise<{ status: HydrationStatus; save: SaveRoot; reason?: string }>
	getSave(): SaveRoot
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
	}): Promise<{ readonly save: SaveRoot; readonly event: CompletionEventResult }>
	replaceActivePuzzle(puzzleId: string): Promise<SaveRoot>
	recordUndo(): Promise<SaveRoot>
	recordRedo(): Promise<SaveRoot>
	flush(): Promise<void>
	resetProgressDevOnly(): Promise<SaveRoot>
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

	return {
		async hydrate() {
			const loaded = await repository.load()
			let status: HydrationStatus = 'READY'
			let reason: string | undefined

			if (loaded.kind === 'recovered' || loaded.kind === 'unsupported') {
				status = 'ERROR_RECOVERED'
				reason = loaded.reason
			}

			const sanitized = sanitizeSaveAgainstCatalog(loaded.save)
			if (sanitized.clearedActiveGame) {
				status = status === 'READY' ? 'ERROR_RECOVERED' : status
				reason = sanitized.reason ?? reason
				current = sanitized.save
				await repository.save(current)
			} else {
				current = sanitized.save
				// Persist recovered defaults so the next launch is clean.
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
				restartCountThisRun:
					(next.activeGame?.restartCountThisRun ?? 0),
			})
			next = setActiveGame(next, active)
			return commit(next)
		},

		async completePuzzle(input) {
			ensureHydrated(hydrated)
			const beforeSave = current
			const beforeAchievements = evaluateAchievements(
				contextFromSave(beforeSave),
			)
			const firstCompletion = !beforeSave.completedPuzzleIds.includes(
				input.puzzleId,
			)
			const previousBest =
				beforeSave.bestTimes.find(
					(item) => item.puzzleId === input.puzzleId,
				)?.bestActiveTimeMs ?? null

			const next = completePuzzle(beforeSave, input)
			await commit(next)

			const afterAchievements = evaluateAchievements(contextFromSave(next))
			const newlyUnlocked = getNewlyUnlockedAchievements(
				beforeAchievements,
				afterAchievements,
			)
			const newBest =
				next.bestTimes.find((item) => item.puzzleId === input.puzzleId)
					?.bestActiveTimeMs ?? input.activeTimeMs
			const bestTimeImproved =
				previousBest === null || newBest < previousBest

			const event: CompletionEventResult = {
				puzzleId: input.puzzleId,
				firstCompletion,
				bestTimeImproved,
				previousBestTimeMs: previousBest,
				newBestTimeMs: newBest,
				newlyUnlockedAchievements: newlyUnlocked,
				collectionJustCompletedTitle: collectionJustCompleted(
					beforeSave.completedPuzzleIds,
					next.completedPuzzleIds,
					input.puzzleId,
				),
				nextCampaignPuzzleId: findNextCampaignPuzzleId(
					next,
					input.puzzleId,
				),
				galleryIncluded: getGalleryItemDef(input.puzzleId) !== null,
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

		async flush() {
			ensureHydrated(hydrated)
			await repository.save(current)
		},

		async resetProgressDevOnly() {
			ensureHydrated(hydrated)
			return commit(resetProgress())
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
