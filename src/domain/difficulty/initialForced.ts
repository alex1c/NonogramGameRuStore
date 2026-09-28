/**
 * Initial forced-cell analysis using line-candidate intersection only.
 *
 * From an empty grid, each row/column is examined independently (no chained
 * propagation). Cells agreed by all candidates of any line are counted.
 * Authored solutions are never consulted.
 */

import { assertValidSpec, cellIndex } from '../nonogram/grid'
import type { PuzzleSpec } from '../nonogram/types'
import {
	generateLineCandidates,
	intersectCandidates,
} from '../../solver/lineCandidates'

export interface InitialForcedAnalysis {
	readonly forcedCells: number
	readonly forcedRatio: number
	readonly linesWithForce: number
	readonly cellCount: number
}

export function analyzeInitialForced(
	spec: PuzzleSpec,
): InitialForcedAnalysis {
	assertValidSpec(spec)
	const { width, height, rowClues, columnClues } = spec
	const cellCount = width * height
	const forced = new Set<number>()
	let linesWithForce = 0

	const emptyKnown = (length: number) =>
		Array.from({ length }, () => 'UNKNOWN' as const)

	for (let row = 0; row < height; row += 1) {
		const clue = rowClues[row]
		if (clue === undefined) {
			continue
		}
		const candidates = generateLineCandidates(
			width,
			clue,
			emptyKnown(width),
		)
		if (candidates.length === 0) {
			continue
		}
		const agreement = intersectCandidates(candidates, width)
		let lineForced = 0
		for (let col = 0; col < width; col += 1) {
			if (agreement[col] !== null && agreement[col] !== undefined) {
				forced.add(cellIndex(width, row, col))
				lineForced += 1
			}
		}
		if (lineForced > 0) {
			linesWithForce += 1
		}
	}

	for (let col = 0; col < width; col += 1) {
		const clue = columnClues[col]
		if (clue === undefined) {
			continue
		}
		const candidates = generateLineCandidates(
			height,
			clue,
			emptyKnown(height),
		)
		if (candidates.length === 0) {
			continue
		}
		const agreement = intersectCandidates(candidates, height)
		let lineForced = 0
		for (let row = 0; row < height; row += 1) {
			if (agreement[row] !== null && agreement[row] !== undefined) {
				forced.add(cellIndex(width, row, col))
				lineForced += 1
			}
		}
		if (lineForced > 0) {
			linesWithForce += 1
		}
	}

	return {
		forcedCells: forced.size,
		forcedRatio: cellCount === 0 ? 0 : forced.size / cellCount,
		linesWithForce,
		cellCount,
	}
}
