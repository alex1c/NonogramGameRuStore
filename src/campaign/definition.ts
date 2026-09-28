/**
 * Phase 4 development campaign baseline.
 *
 * IMPORTANT: these 21 productionReady mini-catalog puzzles are a temporary
 * campaign for persistence / unlock / Levels QA — NOT the final RuStore
 * content pack. Future phases may replace order and size without changing
 * stable puzzle IDs (progress stays keyed by ID).
 */

import { getProductionPuzzleById } from '../content/playable'
import type { CatalogPuzzle } from '../content/types'

export interface CampaignEntry {
	/** 1-based display order — independent of puzzle ID. */
	readonly order: number
	readonly puzzleId: string
}

/**
 * Display order for the temporary Phase 4 campaign.
 * Order can change in a later release without losing completed progress.
 */
export const PHASE4_CAMPAIGN_ENTRIES: readonly CampaignEntry[] = Object.freeze([
	{ order: 1, puzzleId: 'mini-beginner-bar' },
	{ order: 2, puzzleId: 'mini-beginner-full' },
	{ order: 3, puzzleId: 'mini-beginner-frame' },
	{ order: 4, puzzleId: 'mini-easy-block' },
	{ order: 5, puzzleId: 'mini-easy-stairs' },
	{ order: 6, puzzleId: 'mini-easy-plus' },
	{ order: 7, puzzleId: 'mini-easy-checker' },
	{ order: 8, puzzleId: 'mini-easy-weave' },
	{ order: 9, puzzleId: 'mini-medium-heart' },
	{ order: 10, puzzleId: 'mini-medium-letter-h' },
	{ order: 11, puzzleId: 'mini-medium-boat' },
	{ order: 12, puzzleId: 'mini-medium-diamond' },
	{ order: 13, puzzleId: 'mini-medium-spiral' },
	{ order: 14, puzzleId: 'mini-medium-maze' },
	{ order: 15, puzzleId: 'mini-hard-tree' },
	{ order: 16, puzzleId: 'mini-hard-bridge' },
	{ order: 17, puzzleId: 'mini-hard-arrows' },
	{ order: 18, puzzleId: 'mini-hard-window' },
	{ order: 19, puzzleId: 'mini-hard-frame-cross' },
	{ order: 20, puzzleId: 'mini-expert-scatter' },
	{ order: 21, puzzleId: 'mini-expert-lattice' },
])

/** How many leading levels are open on a fresh save. */
export const INITIAL_UNLOCKED_COUNT = 5

export function getCampaignTotal(): number {
	return PHASE4_CAMPAIGN_ENTRIES.length
}

export function getCampaignEntryByOrder(
	order: number,
): CampaignEntry | null {
	return PHASE4_CAMPAIGN_ENTRIES.find((entry) => entry.order === order) ?? null
}

export function getCampaignEntryByPuzzleId(
	puzzleId: string,
): CampaignEntry | null {
	return (
		PHASE4_CAMPAIGN_ENTRIES.find((entry) => entry.puzzleId === puzzleId) ??
		null
	)
}

export function resolveCampaignPuzzle(
	puzzleId: string,
): CatalogPuzzle | null {
	return getProductionPuzzleById(puzzleId)
}
