/**
 * Line candidate generation for black-and-white nonograms.
 *
 * A candidate is a boolean array (true = FILLED, false = EMPTY) that matches
 * the clue and any already-known cell constraints.
 */

import { clueMinLength } from '../domain/nonogram/grid'
import type { ClueLine } from '../domain/nonogram/types'

/** Known constraint on a single cell while generating candidates. */
export type LineKnown = 'UNKNOWN' | 'FILLED' | 'EMPTY'

/**
 * Generate every placement of the clue blocks inside a line of the given length.
 * Deterministic order: left-to-right earliest block starts first.
 */
export function generateLineCandidates(
	length: number,
	clue: ClueLine,
	known: readonly LineKnown[] = Array.from(
		{ length },
		() => 'UNKNOWN' as const,
	),
): boolean[][] {
	if (known.length !== length) {
		throw new Error(
			`Known mask length ${known.length} !== line length ${length}`,
		)
	}

	if (clueMinLength(clue) > length) {
		return []
	}

	const results: boolean[][] = []

	function fitsKnown(cells: boolean[]): boolean {
		for (let i = 0; i < length; i += 1) {
			const constraint = known[i]
			if (constraint === 'FILLED' && cells[i] !== true) {
				return false
			}
			if (constraint === 'EMPTY' && cells[i] !== false) {
				return false
			}
		}
		return true
	}

	function place(blockIndex: number, start: number, cells: boolean[]): void {
		if (blockIndex >= clue.length) {
			// Remaining cells stay empty; validate against known constraints.
			if (fitsKnown(cells)) {
				results.push(cells.slice())
			}
			return
		}

		const run = clue[blockIndex]
		if (run === undefined) {
			return
		}

		const remainingBlocks = clue.slice(blockIndex + 1)
		const reserved =
			remainingBlocks.reduce((sum, value) => sum + value, 0) +
			remainingBlocks.length
		const maxStart = length - run - reserved

		for (let pos = start; pos <= maxStart; pos += 1) {
			const next = cells.slice()
			let valid = true

			// Gap before this block (except for the first block) is already empty.
			for (let i = 0; i < run; i += 1) {
				const index = pos + i
				if (known[index] === 'EMPTY') {
					valid = false
					break
				}
				next[index] = true
			}
			if (!valid) {
				continue
			}

			// Mandatory gap after block when another block remains.
			const nextStart = pos + run
			if (blockIndex + 1 < clue.length) {
				if (nextStart >= length || known[nextStart] === 'FILLED') {
					continue
				}
				next[nextStart] = false
				place(blockIndex + 1, nextStart + 1, next)
			} else {
				place(blockIndex + 1, nextStart, next)
			}
		}
	}

	if (clue.length === 0) {
		const empty = Array.from({ length }, () => false)
		if (fitsKnown(empty)) {
			results.push(empty)
		}
		return results
	}

	place(0, 0, Array.from({ length }, () => false))
	return results
}

/**
 * Cells that share the same value in every candidate.
 * Returns null entries where candidates disagree.
 */
export function intersectCandidates(
	candidates: readonly boolean[][],
	length: number,
): (boolean | null)[] {
	if (candidates.length === 0) {
		return Array.from({ length }, () => null)
	}

	const agreed: (boolean | null)[] = Array.from({ length }, () => null)
	const first = candidates[0]
	if (first === undefined) {
		return agreed
	}

	for (let i = 0; i < length; i += 1) {
		const value = first[i]
		if (value === undefined) {
			agreed[i] = null
			continue
		}
		let same = true
		for (let c = 1; c < candidates.length; c += 1) {
			if (candidates[c]?.[i] !== value) {
				same = false
				break
			}
		}
		agreed[i] = same ? value : null
	}

	return agreed
}
