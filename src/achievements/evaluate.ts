/**
 * Pure achievement evaluator — no AsyncStorage, no React.
 */

import { analyzeDifficulty } from '../domain/difficulty/analyzer'
import type { DifficultyTier } from '../domain/difficulty/tiers'
import { getProductionPuzzleById } from '../content/playable'
import { GALLERY_ITEMS } from '../gallery/definitions'
import type { SaveRoot } from '../persistence/schema'
import {
	ACHIEVEMENT_DEFINITIONS,
	type AchievementDefinition,
	type AchievementIconKey,
} from './definitions'

export type AchievementAccess = 'LOCKED' | 'UNLOCKED'

export interface AchievementState {
	readonly id: string
	readonly titleRu: string
	readonly descriptionRu: string
	readonly displayOrder: number
	readonly iconKey: AchievementIconKey
	readonly access: AchievementAccess
	readonly current: number
	readonly target: number
	readonly progressLabel: string
}

export interface AchievementEvalContext {
	readonly completedPuzzleIds: readonly string[]
	readonly totalCompletions: number
}

/** Build eval context from a save snapshot (before or after mutation). */
export function contextFromSave(save: SaveRoot): AchievementEvalContext {
	return {
		completedPuzzleIds: save.completedPuzzleIds,
		totalCompletions: save.statistics.totalCompletions,
	}
}

const tierCache = new Map<string, DifficultyTier | 'UNRATED'>()

function tierFor(puzzleId: string): DifficultyTier | 'UNRATED' {
	const hit = tierCache.get(puzzleId)
	if (hit !== undefined) {
		return hit
	}
	const puzzle = getProductionPuzzleById(puzzleId)
	const tier = puzzle === null ? 'UNRATED' : analyzeDifficulty(puzzle).tier
	tierCache.set(puzzleId, tier)
	return tier
}

function countDifficulty(
	completedIds: readonly string[],
	tier: DifficultyTier,
): number {
	let count = 0
	for (const id of completedIds) {
		if (tierFor(id) === tier) {
			count += 1
		}
	}
	return count
}

function countCompletedCollections(completedIds: readonly string[]): number {
	const set = new Set(completedIds)
	const byCollection = new Map<string, string[]>()
	for (const item of GALLERY_ITEMS) {
		const list = byCollection.get(item.collectionId) ?? []
		list.push(item.puzzleId)
		byCollection.set(item.collectionId, list)
	}
	let done = 0
	for (const members of byCollection.values()) {
		if (members.length > 0 && members.every((id) => set.has(id))) {
			done += 1
		}
	}
	return done
}

function countLargeGrid(
	completedIds: readonly string[],
	minSide: number,
): number {
	let count = 0
	for (const id of completedIds) {
		const puzzle = getProductionPuzzleById(id)
		if (puzzle === null) {
			continue
		}
		if (puzzle.width >= minSide || puzzle.height >= minSide) {
			count += 1
		}
	}
	return count
}

function progressFor(
	def: AchievementDefinition,
	ctx: AchievementEvalContext,
): number {
	const { condition } = def
	switch (condition.kind) {
		case 'unique_completed':
			return ctx.completedPuzzleIds.filter((id) =>
				GALLERY_ITEMS.some((item) => item.puzzleId === id) ||
				getProductionPuzzleById(id) !== null,
			).length
		case 'difficulty_count':
		case 'difficulty_any':
			return countDifficulty(
				ctx.completedPuzzleIds,
				condition.difficultyTier as DifficultyTier,
			)
		case 'collection_complete_any':
			return countCompletedCollections(ctx.completedPuzzleIds)
		case 'total_completions':
			return ctx.totalCompletions
		case 'large_grid':
			return countLargeGrid(
				ctx.completedPuzzleIds,
				condition.minSide ?? 15,
			)
		default:
			return 0
	}
}

/**
 * Unique completed for unique_completed achievements should count campaign IDs
 * present in save (including gallery). Unknown historical IDs still count toward
 * unique_completed if they are completed — but difficulty/collection ignore unknowns.
 */
function uniqueCompletedCount(ctx: AchievementEvalContext): number {
	return new Set(ctx.completedPuzzleIds).size
}

export function evaluateAchievements(
	ctx: AchievementEvalContext,
): readonly AchievementState[] {
	const states: AchievementState[] = []
	for (const def of ACHIEVEMENT_DEFINITIONS) {
		const current =
			def.condition.kind === 'unique_completed'
				? uniqueCompletedCount(ctx)
				: progressFor(def, ctx)
		const target = def.condition.target
		const unlocked = current >= target
		states.push({
			id: def.id,
			titleRu: def.titleRu,
			descriptionRu: def.descriptionRu,
			displayOrder: def.displayOrder,
			iconKey: def.iconKey,
			access: unlocked ? 'UNLOCKED' : 'LOCKED',
			current: Math.min(current, target),
			target,
			progressLabel: `${Math.min(current, target)} / ${target}`,
		})
	}
	return Object.freeze(
		states.sort((a, b) => a.displayOrder - b.displayOrder),
	)
}

/**
 * Achievements that transitioned LOCKED → UNLOCKED between two snapshots.
 * Sorted by displayOrder.
 */
export function getNewlyUnlockedAchievements(
	before: readonly AchievementState[],
	after: readonly AchievementState[],
): readonly AchievementState[] {
	const beforeMap = new Map(before.map((item) => [item.id, item.access]))
	const newly = after.filter((item) => {
		if (item.access !== 'UNLOCKED') {
			return false
		}
		return beforeMap.get(item.id) !== 'UNLOCKED'
	})
	return Object.freeze(
		[...newly].sort((a, b) => a.displayOrder - b.displayOrder),
	)
}
