/**
 * Build production puzzles from solution bitmaps (clue SoT policy).
 */

import {
	createPuzzleFromSolution,
	gridFromMatrix,
} from '../domain/nonogram/clues'
import { CONTENT_SCHEMA_VERSION, type CatalogPuzzle, type CatalogPuzzleDraft } from './types'

export function buildCatalogPuzzle(draft: CatalogPuzzleDraft): CatalogPuzzle {
	if (draft.schemaVersion !== CONTENT_SCHEMA_VERSION) {
		throw new Error(
			`Unsupported content schemaVersion ${draft.schemaVersion} for ${draft.id}`,
		)
	}
	if (!draft.id.trim()) {
		throw new Error('Catalog puzzle id must be a non-empty stable string')
	}

	const puzzle = createPuzzleFromSolution({
		id: draft.id,
		width: draft.width,
		height: draft.height,
		solution: gridFromMatrix(draft.solutionMatrix),
		metadata: {
			title: draft.title,
			category: draft.category,
			collection: draft.collection,
			source: draft.provenance,
			notes: draft.notes,
			colorMode: 'bw',
		},
	})

	return Object.freeze({
		...puzzle,
		schemaVersion: CONTENT_SCHEMA_VERSION,
		title: draft.title,
		category: draft.category ?? 'uncategorized',
		collection: draft.collection ?? 'default',
		tags: Object.freeze([...(draft.tags ?? [])]),
		provenance: draft.provenance,
	})
}
