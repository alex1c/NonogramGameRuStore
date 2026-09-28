/**
 * Presentation crop for gallery/completion previews.
 * Does not mutate puzzle solution — pure bounding-box trim of empty margins.
 */

import { SolutionCell, type SolutionGrid } from '../domain/nonogram/types'

export interface PixelBounds {
	readonly minRow: number
	readonly maxRow: number
	readonly minCol: number
	readonly maxCol: number
}

export interface CroppedBitmap {
	readonly width: number
	readonly height: number
	/** Row-major 0/1 cells after crop (or original if empty). */
	readonly cells: readonly number[]
	readonly bounds: PixelBounds | null
}

/**
 * Find inclusive bounding box of FILLED cells.
 * Returns null when the solution has no filled cells.
 */
export function findFilledBounds(
	width: number,
	height: number,
	solution: SolutionGrid | readonly number[],
): PixelBounds | null {
	let minRow = height
	let maxRow = -1
	let minCol = width
	let maxCol = -1
	for (let row = 0; row < height; row += 1) {
		for (let col = 0; col < width; col += 1) {
			const value = solution[row * width + col]
			if (value === SolutionCell.FILLED || value === 1) {
				if (row < minRow) minRow = row
				if (row > maxRow) maxRow = row
				if (col < minCol) minCol = col
				if (col > maxCol) maxCol = col
			}
		}
	}
	if (maxRow < 0) {
		return null
	}
	return { minRow, maxRow, minCol, maxCol }
}

/**
 * Crop empty outer rows/columns for presentation.
 * Edge-touching objects keep original dimensions.
 * All-empty → safe 1×1 empty cell (should not appear as production art).
 */
export function cropSolutionBitmap(
	width: number,
	height: number,
	solution: SolutionGrid | readonly number[],
): CroppedBitmap {
	const bounds = findFilledBounds(width, height, solution)
	if (bounds === null) {
		return {
			width: 1,
			height: 1,
			cells: Object.freeze([0]),
			bounds: null,
		}
	}
	const cropW = bounds.maxCol - bounds.minCol + 1
	const cropH = bounds.maxRow - bounds.minRow + 1
	const cells: number[] = []
	for (let row = bounds.minRow; row <= bounds.maxRow; row += 1) {
		for (let col = bounds.minCol; col <= bounds.maxCol; col += 1) {
			const value = solution[row * width + col]
			cells.push(value === SolutionCell.FILLED || value === 1 ? 1 : 0)
		}
	}
	return {
		width: cropW,
		height: cropH,
		cells: Object.freeze(cells),
		bounds,
	}
}
