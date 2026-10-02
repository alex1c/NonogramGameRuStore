/**
 * Versioned save schema.
 * Phase 4–5: v1. Phase 6: v2 (Daily). Phase 7: v3 (Hints).
 * Phase 8B: v4 (sticky unlockedAchievementIds).
 * Phase 9: v5 (tutorial completion version).
 * Phase 9.1: v6 (daily Hint / Teach Me free allowances + rewarded pending).
 * Phase 9C: v7 (tutorialFirstRunSkipped — persisted first-run skip).
 * Persist IDs + player progress — never solution/clues/catalog blobs.
 *
 * Storage key remains `nonogram.save.v1` (historical suffix); schemaVersion
 * inside the document is authoritative.
 */

import type { SerializedPlayerState } from '../domain/nonogram/types'
import type { PaintTool } from '../gameplay/tools'
import type { DayKey } from '../daily/dateUtils'

/** Single source of truth for the current save schema version. */
export const CURRENT_SAVE_SCHEMA_VERSION = 7 as const

export type SaveSchemaVersion = typeof CURRENT_SAVE_SCHEMA_VERSION

/** Current shipped tutorial content version (persist when completed). */
export const CURRENT_TUTORIAL_VERSION = 1 as const

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
	/** Logical help uses this run (Hint/Teach/contradiction diagnostics). */
	readonly hintsUsedThisRun: number
}

/** Unfinished Daily party — coexists with Campaign activeGame. */
export interface ActiveDailyGameSave {
	readonly dayKey: DayKey
	readonly puzzleId: string
	readonly selectionVersion: string
	readonly contentFingerprint: string
	readonly player: SerializedPlayerState
	readonly accumulatedActiveMs: number
	readonly startedAtMs: number
	readonly savedAtMs: number
	readonly tool: PaintTool
	readonly restartCountThisRun: number
	readonly hintsUsedThisRun: number
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
	/** User requested Hint or Teach Me and received STEP/CONTRADICTION/STALLED. */
	readonly hintRequests: number
	/** User pressed Apply on a logical HintStep. */
	readonly hintsApplied: number
	/** Successful Teach Me STEP explanation opened. */
	readonly teachMeViews: number
}

/** Historical Daily completion — stores puzzleId for future selector changes. */
export interface DailyCompletionRecordSave {
	readonly dayKey: DayKey
	readonly puzzleId: string
	readonly selectionVersion: string
	readonly activeTimeMs: number
}

/**
 * Root persisted document (schema v7).
 *
 * Semantics:
 * - completedPuzzleIds = Campaign completions only
 * - solvedPuzzleIds = unique puzzles solved in any mode (Gallery unlock source)
 * - dailyCompletionRecords = actual Daily calendar completions
 * - restoredDailyDays = streak bridges (not puzzle solves)
 * - dailyStartedDay = user participation start (null until first Daily screen open)
 * - activeGame = Campaign unfinished party (+ hintsUsedThisRun)
 * - activeDailyGame = Daily unfinished party (+ hintsUsedThisRun)
 * - statistics.hintRequests / hintsApplied / teachMeViews = global help counters
 * - unlockedAchievementIds = sticky unlocked achievement history (never shrinks)
 * - tutorialVersionCompleted = last fully completed tutorial version (null = never)
 * - tutorialOfferDismissed = user chose «Позже» on soft Home offer
 * - tutorialFirstRunSkipped = user skipped / exited the first-run tutorial
 *   (persisted so first_run does not reopen on every cold start)
 * - helpAllowance* = local-day free Hint/Teach Me quotas + pending rewarded entitlements
 */
export interface SaveRoot {
	readonly schemaVersion: SaveSchemaVersion
	readonly activeGame: ActiveGameSave | null
	readonly activeDailyGame: ActiveDailyGameSave | null
	readonly completedPuzzleIds: readonly string[]
	readonly solvedPuzzleIds: readonly string[]
	readonly startedPuzzleIds: readonly string[]
	readonly bestTimes: readonly PuzzleBestTime[]
	readonly statistics: ProgressStatistics
	readonly dailyCompletionRecords: readonly DailyCompletionRecordSave[]
	readonly restoredDailyDays: readonly DayKey[]
	readonly dailyStartedDay: DayKey | null
	/** Authoritative sticky achievement unlock history. */
	readonly unlockedAchievementIds: readonly string[]
	/**
	 * Tutorial version last completed (e.g. 1). Null means not completed.
	 * Replay does not clear this; completing again updates to current version.
	 */
	readonly tutorialVersionCompleted: number | null
	/** Soft Home offer dismissed («Позже») — does not block Settings replay. */
	readonly tutorialOfferDismissed: boolean
	/**
	 * User skipped or exited the first-run tutorial before completing it.
	 * Suppresses first-run auto-open only; Settings replay always works.
	 */
	readonly tutorialFirstRunSkipped: boolean
	/** Local calendar day for free help counters (YYYY-MM-DD). */
	readonly helpAllowanceDay: DayKey
	/** Free successful Hint Applies used on helpAllowanceDay. */
	readonly freeHintsUsedToday: number
	/** Free Teach Me STEP explanations shown on helpAllowanceDay. */
	readonly freeTeachMeUsedToday: number
	/** Pending rewarded Hint entitlements (0 or 1). */
	readonly pendingRewardedHints: number
	/** Pending rewarded Teach Me entitlements (0 or 1). */
	readonly pendingRewardedTeachMe: number
}

export type HydrationStatus =
	| 'LOADING'
	| 'READY'
	| 'ERROR_RECOVERED'
	/** Storage read failed: in-memory default only, persistent writes blocked. */
	| 'ERROR_IO_READ'
	/** Save written by a newer app: in-memory default only, writes blocked. */
	| 'ERROR_UNSUPPORTED_SCHEMA'

export interface HydrationResult {
	readonly status: Exclude<HydrationStatus, 'LOADING'>
	readonly save: SaveRoot
	readonly reason?: string
}
