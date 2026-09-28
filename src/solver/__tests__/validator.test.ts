/**
 * Validator pipeline tests covering fixtures A–I quality gates.
 */

import { puzzleToSpec } from '../completeSolver'
import { validatePuzzle, validatePuzzleSpec } from '../validator'
import {
	FIXTURE_A_SIMPLE_5X5,
	FIXTURE_F_AMBIGUOUS,
	FIXTURE_G_IMPOSSIBLE,
	FIXTURE_G_STRUCTURALLY_INVALID,
	FIXTURE_H_LOGICAL,
	FIXTURE_I_STALLED_UNIQUE,
} from '../../tests/fixtures/nonogramFixtures'
import {
	createPuzzleFromSolution,
	gridFromMatrix,
} from '../../domain/nonogram'

describe('validatePuzzle / validatePuzzleSpec', () => {
	it('marks fixture A as valid, unique, logically solvable, productionReady', () => {
		const result = validatePuzzle(FIXTURE_A_SIMPLE_5X5)
		expect(result.valid).toBe(true)
		expect(result.unique).toBe(true)
		expect(result.logicallySolvable).toBe(true)
		expect(result.productionReady).toBe(true)
		expect(result.hasSolution).toBe(true)
		expect(result.logicalStatus).toBe('SOLVED')
	})

	it('marks fixture F as ambiguous (not unique)', () => {
		const result = validatePuzzleSpec(FIXTURE_F_AMBIGUOUS)
		expect(result.hasSolution).toBe(true)
		expect(result.unique).toBe(false)
		expect(result.solutionCount).toBe(2)
		expect(result.issues.some((issue) => issue.code === 'NOT_UNIQUE')).toBe(
			true,
		)
	})

	it('marks fixture G as invalid / no solution', () => {
		const result = validatePuzzleSpec(FIXTURE_G_IMPOSSIBLE)
		expect(result.hasSolution).toBe(false)
		expect(result.unique).toBe(false)
		expect(result.logicallySolvable).toBe(false)
		expect(
			result.issues.some((issue) =>
				['NO_SOLUTION', 'LOGICAL_INVALID'].includes(issue.code),
			),
		).toBe(true)
	})

	it('rejects structurally invalid clues', () => {
		const result = validatePuzzleSpec(FIXTURE_G_STRUCTURALLY_INVALID)
		expect(result.valid).toBe(false)
		expect(result.issues.some((issue) => issue.code === 'INVALID_SPEC')).toBe(
			true,
		)
	})

	it('marks fixture H as logically solvable', () => {
		const result = validatePuzzle(FIXTURE_H_LOGICAL)
		expect(result.valid).toBe(true)
		expect(result.unique).toBe(true)
		expect(result.logicallySolvable).toBe(true)
	})

	it('marks fixture I as unique but not logically solvable (STALLED)', () => {
		const result = validatePuzzle(FIXTURE_I_STALLED_UNIQUE)
		expect(result.hasSolution).toBe(true)
		expect(result.unique).toBe(true)
		expect(result.logicallySolvable).toBe(false)
		expect(result.productionReady).toBe(false)
		expect(result.logicalStatus).toBe('STALLED')
		expect(
			result.issues.some((issue) => issue.code === 'NOT_LOGICALLY_SOLVABLE'),
		).toBe(true)
	})

	it('detects clues that do not match the authored solution', () => {
		const broken = {
			...FIXTURE_A_SIMPLE_5X5,
			rowClues: FIXTURE_A_SIMPLE_5X5.rowClues.map((clue, index) =>
				index === 0 ? [1] : clue,
			),
		}
		const result = validatePuzzle(broken)
		expect(result.valid).toBe(false)
		expect(
			result.issues.some((issue) => issue.code === 'ROW_CLUES_MISMATCH'),
		).toBe(true)
	})

	it('accepts a rectangular authored puzzle', () => {
		const puzzle = createPuzzleFromSolution({
			id: 'rect-valid',
			width: 4,
			height: 2,
			solution: gridFromMatrix([
				[1, 1, 1, 0],
				[0, 0, 1, 1],
			]),
		})
		const result = validatePuzzle(puzzle)
		expect(result.valid).toBe(true)
		expect(result.unique).toBe(true)
		expect(puzzleToSpec(puzzle).width).toBe(4)
		expect(puzzleToSpec(puzzle).height).toBe(2)
	})
})
