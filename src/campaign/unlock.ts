/**
 * Campaign unlock policy (Phase 8D).
 *
 * - Set 1 unlocked immediately
 * - Set N+1 unlocks when Set N has ≥ SET_UNLOCK_AFTER_COMPLETIONS completions
 * - Within an unlocked set: first slot open; subsequent unlock when previous
 *   in-set slot is completed (Set 1 also opens first INITIAL_UNLOCKED_COUNT)
 * - Active / completed puzzles stay accessible
 * - Unknown completed IDs do not break calculation
 */

import {
	CAMPAIGN_ENTRIES,
	CAMPAIGN_SETS,
	INITIAL_UNLOCKED_COUNT,
	SET_UNLOCK_AFTER_COMPLETIONS,
	type CampaignEntry,
	type CampaignSetDef,
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

export function countCompletedInSet(
	set: CampaignSetDef,
	ctx: UnlockContext,
): number {
	let n = 0
	for (const id of set.puzzleIds) {
		if (ctx.completedPuzzleIds.has(id)) {
			n += 1
		}
	}
	return n
}

export function isSetUnlocked(
	setDisplayOrder: number,
	ctx: UnlockContext,
): boolean {
	if (setDisplayOrder <= 1) {
		return true
	}
	const previous = CAMPAIGN_SETS.find(
		(s) => s.displayOrder === setDisplayOrder - 1,
	)
	if (previous === undefined) {
		return false
	}
	return countCompletedInSet(previous, ctx) >= SET_UNLOCK_AFTER_COMPLETIONS
}

function isOrderCompleted(
	entry: CampaignEntry,
	ctx: UnlockContext,
): boolean {
	return ctx.completedPuzzleIds.has(entry.puzzleId)
}

/**
 * Whether the player may open this campaign display order.
 */
export function isLevelUnlocked(
	order: number,
	ctx: UnlockContext,
): boolean {
	const entry = CAMPAIGN_ENTRIES.find((item) => item.order === order)
	if (entry === undefined) {
		return false
	}
	if (isOrderCompleted(entry, ctx)) {
		return true
	}
	if (ctx.activePuzzleId === entry.puzzleId) {
		return true
	}
	if (!isSetUnlocked(entry.setDisplayOrder, ctx)) {
		return false
	}
	// Soft onboarding: first N of Set 1.
	if (
		entry.setDisplayOrder === 1 &&
		entry.setSlot <= INITIAL_UNLOCKED_COUNT
	) {
		return true
	}
	// First slot of any unlocked set.
	if (entry.setSlot === 1) {
		return true
	}
	const previousInSet = CAMPAIGN_ENTRIES.find(
		(item) =>
			item.setId === entry.setId && item.setSlot === entry.setSlot - 1,
	)
	if (previousInSet === undefined) {
		return false
	}
	return isOrderCompleted(previousInSet, ctx)
}

export function getLevelAccessState(
	order: number,
	ctx: UnlockContext,
): LevelAccessState {
	const entry = CAMPAIGN_ENTRIES.find((item) => item.order === order)
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
