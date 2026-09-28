/**
 * Clue satisfaction — must not use authored solution.
 */

import { PlayerCell } from '../../domain/nonogram/types'
import {
	createEmptyPlayerState,
	setCrossed,
	setFilled,
} from '../../domain/nonogram/playerState'
import {
	getSatisfiedRows,
	isPlayerLineSatisfied,
} from '../clueSatisfaction'
import {
	createPuzzleFromSolution,
	gridFromMatrix,
} from '../../domain/nonogram/clues'

describe('clue satisfaction', () => {
	it('requires exact runs and a fully decided line', () => {
		expect(
			isPlayerLineSatisfied(
				[
					PlayerCell.FILLED,
					PlayerCell.FILLED,
					PlayerCell.CROSSED,
					PlayerCell.FILLED,
					PlayerCell.CROSSED,
				],
				[2, 1],
			),
		).toBe(true)

		expect(
			isPlayerLineSatisfied(
				[
					PlayerCell.FILLED,
					PlayerCell.FILLED,
					PlayerCell.FILLED,
					PlayerCell.UNKNOWN,
					PlayerCell.UNKNOWN,
				],
				[2, 1],
			),
		).toBe(false)

		expect(
			isPlayerLineSatisfied(
				[
					PlayerCell.FILLED,
					PlayerCell.CROSSED,
					PlayerCell.FILLED,
					PlayerCell.FILLED,
					PlayerCell.CROSSED,
				],
				[2, 1],
			),
		).toBe(false)
	})

	it('does not consult the authored solution bitmap', () => {
		const puzzle = createPuzzleFromSolution({
			id: 'clue-sat',
			width: 3,
			height: 1,
			solution: gridFromMatrix([[1, 0, 1]]),
		})
		let state = createEmptyPlayerState(3, 1)
		state = setFilled(state, 0, 0)
		state = setCrossed(state, 0, 1)
		state = setFilled(state, 0, 2)
		expect(getSatisfiedRows(state, puzzle.rowClues)[0]).toBe(true)

		state = createEmptyPlayerState(3, 1)
		state = setFilled(state, 0, 0)
		state = setFilled(state, 0, 1)
		state = setCrossed(state, 0, 2)
		expect(getSatisfiedRows(state, puzzle.rowClues)[0]).toBe(false)
	})
})
