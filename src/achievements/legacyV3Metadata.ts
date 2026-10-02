/**
 * Frozen per-puzzle metadata for the 21 legacy v3 development puzzles.
 *
 * Used ONLY by the v3 → v4 sticky achievement seed so migration never has to
 * decode puzzles or run `analyzeDifficulty` (H4). The tiers below are the
 * analyzer results at the time of the Phase 8B freeze; they intentionally do
 * not follow the legacy `tags` (e.g. `mini-beginner-frame` was rated EASY).
 *
 * Keep this table immutable: future catalog / analyzer changes must not alter
 * which achievements an existing v3 player already earned.
 */

import type { DifficultyTier } from '../domain/difficulty/tiers'

export interface LegacyV3PuzzleMetadata {
	readonly tier: DifficultyTier
	readonly width: number
	readonly height: number
}

function meta(
	tier: DifficultyTier,
	width: number,
	height: number,
): LegacyV3PuzzleMetadata {
	return Object.freeze({ tier, width, height })
}

/** Legacy puzzle id → frozen tier + grid size. */
export const LEGACY_V3_PUZZLE_METADATA: Readonly<
	Record<string, LegacyV3PuzzleMetadata>
> = Object.freeze({
	'mini-beginner-bar': meta('BEGINNER', 5, 3),
	'mini-beginner-full': meta('BEGINNER', 3, 3),
	'mini-beginner-frame': meta('EASY', 5, 5),
	'mini-easy-block': meta('EASY', 5, 5),
	'mini-easy-stairs': meta('EASY', 5, 5),
	'mini-easy-plus': meta('EASY', 5, 5),
	'mini-easy-checker': meta('EASY', 5, 5),
	'mini-easy-weave': meta('BEGINNER', 10, 10),
	'mini-medium-heart': meta('MEDIUM', 5, 5),
	'mini-medium-letter-h': meta('MEDIUM', 5, 7),
	'mini-medium-boat': meta('MEDIUM', 7, 5),
	'mini-medium-diamond': meta('MEDIUM', 7, 7),
	'mini-medium-spiral': meta('EASY', 10, 10),
	'mini-medium-maze': meta('EASY', 15, 15),
	'mini-hard-tree': meta('HARD', 5, 7),
	'mini-hard-bridge': meta('HARD', 12, 8),
	'mini-hard-arrows': meta('HARD', 9, 9),
	'mini-hard-window': meta('EASY', 10, 10),
	'mini-hard-frame-cross': meta('HARD', 15, 15),
	'mini-expert-scatter': meta('EXPERT', 10, 10),
	'mini-expert-lattice': meta('EXPERT', 10, 10),
})

/** Frozen metadata for a legacy id, or null when the id is not legacy. */
export function getLegacyV3PuzzleMetadata(
	puzzleId: string,
): LegacyV3PuzzleMetadata | null {
	return LEGACY_V3_PUZZLE_METADATA[puzzleId] ?? null
}
