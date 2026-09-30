/**
 * Phase 8B.1 structural reward-quality + risk scoring.
 * Heuristic only — does NOT claim human recognizability.
 * Title must never affect results (bitmap + kind only).
 */

import {
	boundingBox,
	countFilled,
	type Bitmap,
	type Bit,
} from './bitmap'
import type { ContentKind } from './types'

export type RewardQualityFlag =
	| 'line_like'
	| 'tiny_trivial'
	| 'noise_like'
	| 'extreme_density'
	| 'component_outlier'
	| 'simple_high_tier'
	| 'low_row_diversity'
	| 'low_column_diversity'
	| 'low_transition_complexity'
	| 'solid_blob'
	| 'corner_like'
	| 'vertical_blob'
	| 'tiny_box'
	| 'low_bbox_usage'
	| 'excessive_components'

export interface RewardQualityMetrics {
	readonly width: number
	readonly height: number
	readonly filled: number
	readonly occupiedRows: number
	readonly occupiedCols: number
	readonly bboxWidth: number
	readonly bboxHeight: number
	readonly bboxArea: number
	readonly fillInBbox: number
	readonly rowDiversity: number
	readonly columnDiversity: number
	readonly horizontalTransitions: number
	readonly verticalTransitions: number
	readonly transitionDensity: number
	readonly runCount: number
	readonly runLengthDiversity: number
	readonly perimeter: number
	readonly perimeterRatio: number
	readonly holeCount: number
	readonly componentCount: number
	readonly largestComponentRatio: number
	readonly bboxCoverage: number
}

export interface RewardQualityResult {
	readonly structuralPass: boolean
	readonly hardReject: boolean
	readonly hardRejectReason: RewardQualityFlag | null
	readonly flags: readonly RewardQualityFlag[]
	readonly metrics: RewardQualityMetrics
	/** 0 = clean, 1 = extreme risk. Used for Worst-20 ranking only. */
	readonly riskScore: number
	readonly riskReasons: readonly RewardQualityFlag[]
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

function countRuns(bitmap: Bitmap): { count: number; lengths: number[] } {
	const lengths: number[] = []
	let count = 0
	for (const row of bitmap) {
		let inRun = false
		let len = 0
		for (const cell of row) {
			if (cell === 1) {
				if (!inRun) {
					count += 1
					inRun = true
					len = 1
				} else {
					len += 1
				}
			} else if (inRun) {
				lengths.push(len)
				inRun = false
				len = 0
			}
		}
		if (inRun) {
			lengths.push(len)
		}
	}
	for (let c = 0; c < (bitmap[0]?.length ?? 0); c += 1) {
		let inRun = false
		let len = 0
		for (let r = 0; r < bitmap.length; r += 1) {
			if (bitmap[r]![c] === 1) {
				if (!inRun) {
					count += 1
					inRun = true
					len = 1
				} else {
					len += 1
				}
			} else if (inRun) {
				lengths.push(len)
				inRun = false
				len = 0
			}
		}
		if (inRun) {
			lengths.push(len)
		}
	}
	return { count, lengths }
}

function rowSignaturesInBbox(
	bitmap: Bitmap,
	minR: number,
	maxR: number,
	minC: number,
	maxC: number,
): {
	diversity: number
	unique: number
	total: number
	dominantShare: number
} {
	const counts = new Map<string, number>()
	let total = 0
	for (let r = minR; r <= maxR; r += 1) {
		const row = bitmap[r]!
		let any = false
		const parts: string[] = []
		for (let c = minC; c <= maxC; c += 1) {
			const bit = row[c] ?? 0
			parts.push(String(bit))
			if (bit === 1) {
				any = true
			}
		}
		if (any) {
			total += 1
			const sig = parts.join('')
			counts.set(sig, (counts.get(sig) ?? 0) + 1)
		}
	}
	const unique = counts.size
	let dominant = 0
	for (const n of counts.values()) {
		dominant = Math.max(dominant, n)
	}
	return {
		unique,
		total,
		diversity: total === 0 ? 0 : unique / total,
		dominantShare: total === 0 ? 0 : dominant / total,
	}
}

function colSignaturesInBbox(
	bitmap: Bitmap,
	minR: number,
	maxR: number,
	minC: number,
	maxC: number,
): {
	diversity: number
	unique: number
	total: number
	dominantShare: number
} {
	const counts = new Map<string, number>()
	let total = 0
	for (let c = minC; c <= maxC; c += 1) {
		let any = false
		const parts: string[] = []
		for (let r = minR; r <= maxR; r += 1) {
			const bit = bitmap[r]![c] ?? 0
			parts.push(String(bit))
			if (bit === 1) {
				any = true
			}
		}
		if (any) {
			total += 1
			const sig = parts.join('')
			counts.set(sig, (counts.get(sig) ?? 0) + 1)
		}
	}
	const unique = counts.size
	let dominant = 0
	for (const n of counts.values()) {
		dominant = Math.max(dominant, n)
	}
	return {
		unique,
		total,
		diversity: total === 0 ? 0 : unique / total,
		dominantShare: total === 0 ? 0 : dominant / total,
	}
}

function countTransitions(bitmap: Bitmap): {
	horizontal: number
	vertical: number
} {
	let horizontal = 0
	let vertical = 0
	const h = bitmap.length
	const w = bitmap[0]?.length ?? 0
	for (let r = 0; r < h; r += 1) {
		for (let c = 1; c < w; c += 1) {
			if (bitmap[r]![c] !== bitmap[r]![c - 1]) {
				horizontal += 1
			}
		}
	}
	for (let c = 0; c < w; c += 1) {
		for (let r = 1; r < h; r += 1) {
			if (bitmap[r]![c] !== bitmap[r - 1]![c]) {
				vertical += 1
			}
		}
	}
	return { horizontal, vertical }
}

/** Perimeter: filled cells with an empty/out-of-bounds 4-neighbor. */
function perimeterComplexity(bitmap: Bitmap): number {
	const h = bitmap.length
	const w = bitmap[0]?.length ?? 0
	let peri = 0
	const dirs = [
		[0, 1],
		[0, -1],
		[1, 0],
		[-1, 0],
	] as const
	for (let r = 0; r < h; r += 1) {
		for (let c = 0; c < w; c += 1) {
			if (bitmap[r]![c] !== 1) {
				continue
			}
			for (const [dr, dc] of dirs) {
				const nr = r + dr
				const nc = c + dc
				if (
					nr < 0 ||
					nc < 0 ||
					nr >= h ||
					nc >= w ||
					bitmap[nr]![nc] === 0
				) {
					peri += 1
					break
				}
			}
		}
	}
	return peri
}

function componentStats(bitmap: Bitmap): {
	count: number
	largestShare: number
} {
	const h = bitmap.length
	const w = bitmap[0]?.length ?? 0
	const seen: boolean[][] = Array.from({ length: h }, () =>
		Array.from({ length: w }, () => false),
	)
	let count = 0
	let largest = 0
	let filled = 0
	const dirs = [
		[0, 1],
		[0, -1],
		[1, 0],
		[-1, 0],
	] as const
	for (let r = 0; r < h; r += 1) {
		for (let c = 0; c < w; c += 1) {
			if (bitmap[r]![c] !== 1 || seen[r]![c]) {
				continue
			}
			count += 1
			let size = 0
			const stack: Array<[number, number]> = [[r, c]]
			seen[r]![c] = true
			while (stack.length > 0) {
				const [cr, cc] = stack.pop()!
				size += 1
				filled += 1
				for (const [dr, dc] of dirs) {
					const nr = cr + dr
					const nc = cc + dc
					if (
						nr < 0 ||
						nc < 0 ||
						nr >= h ||
						nc >= w ||
						seen[nr]![nc] ||
						bitmap[nr]![nc] !== 1
					) {
						continue
					}
					seen[nr]![nc] = true
					stack.push([nr, nc])
				}
			}
			largest = Math.max(largest, size)
		}
	}
	return {
		count,
		largestShare: filled === 0 ? 0 : largest / filled,
	}
}

/**
 * Approximate holes: empty cells not reachable from the canvas border
 * through empty 4-neighbors (interior negative space).
 */
function countHoles(bitmap: Bitmap): number {
	const h = bitmap.length
	const w = bitmap[0]?.length ?? 0
	if (h === 0 || w === 0) {
		return 0
	}
	const exterior: boolean[][] = Array.from({ length: h }, () =>
		Array.from({ length: w }, () => false),
	)
	const stack: Array<[number, number]> = []
	const dirs = [
		[0, 1],
		[0, -1],
		[1, 0],
		[-1, 0],
	] as const
	for (let r = 0; r < h; r += 1) {
		for (const c of [0, w - 1]) {
			if (bitmap[r]![c] === 0 && !exterior[r]![c]) {
				exterior[r]![c] = true
				stack.push([r, c])
			}
		}
	}
	for (let c = 0; c < w; c += 1) {
		for (const r of [0, h - 1]) {
			if (bitmap[r]![c] === 0 && !exterior[r]![c]) {
				exterior[r]![c] = true
				stack.push([r, c])
			}
		}
	}
	while (stack.length > 0) {
		const [cr, cc] = stack.pop()!
		for (const [dr, dc] of dirs) {
			const nr = cr + dr
			const nc = cc + dc
			if (
				nr < 0 ||
				nc < 0 ||
				nr >= h ||
				nc >= w ||
				exterior[nr]![nc] ||
				bitmap[nr]![nc] !== 0
			) {
				continue
			}
			exterior[nr]![nc] = true
			stack.push([nr, nc])
		}
	}
	// Count connected components of non-exterior empty cells.
	const seen: boolean[][] = Array.from({ length: h }, () =>
		Array.from({ length: w }, () => false),
	)
	let holes = 0
	for (let r = 0; r < h; r += 1) {
		for (let c = 0; c < w; c += 1) {
			if (bitmap[r]![c] !== 0 || exterior[r]![c] || seen[r]![c]) {
				continue
			}
			holes += 1
			const q: Array<[number, number]> = [[r, c]]
			seen[r]![c] = true
			while (q.length > 0) {
				const [cr, cc] = q.pop()!
				for (const [dr, dc] of dirs) {
					const nr = cr + dr
					const nc = cc + dc
					if (
						nr < 0 ||
						nc < 0 ||
						nr >= h ||
						nc >= w ||
						seen[nr]![nc] ||
						bitmap[nr]![nc] !== 0 ||
						exterior[nr]![nc]
					) {
						continue
					}
					seen[nr]![nc] = true
					q.push([nr, nc])
				}
			}
		}
	}
	return holes
}

function isCornerLike(
	bitmap: Bitmap,
	bbox: NonNullable<ReturnType<typeof boundingBox>>,
	filled: number,
): boolean {
	// Classic L: two arms with little other fill.
	if (bbox.width < 3 || bbox.height < 3) {
		return false
	}
	// Allow filled ≈ armW + armH - 1 (shared corner), plus tiny noise.
	if (filled > bbox.width + bbox.height + 1) {
		return false
	}
	const { minRow, maxRow, minCol, maxCol } = bbox
	let top = 0
	let bottom = 0
	let left = 0
	let right = 0
	for (let c = minCol; c <= maxCol; c += 1) {
		if (bitmap[minRow]![c] === 1) {
			top += 1
		}
		if (bitmap[maxRow]![c] === 1) {
			bottom += 1
		}
	}
	for (let r = minRow; r <= maxRow; r += 1) {
		if (bitmap[r]![minCol] === 1) {
			left += 1
		}
		if (bitmap[r]![maxCol] === 1) {
			right += 1
		}
	}
	const armPairs = [
		[top, left],
		[top, right],
		[bottom, left],
		[bottom, right],
	]
	for (const [a, b] of armPairs) {
		if (
			a >= Math.max(3, Math.floor(bbox.width * 0.6)) &&
			b >= Math.max(3, Math.floor(bbox.height * 0.6)) &&
			filled <= a + b - 1 + 2
		) {
			return true
		}
	}
	return false
}

function emptyMetrics(width: number, height: number): RewardQualityMetrics {
	return {
		width,
		height,
		filled: 0,
		occupiedRows: 0,
		occupiedCols: 0,
		bboxWidth: 0,
		bboxHeight: 0,
		bboxArea: 0,
		fillInBbox: 0,
		rowDiversity: 0,
		columnDiversity: 0,
		horizontalTransitions: 0,
		verticalTransitions: 0,
		transitionDensity: 0,
		runCount: 0,
		runLengthDiversity: 0,
		perimeter: 0,
		perimeterRatio: 0,
		holeCount: 0,
		componentCount: 0,
		largestComponentRatio: 0,
		bboxCoverage: 0,
	}
}

function computeRiskScore(flags: readonly RewardQualityFlag[]): {
	score: number
	reasons: RewardQualityFlag[]
} {
	const weights: Partial<Record<RewardQualityFlag, number>> = {
		line_like: 0.35,
		tiny_trivial: 0.35,
		noise_like: 0.4,
		solid_blob: 0.28,
		corner_like: 0.3,
		vertical_blob: 0.22,
		tiny_box: 0.2,
		low_row_diversity: 0.18,
		low_column_diversity: 0.18,
		low_transition_complexity: 0.2,
		low_bbox_usage: 0.12,
		extreme_density: 0.1,
		excessive_components: 0.15,
		component_outlier: 0.12,
		simple_high_tier: 0.08,
	}
	let score = 0
	const reasons: RewardQualityFlag[] = []
	for (const flag of flags) {
		const w = weights[flag] ?? 0.1
		score += w
		reasons.push(flag)
	}
	return { score: Math.min(1, score), reasons }
}

/**
 * Structural reward-quality analysis for a candidate bitmap.
 * Symbols get a lighter bar; objects/scenes must clear richer multi-signal bars.
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
	const isPattern = kind === 'pattern'
	const density = cells === 0 ? 0 : filled / cells

	if (bbox === null || filled === 0) {
		const metrics = emptyMetrics(width, height)
		return {
			structuralPass: false,
			hardReject: true,
			hardRejectReason: 'tiny_trivial',
			flags: Object.freeze(['tiny_trivial'] as RewardQualityFlag[]),
			metrics,
			riskScore: 1,
			riskReasons: Object.freeze(['tiny_trivial'] as RewardQualityFlag[]),
		}
	}

	const rowSig = rowSignaturesInBbox(
		bitmap,
		bbox.minRow,
		bbox.maxRow,
		bbox.minCol,
		bbox.maxCol,
	)
	const colSig = colSignaturesInBbox(
		bitmap,
		bbox.minRow,
		bbox.maxRow,
		bbox.minCol,
		bbox.maxCol,
	)
	const transitions = countTransitions(bitmap)
	const peri = perimeterComplexity(bitmap)
	const comps = componentStats(bitmap)
	const holes = countHoles(bitmap)
	const bboxArea = bbox.width * bbox.height
	const fillInBbox = bboxArea === 0 ? 0 : filled / bboxArea
	const transitionTotal = transitions.horizontal + transitions.vertical
	const transitionDensity =
		bboxArea === 0 ? 0 : transitionTotal / Math.max(1, bboxArea)
	const uniqueRunLens = new Set(runs.lengths)
	const runLengthDiversity =
		runs.lengths.length === 0
			? 0
			: uniqueRunLens.size / runs.lengths.length
	const bboxCoverage = cells === 0 ? 0 : bboxArea / cells

	const metrics: RewardQualityMetrics = {
		width,
		height,
		filled,
		occupiedRows: rows,
		occupiedCols: cols,
		bboxWidth: bbox.width,
		bboxHeight: bbox.height,
		bboxArea,
		fillInBbox,
		rowDiversity: rowSig.diversity,
		columnDiversity: colSig.diversity,
		horizontalTransitions: transitions.horizontal,
		verticalTransitions: transitions.vertical,
		transitionDensity,
		runCount: runs.count,
		runLengthDiversity,
		perimeter: peri,
		perimeterRatio: filled === 0 ? 0 : peri / filled,
		holeCount: holes,
		componentCount: comps.count,
		largestComponentRatio: comps.largestShare,
		bboxCoverage,
	}

	const lineLike =
		(rows <= 1 && cols >= 1 && filled <= Math.max(width, 8)) ||
		(cols <= 1 && rows >= 1 && filled <= Math.max(height, 8)) ||
		bbox.height <= 1 ||
		bbox.width <= 1

	const tinyTrivial =
		filled <= 4 ||
		(bboxArea <= 6 && filled <= 6 && runs.count <= 4) ||
		(rows <= 2 && cols <= 2 && filled <= 6 && !isSymbol)

	const noiseLike =
		!isSymbol &&
		!isPattern &&
		filled >= 12 &&
		runs.count >= filled * 1.5 &&
		rows >= Math.min(height, 8)

	const extremeDensity = density > 0.92 || density < 0.03

	const lowRowDiv =
		rowSig.total >= 3 &&
		(rowSig.diversity <= (isSymbol ? 0.34 : 0.45) ||
			rowSig.dominantShare >= (isSymbol ? 0.7 : 0.5)) &&
		(rowSig.unique <= Math.max(2, Math.ceil(rowSig.total * 0.5)) ||
			rowSig.dominantShare >= 0.5)

	const lowColDiv =
		colSig.total >= 3 &&
		(colSig.diversity <= (isSymbol ? 0.34 : 0.45) ||
			colSig.dominantShare >= (isSymbol ? 0.7 : 0.5)) &&
		(colSig.unique <= Math.max(2, Math.ceil(colSig.total * 0.5)) ||
			colSig.dominantShare >= 0.5)

	const lowTransition =
		!isPattern &&
		transitionDensity <= (isSymbol ? 0.12 : 0.22) &&
		transitionTotal <= Math.max(6, Math.floor(Math.sqrt(bboxArea) * 2.2))

	const solidBlob =
		!isPattern &&
		bboxArea >= 9 &&
		fillInBbox >= 0.82 &&
		lowRowDiv &&
		metrics.perimeterRatio <= 0.65

	const cornerLike = isCornerLike(bitmap, bbox, filled)

	const verticalBlob =
		!isSymbol &&
		!isPattern &&
		bbox.height >= 5 &&
		(bbox.width <= Math.max(5, Math.ceil(bbox.height * 0.9)) ||
			rowSig.dominantShare >= 0.45) &&
		lowRowDiv &&
		fillInBbox >= 0.5 &&
		holes === 0

	const tinyBox =
		!isSymbol &&
		bboxArea <= 30 &&
		bbox.width <= 6 &&
		bbox.height <= 6 &&
		fillInBbox >= 0.5 &&
		holes === 0 &&
		(lowRowDiv || lowColDiv || lowTransition) &&
		rowSig.unique <= 3 &&
		transitionDensity < 0.55

	const lowBboxUsage = bboxCoverage < 0.18 && filled >= 6 && !isSymbol

	const excessiveComponents =
		!isPattern && comps.count >= 8 && comps.largestShare < 0.35

	// Small framed objects with holes (window/phone/book) get a soft risk boost only.
	const smallFrameSoft =
		!isSymbol &&
		!isPattern &&
		bboxArea <= 30 &&
		bbox.width <= 6 &&
		bbox.height <= 6 &&
		holes >= 1 &&
		fillInBbox >= 0.55 &&
		(lowRowDiv || lowColDiv)

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
	if (lowRowDiv) {
		flags.push('low_row_diversity')
	}
	if (lowColDiv) {
		flags.push('low_column_diversity')
	}
	if (lowTransition) {
		flags.push('low_transition_complexity')
	}
	if (solidBlob) {
		flags.push('solid_blob')
	}
	if (cornerLike) {
		flags.push('corner_like')
	}
	if (verticalBlob) {
		flags.push('vertical_blob')
	}
	if (tinyBox) {
		flags.push('tiny_box')
	}
	if (smallFrameSoft) {
		flags.push('tiny_box')
	}
	if (lowBboxUsage) {
		flags.push('low_bbox_usage')
	}
	if (excessiveComponents) {
		flags.push('excessive_components')
	}
	if (comps.count >= 6) {
		flags.push('component_outlier')
	}

	let hardRejectReason: RewardQualityFlag | null = null

	if (!isSymbol && lineLike) {
		hardRejectReason = 'line_like'
	} else if (!isSymbol && tinyTrivial) {
		hardRejectReason = 'tiny_trivial'
	} else if (noiseLike) {
		hardRejectReason = 'noise_like'
	} else if (
		isSymbol &&
		lineLike &&
		filled <= Math.max(5, Math.floor(Math.max(width, height) * 0.6))
	) {
		hardRejectReason = 'line_like'
	} else if (!isSymbol && !isPattern && cornerLike) {
		hardRejectReason = 'corner_like'
	} else if (isSymbol && cornerLike && filled <= bbox.width + bbox.height) {
		// Generic geometric L glyph — tutorial material, not production reward.
		hardRejectReason = 'corner_like'
	} else if (
		!isSymbol &&
		!isPattern &&
		solidBlob &&
		lowRowDiv &&
		(lowColDiv || lowTransition)
	) {
		hardRejectReason = 'solid_blob'
	} else if (
		!isSymbol &&
		!isPattern &&
		lowRowDiv &&
		lowColDiv &&
		lowTransition
	) {
		hardRejectReason = 'low_transition_complexity'
	} else if (
		!isSymbol &&
		!isPattern &&
		verticalBlob &&
		rowSig.dominantShare >= 0.55 &&
		fillInBbox >= 0.65 &&
		transitionDensity < 0.45
	) {
		// Extreme salt-shaker / bottle: repeated rows + low edge complexity.
		hardRejectReason = 'vertical_blob'
	} else if (
		!isSymbol &&
		!isPattern &&
		tinyBox &&
		filled <= 20 &&
		(lowRowDiv || lowColDiv)
	) {
		hardRejectReason = 'tiny_box'
	}

	const { score, reasons } = computeRiskScore(flags)
	// Boost risk when multi-signal weak without hard reject yet.
	const multiWeak =
		[
			lowRowDiv,
			lowColDiv,
			lowTransition,
			solidBlob,
			tinyBox,
			verticalBlob,
			cornerLike,
			smallFrameSoft,
		].filter(Boolean).length
	const boosted = Math.min(
		1,
		score + (multiWeak >= 2 ? 0.12 : 0) + (smallFrameSoft ? 0.15 : 0),
	)

	return {
		structuralPass: hardRejectReason === null,
		hardReject: hardRejectReason !== null,
		hardRejectReason,
		flags: Object.freeze(flags),
		metrics,
		riskScore: boosted,
		riskReasons: Object.freeze(reasons),
	}
}

/** Compare two results for Worst-20 ranking: higher risk first, then id. */
export function compareRiskDesc(
	a: { riskScore: number; id: string },
	b: { riskScore: number; id: string },
): number {
	if (a.riskScore !== b.riskScore) {
		return b.riskScore - a.riskScore
	}
	return a.id.localeCompare(b.id)
}
