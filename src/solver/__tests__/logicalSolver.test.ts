/**
 * Logical solver tests — NO GUESSING contract.
 */

import { puzzleToSpec } from '../completeSolver'
import { nextLogicalStep, solveLogically } from '../logicalSolver'
import {
	FIXTURE_A_SIMPLE_5X5,
	FIXTURE_G_IMPOSSIBLE,
	FIXTURE_H_LOGICAL,
	FIXTURE_I_STALLED_UNIQUE,
} from '../../tests/fixtures/nonogramFixtures'

describe('solveLogically', () => {
	it('fully solves fixture H without guessing', () => {
		const result = solveLogically(puzzleToSpec(FIXTURE_H_LOGICAL))
		expect(result.status).toBe('SOLVED')
		expect(result.grid.every((cell) => cell !== 0)).toBe(true)
		const binary = result.grid.map((cell) => (cell === 1 ? 1 : 0))
		expect(binary).toEqual([...FIXTURE_H_LOGICAL.solution])
	})

	it('returns STALLED for fixture I and does not claim SOLVED', () => {
		const result = solveLogically(puzzleToSpec(FIXTURE_I_STALLED_UNIQUE))
		expect(result.status).toBe('STALLED')
		expect(result.grid.some((cell) => cell === 0)).toBe(true)
	})

	it('returns INVALID for contradictory fixture G', () => {
		const result = solveLogically(FIXTURE_G_IMPOSSIBLE)
		expect(result.status).toBe('INVALID')
	})

	it('never contradicts the known solution on fixture A deductions', () => {
		const result = solveLogically(puzzleToSpec(FIXTURE_A_SIMPLE_5X5))
		expect(result.status).toBe('SOLVED')
		for (let i = 0; i < FIXTURE_A_SIMPLE_5X5.solution.length; i += 1) {
			const expected = FIXTURE_A_SIMPLE_5X5.solution[i]
			const actual = result.grid[i]
			if (actual === 1) {
				expect(expected).toBe(1)
			}
			if (actual === -1) {
				expect(expected).toBe(0)
			}
		}
	})

	it('exposes a machine-readable nextLogicalStep for teach-me', () => {
		const step = nextLogicalStep(
			puzzleToSpec(FIXTURE_H_LOGICAL),
			Array.from(
				{ length: FIXTURE_H_LOGICAL.width * FIXTURE_H_LOGICAL.height },
				() => 0,
			),
		)
		expect(step).not.toBeNull()
		expect(step).not.toBe('INVALID')
		if (step === null || step === 'INVALID') {
			return
		}
		expect(step.cells.length).toBeGreaterThan(0)
		expect(step.orientation === 'row' || step.orientation === 'column').toBe(
			true,
		)
		expect(Array.isArray(step.clue)).toBe(true)
		expect(typeof step.reason).toBe('string')
	})

	it('is deterministic across repeated solves', () => {
		const spec = puzzleToSpec(FIXTURE_H_LOGICAL)
		expect(solveLogically(spec)).toEqual(solveLogically(spec))
	})
})
