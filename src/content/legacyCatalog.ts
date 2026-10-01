/**
 * Legacy development mini-catalog (21 puzzles).
 * Kept only for resolving historical active Campaign / Daily parties.
 * Not listed in production Campaign / Gallery / Daily-v2.
 */

import { MINI_PRODUCTION_CATALOG } from './miniCatalog'
import type { CatalogPuzzle } from './types'

const LEGACY_IDS = Object.freeze(
	MINI_PRODUCTION_CATALOG.map((p) => p.id),
) as readonly string[]

let legacyMap: ReadonlyMap<string, CatalogPuzzle> | null = null

function getLegacyMap(): ReadonlyMap<string, CatalogPuzzle> {
	if (legacyMap !== null) {
		return legacyMap
	}
	const map = new Map<string, CatalogPuzzle>()
	for (const puzzle of MINI_PRODUCTION_CATALOG) {
		map.set(puzzle.id, puzzle)
	}
	legacyMap = map
	return map
}

export const LEGACY_DEVELOPMENT_PUZZLE_IDS: readonly string[] = LEGACY_IDS

export function getLegacyPuzzleById(id: string): CatalogPuzzle | null {
	return getLegacyMap().get(id) ?? null
}

export function isLegacyDevelopmentId(id: string): boolean {
	return getLegacyMap().has(id)
}
