/**
 * Conservative clue-line satisfaction for UI dimming.
 *
 * Uses only player FILLED runs vs the clue. Does NOT consult the authored
 * solution. A line is satisfied when:
 * - FILLED runs exactly match the clue, AND
 * - every non-FILLED cell on the line is already CROSSED
 *   (line is fully decided by the player).
 */

import { PlayerCell, type ClueLine, type PlayerState } from '../domain/nonogram/types'
import { generateClueFromLine } from '../domain/nonogram/clues'
import { SolutionCell } from '../domain/nonogram/types'

function runsFromPlayerLine(line: readonly PlayerCell[]): ClueLine {
	const asSolution = line.map((cell) =>
		cell === PlayerCell.FILLED ? SolutionCell.FILLED : SolutionCell.EMPTY,
	)
	return generateClueFromLine(asSolution)
}

function cluesEqual(a: ClueLine, b: ClueLine): boolean {
	if (a.length !== b.length) {
		return false
	}
	for (let i = 0; i < a.length; i += 1) {
		if (a[i] !== b[i]) {
			return false
		}
	}
	return true
}

function lineFullyDecided(line: readonly PlayerCell[]): boolean {
	return line.every(
		(cell) => cell === PlayerCell.FILLED || cell === PlayerCell.CROSSED,
	)
}

export function isPlayerLineSatisfied(
	line: readonly PlayerCell[],
	clue: ClueLine,
): boolean {
	if (!lineFullyDecided(line)) {
		return false
	}
	return cluesEqual(runsFromPlayerLine(line), clue)
}

export function getSatisfiedRows(state: PlayerState, rowClues: readonly ClueLine[]): boolean[] {
	const result: boolean[] = []
	for (let row = 0; row < state.height; row += 1) {
		const start = row * state.width
		const line = state.cells.slice(start, start + state.width)
		const clue = rowClues[row] ?? []
		result.push(isPlayerLineSatisfied(line, clue))
	}
	return result
}

export function getSatisfiedColumns(
	state: PlayerState,
	columnClues: readonly ClueLine[],
): boolean[] {
	const result: boolean[] = []
	for (let col = 0; col < state.width; col += 1) {
		const line: PlayerCell[] = []
		for (let row = 0; row < state.height; row += 1) {
			line.push(state.cells[row * state.width + col]!)
		}
		const clue = columnClues[col] ?? []
		result.push(isPlayerLineSatisfied(line, clue))
	}
	return result
}
