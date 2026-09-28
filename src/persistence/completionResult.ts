/**
 * Completion event results — UI must not re-derive before/after transitions.
 */

import type { AchievementState } from '../achievements/evaluate'
import type { DayKey } from '../daily/dateUtils'

/** Campaign / Replay completion event. */
export interface CompletionEventResult {
	readonly mode: 'CAMPAIGN' | 'REPLAY'
	readonly puzzleId: string
	readonly firstCompletion: boolean
	readonly firstPuzzleSolve: boolean
	readonly galleryJustUnlocked: boolean
	readonly bestTimeImproved: boolean
	readonly previousBestTimeMs: number | null
	readonly newBestTimeMs: number
	readonly newlyUnlockedAchievements: readonly AchievementState[]
	/** Russian collection title when this completion finishes a collection. */
	readonly collectionJustCompletedTitle: string | null
	readonly nextCampaignPuzzleId: string | null
	readonly galleryIncluded: boolean
}

/** Daily completion event. */
export interface DailyCompletionEventResult {
	readonly mode: 'DAILY'
	readonly dayKey: DayKey
	readonly puzzleId: string
	readonly firstDailyCompletion: boolean
	readonly firstPuzzleSolve: boolean
	readonly galleryJustUnlocked: boolean
	readonly newlyUnlockedAchievements: readonly AchievementState[]
	readonly collectionJustCompletedTitle: string | null
	readonly streakBefore: number
	readonly streakAfter: number
	readonly streakExtended: boolean
	readonly galleryIncluded: boolean
	readonly activeTimeMs: number
	/** Restore may be offered later from Daily screen — not forced here. */
	readonly restoreEligible: boolean
	readonly restoreMissingDayKey: DayKey | null
}
