/**
 * Production playable puzzle access — Game UI must use this, not raw fixtures.
 */

import { MINI_PRODUCTION_CATALOG } from './miniCatalog'
import type { CatalogPuzzle } from './types'
import { validateProductionPuzzle } from '../solver/validator'

export function getProductionCatalog(): readonly CatalogPuzzle[] {
	return MINI_PRODUCTION_CATALOG
}

export function getProductionPuzzleById(id: string): CatalogPuzzle | null {
	const puzzle = MINI_PRODUCTION_CATALOG.find((item) => item.id === id)
	if (puzzle === undefined) {
		return null
	}
	const gate = validateProductionPuzzle(puzzle)
	if (!gate.productionReady) {
		return null
	}
	return puzzle
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
