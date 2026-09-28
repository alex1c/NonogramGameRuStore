/**
 * Production gate / productionReady semantics tests.
 */

import {
	createPuzzleFromSolution,
	gridFromMatrix,
} from '../../domain/nonogram'
import {
	validateProductionPuzzle,
	validatePuzzle,
	validatePuzzleSpec,
} from '../validator'
import {
	FIXTURE_A_SIMPLE_5X5,
	FIXTURE_F_AMBIGUOUS,
	FIXTURE_G_IMPOSSIBLE,
	FIXTURE_I_STALLED_UNIQUE,
} from '../../tests/fixtures/nonogramFixtures'

describe('productionReady gate', () => {
	it('is true only for full quality gate on unique logical puzzles', () => {
		const result = validateProductionPuzzle(FIXTURE_A_SIMPLE_5X5)
		expect(result.valid).toBe(true)
		expect(result.unique).toBe(true)
		expect(result.logicallySolvable).toBe(true)
		expect(result.authoredSolutionMatchesUnique).toBe(true)
		expect(result.productionReady).toBe(true)
	})

	it('marks ambiguous fixture F as not productionReady', () => {
		const result = validatePuzzleSpec(FIXTURE_F_AMBIGUOUS)
		expect(result.unique).toBe(false)
		expect(result.productionReady).toBe(false)
	})

	it('marks impossible fixture G as not productionReady', () => {
		const result = validatePuzzleSpec(FIXTURE_G_IMPOSSIBLE)
		expect(result.hasSolution).toBe(false)
		expect(result.productionReady).toBe(false)
	})

	it('marks unique STALLED fixture I as not productionReady', () => {
		const result = validateProductionPuzzle(FIXTURE_I_STALLED_UNIQUE)
		expect(result.unique).toBe(true)
		expect(result.logicallySolvable).toBe(false)
		expect(result.logicalStatus).toBe('STALLED')
		expect(result.productionReady).toBe(false)
	})

	it('marks authored clue mismatch as not productionReady', () => {
		const broken = {
			...FIXTURE_A_SIMPLE_5X5,
			rowClues: FIXTURE_A_SIMPLE_5X5.rowClues.map((clue, index) =>
				index === 0 ? [1] : clue,
			),
		}
		const result = validatePuzzle(broken)
		expect(result.valid).toBe(false)
		expect(result.productionReady).toBe(false)
		expect(
			result.issues.some((issue) => issue.code === 'ROW_CLUES_MISMATCH'),
		).toBe(true)
	})

	it('marks authored solution mismatch as not productionReady', () => {
		// Same clues as a unique puzzle but wrong bitmap that still has matching
		// dimensions — force SOLUTION_MISMATCH by swapping a filled cell while
		// regenerating would change clues, so craft via validate path after
		// keeping original clues with a different solution that happens to share
		// clue sums is hard; instead mutate solution and keep regenerated clues
		// out of sync by copying clues from A onto a different unique shape.
		const other = createPuzzleFromSolution({
			id: 'other-shape',
			width: 5,
			height: 5,
			solution: gridFromMatrix([
				[1, 1, 1, 1, 1],
				[1, 0, 0, 0, 1],
				[1, 0, 1, 0, 1],
				[1, 0, 0, 0, 1],
				[1, 1, 1, 1, 1],
			]),
		})
		const mismatched = {
			...other,
			// Keep other solution but attach A's clues (intentional desync).
			rowClues: FIXTURE_A_SIMPLE_5X5.rowClues,
			columnClues: FIXTURE_A_SIMPLE_5X5.columnClues,
		}
		const result = validatePuzzle(mismatched)
		expect(result.productionReady).toBe(false)
		expect(
			result.issues.some((issue) =>
				['ROW_CLUES_MISMATCH', 'COLUMN_CLUES_MISMATCH', 'SOLUTION_MISMATCH'].includes(
					issue.code,
				),
			),
		).toBe(true)
	})

	it('keeps clue-only productionReady false even when unique+logical', () => {
		const result = validatePuzzleSpec({
			width: FIXTURE_A_SIMPLE_5X5.width,
			height: FIXTURE_A_SIMPLE_5X5.height,
			rowClues: FIXTURE_A_SIMPLE_5X5.rowClues,
			columnClues: FIXTURE_A_SIMPLE_5X5.columnClues,
		})
		expect(result.unique).toBe(true)
		expect(result.logicallySolvable).toBe(true)
		expect(result.productionReady).toBe(false)
		expect(result.authoredSolutionMatchesUnique).toBeNull()
	})
})
