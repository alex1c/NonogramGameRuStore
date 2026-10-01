/**
 * Production playable puzzle access — Game UI must use this, not raw fixtures.
 *
 * Phase 8D: production catalog is B1000 (no startup solver audit).
 * Legacy mini-21 remains resolvable for historical active Campaign / Daily only.
 */

import type { CatalogPuzzle } from './types'
import { getLegacyPuzzleById } from './legacyCatalog'
import {
	getRuntimePuzzleById,
	isRuntimeProductionId,
	PRODUCTION_PUZZLE_COUNT,
} from './runtime'

/**
 * Production B1000 puzzle by ID.
 * Does NOT fall back to legacy development catalog.
 */
export function getProductionPuzzleById(id: string): CatalogPuzzle | null {
	return getRuntimePuzzleById(id)
}

/**
 * Resolve any playable puzzle: production first, then legacy compatibility.
 * Use for active-game hydration / Daily-v1 continue — NOT for new Campaign picks.
 */
export function resolvePlayablePuzzleById(id: string): CatalogPuzzle | null {
	return getRuntimePuzzleById(id) ?? getLegacyPuzzleById(id)
}

/** Production catalog size (B1000). */
export function getProductionCatalogCount(): number {
	return PRODUCTION_PUZZLE_COUNT
}

export function isProductionCatalogId(id: string): boolean {
	return isRuntimeProductionId(id)
}

/**
 * @deprecated Prefer campaign Sets / next-level contracts.
 * Kept for tests that referenced curated Home shortcuts — returns empty for B1000.
 */
export function getHomePlayablePuzzles(): readonly CatalogPuzzle[] {
	return []
}

/** @deprecated Use getProductionCatalogCount — not an eager decoded list. */
export function getProductionCatalog(): readonly CatalogPuzzle[] {
	throw new Error(
		'getProductionCatalog() disabled for B1000 — use getProductionPuzzleById / campaign sets (no eager 1000 decode)',
	)
}
