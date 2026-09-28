/**
 * Invariant / parameterized checks across fixtures.
 */

import {
	createEmptyPlayerState,
	deserializePlayerState,
	generateClueFromLine,
	getSolutionColumn,
	getSolutionRow,
	serializePlayerState,
	setFilled,
} from '..'
import { puzzleToSpec, solveComplete } from '../../../solver/completeSolver'
import { solveLogically } from '../../../solver/logicalSolver'
import { ALL_SOLUTION_FIXTURES } from '../../../tests/fixtures/nonogramFixtures'

describe('nonogram invariants', () => {
	it.each(ALL_SOLUTION_FIXTURES.map((puzzle) => [puzzle.id, puzzle] as const))(
		'clues match every line for %s',
		(_id, puzzle) => {
			for (let row = 0; row < puzzle.height; row += 1) {
				expect(
					generateClueFromLine(
						getSolutionRow(puzzle.solution, puzzle.width, row),
					),
				).toEqual(puzzle.rowClues[row])
			}
			for (let col = 0; col < puzzle.width; col += 1) {
				expect(
					generateClueFromLine(
						getSolutionColumn(
							puzzle.solution,
							puzzle.width,
							puzzle.height,
							col,
						),
					),
				).toEqual(puzzle.columnClues[col])
			}
		},
	)

	it.each(ALL_SOLUTION_FIXTURES.map((puzzle) => [puzzle.id, puzzle] as const))(
		'unique complete solver matches authored solution for %s',
		(_id, puzzle) => {
			const result = solveComplete(puzzleToSpec(puzzle), { maxSolutions: 2 })
			expect(result.unique).toBe(true)
			expect(result.solutions[0]).toEqual([...puzzle.solution])
		},
	)

	it.each(ALL_SOLUTION_FIXTURES.map((puzzle) => [puzzle.id, puzzle] as const))(
		'logical deductions never contradict solution for %s',
		(_id, puzzle) => {
			const result = solveLogically(puzzleToSpec(puzzle))
			expect(result.status).not.toBe('INVALID')
			for (let i = 0; i < puzzle.solution.length; i += 1) {
				const actual = result.grid[i]
				const expected = puzzle.solution[i]
				if (actual === 1) {
					expect(expected).toBe(1)
				}
				if (actual === -1) {
					expect(expected).toBe(0)
				}
			}
		},
	)

	it('player state serialization round-trip is stable', () => {
		const puzzle = ALL_SOLUTION_FIXTURES[0]!
		let state = createEmptyPlayerState(puzzle.width, puzzle.height)
		state = setFilled(state, 0, 0)
		const once = deserializePlayerState(serializePlayerState(state))
		const twice = deserializePlayerState(serializePlayerState(once))
		expect(twice).toEqual(state)
	})

	it('repeated complete/logical solves are deterministic', () => {
		const puzzle = ALL_SOLUTION_FIXTURES[0]!
		const spec = puzzleToSpec(puzzle)
		expect(solveComplete(spec, { maxSolutions: 2 })).toEqual(
			solveComplete(spec, { maxSolutions: 2 }),
		)
		expect(solveLogically(spec)).toEqual(solveLogically(spec))
	})
})
