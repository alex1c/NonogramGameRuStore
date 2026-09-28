/**
 * Deterministic default save factory — no mutable singleton.
 */

import {
	CURRENT_SAVE_SCHEMA_VERSION,
	type ProgressStatistics,
	type SaveRoot,
} from './schema'

export function createEmptyStatistics(): ProgressStatistics {
	return Object.freeze({
		totalCompletions: 0,
		totalActiveSolveTimeMs: 0,
		totalRestarts: 0,
		totalUndoActions: 0,
		totalRedoActions: 0,
	})
}

/** Pure deterministic default save (no wall-clock fields). */
export function createDefaultSave(): SaveRoot {
	return Object.freeze({
		schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
		activeGame: null,
		completedPuzzleIds: Object.freeze([] as string[]),
		startedPuzzleIds: Object.freeze([] as string[]),
		bestTimes: Object.freeze([] as SaveRoot['bestTimes']),
		statistics: createEmptyStatistics(),
	})
}
