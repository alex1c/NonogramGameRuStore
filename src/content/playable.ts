/**
 * Production playable puzzle access — Game UI must use this, not raw fixtures.
 */

import { MINI_PRODUCTION_CATALOG } from './miniCatalog'
import type { CatalogPuzzle } from './types'
import { validateProductionPuzzle } from '../solver/validator'

/** Immutable validated catalog cache — avoid re-running solvers on every lookup. */
let validatedCatalogCache: ReadonlyMap<string, CatalogPuzzle> | null = null

function getValidatedCatalogMap(): ReadonlyMap<string, CatalogPuzzle> {
	if (validatedCatalogCache !== null) {
		return validatedCatalogCache
	}
	const map = new Map<string, CatalogPuzzle>()
	for (const puzzle of MINI_PRODUCTION_CATALOG) {
		const gate = validateProductionPuzzle(puzzle)
		if (gate.productionReady) {
			map.set(puzzle.id, puzzle)
		}
	}
	validatedCatalogCache = map
	return map
}

export function getProductionCatalog(): readonly CatalogPuzzle[] {
	return Array.from(getValidatedCatalogMap().values())
}

export function getProductionPuzzleById(id: string): CatalogPuzzle | null {
	return getValidatedCatalogMap().get(id) ?? null
}

/** Curated Home shortcuts — only productionReady catalog entries. */
export function getHomePlayablePuzzles(): readonly CatalogPuzzle[] {
	const preferredIds = [
		'mini-beginner-frame',
		'mini-easy-stairs',
		'mini-medium-diamond',
		'mini-hard-arrows',
		'mini-hard-frame-cross',
		'mini-expert-scatter',
	]
	const selected: CatalogPuzzle[] = []
	for (const id of preferredIds) {
		const puzzle = getProductionPuzzleById(id)
		if (puzzle !== null) {
			selected.push(puzzle)
		}
	}
	return selected
}
