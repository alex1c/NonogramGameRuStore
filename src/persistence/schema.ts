/**
 * Versioned save schema (Phase 4).
 * Persist only IDs + player progress — never solution/clues/catalog blobs.
 */

import type { SerializedPlayerState } from '../domain/nonogram/types'
import type { PaintTool } from '../gameplay/tools'

/** Single source of truth for the current save schema version. */
export const CURRENT_SAVE_SCHEMA_VERSION = 1 as const

export type SaveSchemaVersion = typeof CURRENT_SAVE_SCHEMA_VERSION

/** Persisted unfinished party — no Skia / gesture / undo history. */
export interface ActiveGameSave {
	readonly puzzleId: string
	/** Deterministic content fingerprint at save time. */
	readonly contentFingerprint: string
	readonly player: SerializedPlayerState
	/** Accumulated active solve time (excludes background / away). */
	readonly accumulatedActiveMs: number
	readonly startedAtMs: number
	readonly savedAtMs: number
	readonly tool: PaintTool
	/**
	 * Restarts confirmed by the user during this run.
	 * Used only for optional no-restart completion metric (deferred if unused).
	 */
	readonly restartCountThisRun: number
}

export interface PuzzleBestTime {
	readonly puzzleId: string
	readonly bestActiveTimeMs: number
}

export interface ProgressStatistics {
	readonly totalCompletions: number
	readonly totalActiveSolveTimeMs: number
	readonly totalRestarts: number
	readonly totalUndoActions: number
	readonly totalRedoActions: number
}

/**
 * Root persisted document.
 * Keep derived counts out of storage — compute from ID sets + catalog.
 */
export interface SaveRoot {
	readonly schemaVersion: SaveSchemaVersion
	readonly activeGame: ActiveGameSave | null
	readonly completedPuzzleIds: readonly string[]
	readonly startedPuzzleIds: readonly string[]
	readonly bestTimes: readonly PuzzleBestTime[]
	readonly statistics: ProgressStatistics
}

export type HydrationStatus =
	| 'LOADING'
	| 'READY'
	| 'ERROR_RECOVERED'

export interface HydrationResult {
	readonly status: Exclude<HydrationStatus, 'LOADING'>
	readonly save: SaveRoot
	readonly reason?: string
}
