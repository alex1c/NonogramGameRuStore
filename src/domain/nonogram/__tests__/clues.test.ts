/**
 * Clue generator unit tests.
 */

import {
	EMPTY_LINE_CLUE,
	generateClueFromLine,
	createPuzzleFromSolution,
	gridFromMatrix,
} from '..'
import { SolutionCell } from '../types'
import {
	FIXTURE_B_MULTI_BLOCK,
	FIXTURE_C_EMPTY_LINE,
	FIXTURE_D_FULL_LINE,
} from '../../../tests/fixtures/nonogramFixtures'

describe('generateClueFromLine', () => {
	it('maps a single contiguous block', () => {
		expect(
			generateClueFromLine([
				SolutionCell.EMPTY,
				SolutionCell.FILLED,
				SolutionCell.FILLED,
				SolutionCell.FILLED,
				SolutionCell.EMPTY,
			]),
		).toEqual([3])
	})

	it('maps multiple blocks', () => {
		expect(
			generateClueFromLine([
				SolutionCell.FILLED,
				SolutionCell.FILLED,
				SolutionCell.EMPTY,
				SolutionCell.FILLED,
				SolutionCell.EMPTY,
				SolutionCell.FILLED,
				SolutionCell.FILLED,
			]),
		).toEqual([2, 1, 2])
	})

	it('uses [] for a fully empty line (never [0])', () => {
		expect(
			generateClueFromLine([
				SolutionCell.EMPTY,
				SolutionCell.EMPTY,
				SolutionCell.EMPTY,
			]),
		).toBe(EMPTY_LINE_CLUE)
		expect(
			generateClueFromLine([
				SolutionCell.EMPTY,
				SolutionCell.EMPTY,
				SolutionCell.EMPTY,
			]),
		).toEqual([])
	})

	it('maps a fully filled line to a single clue', () => {
		expect(
			generateClueFromLine([
				SolutionCell.FILLED,
				SolutionCell.FILLED,
				SolutionCell.FILLED,
				SolutionCell.FILLED,
			]),
		).toEqual([4])
	})
})

describe('createPuzzleFromSolution', () => {
	it('derives multi-block row clues for fixture B', () => {
		expect(FIXTURE_B_MULTI_BLOCK.rowClues[0]).toEqual([2, 1, 2])
	})

	it('represents empty lines as [] in fixture C', () => {
		expect(FIXTURE_C_EMPTY_LINE.rowClues[1]).toEqual([])
		expect(FIXTURE_C_EMPTY_LINE.columnClues[2]).toEqual([])
	})

	it('represents a full row as [width] in fixture D', () => {
		expect(FIXTURE_D_FULL_LINE.rowClues[0]).toEqual([5])
		expect(FIXTURE_D_FULL_LINE.rowClues[2]).toEqual([5])
	})

	it('supports rectangular boards', () => {
		const puzzle = createPuzzleFromSolution({
			id: 'rect',
			width: 3,
			height: 2,
			solution: gridFromMatrix([
				[1, 0, 1],
				[1, 1, 0],
			]),
		})
		expect(puzzle.width).toBe(3)
		expect(puzzle.height).toBe(2)
		expect(puzzle.rowClues).toEqual([[1, 1], [2]])
		expect(puzzle.columnClues).toEqual([[2], [1], [1]])
	})
})
