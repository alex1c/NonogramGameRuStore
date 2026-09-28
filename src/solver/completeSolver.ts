/**
 * Complete solver: constraint propagation + controlled search.
 *
 * Purpose: prove existence / uniqueness (0, 1, or >1 solutions).
 * Does NOT claim logical (no-guess) solvability — see logicalSolver.ts.
 *
 * Early-stops after finding `maxSolutions` (default 2 for uniqueness checks).
 */

import { assertValidSpec, cellIndex } from '../domain/nonogram/grid'
import type { PuzzleSpec } from '../domain/nonogram/types'
import {
	generateLineCandidates,
	intersectCandidates,
	type LineKnown,
} from './lineCandidates'

/** Solver grid cell: unknown / filled / empty (empty ≡ crossed in UI terms). */
export type SolverCell = 0 | 1 | -1
// 0 = UNKNOWN, 1 = FILLED, -1 = EMPTY

export interface CompleteSolveOptions {
	/** Stop after this many solutions (2 is enough for uniqueness). */
	readonly maxSolutions?: number
}

export interface CompleteSolveResult {
	readonly solutionCount: number
	/** Up to maxSolutions grids (row-major 0/1). */
	readonly solutions: readonly (readonly number[])[]
	readonly unique: boolean
	readonly timedOut: boolean
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

function readLine(
	grid: SolverCell[],
	width: number,
	height: number,
	orientation: 'row' | 'column',
	index: number,
): SolverCell[] {
	if (orientation === 'row') {
		const start = index * width
		return grid.slice(start, start + width)
	}
	const cells: SolverCell[] = []
	for (let row = 0; row < height; row += 1) {
		const value = grid[cellIndex(width, row, index)]
		cells.push(value ?? 0)
	}
	return cells
}

function writeLine(
	grid: SolverCell[],
	width: number,
	height: number,
	orientation: 'row' | 'column',
	index: number,
	values: readonly boolean[],
): void {
	if (orientation === 'row') {
		for (let col = 0; col < width; col += 1) {
			grid[cellIndex(width, index, col)] = values[col] ? 1 : -1
		}
		return
	}
	for (let row = 0; row < height; row += 1) {
		grid[cellIndex(width, row, index)] = values[row] ? 1 : -1
	}
}

function applyAgreement(
	grid: SolverCell[],
	width: number,
	height: number,
	orientation: 'row' | 'column',
	index: number,
	agreement: readonly (boolean | null)[],
): boolean {
	let changed = false
	const length = orientation === 'row' ? width : height

	for (let i = 0; i < length; i += 1) {
		const agreed = agreement[i]
		if (agreed === null || agreed === undefined) {
			continue
		}
		const target: SolverCell = agreed ? 1 : -1
		const pos =
			orientation === 'row'
				? cellIndex(width, index, i)
				: cellIndex(width, i, index)
		const current = grid[pos] ?? 0
		if (current === 0) {
			grid[pos] = target
			changed = true
		} else if (current !== target) {
			throw new ContradictionError()
		}
	}
	return changed
}

class ContradictionError extends Error {
	constructor() {
		super('Contradiction while propagating nonogram constraints')
		this.name = 'ContradictionError'
	}
}

/**
 * Propagate forced cells until a fixed point or contradiction.
 * Returns false on contradiction.
 */
export function propagate(
	grid: SolverCell[],
	spec: PuzzleSpec,
): boolean {
	const { width, height, rowClues, columnClues } = spec

	try {
		let changed = true
		while (changed) {
			changed = false

			for (let row = 0; row < height; row += 1) {
				const line = readLine(grid, width, height, 'row', row)
				const known = line.map(toKnown)
				const clue = rowClues[row]
				if (clue === undefined) {
					return false
				}
				const candidates = generateLineCandidates(width, clue, known)
				if (candidates.length === 0) {
					return false
				}
				const agreement = intersectCandidates(candidates, width)
				if (applyAgreement(grid, width, height, 'row', row, agreement)) {
					changed = true
				}
			}

			for (let col = 0; col < width; col += 1) {
				const line = readLine(grid, width, height, 'column', col)
				const known = line.map(toKnown)
				const clue = columnClues[col]
				if (clue === undefined) {
					return false
				}
				const candidates = generateLineCandidates(height, clue, known)
				if (candidates.length === 0) {
					return false
				}
				const agreement = intersectCandidates(candidates, height)
				if (
					applyAgreement(grid, width, height, 'column', col, agreement)
				) {
					changed = true
				}
			}
		}
		return true
	} catch (error) {
		if (error instanceof ContradictionError) {
			return false
		}
		throw error
	}
}

function isComplete(grid: SolverCell[]): boolean {
	return grid.every((cell) => cell !== 0)
}

function toBinarySolution(grid: SolverCell[]): number[] {
	return grid.map((cell) => (cell === 1 ? 1 : 0))
}

interface LineChoice {
	readonly orientation: 'row' | 'column'
	readonly index: number
	readonly candidates: boolean[][]
}

function pickBranch(
	grid: SolverCell[],
	spec: PuzzleSpec,
): LineChoice | null {
	const { width, height, rowClues, columnClues } = spec
	let best: LineChoice | null = null

	for (let row = 0; row < height; row += 1) {
		const line = readLine(grid, width, height, 'row', row)
		if (line.every((cell) => cell !== 0)) {
			continue
		}
		const clue = rowClues[row]
		if (clue === undefined) {
			continue
		}
		const candidates = generateLineCandidates(
			width,
			clue,
			line.map(toKnown),
		)
		if (candidates.length <= 1) {
			continue
		}
		if (best === null || candidates.length < best.candidates.length) {
			best = { orientation: 'row', index: row, candidates }
		}
	}

	for (let col = 0; col < width; col += 1) {
		const line = readLine(grid, width, height, 'column', col)
		if (line.every((cell) => cell !== 0)) {
			continue
		}
		const clue = columnClues[col]
		if (clue === undefined) {
			continue
		}
		const candidates = generateLineCandidates(
			height,
			clue,
			line.map(toKnown),
		)
		if (candidates.length <= 1) {
			continue
		}
		if (best === null || candidates.length < best.candidates.length) {
			best = { orientation: 'column', index: col, candidates }
		}
	}

	return best
}

function search(
	grid: SolverCell[],
	spec: PuzzleSpec,
	maxSolutions: number,
	found: number[][],
): void {
	if (found.length >= maxSolutions) {
		return
	}

	if (!propagate(grid, spec)) {
		return
	}

	if (isComplete(grid)) {
		found.push(toBinarySolution(grid))
		return
	}

	const branch = pickBranch(grid, spec)
	if (branch === null) {
		// No unknown cells with multiple candidates — treat as complete or dead.
		if (isComplete(grid)) {
			found.push(toBinarySolution(grid))
		}
		return
	}

	for (const candidate of branch.candidates) {
		if (found.length >= maxSolutions) {
			return
		}
		const next = grid.slice()
		writeLine(
			next,
			spec.width,
			spec.height,
			branch.orientation,
			branch.index,
			candidate,
		)
		search(next, spec, maxSolutions, found)
	}
}

/**
 * Solve a clue-only puzzle spec.
 * Never reads an authored solution bitmap — only dimensions + clues.
 */
export function solveComplete(
	spec: PuzzleSpec,
	options: CompleteSolveOptions = {},
): CompleteSolveResult {
	assertValidSpec(spec)

	const maxSolutions = options.maxSolutions ?? 2
	if (maxSolutions < 1) {
		throw new Error('maxSolutions must be >= 1')
	}

	const grid: SolverCell[] = Array.from(
		{ length: spec.width * spec.height },
		() => 0,
	)
	const found: number[][] = []
	search(grid, spec, maxSolutions, found)

	return {
		solutionCount: found.length,
		solutions: found.map((solution) => Object.freeze(solution)),
		unique: found.length === 1,
		timedOut: false,
	}
}

/** Convenience: true iff the clue set has exactly one solution. */
export function hasUniqueSolution(spec: PuzzleSpec): boolean {
	return solveComplete(spec, { maxSolutions: 2 }).unique
}

export function puzzleToSpec(puzzle: {
	readonly width: number
	readonly height: number
	readonly rowClues: PuzzleSpec['rowClues']
	readonly columnClues: PuzzleSpec['columnClues']
}): PuzzleSpec {
	return {
		width: puzzle.width,
		height: puzzle.height,
		rowClues: puzzle.rowClues,
		columnClues: puzzle.columnClues,
	}
}
