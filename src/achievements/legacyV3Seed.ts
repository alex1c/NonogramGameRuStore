/**
 * v3→v4 sticky achievement seeding using frozen legacy Gallery membership.
 *
 * Uses compatibility puzzle resolution (legacy mini-21) + frozen difficulty
 * tags — never production-only lookup or runtime analyzeDifficulty.
 * Collection completeness uses LEGACY_V3_GALLERY_ITEMS only.
 */

import type { DifficultyTier } from '../domain/difficulty/tiers'
import { resolvePlayablePuzzleById } from '../content/playable'
import { resolvePuzzleDifficultyTier } from '../content/difficultyLookup'
import type { SaveRoot } from '../persistence/schema'
import {
	computeCurrentStreak,
	computeLongestStreak,
} from '../daily/streak'
import { localDayKey } from '../daily/dateUtils'
import {
	ACHIEVEMENT_DEFINITIONS,
	type AchievementDefinition,
} from './definitions'
import { LEGACY_V3_GALLERY_ITEMS } from './legacyV3Gallery'
import { getLegacyV3PuzzleMetadata } from './legacyV3Metadata'
import { mergeStickyAchievementIds } from './sticky'
import type { AchievementEvalContext } from './evaluate'

function tierForLegacy(puzzleId: string): DifficultyTier | 'UNRATED' {
	// Frozen v3 metadata first: no puzzle decode, no analyzeDifficulty.
	const frozen = getLegacyV3PuzzleMetadata(puzzleId)
	if (frozen !== null) {
		return frozen.tier
	}
	// Defensive fallback for non-legacy ids: precomputed runtime tier only.
	const puzzle = resolvePlayablePuzzleById(puzzleId)
	if (puzzle === null) {
		return 'UNRATED'
	}
	return resolvePuzzleDifficultyTier(puzzle) ?? 'UNRATED'
}

function countDifficulty(
	solvedIds: readonly string[],
	tier: DifficultyTier,
): number {
	let count = 0
	for (const id of solvedIds) {
		if (tierForLegacy(id) === tier) {
			count += 1
		}
	}
	return count
}

function countCompletedLegacyCollections(
	solvedIds: readonly string[],
): number {
	const set = new Set(solvedIds)
	const byCollection = new Map<string, string[]>()
	for (const item of LEGACY_V3_GALLERY_ITEMS) {
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
		// Frozen grid size for the 21 legacy puzzles — no decode needed.
		const frozen = getLegacyV3PuzzleMetadata(id)
		if (frozen !== null) {
			if (frozen.width >= minSide || frozen.height >= minSide) {
				count += 1
			}
			continue
		}
		const puzzle = resolvePlayablePuzzleById(id)
		if (puzzle === null) {
			continue
		}
		if (puzzle.width >= minSide || puzzle.height >= minSide) {
			count += 1
		}
	}
	return count
}

function progressForLegacy(
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
			return countCompletedLegacyCollections(ctx.solvedPuzzleIds)
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

/** Build eval context from a v3-shaped save (no sticky field required). */
export function legacyContextFromV3Progress(
	save: {
		readonly solvedPuzzleIds: readonly string[]
		readonly statistics: { readonly totalCompletions: number }
		readonly dailyCompletionRecords: readonly unknown[]
		readonly restoredDailyDays: readonly string[]
		readonly dailyStartedDay: string | null
	},
	today: string = localDayKey(),
): AchievementEvalContext {
	const streakInput = {
		today,
		completions: save.dailyCompletionRecords as SaveRoot['dailyCompletionRecords'],
		restoredDays: save.restoredDailyDays as SaveRoot['restoredDailyDays'],
		dailyStartedDay: save.dailyStartedDay as SaveRoot['dailyStartedDay'],
	}
	return {
		solvedPuzzleIds: save.solvedPuzzleIds,
		totalCompletions: save.statistics.totalCompletions,
		dailyCompletionCount: save.dailyCompletionRecords.length,
		currentStreak: computeCurrentStreak(streakInput),
		longestStreak: computeLongestStreak(streakInput),
		stickyAchievementIds: Object.freeze([] as string[]),
	}
}

/**
 * Achievement IDs that are unlocked under frozen v3 Gallery rules.
 * Used only for migration seeding — never for celebration.
 */
export function seedStickyAchievementIdsFromLegacyV3(
	save: {
		readonly solvedPuzzleIds: readonly string[]
		readonly statistics: { readonly totalCompletions: number }
		readonly dailyCompletionRecords: readonly unknown[]
		readonly restoredDailyDays: readonly string[]
		readonly dailyStartedDay: string | null
	},
	today: string = localDayKey(),
): readonly string[] {
	const ctx = legacyContextFromV3Progress(save, today)
	const unlocked: string[] = []
	for (const def of ACHIEVEMENT_DEFINITIONS) {
		const current = progressForLegacy(def, ctx)
		if (current >= def.condition.target) {
			unlocked.push(def.id)
		}
	}
	return mergeStickyAchievementIds([], unlocked)
}
