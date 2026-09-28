/**
 * Deterministic clue generation from a solution line / grid.
 */

import {
	EMPTY_LINE_CLUE,
	type ClueLine,
	type Puzzle,
	type PuzzleMetadata,
	type SolutionCell,
	type SolutionGrid,
} from './types'
import { SolutionCell as SC } from './types'

/**
 * Build the canonical clue for one black-and-white line.
 *
 * Runs of consecutive FILLED cells become clue numbers.
 * A fully empty line returns EMPTY_LINE_CLUE (`[]`), never `[0]`.
 */
export function generateClueFromLine(
	line: readonly SolutionCell[],
): ClueLine {
	const runs: number[] = []
	let run = 0

	for (const cell of line) {
		if (cell === SC.FILLED) {
			run += 1
		} else if (run > 0) {
			runs.push(run)
			run = 0
		}
	}

	if (run > 0) {
		runs.push(run)
	}

	return runs.length === 0 ? EMPTY_LINE_CLUE : Object.freeze(runs)
}

/** Extract a row (left → right) from a row-major solution grid. */
export function getSolutionRow(
	solution: SolutionGrid,
	width: number,
	row: number,
): SolutionCell[] {
	const start = row * width
	return Array.from(solution.slice(start, start + width))
}

/** Extract a column (top → bottom) from a row-major solution grid. */
export function getSolutionColumn(
	solution: SolutionGrid,
	width: number,
	height: number,
	column: number,
): SolutionCell[] {
	const cells: SolutionCell[] = []
	for (let row = 0; row < height; row += 1) {
		const cell = solution[row * width + column]
		if (cell === undefined) {
			throw new Error(
				`Solution grid missing cell at row=${row} col=${column}`,
			)
		}
		cells.push(cell)
	}
	return cells
}

/** Generate all row clues from a solution bitmap. */
export function generateRowClues(
	solution: SolutionGrid,
	width: number,
	height: number,
): readonly ClueLine[] {
	const clues: ClueLine[] = []
	for (let row = 0; row < height; row += 1) {
		clues.push(generateClueFromLine(getSolutionRow(solution, width, row)))
	}
	return Object.freeze(clues)
}

/** Generate all column clues from a solution bitmap. */
export function generateColumnClues(
	solution: SolutionGrid,
	width: number,
	height: number,
): readonly ClueLine[] {
	const clues: ClueLine[] = []
	for (let col = 0; col < width; col += 1) {
		clues.push(
			generateClueFromLine(
				getSolutionColumn(solution, width, height, col),
			),
		)
	}
	return Object.freeze(clues)
}

export interface CreatePuzzleInput {
	readonly id: string
	readonly width: number
	readonly height: number
	readonly solution: SolutionGrid
	readonly metadata?: PuzzleMetadata
}

/**
 * Create a puzzle from a solution bitmap, deriving clues deterministically.
 * Throws if the solution length does not match width * height.
 */
export function createPuzzleFromSolution(input: CreatePuzzleInput): Puzzle {
	const { id, width, height, solution, metadata = {} } = input

	if (width < 1 || height < 1) {
		throw new Error(`Invalid puzzle dimensions: ${width}x${height}`)
	}

	if (solution.length !== width * height) {
		throw new Error(
			`Solution length ${solution.length} !== ${width}*${height}`,
		)
	}

	for (const cell of solution) {
		if (cell !== SC.EMPTY && cell !== SC.FILLED) {
			throw new Error(`Invalid solution cell value: ${cell}`)
		}
	}

	return Object.freeze({
		id,
		width,
		height,
		solution: Object.freeze(Array.from(solution)),
		rowClues: generateRowClues(solution, width, height),
		columnClues: generateColumnClues(solution, width, height),
		metadata: Object.freeze({ ...metadata }),
	})
}

/** Convert a 2D 0/1 matrix into a row-major SolutionGrid. */
export function gridFromMatrix(
	matrix: readonly (readonly number[])[],
): SolutionGrid {
	const height = matrix.length
	if (height === 0) {
		throw new Error('Matrix must have at least one row')
	}
	const width = matrix[0]?.length
	if (width === undefined || width === 0) {
		throw new Error('Matrix must have at least one column')
	}

	const cells: SolutionCell[] = []
	for (let row = 0; row < height; row += 1) {
		const line = matrix[row]
		if (line === undefined || line.length !== width) {
			throw new Error(`Matrix row ${row} has inconsistent width`)
		}
		for (const value of line) {
			if (value !== 0 && value !== 1) {
				throw new Error(`Matrix values must be 0 or 1, got ${value}`)
			}
			cells.push(value === 1 ? SC.FILLED : SC.EMPTY)
		}
	}
	return Object.freeze(cells)
}
