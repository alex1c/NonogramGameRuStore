/**
 * Logical solver foundation — NO GUESSING CONTRACT.
 *
 * Only applies deductions that are forced by line candidate intersection
 * (overlap / completed line / impossible positions eliminated).
 *
 * After each deduction pass, constraints are refreshed to a fixed point.
 * This solver NEVER branches / backtracks / trial-and-errors. If no forced
 * move remains, the status is STALLED — callers must not silently escalate
 * to the complete solver and claim a logical solve.
 */

import { assertValidSpec, cellIndex } from '../domain/nonogram/grid'
import type { PuzzleSpec } from '../domain/nonogram/types'
import {
	generateLineCandidates,
	intersectCandidates,
	type LineKnown,
} from './lineCandidates'
import type { SolverCell } from './completeSolver'

export type LogicalStatus = 'SOLVED' | 'STALLED' | 'INVALID'

export type DeductionReason =
	| 'overlap'
	| 'completed_line'
	| 'impossible_positions_eliminated'
	| 'forced_filled'
	| 'forced_empty'

export type LineOrientation = 'row' | 'column'

export interface LogicalCellAction {
	readonly row: number
	readonly col: number
	readonly action: 'FILLED' | 'EMPTY'
	readonly reason: DeductionReason
}

export interface LogicalStep {
	readonly orientation: LineOrientation
	readonly lineIndex: number
	readonly clue: readonly number[]
	readonly cells: readonly LogicalCellAction[]
	readonly reason: DeductionReason
	readonly candidateCountBefore: number
}

export interface LogicalSolveResult {
	readonly status: LogicalStatus
	readonly grid: readonly SolverCell[]
	readonly steps: readonly LogicalStep[]
	readonly iterations: number
	readonly deductionCount: number
}

function toKnown(cell: SolverCell): LineKnown {
	if (cell === 1) {
		return 'FILLED'
	}
	if (cell === -1) {
		return 'EMPTY'
	}
	return 'UNKNOWN'
}

function classifyReason(
	actions: readonly LogicalCellAction[],
	candidateCount: number,
	clue: readonly number[],
	lineLength: number,
): DeductionReason {
	if (candidateCount === 1) {
		return 'completed_line'
	}

	const onlyFilled = actions.every((action) => action.action === 'FILLED')
	const onlyEmpty = actions.every((action) => action.action === 'EMPTY')

	if (onlyFilled) {
		// Classic overlap: e.g. length 10 clue [8] forces the middle cells.
		const filledSum = clue.reduce((sum, run) => sum + run, 0)
		if (clue.length === 1 && filledSum * 2 > lineLength) {
			return 'overlap'
		}
		return 'forced_filled'
	}

	if (onlyEmpty) {
		return 'forced_empty'
	}

	return 'impossible_positions_eliminated'
}

function readLineKnown(
	grid: SolverCell[],
	width: number,
	height: number,
	orientation: LineOrientation,
	index: number,
): LineKnown[] {
	if (orientation === 'row') {
		const start = index * width
		return grid.slice(start, start + width).map(toKnown)
	}
	const known: LineKnown[] = []
	for (let row = 0; row < height; row += 1) {
		known.push(toKnown(grid[cellIndex(width, row, index)] ?? 0))
	}
	return known
}

function isGridSolved(grid: readonly SolverCell[]): boolean {
	return grid.every((cell) => cell !== 0)
}

/**
 * Compute the next single provable deduction step, or null if stalled/invalid.
 * Does not mutate the input grid.
 */
export function nextLogicalStep(
	spec: PuzzleSpec,
	gridInput: readonly SolverCell[],
): LogicalStep | 'INVALID' | null {
	assertValidSpec(spec)
	const { width, height, rowClues, columnClues } = spec
	const grid = gridInput.slice()

	const lines: {
		orientation: LineOrientation
		index: number
		length: number
		clue: readonly number[]
	}[] = []

	for (let row = 0; row < height; row += 1) {
		const clue = rowClues[row]
		if (clue === undefined) {
			return 'INVALID'
		}
		lines.push({
			orientation: 'row',
			index: row,
			length: width,
			clue,
		})
	}
	for (let col = 0; col < width; col += 1) {
		const clue = columnClues[col]
		if (clue === undefined) {
			return 'INVALID'
		}
		lines.push({
			orientation: 'column',
			index: col,
			length: height,
			clue,
		})
	}

	for (const line of lines) {
		const known = readLineKnown(
			grid,
			width,
			height,
			line.orientation,
			line.index,
		)
		const candidates = generateLineCandidates(
			line.length,
			line.clue,
			known,
		)
		if (candidates.length === 0) {
			return 'INVALID'
		}

		const agreement = intersectCandidates(candidates, line.length)
		const actions: LogicalCellAction[] = []

		for (let i = 0; i < line.length; i += 1) {
			const agreed = agreement[i]
			if (agreed === null || agreed === undefined) {
				continue
			}
			const row =
				line.orientation === 'row' ? line.index : i
			const col =
				line.orientation === 'row' ? i : line.index
			const pos = cellIndex(width, row, col)
			const current = grid[pos] ?? 0
			const target: SolverCell = agreed ? 1 : -1
			if (current === 0) {
				actions.push({
					row,
					col,
					action: agreed ? 'FILLED' : 'EMPTY',
					reason: agreed ? 'forced_filled' : 'forced_empty',
				})
			} else if (current !== target) {
				return 'INVALID'
			}
		}

		if (actions.length === 0) {
			continue
		}

		const reason = classifyReason(
			actions,
			candidates.length,
			line.clue,
			line.length,
		)

		return {
			orientation: line.orientation,
			lineIndex: line.index,
			clue: line.clue,
			cells: actions.map((action) => ({ ...action, reason })),
			reason,
			candidateCountBefore: candidates.length,
		}
	}

	return null
}

function applyStep(grid: SolverCell[], width: number, step: LogicalStep): void {
	for (const cell of step.cells) {
		grid[cellIndex(width, cell.row, cell.col)] =
			cell.action === 'FILLED' ? 1 : -1
	}
}

/**
 * Solve using only guaranteed line deductions to a fixed point.
 * Guarantees: no hidden search/backtracking inside this function.
 */
export function solveLogically(
	spec: PuzzleSpec,
	initialGrid?: readonly SolverCell[],
): LogicalSolveResult {
	assertValidSpec(spec)

	const grid: SolverCell[] =
		initialGrid !== undefined
			? initialGrid.slice()
			: Array.from({ length: spec.width * spec.height }, () => 0)

	if (grid.length !== spec.width * spec.height) {
		throw new Error('Initial grid size does not match puzzle dimensions')
	}

	const steps: LogicalStep[] = []
	let iterations = 0
	let deductionCount = 0

	/**
	 * A fully painted grid is SOLVED only if every line still admits the
	 * painted pattern. Otherwise the deduction chain painted a contradiction.
	 */
	function finalizeIfComplete(): LogicalSolveResult | null {
		if (!isGridSolved(grid)) {
			return null
		}
		const consistency = nextLogicalStep(spec, grid)
		if (consistency === 'INVALID') {
			return {
				status: 'INVALID',
				grid: Object.freeze(grid.slice()),
				steps,
				iterations,
				deductionCount,
			}
		}
		return {
			status: 'SOLVED',
			grid: Object.freeze(grid.slice()),
			steps,
			iterations,
			deductionCount,
		}
	}

	const alreadyComplete = finalizeIfComplete()
	if (alreadyComplete !== null) {
		return alreadyComplete
	}

	// Fixed-point loop: each iteration applies one line deduction batch.
	while (true) {
		iterations += 1
		const step = nextLogicalStep(spec, grid)
		if (step === 'INVALID') {
			return {
				status: 'INVALID',
				grid: Object.freeze(grid.slice()),
				steps,
				iterations,
				deductionCount,
			}
		}
		if (step === null) {
			const complete = finalizeIfComplete()
			if (complete !== null) {
				return complete
			}
			return {
				status: 'STALLED',
				grid: Object.freeze(grid.slice()),
				steps,
				iterations,
				deductionCount,
			}
		}

		applyStep(grid, spec.width, step)
		steps.push(step)
		deductionCount += step.cells.length

		const complete = finalizeIfComplete()
		if (complete !== null) {
			return complete
		}
	}
}
