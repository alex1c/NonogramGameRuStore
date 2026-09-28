/**
 * Completion event result — UI must not re-derive before/after transitions.
 */

import type { AchievementState } from '../achievements/evaluate'

export interface CompletionEventResult {
	readonly puzzleId: string
	readonly firstCompletion: boolean
	readonly bestTimeImproved: boolean
	readonly previousBestTimeMs: number | null
	readonly newBestTimeMs: number
	readonly newlyUnlockedAchievements: readonly AchievementState[]
	/** Russian collection title when this completion finishes a collection. */
	readonly collectionJustCompletedTitle: string | null
	readonly nextCampaignPuzzleId: string | null
	readonly galleryIncluded: boolean
}
