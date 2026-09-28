/**
 * Content catalog / audit tests.
 */

import { buildCatalogPuzzle } from '../../content/buildPuzzle'
import { MINI_PRODUCTION_CATALOG } from '../../content/miniCatalog'
import { validateCatalog } from '../../content/validateCatalog'
import {
	generateColumnClues,
	generateRowClues,
} from '../../domain/nonogram/clues'
import { validateProductionPuzzle } from '../../solver/validator'

describe('mini production catalog', () => {
	it('contains a usable number of puzzles', () => {
		expect(MINI_PRODUCTION_CATALOG.length).toBeGreaterThanOrEqual(15)
		expect(MINI_PRODUCTION_CATALOG.length).toBeLessThanOrEqual(30)
	})

	it('every puzzle passes productionReady', () => {
		for (const puzzle of MINI_PRODUCTION_CATALOG) {
			const result = validateProductionPuzzle(puzzle)
			expect(result.productionReady).toBe(true)
		}
	})

	it('has stable unique ids (no duplicates)', () => {
		const ids = MINI_PRODUCTION_CATALOG.map((puzzle) => puzzle.id)
		expect(new Set(ids).size).toBe(ids.length)
	})

	it('generates clues deterministically from solution', () => {
		for (const puzzle of MINI_PRODUCTION_CATALOG) {
			expect(
				generateRowClues(puzzle.solution, puzzle.width, puzzle.height),
			).toEqual(puzzle.rowClues)
			expect(
				generateColumnClues(
					puzzle.solution,
					puzzle.width,
					puzzle.height,
				),
			).toEqual(puzzle.columnClues)
		}
	})

	it('validateCatalog passes for the mini catalog', () => {
		const result = validateCatalog(MINI_PRODUCTION_CATALOG)
		expect(result.ok).toBe(true)
		expect(result.summary.fail).toBe(0)
		expect(result.summary.duplicateIds).toBe(0)
	})

	it('validateCatalog fails on duplicate ids / non-ready puzzle', () => {
		const first = MINI_PRODUCTION_CATALOG[0]!
		const duplicate = buildCatalogPuzzle({
			id: first.id,
			schemaVersion: 1,
			title: 'Duplicate',
			width: first.width,
			height: first.height,
			solutionMatrix: Array.from({ length: first.height }, (_, row) =>
				Array.from({ length: first.width }, (_, col) =>
					first.solution[row * first.width + col] === 1 ? 1 : 0,
				),
			),
		})
		const stalledLike = {
			...first,
			id: 'broken-stalled-injection',
			// Force clue mismatch → not production ready
			rowClues: first.rowClues.map((clue, index) =>
				index === 0 ? [1] : clue,
			),
		}
		const result = validateCatalog([first, duplicate, stalledLike])
		expect(result.ok).toBe(false)
		expect(result.duplicateIds).toContain(first.id)
		expect(
			result.issues.some((issue) => issue.code === 'DUPLICATE_ID'),
		).toBe(true)
		expect(
			result.issues.some((issue) => issue.code === 'NOT_PRODUCTION_READY'),
		).toBe(true)
	})
})
