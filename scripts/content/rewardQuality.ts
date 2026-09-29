/**
 * Phase 8B structural reward-quality gate.
 * Rejects obviously primitive production rewards without claiming recognizability.
 */

import {
	boundingBox,
	countFilled,
	type Bitmap,
} from './bitmap'
import type { ContentKind } from './types'

export type RewardQualityFlag =
	| 'line_like'
	| 'tiny_trivial'
	| 'noise_like'
	| 'extreme_density'
	| 'component_outlier'
	| 'simple_high_tier'

export interface RewardQualityResult {
	readonly structuralPass: boolean
	readonly hardReject: boolean
	readonly hardRejectReason: RewardQualityFlag | null
	readonly flags: readonly RewardQualityFlag[]
}

function occupiedRows(bitmap: Bitmap): number {
	let n = 0
	for (const row of bitmap) {
		if (row.some((c) => c === 1)) {
			n += 1
		}
	}
	return n
}

function occupiedCols(bitmap: Bitmap): number {
	const width = bitmap[0]?.length ?? 0
	let n = 0
	for (let c = 0; c < width; c += 1) {
		for (let r = 0; r < bitmap.length; r += 1) {
			if (bitmap[r]![c] === 1) {
				n += 1
				break
			}
		}
	}
	return n
}

function countRuns(bitmap: Bitmap): number {
	let runs = 0
	for (const row of bitmap) {
		let inRun = false
		for (const cell of row) {
			if (cell === 1) {
				if (!inRun) {
					runs += 1
					inRun = true
				}
			} else {
				inRun = false
			}
		}
	}
	for (let c = 0; c < (bitmap[0]?.length ?? 0); c += 1) {
		let inRun = false
		for (let r = 0; r < bitmap.length; r += 1) {
			if (bitmap[r]![c] === 1) {
				if (!inRun) {
					runs += 1
					inRun = true
				}
			} else {
				inRun = false
			}
		}
	}
	return runs
}

/**
 * Structural reward-quality analysis for a candidate bitmap.
 * Symbols get a lighter bar; objects/scenes/patterns must clear harder bars.
 */
export function analyzeRewardQuality(
	bitmap: Bitmap,
	kind: ContentKind,
): RewardQualityResult {
	const height = bitmap.length
	const width = bitmap[0]?.length ?? 0
	const filled = countFilled(bitmap)
	const cells = width * height
	const flags: RewardQualityFlag[] = []
	const bbox = boundingBox(bitmap)
	const rows = occupiedRows(bitmap)
	const cols = occupiedCols(bitmap)
	const runs = countRuns(bitmap)
	const isSymbol = kind === 'symbol'
	const density = cells === 0 ? 0 : filled / cells

	const lineLike =
		(rows <= 1 && cols >= 1 && filled <= Math.max(width, 8)) ||
		(cols <= 1 && rows >= 1 && filled <= Math.max(height, 8)) ||
		(bbox !== null &&
			((bbox.height <= 1 && bbox.width <= 8) ||
				(bbox.width <= 1 && bbox.height <= 8)))

	const tinyTrivial =
		filled <= 4 ||
		(bbox !== null &&
			bbox.width * bbox.height <= 6 &&
			filled <= 6 &&
			runs <= 4) ||
		(rows <= 2 && cols <= 2 && filled <= 6 && !isSymbol)

	const noiseLike =
		!isSymbol &&
		filled >= 12 &&
		runs >= filled * 1.5 &&
		rows >= Math.min(height, 8)

	const extremeDensity = density > 0.92 || density < 0.03

	if (lineLike) {
		flags.push('line_like')
	}
	if (tinyTrivial) {
		flags.push('tiny_trivial')
	}
	if (noiseLike) {
		flags.push('noise_like')
	}
	if (extremeDensity) {
		flags.push('extreme_density')
	}

	let hardRejectReason: RewardQualityFlag | null = null
	if (!isSymbol && lineLike) {
		hardRejectReason = 'line_like'
	} else if (!isSymbol && tinyTrivial) {
		hardRejectReason = 'tiny_trivial'
	} else if (noiseLike) {
		hardRejectReason = 'noise_like'
	}

	// Symbols that are still just a single bar fail production reward quality.
	if (
		isSymbol &&
		lineLike &&
		filled <= Math.max(5, Math.floor(Math.max(width, height) * 0.6))
	) {
		hardRejectReason = 'line_like'
	}

	return {
		structuralPass: hardRejectReason === null,
		hardReject: hardRejectReason !== null,
		hardRejectReason,
		flags: Object.freeze(flags),
	}
}
