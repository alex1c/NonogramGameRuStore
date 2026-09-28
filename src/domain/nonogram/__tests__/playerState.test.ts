/**
 * Player state unit tests.
 */

import {
	PlayerCell,
	clearCell,
	createEmptyPlayerState,
	createPuzzleFromSolution,
	deserializePlayerState,
	gridFromMatrix,
	isFilledSetCorrect,
	isPuzzleComplete,
	serializePlayerState,
	setCrossed,
	setFilled,
} from '..'
import { FIXTURE_A_SIMPLE_5X5 } from '../../../tests/fixtures/nonogramFixtures'

describe('playerState', () => {
	const puzzle = FIXTURE_A_SIMPLE_5X5

	it('creates an all-UNKNOWN grid', () => {
		const state = createEmptyPlayerState(puzzle.width, puzzle.height)
		expect(state.cells.every((cell) => cell === PlayerCell.UNKNOWN)).toBe(
			true,
		)
	})

	it('sets FILLED, CROSSED and clears back to UNKNOWN', () => {
		let state = createEmptyPlayerState(3, 2)
		state = setFilled(state, 0, 1)
		expect(state.cells[1]).toBe(PlayerCell.FILLED)
		state = setCrossed(state, 1, 0)
		expect(state.cells[3]).toBe(PlayerCell.CROSSED)
		state = clearCell(state, 0, 1)
		expect(state.cells[1]).toBe(PlayerCell.UNKNOWN)
	})

	it('round-trips through serialization safely', () => {
		let state = createEmptyPlayerState(puzzle.width, puzzle.height)
		state = setFilled(state, 0, 1)
		state = setCrossed(state, 4, 2)
		const restored = deserializePlayerState(serializePlayerState(state))
		expect(restored).toEqual(state)
	})

	it('rejects corrupt serialized payloads', () => {
		expect(() => deserializePlayerState({ version: 99 })).toThrow(
			/Unsupported/,
		)
		expect(() =>
			deserializePlayerState({
				version: 1,
				width: 2,
				height: 2,
				cells: ['NOPE', 'UNKNOWN', 'UNKNOWN', 'UNKNOWN'],
			}),
		).toThrow(/Invalid player cell/)
	})

	it('treats exact FILLED set as complete even with UNKNOWN empties', () => {
		let state = createEmptyPlayerState(puzzle.width, puzzle.height)
		for (let i = 0; i < puzzle.solution.length; i += 1) {
			if (puzzle.solution[i] === 1) {
				const row = Math.floor(i / puzzle.width)
				const col = i % puzzle.width
				state = setFilled(state, row, col)
			}
		}
		expect(isPuzzleComplete(state, puzzle)).toBe(true)
		expect(isFilledSetCorrect(state, puzzle)).toBe(true)
	})

	it('allows CROSSED on empty solution cells for a correct finish', () => {
		let state = createEmptyPlayerState(puzzle.width, puzzle.height)
		for (let i = 0; i < puzzle.solution.length; i += 1) {
			const row = Math.floor(i / puzzle.width)
			const col = i % puzzle.width
			if (puzzle.solution[i] === 1) {
				state = setFilled(state, row, col)
			} else {
				state = setCrossed(state, row, col)
			}
		}
		expect(isPuzzleComplete(state, puzzle)).toBe(true)
	})

	it('rejects extra FILLED marks on empty solution cells', () => {
		const tiny = createPuzzleFromSolution({
			id: 'tiny',
			width: 2,
			height: 1,
			solution: gridFromMatrix([[1, 0]]),
		})
		let state = createEmptyPlayerState(2, 1)
		state = setFilled(state, 0, 0)
		state = setFilled(state, 0, 1)
		expect(isFilledSetCorrect(state, tiny)).toBe(false)
	})
})
