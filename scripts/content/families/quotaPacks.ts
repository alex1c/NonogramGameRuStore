/**
 * Extra Beginner + Hard/Expert procedural packs to fill pilot quotas.
 * Deterministic; biased toward known-good pattern families from Phase 2 catalog.
 */

import { freezeBitmap, type Bit, type Bitmap } from '../bitmap'
import type { RawCandidate } from '../types'

function filledRectLocal(
	width: number,
	height: number,
	fill: (r: number, c: number) => boolean,
): Bitmap {
	const matrix: Bit[][] = []
	for (let r = 0; r < height; r += 1) {
		const row: Bit[] = []
		for (let c = 0; c < width; c += 1) {
			row.push(fill(r, c) ? 1 : 0)
		}
		matrix.push(row)
	}
	return freezeBitmap(matrix)
}

function cand(partial: RawCandidate): RawCandidate {
	return partial
}

/** Tiny recognizable / simple shapes for BEGINNER quota. */
export function generateBeginnerPack(): RawCandidate[] {
	const out: RawCandidate[] = []
	const shapes: Array<{
		readonly id: string
		readonly title: string
		readonly collectionId: RawCandidate['collectionId']
		readonly ascii: string[]
	}> = [
		{
			id: 'symbols-bar-5x3',
			title: 'Полоска',
			collectionId: 'symbols',
			ascii: ['.....', '#####', '.....'],
		},
		{
			id: 'symbols-block-3',
			title: 'Квадрат',
			collectionId: 'symbols',
			ascii: ['###', '###', '###'],
		},
		{
			id: 'symbols-dot-5',
			title: 'Точка',
			collectionId: 'symbols',
			ascii: ['.....', '..#..', '.....', '.....', '.....'],
		},
		{
			id: 'symbols-two-dots-5',
			title: 'Две точки',
			collectionId: 'symbols',
			ascii: ['.....', '.#.#.', '.....', '.....', '.....'],
		},
		{
			id: 'symbols-line-h-5',
			title: 'Линия',
			collectionId: 'symbols',
			ascii: ['.....', '.....', '#####', '.....', '.....'],
		},
		{
			id: 'symbols-line-v-5',
			title: 'Столбик',
			collectionId: 'symbols',
			ascii: ['..#..', '..#..', '..#..', '..#..', '..#..'],
		},
		{
			id: 'symbols-corner-5',
			title: 'Угол',
			collectionId: 'symbols',
			ascii: ['###..', '#....', '#....', '.....', '.....'],
		},
		{
			id: 'symbols-u-5',
			title: 'Подкова',
			collectionId: 'symbols',
			ascii: ['#...#', '#...#', '#...#', '#...#', '.###.'],
		},
		{
			id: 'symbols-t-5',
			title: 'Тэ',
			collectionId: 'symbols',
			ascii: ['#####', '..#..', '..#..', '..#..', '..#..'],
		},
		{
			id: 'symbols-l-5',
			title: 'Эль',
			collectionId: 'symbols',
			ascii: ['#....', '#....', '#....', '#....', '#####'],
		},
		{
			id: 'food-banana-5',
			title: 'Банан',
			collectionId: 'food',
			ascii: ['..##.', '.#..#', '#...#', '.#.#.', '..#..'],
		},
		{
			id: 'objects-box-5',
			title: 'Коробка',
			collectionId: 'objects',
			ascii: ['#####', '#...#', '#...#', '#...#', '#####'],
		},
		{
			id: 'nature-drop-5',
			title: 'Капля',
			collectionId: 'nature',
			ascii: ['..#..', '.###.', '#####', '.###.', '..#..'],
		},
		{
			id: 'symbols-x-5',
			title: 'Крест',
			collectionId: 'symbols',
			ascii: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
		},
		{
			id: 'symbols-stairs-5',
			title: 'Ступени',
			collectionId: 'symbols',
			ascii: ['#....', '##...', '###..', '####.', '#####'],
		},
		{
			id: 'home-window-5',
			title: 'Окно',
			collectionId: 'home',
			ascii: ['#####', '#.#.#', '#####', '#.#.#', '#####'],
		},
		{
			id: 'transport-cart-5x3',
			title: 'Тележка',
			collectionId: 'transport',
			ascii: ['#####', '#.#.#', '.....'],
		},
		{
			id: 'plants-sprout-5',
			title: 'Росток',
			collectionId: 'plants',
			ascii: ['..#..', '.#.#.', '..#..', '..#..', '.###.'],
		},
		{
			id: 'drinks-glass-5',
			title: 'Стакан',
			collectionId: 'drinks',
			ascii: ['.###.', '#...#', '#...#', '#...#', '.###.'],
		},
		{
			id: 'sea-wave-5x3',
			title: 'Волна',
			collectionId: 'sea',
			ascii: ['.#.#.', '#.#.#', '.....'],
		},
	]

	for (let i = 0; i < shapes.length; i += 1) {
		const s = shapes[i]!
		const bitmap = filledRectLocal(s.ascii[0]!.length, s.ascii.length, (r, c) => {
			return s.ascii[r]![c] === '#'
		})
		out.push(
			cand({
				id: s.id,
				titleRu: s.title,
				collectionId: s.collectionId,
				family: 'beginner-pack-v1',
				variant: `i${i}`,
				kind: 'object',
				bitmap,
				seed: 15000 + i,
				intendedTierHint: 'BEGINNER',
			}),
		)
	}
	return out
}

/** Frame + cross / lattice / window patterns that often land HARD/EXPERT. */
export function generateHardExpertPack(): RawCandidate[] {
	const out: RawCandidate[] = []

	// Frame + cross variants
	for (const size of [10, 12, 15, 20] as const) {
		for (const midOffset of [0, 1] as const) {
			const mid = Math.floor(size / 2) + midOffset
			if (mid >= size - 1) {
				continue
			}
			const bitmap = filledRectLocal(size, size, (r, c) => {
				const border = r === 0 || c === 0 || r === size - 1 || c === size - 1
				return border || r === mid || c === mid
			})
			out.push(
				cand({
					id: `patterns-framecross-${size}-m${mid}`,
					titleRu: 'Рамка с крестом',
					collectionId: 'patterns',
					family: 'frame-cross-v1',
					variant: `s${size}-m${mid}`,
					kind: 'pattern',
					bitmap,
					seed: 16000 + size * 10 + midOffset,
					intendedTierHint: 'HARD',
				}),
			)
		}
	}

	// Double window
	for (const size of [10, 12, 15] as const) {
		const bitmap = filledRectLocal(size, size, (r, c) => {
			const mid = Math.floor(size / 2)
			const border = r === 0 || c === 0 || r === size - 1 || c === size - 1
			const midLines = r === mid || c === mid || r === mid - 1 || c === mid - 1
			const hubs =
				(r === Math.floor(size / 4) || r === Math.floor((3 * size) / 4)) &&
				(c === Math.floor(size / 4) || c === Math.floor((3 * size) / 4))
			return border || midLines || hubs
		})
		out.push(
			cand({
				id: `patterns-window-${size}`,
				titleRu: 'Окна',
				collectionId: 'patterns',
				family: 'window-v1',
				variant: `s${size}`,
				kind: 'pattern',
				bitmap,
				seed: 17000 + size,
				intendedTierHint: 'HARD',
			}),
		)
	}

	// Scatter / lattice deterministic variants (expert-leaning)
	for (let seed = 0; seed < 24; seed += 1) {
		const size = seed < 12 ? 10 : 15
		const bitmap = filledRectLocal(size, size, (r, c) => {
			const a = (r * 3 + c * 5 + seed) % 4
			const b = (r * 7 + c * 2 + seed * 3) % 5
			if (seed % 2 === 0) {
				return a === 0 || b === 0
			}
			return (r + c + seed) % 3 === 0 || (r * c + seed) % 7 === 0
		})
		out.push(
			cand({
				id: `patterns-scatter-${size}-s${seed}`,
				titleRu: seed % 2 === 0 ? 'Мозаика' : 'Решётка',
				collectionId: 'patterns',
				family: 'scatter-v1',
				variant: `s${size}-seed${seed}`,
				kind: 'pattern',
				bitmap,
				seed: 18000 + seed,
				intendedTierHint: seed >= 8 ? 'EXPERT' : 'HARD',
			}),
		)
	}

	// Nested maze corridors
	for (const size of [15, 20, 25] as const) {
		for (let gap = 2; gap <= 4; gap += 1) {
			const bitmap = filledRectLocal(size, size, (r, c) => {
				if (r === 0 || c === 0 || r === size - 1 || c === size - 1) {
					return true
				}
				if (r % gap === 0 && c < size - 2) {
					return true
				}
				if (c % gap === 0 && r > 1) {
					return true
				}
				return false
			})
			out.push(
				cand({
					id: `patterns-maze-${size}-g${gap}`,
					titleRu: 'Лабиринт',
					collectionId: 'patterns',
					family: 'maze-v1',
					variant: `s${size}-g${gap}`,
					kind: 'pattern',
					bitmap,
					seed: 19000 + size * 10 + gap,
					intendedTierHint: size >= 20 ? 'EXPERT' : 'HARD',
				}),
			)
		}
	}

	// Bridge compositions
	for (const w of [12, 15, 20] as const) {
		const h = Math.max(8, Math.floor(w * 0.6))
		const bitmap = filledRectLocal(w, h, (r, c) => {
			const pierL = Math.floor(w * 0.25)
			const pierR = Math.floor(w * 0.75)
			if (r < 3) {
				return Math.abs(c - pierL) <= r || Math.abs(c - pierR) <= r
			}
			if (r >= 3 && r <= 4) {
				return c === pierL || c === pierR
			}
			if (r === 5) {
				return true
			}
			return r > 5 && (c === pierL || c === pierR || (r + c) % 2 === 0 && r === h - 1)
		})
		out.push(
			cand({
				id: `nature-bridge-${w}x${h}`,
				titleRu: 'Мост',
				collectionId: 'nature',
				family: 'bridge-v1',
				variant: `${w}x${h}`,
				kind: 'scene',
				bitmap,
				seed: 20000 + w,
				intendedTierHint: 'HARD',
			}),
		)
	}

	// Dense arrow / plus fields
	for (const size of [9, 11, 15] as const) {
		const bitmap = filledRectLocal(size, size, (r, c) => {
			const mid = Math.floor(size / 2)
			if (r === mid || c === mid) {
				return true
			}
			if (Math.abs(r - mid) + Math.abs(c - mid) <= Math.floor(size / 3)) {
				return Math.abs(r - mid) === Math.abs(c - mid)
			}
			return false
		})
		out.push(
			cand({
				id: `symbols-compass-${size}`,
				titleRu: 'Компас',
				collectionId: 'symbols',
				family: 'compass-v1',
				variant: `s${size}`,
				kind: 'object',
				bitmap,
				seed: 21000 + size,
				intendedTierHint: 'HARD',
			}),
		)
	}

	return out
}
