/**
 * Visual / structural metrics for content audit (not difficulty).
 */

import {
	analyzeComponents,
	boundingBox,
	countFilled,
	fillRatio,
	type Bitmap,
} from './bitmap'
import type { VisualMetrics } from './types'

export function computeVisualMetrics(bitmap: Bitmap): VisualMetrics {
	const height = bitmap.length
	const width = bitmap[0]?.length ?? 0
	const filled = countFilled(bitmap)
	const components = analyzeComponents(bitmap)
	const bbox = boundingBox(bitmap)
	const bboxCoverage =
		bbox === null || width === 0 || height === 0
			? 0
			: (bbox.width * bbox.height) / (width * height)

	let emptyRows = 0
	for (let r = 0; r < height; r += 1) {
		if (bitmap[r]!.every((cell) => cell === 0)) {
			emptyRows += 1
		}
	}
	let emptyCols = 0
	for (let c = 0; c < width; c += 1) {
		let empty = true
		for (let r = 0; r < height; r += 1) {
			if (bitmap[r]![c] === 1) {
				empty = false
				break
			}
		}
		if (empty) {
			emptyCols += 1
		}
	}

	let touchesBorder = false
	for (let c = 0; c < width; c += 1) {
		if (bitmap[0]?.[c] === 1 || bitmap[height - 1]?.[c] === 1) {
			touchesBorder = true
			break
		}
	}
	if (!touchesBorder) {
		for (let r = 0; r < height; r += 1) {
			if (bitmap[r]?.[0] === 1 || bitmap[r]?.[width - 1] === 1) {
				touchesBorder = true
				break
			}
		}
	}

	return {
		fillRatio: fillRatio(bitmap),
		filledCells: filled,
		componentCount: components.count,
		singletons: components.singletons,
		largestShare: components.largestShare,
		bboxCoverage,
		emptyRows,
		emptyCols,
		touchesBorder,
	}
}

/** Structural soft rejects before expensive solvers. */
export function structuralRejectReason(
	bitmap: Bitmap,
): 'empty_or_full' | 'fill_ratio' | 'structural' | null {
	const height = bitmap.length
	const width = bitmap[0]?.length ?? 0
	const cells = width * height
	if (cells === 0) {
		return 'empty_or_full'
	}
	// Reject degenerate canvases (e.g. 1×N) — not usable for gallery review.
	if (width < 3 || height < 3) {
		return 'structural'
	}
	const filled = countFilled(bitmap)
	if (filled === 0 || filled === cells) {
		return 'empty_or_full'
	}
	const ratio = filled / cells
	// Extremely sparse / dense art is usually noise (except rare symbols).
	if (ratio < 0.04 || ratio > 0.96) {
		return 'fill_ratio'
	}
	// Singleton / bbox outliers are reported in audit, not hard-rejected:
	// expert mosaics legitimately contain many disconnected cells.
	return null
}
