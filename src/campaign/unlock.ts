/**
 * Campaign unlock policy (Phase 4 v1).
 *
 * - Orders 1–INITIAL_UNLOCKED_COUNT open immediately
 * - Order N unlocks when order N−1 is completed
 * - Completed and in-progress puzzles stay accessible
 * - Replay of completed is always allowed
 * - Unknown completed IDs do not break calculation
 */

import {
	INITIAL_UNLOCKED_COUNT,
	PHASE4_CAMPAIGN_ENTRIES,
	type CampaignEntry,
} from './definition'

export type LevelAccessState =
	| 'LOCKED'
	| 'AVAILABLE'
	| 'IN_PROGRESS'
	| 'COMPLETED'

export interface UnlockContext {
	readonly completedPuzzleIds: ReadonlySet<string>
	readonly activePuzzleId: string | null
}

export function buildUnlockContext(
	completedPuzzleIds: readonly string[],
	activePuzzleId: string | null,
): UnlockContext {
	return {
		completedPuzzleIds: new Set(completedPuzzleIds),
		activePuzzleId,
	}
}

function isOrderCompleted(
	entry: CampaignEntry,
	ctx: UnlockContext,
): boolean {
	return ctx.completedPuzzleIds.has(entry.puzzleId)
}

/**
 * Whether the player may open this campaign order.
 * Continue for an active game is never blocked by unlock drift.
 */
export function isLevelUnlocked(
	order: number,
	ctx: UnlockContext,
): boolean {
	const entry = PHASE4_CAMPAIGN_ENTRIES.find((item) => item.order === order)
	if (entry === undefined) {
		return false
	}
	if (isOrderCompleted(entry, ctx)) {
		return true
	}
	if (ctx.activePuzzleId === entry.puzzleId) {
		return true
	}
	if (order <= INITIAL_UNLOCKED_COUNT) {
		return true
	}
	const previous = PHASE4_CAMPAIGN_ENTRIES.find(
		(item) => item.order === order - 1,
	)
	if (previous === undefined) {
		return false
	}
	return isOrderCompleted(previous, ctx)
}

export function getLevelAccessState(
	order: number,
	ctx: UnlockContext,
): LevelAccessState {
	const entry = PHASE4_CAMPAIGN_ENTRIES.find((item) => item.order === order)
	if (entry === undefined) {
		return 'LOCKED'
	}
	if (isOrderCompleted(entry, ctx)) {
		return 'COMPLETED'
	}
	if (ctx.activePuzzleId === entry.puzzleId) {
		return 'IN_PROGRESS'
	}
	if (!isLevelUnlocked(order, ctx)) {
		return 'LOCKED'
	}
	return 'AVAILABLE'
}
