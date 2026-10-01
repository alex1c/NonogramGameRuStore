/**
 * Pure achievement evaluator — no AsyncStorage, no React.
 *
 * Phase 8B: unlock = sticky IDs ∪ currently derived conditions.
 * Celebration uses getNewlyUnlockedAchievements on before/after snapshots.
 */

import { analyzeDifficulty } from '../domain/difficulty/analyzer'
import type { DifficultyTier } from '../domain/difficulty/tiers'
import { getProductionPuzzleById } from '../content/playable'
import { getRuntimePuzzleEntry } from '../content/runtime'
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
import { mergeStickyAchievementIds, normalizeStickyAchievementIds } from './sticky'

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
	/** True when unlock comes from sticky history while derived progress is incomplete. */
	readonly stickyOnly: boolean
	/** True when current progress alone satisfies the definition. */
	readonly derivedUnlocked: boolean
}

export interface AchievementEvalContext {
	readonly solvedPuzzleIds: readonly string[]
	readonly totalCompletions: number
	readonly dailyCompletionCount: number
	readonly currentStreak: number
	readonly longestStreak: number
	readonly stickyAchievementIds: readonly string[]
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
		stickyAchievementIds: normalizeStickyAchievementIds(
			save.unlockedAchievementIds,
		),
	}
}

const tierCache = new Map<string, DifficultyTier | 'UNRATED'>()

function tierFor(puzzleId: string): DifficultyTier | 'UNRATED' {
	const hit = tierCache.get(puzzleId)
	if (hit !== undefined) {
		return hit
	}
	const entry = getRuntimePuzzleEntry(puzzleId)
	let tier: DifficultyTier | 'UNRATED' = entry?.tier ?? 'UNRATED'
	if (tier === 'UNRATED') {
		const puzzle = getProductionPuzzleById(puzzleId)
		tier = puzzle === null ? 'UNRATED' : analyzeDifficulty(puzzle).tier
	}
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

/**
 * Test helper: evaluate collections against an alternate gallery membership
 * without mutating live definitions (taxonomy-change regression).
 */
export function countCompletedCollectionsFromItems(
	solvedIds: readonly string[],
	items: readonly { readonly puzzleId: string; readonly collectionId: string }[],
): number {
	const set = new Set(solvedIds)
	const byCollection = new Map<string, string[]>()
	for (const item of items) {
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

/**
 * Evaluate achievements with sticky ∪ derived unlock semantics.
 * Unknown sticky IDs (removed definitions) are ignored in the UI list.
 */
export function evaluateAchievements(
	ctx: AchievementEvalContext,
): readonly AchievementState[] {
	const sticky = new Set(ctx.stickyAchievementIds)
	const states: AchievementState[] = []
	for (const def of ACHIEVEMENT_DEFINITIONS) {
		const current = progressFor(def, ctx)
		const target = def.condition.target
		const derivedUnlocked = current >= target
		const stickyHit = sticky.has(def.id)
		const unlocked = derivedUnlocked || stickyHit
		const stickyOnly = stickyHit && !derivedUnlocked
		states.push({
			id: def.id,
			titleRu: def.titleRu,
			descriptionRu: def.descriptionRu,
			displayOrder: def.displayOrder,
			iconKey: def.iconKey,
			access: unlocked ? 'UNLOCKED' : 'LOCKED',
			current: Math.min(current, target),
			target,
			progressLabel: stickyOnly
				? 'Получено'
				: `${Math.min(current, target)} / ${target}`,
			stickyOnly,
			derivedUnlocked,
		})
	}
	return Object.freeze(
		states.sort((a, b) => a.displayOrder - b.displayOrder),
	)
}

/** IDs currently unlocked by derived progress alone (ignore sticky). */
export function listDerivedUnlockedIds(
	ctx: AchievementEvalContext,
): readonly string[] {
	const out: string[] = []
	for (const def of ACHIEVEMENT_DEFINITIONS) {
		if (progressFor(def, ctx) >= def.condition.target) {
			out.push(def.id)
		}
	}
	return Object.freeze(out)
}

/**
 * Merge sticky history with all currently derived unlocks.
 * Used on progress transitions to materialize hydration unlocks without celebration.
 */
export function materializeStickyAchievementIds(
	ctx: AchievementEvalContext,
): readonly string[] {
	return mergeStickyAchievementIds(
		ctx.stickyAchievementIds,
		listDerivedUnlockedIds(ctx),
	)
}

/**
 * Achievements that transitioned LOCKED → UNLOCKED between two snapshots.
 * Sorted by displayOrder. Sticky-only history does not re-celebrate.
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
