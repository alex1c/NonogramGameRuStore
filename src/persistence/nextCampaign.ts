/**
 * Next campaign puzzle after a completion (campaign order, not collection).
 */

import {
	getCampaignEntryByPuzzleId,
	PHASE4_CAMPAIGN_ENTRIES,
} from '../campaign/definition'
import {
	buildUnlockContext,
	isLevelUnlocked,
} from '../campaign/unlock'
import type { SaveRoot } from './schema'

export function findNextCampaignPuzzleId(
	save: SaveRoot,
	justCompletedPuzzleId: string,
): string | null {
	const entry = getCampaignEntryByPuzzleId(justCompletedPuzzleId)
	if (entry === null) {
		// Fallback: first unlocked incomplete campaign puzzle
		return firstPlayableIncomplete(save)
	}
	const next = PHASE4_CAMPAIGN_ENTRIES.find(
		(item) => item.order === entry.order + 1,
	)
	if (next === undefined) {
		return null
	}
	const ctx = buildUnlockContext(
		save.completedPuzzleIds,
		save.activeGame?.puzzleId ?? null,
	)
	if (!isLevelUnlocked(next.order, ctx)) {
		return null
	}
	return next.puzzleId
}

function firstPlayableIncomplete(save: SaveRoot): string | null {
	const completed = new Set(save.completedPuzzleIds)
	const ctx = buildUnlockContext(
		save.completedPuzzleIds,
		save.activeGame?.puzzleId ?? null,
	)
	for (const entry of PHASE4_CAMPAIGN_ENTRIES) {
		if (completed.has(entry.puzzleId)) {
			continue
		}
		if (isLevelUnlocked(entry.order, ctx)) {
			return entry.puzzleId
		}
	}
	return null
}
