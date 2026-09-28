/**
 * Pure progress transitions — repository only handles I/O.
 */

import {
	serializePlayerState,
} from '../domain/nonogram/playerState'
import type { PlayerState, Puzzle } from '../domain/nonogram/types'
import { PaintTool } from '../gameplay/tools'
import { buildPuzzleContentFingerprint } from './fingerprint'
import { createDefaultSave } from './createDefaultSave'
import type { ActiveGameSave, PuzzleBestTime, SaveRoot } from './schema'
import { freezeSave } from './validate'

function withUniqueId(
	ids: readonly string[],
	id: string,
): readonly string[] {
	if (ids.includes(id)) {
		return ids
	}
	return Object.freeze([...ids, id])
}

function upsertBestTime(
	bestTimes: readonly PuzzleBestTime[],
	puzzleId: string,
	activeTimeMs: number,
): readonly PuzzleBestTime[] {
	const existing = bestTimes.find((item) => item.puzzleId === puzzleId)
	if (existing === undefined) {
		return Object.freeze([
			...bestTimes,
			Object.freeze({ puzzleId, bestActiveTimeMs: activeTimeMs }),
		])
	}
	if (activeTimeMs >= existing.bestActiveTimeMs) {
		return bestTimes
	}
	return Object.freeze(
		bestTimes.map((item) =>
			item.puzzleId === puzzleId
				? Object.freeze({ puzzleId, bestActiveTimeMs: activeTimeMs })
				: item,
		),
	)
}

export function createActiveGameSave(input: {
	readonly puzzle: Puzzle
	readonly player: PlayerState
	readonly accumulatedActiveMs: number
	readonly startedAtMs: number
	readonly savedAtMs: number
	readonly tool: PaintTool
	readonly restartCountThisRun: number
}): ActiveGameSave {
	return Object.freeze({
		puzzleId: input.puzzle.id,
		contentFingerprint: buildPuzzleContentFingerprint(input.puzzle),
		player: serializePlayerState(input.player),
		accumulatedActiveMs: Math.max(0, input.accumulatedActiveMs),
		startedAtMs: input.startedAtMs,
		savedAtMs: input.savedAtMs,
		tool: input.tool,
		restartCountThisRun: Math.max(0, input.restartCountThisRun),
	})
}

/** Mark a puzzle as started (unique set semantics). */
export function markPuzzleStarted(save: SaveRoot, puzzleId: string): SaveRoot {
	return freezeSave({
		...save,
		startedPuzzleIds: withUniqueId(save.startedPuzzleIds, puzzleId),
	})
}

/** Replace or clear the single active unfinished party. */
export function setActiveGame(
	save: SaveRoot,
	activeGame: ActiveGameSave | null,
): SaveRoot {
	return freezeSave({
		...save,
		activeGame,
	})
}

export function persistActivePlayerState(
	save: SaveRoot,
	input: {
		readonly puzzle: Puzzle
		readonly player: PlayerState
		readonly accumulatedActiveMs: number
		readonly tool: PaintTool
		readonly savedAtMs: number
		readonly restartCountThisRun: number
	},
): SaveRoot {
	const startedAtMs = save.activeGame?.startedAtMs ?? input.savedAtMs
	const active = createActiveGameSave({
		puzzle: input.puzzle,
		player: input.player,
		accumulatedActiveMs: input.accumulatedActiveMs,
		startedAtMs,
		savedAtMs: input.savedAtMs,
		tool: input.tool,
		restartCountThisRun: input.restartCountThisRun,
	})
	return freezeSave({
		...save,
		activeGame: active,
		startedPuzzleIds: withUniqueId(save.startedPuzzleIds, input.puzzle.id),
	})
}

/**
 * Atomic completion: stats + completed IDs + best time + clear active game.
 * Must be one root-object transition before a single repository save.
 */
export function completePuzzle(
	save: SaveRoot,
	input: {
		readonly puzzleId: string
		readonly activeTimeMs: number
	},
): SaveRoot {
	return freezeSave({
		...save,
		activeGame: null,
		completedPuzzleIds: withUniqueId(save.completedPuzzleIds, input.puzzleId),
		startedPuzzleIds: withUniqueId(save.startedPuzzleIds, input.puzzleId),
		bestTimes: upsertBestTime(
			save.bestTimes,
			input.puzzleId,
			input.activeTimeMs,
		),
		statistics: Object.freeze({
			...save.statistics,
			totalCompletions: save.statistics.totalCompletions + 1,
			totalActiveSolveTimeMs:
				save.statistics.totalActiveSolveTimeMs +
				Math.max(0, input.activeTimeMs),
		}),
	})
}

export function recordUndoAction(save: SaveRoot): SaveRoot {
	return freezeSave({
		...save,
		statistics: Object.freeze({
			...save.statistics,
			totalUndoActions: save.statistics.totalUndoActions + 1,
		}),
	})
}

export function recordRedoAction(save: SaveRoot): SaveRoot {
	return freezeSave({
		...save,
		statistics: Object.freeze({
			...save.statistics,
			totalRedoActions: save.statistics.totalRedoActions + 1,
		}),
	})
}

/** User-confirmed "Начать заново" only. */
export function recordRestart(save: SaveRoot): SaveRoot {
	const active = save.activeGame
	return freezeSave({
		...save,
		activeGame:
			active === null
				? null
				: Object.freeze({
						...active,
						restartCountThisRun: active.restartCountThisRun + 1,
					}),
		statistics: Object.freeze({
			...save.statistics,
			totalRestarts: save.statistics.totalRestarts + 1,
		}),
	})
}

export function clearActiveGame(save: SaveRoot): SaveRoot {
	return freezeSave({
		...save,
		activeGame: null,
	})
}

export function resetProgress(): SaveRoot {
	return createDefaultSave()
}
