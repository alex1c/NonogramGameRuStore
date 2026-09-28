/**
 * Pure achievement evaluator — no AsyncStorage, no React.
 *
 * Phase 6: unique / difficulty / collection / large_grid use solvedPuzzleIds.
 * Campaign-only metrics are not used for Gallery-facing achievements.
 * Daily achievements use dailyCompletionRecords + streak.
 */

import { analyzeDifficulty } from '../domain/difficulty/analyzer'
import type { DifficultyTier } from '../domain/difficulty/tiers'
import { getProductionPuzzleById } from '../content/playable'
import { GALLERY_ITEMS } from '../gallery/definitions'
import type { SaveRoot } from '../persistence/schema'
import {
	computeCurrentStreak,
	computeLongestStreak,
} from '../daily/streak'
import { localDayKey } from '../daily/dateUtils'
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
	readonly solvedPuzzleIds: readonly string[]
	readonly totalCompletions: number
	readonly dailyCompletionCount: number
	readonly currentStreak: number
	readonly longestStreak: number
}

/** Build eval context from a save snapshot (before or after mutation). */
export function contextFromSave(
	save: SaveRoot,
	today: string = localDayKey(),
): AchievementEvalContext {
	const streakInput = {
		today,
		completions: save.dailyCompletionRecords,
		restoredDays: save.restoredDailyDays,
		dailyStartedDay: save.dailyStartedDay,
	}
	return {
		solvedPuzzleIds: save.solvedPuzzleIds,
		totalCompletions: save.statistics.totalCompletions,
		dailyCompletionCount: save.dailyCompletionRecords.length,
		currentStreak: computeCurrentStreak(streakInput),
		longestStreak: computeLongestStreak(streakInput),
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
	solvedIds: readonly string[],
	tier: DifficultyTier,
): number {
	let count = 0
	for (const id of solvedIds) {
		if (tierFor(id) === tier) {
			count += 1
		}
	}
	return count
}

function countCompletedCollections(solvedIds: readonly string[]): number {
	const set = new Set(solvedIds)
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
	solvedIds: readonly string[],
	minSide: number,
): number {
	let count = 0
	for (const id of solvedIds) {
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
		case 'unique_solved':
			return new Set(ctx.solvedPuzzleIds).size
		case 'difficulty_count':
		case 'difficulty_any':
			return countDifficulty(
				ctx.solvedPuzzleIds,
				condition.difficultyTier as DifficultyTier,
			)
		case 'collection_complete_any':
			return countCompletedCollections(ctx.solvedPuzzleIds)
		case 'total_completions':
			return ctx.totalCompletions
		case 'large_grid':
			return countLargeGrid(
				ctx.solvedPuzzleIds,
				condition.minSide ?? 15,
			)
		case 'daily_completions':
			return ctx.dailyCompletionCount
		case 'daily_streak':
			return Math.max(ctx.currentStreak, ctx.longestStreak)
		default:
			return 0
	}
}

export function evaluateAchievements(
	ctx: AchievementEvalContext,
): readonly AchievementState[] {
	const states: AchievementState[] = []
	for (const def of ACHIEVEMENT_DEFINITIONS) {
		const current = progressFor(def, ctx)
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
