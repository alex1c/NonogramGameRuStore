/**
 * Complete solver tests — existence / uniqueness with early stop at 2.
 */

import { puzzleToSpec, solveComplete } from '../completeSolver'
import {
	FIXTURE_A_SIMPLE_5X5,
	FIXTURE_E_UNIQUE,
	FIXTURE_F_AMBIGUOUS,
	FIXTURE_G_IMPOSSIBLE,
	FIXTURE_I_STALLED_UNIQUE,
} from '../../tests/fixtures/nonogramFixtures'

describe('solveComplete', () => {
	it('finds a unique solution for fixture E/A', () => {
		const result = solveComplete(puzzleToSpec(FIXTURE_E_UNIQUE), {
			maxSolutions: 2,
		})
		expect(result.solutionCount).toBe(1)
		expect(result.unique).toBe(true)
		expect(result.solutions[0]).toEqual([...FIXTURE_A_SIMPLE_5X5.solution])
	})

	it('reports multiple solutions for fixture F and stops at 2', () => {
		const result = solveComplete(FIXTURE_F_AMBIGUOUS, { maxSolutions: 2 })
		expect(result.solutionCount).toBe(2)
		expect(result.unique).toBe(false)
	})

	it('reports zero solutions for contradictory fixture G', () => {
		const result = solveComplete(FIXTURE_G_IMPOSSIBLE, { maxSolutions: 2 })
		expect(result.solutionCount).toBe(0)
		expect(result.unique).toBe(false)
	})

	it('proves uniqueness for the stalled logical fixture I', () => {
		const result = solveComplete(puzzleToSpec(FIXTURE_I_STALLED_UNIQUE), {
			maxSolutions: 2,
		})
		expect(result.unique).toBe(true)
		expect(result.solutions[0]).toEqual([
			...FIXTURE_I_STALLED_UNIQUE.solution,
		])
	})

	it('is deterministic across repeated solves', () => {
		const spec = puzzleToSpec(FIXTURE_A_SIMPLE_5X5)
		const a = solveComplete(spec, { maxSolutions: 2 })
		const b = solveComplete(spec, { maxSolutions: 2 })
		expect(a).toEqual(b)
	})
})
