/**
 * Hard/Expert packs derived from proven in-repo calibration patterns
 * (mini-expert-scatter / lattice / bridge / arrows) with non-transform variants.
 */

import { freezeBitmap, type Bit, type Bitmap } from '../bitmap'
import type { RawCandidate } from '../types'

function fromMatrix(matrix: readonly (readonly number[])[]): Bitmap {
	return freezeBitmap(
		matrix.map((row) => row.map((cell) => (cell ? 1 : 0) as Bit)),
	)
}

function matrixFromFill(
	width: number,
	height: number,
	fill: (r: number, c: number) => boolean,
): Bitmap {
	const m: Bit[][] = []
	for (let r = 0; r < height; r += 1) {
		const row: Bit[] = []
		for (let c = 0; c < width; c += 1) {
			row.push(fill(r, c) ? 1 : 0)
		}
		m.push(row)
	}
	return freezeBitmap(m)
}

const invert = (bitmap: Bitmap): Bitmap =>
	freezeBitmap(
		bitmap.map((row) => row.map((cell) => (cell === 1 ? 0 : 1) as Bit)),
	)

/** Phase-shifted scatter / lattice / hard object variants. */
export function generateExpertScatterFamily(): RawCandidate[] {
	const clean: RawCandidate[] = []

	// Checker-phase scatters
	for (const size of [10, 11, 12, 13, 14, 15] as const) {
		for (let phase = 0; phase < 6; phase += 1) {
			const bitmap = matrixFromFill(size, size, (r, c) => {
				const base = (r + c + phase) % 2 === 0
				const spice = (r * 2 + c * 3 + phase) % 5 === 0
				const hole = (r * c + phase * 2) % 7 === 1
				if (phase < 2) {
					return base !== hole
				}
				if (phase < 4) {
					return (base && !spice) || (!base && hole)
				}
				return spice || (base && r % 3 === phase % 3)
			})
			clean.push({
				id: `patterns-expert-scatter-${size}-p${phase}`,
				titleRu: 'Мозаика',
				collectionId: 'patterns',
				family: 'expert-scatter-v1',
				variant: `s${size}-p${phase}`,
				kind: 'pattern',
				bitmap,
				seed: 22000 + size * 10 + phase,
				intendedTierHint: 'EXPERT',
			})
		}
	}

	// Lattice family
	for (const size of [10, 12, 14, 15, 16] as const) {
		for (let gap = 2; gap <= 4; gap += 1) {
			for (let shift = 0; shift < 3; shift += 1) {
				const bitmap = matrixFromFill(size, size, (r, c) => {
					const a = (r + shift) % gap === 0
					const b = (c + shift) % gap === 0
					const diag = (r + c + shift) % (gap + 1) === 0
					const border =
						r === 0 || c === 0 || r === size - 1 || c === size - 1
					if (gap === 2) {
						return (a && !b) || (!a && b) || diag
					}
					return (
						border ||
						a ||
						b ||
						(diag && (r + c) % 2 === shift % 2)
					)
				})
				clean.push({
					id: `patterns-expert-lattice-${size}-g${gap}-sh${shift}`,
					titleRu: 'Плетение',
					collectionId: 'patterns',
					family: 'expert-lattice-v1',
					variant: `s${size}-g${gap}-sh${shift}`,
					kind: 'pattern',
					bitmap,
					seed: 23000 + size * 100 + gap * 10 + shift,
					intendedTierHint: 'EXPERT',
				})
			}
		}
	}

	const scatter10 = fromMatrix([
		[1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
		[0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
		[1, 0, 1, 1, 0, 0, 1, 1, 0, 1],
		[0, 1, 1, 0, 1, 1, 0, 1, 1, 0],
		[1, 0, 0, 1, 0, 1, 0, 1, 0, 1],
		[0, 1, 1, 0, 1, 0, 1, 0, 1, 0],
		[1, 0, 1, 1, 0, 1, 1, 0, 0, 1],
		[0, 1, 0, 1, 1, 0, 0, 1, 1, 0],
		[1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
		[0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
	])
	const lattice10 = fromMatrix([
		[1, 1, 0, 0, 1, 0, 0, 1, 1, 0],
		[1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
		[0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
		[0, 0, 1, 1, 0, 0, 1, 1, 0, 0],
		[1, 0, 0, 1, 1, 1, 1, 0, 0, 1],
		[1, 0, 0, 1, 1, 1, 1, 0, 0, 1],
		[0, 0, 1, 1, 0, 0, 1, 1, 0, 0],
		[0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
		[1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
		[1, 1, 0, 0, 1, 0, 0, 1, 1, 0],
	])

	clean.push({
		id: 'patterns-expert-scatter-cal-10',
		titleRu: 'Мозаика',
		collectionId: 'patterns',
		family: 'expert-scatter-v1',
		variant: 'calibration-10',
		kind: 'pattern',
		bitmap: scatter10,
		seed: 24001,
		intendedTierHint: 'EXPERT',
	})
	clean.push({
		id: 'patterns-expert-lattice-cal-10',
		titleRu: 'Плетение',
		collectionId: 'patterns',
		family: 'expert-lattice-v1',
		variant: 'calibration-10',
		kind: 'pattern',
		bitmap: lattice10,
		seed: 24002,
		intendedTierHint: 'EXPERT',
	})
	clean.push({
		id: 'patterns-expert-scatter-cal-10-inv',
		titleRu: 'Мозаика',
		collectionId: 'patterns',
		family: 'expert-scatter-v1',
		variant: 'calibration-10-inv',
		kind: 'pattern',
		bitmap: invert(scatter10),
		seed: 24003,
		intendedTierHint: 'EXPERT',
	})
	clean.push({
		id: 'patterns-expert-lattice-cal-10-inv',
		titleRu: 'Плетение',
		collectionId: 'patterns',
		family: 'expert-lattice-v1',
		variant: 'calibration-10-inv',
		kind: 'pattern',
		bitmap: invert(lattice10),
		seed: 24004,
		intendedTierHint: 'EXPERT',
	})

	for (let mut = 0; mut < 8; mut += 1) {
		const base = mut < 4 ? scatter10 : lattice10
		const cloned: Bit[][] = base.map((row) => [...row])
		const r = 2 + (mut % 4)
		const c = 2 + (Math.floor(mut / 2) % 4)
		cloned[r]![c] = cloned[r]![c] === 1 ? 0 : 1
		cloned[r]![c + 1] = cloned[r]![c + 1] === 1 ? 0 : 1
		clean.push({
			id: `patterns-expert-mut-${mut}`,
			titleRu: mut < 4 ? 'Мозаика' : 'Плетение',
			collectionId: 'patterns',
			family: mut < 4 ? 'expert-scatter-v1' : 'expert-lattice-v1',
			variant: `mut-${mut}`,
			kind: 'pattern',
			bitmap: freezeBitmap(cloned),
			seed: 24100 + mut,
			intendedTierHint: 'EXPERT',
		})
	}

	const arrows = fromMatrix([
		[0, 0, 0, 0, 1, 0, 0, 0, 0],
		[0, 0, 0, 1, 1, 1, 0, 0, 0],
		[0, 0, 1, 1, 1, 1, 1, 0, 0],
		[0, 0, 0, 0, 1, 0, 0, 0, 0],
		[1, 1, 1, 1, 1, 1, 1, 1, 1],
		[0, 0, 0, 0, 1, 0, 0, 0, 0],
		[0, 0, 1, 1, 1, 1, 1, 0, 0],
		[0, 0, 0, 1, 1, 1, 0, 0, 0],
		[0, 0, 0, 0, 1, 0, 0, 0, 0],
	])
	clean.push({
		id: 'symbols-arrows-cal-9',
		titleRu: 'Стрелки',
		collectionId: 'symbols',
		family: 'arrows-v1',
		variant: 'calibration-9',
		kind: 'object',
		bitmap: arrows,
		seed: 25001,
		intendedTierHint: 'HARD',
	})

	for (const size of [11, 13, 15] as const) {
		const mid = Math.floor(size / 2)
		const bitmap = matrixFromFill(size, size, (r, c) => {
			if (r === mid || c === mid) {
				return true
			}
			if (
				Math.abs(r - mid) <= 2 &&
				Math.abs(c - mid) <= Math.floor(size / 3)
			) {
				return Math.abs(c - mid) >= Math.abs(r - mid)
			}
			if (
				Math.abs(c - mid) <= 2 &&
				Math.abs(r - mid) <= Math.floor(size / 3)
			) {
				return Math.abs(r - mid) >= Math.abs(c - mid)
			}
			return false
		})
		clean.push({
			id: `symbols-arrows-${size}`,
			titleRu: 'Стрелки',
			collectionId: 'symbols',
			family: 'arrows-v1',
			variant: `s${size}`,
			kind: 'object',
			bitmap,
			seed: 25000 + size,
			intendedTierHint: 'HARD',
		})
	}

	clean.push({
		id: 'plants-tree-cal-5x7',
		titleRu: 'Ёлка',
		collectionId: 'plants',
		family: 'tree-hard-v1',
		variant: 'calibration-5x7',
		kind: 'object',
		bitmap: fromMatrix([
			[0, 0, 1, 0, 0],
			[0, 1, 1, 1, 0],
			[1, 1, 1, 1, 1],
			[0, 1, 1, 1, 0],
			[0, 0, 1, 0, 0],
			[0, 0, 1, 0, 0],
			[0, 1, 1, 1, 0],
		]),
		seed: 26001,
		intendedTierHint: 'HARD',
	})

	for (let w = 5; w <= 9; w += 2) {
		const h = w + 2
		const mid = Math.floor(w / 2)
		const bitmap = matrixFromFill(w, h, (r, c) => {
			if (r < h - 3) {
				const half = Math.min(mid, r === 0 ? 0 : Math.ceil(r / 2))
				return Math.abs(c - mid) <= half
			}
			if (r < h - 1) {
				return c === mid
			}
			return Math.abs(c - mid) <= 1
		})
		clean.push({
			id: `plants-tree-hard-${w}x${h}`,
			titleRu: 'Ёлка',
			collectionId: 'plants',
			family: 'tree-hard-v1',
			variant: `${w}x${h}`,
			kind: 'object',
			bitmap,
			seed: 26100 + w,
			intendedTierHint: 'HARD',
		})
	}

	// Additional bridge variants (HARD)
	for (const w of [12, 14, 16, 18] as const) {
		const h = 8
		const bitmap = matrixFromFill(w, h, (r, c) => {
			const pierL = Math.floor(w * 0.22)
			const pierR = Math.floor(w * 0.78)
			if (r < 3) {
				return Math.abs(c - pierL) <= r || Math.abs(c - pierR) <= r
			}
			if (r >= 3 && r <= 4) {
				return c === pierL || c === pierR
			}
			if (r === 5) {
				return true
			}
			return r > 5 && (c === pierL || c === pierR)
		})
		clean.push({
			id: `nature-bridge-hard-${w}x${h}`,
			titleRu: 'Мост',
			collectionId: 'nature',
			family: 'bridge-v1',
			variant: `hard-${w}x${h}`,
			kind: 'scene',
			bitmap,
			seed: 27000 + w,
			intendedTierHint: 'HARD',
		})
	}

	return clean
}
