/**
 * Frozen difficulty labels for legacy mini-21 compatibility puzzles.
 * Avoids runtime analyzeDifficulty during Game / achievement seed.
 */

import type { DifficultyTier } from '../domain/difficulty/tiers'
import type { CatalogPuzzle } from './types'

const TAG_TO_TIER: Record<string, DifficultyTier> = {
	beginner: 'BEGINNER',
	easy: 'EASY',
	medium: 'MEDIUM',
	hard: 'HARD',
	expert: 'EXPERT',
}

/**
 * Prefer precomputed B1000 assignedDifficulty; fall back to legacy tag mapping.
 */
export function resolvePuzzleDifficultyTier(
	puzzle: CatalogPuzzle,
): DifficultyTier | null {
	if (puzzle.assignedDifficulty !== undefined) {
		return puzzle.assignedDifficulty
	}
	for (const tag of puzzle.tags) {
		const tier = TAG_TO_TIER[tag.toLowerCase()]
		if (tier !== undefined) {
			return tier
		}
	}
	return null
}
