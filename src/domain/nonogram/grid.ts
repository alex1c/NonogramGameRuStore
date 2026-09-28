/**
 * Domain helpers for indexing and reading rectangular grids.
 */

import type { PuzzleSpec } from './types'

export function cellIndex(width: number, row: number, col: number): number {
	return row * width + col
}

export function assertValidSpec(spec: PuzzleSpec): void {
	const { width, height, rowClues, columnClues } = spec

	if (!Number.isInteger(width) || !Number.isInteger(height)) {
		throw new Error('Puzzle dimensions must be integers')
	}
	if (width < 1 || height < 1) {
		throw new Error(`Invalid puzzle dimensions: ${width}x${height}`)
	}
	if (rowClues.length !== height) {
		throw new Error(
			`rowClues length ${rowClues.length} !== height ${height}`,
		)
	}
	if (columnClues.length !== width) {
		throw new Error(
			`columnClues length ${columnClues.length} !== width ${width}`,
		)
	}

	for (let i = 0; i < rowClues.length; i += 1) {
		assertValidClueLine(rowClues[i], width, `row ${i}`)
	}
	for (let i = 0; i < columnClues.length; i += 1) {
		assertValidClueLine(columnClues[i], height, `column ${i}`)
	}
}

function assertValidClueLine(
	clue: readonly number[] | undefined,
	lineLength: number,
	label: string,
): void {
	if (clue === undefined) {
		throw new Error(`Missing clue for ${label}`)
	}

	for (const run of clue) {
		if (!Number.isInteger(run) || run < 1) {
			throw new Error(
				`Invalid run length ${run} in ${label}; empty lines must use []`,
			)
		}
	}

	if (clue.length === 0) {
		return
	}

	const minCells = clue.reduce((sum, run) => sum + run, 0) + (clue.length - 1)
	if (minCells > lineLength) {
		throw new Error(
			`Clue ${JSON.stringify(clue)} cannot fit into ${label} of length ${lineLength}`,
		)
	}
}

/** Minimum cells occupied by a clue including mandatory gaps. */
export function clueMinLength(clue: readonly number[]): number {
	if (clue.length === 0) {
		return 0
	}
	return clue.reduce((sum, run) => sum + run, 0) + (clue.length - 1)
}

/** Total filled cells implied by a clue. */
export function clueFilledCount(clue: readonly number[]): number {
	return clue.reduce((sum, run) => sum + run, 0)
}
