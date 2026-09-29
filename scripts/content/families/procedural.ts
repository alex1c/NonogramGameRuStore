/**
 * Deterministic procedural families for Phase 8A pilot.
 * Offline, seed-based, no network / AI.
 */

import {
	emptyBitmap,
	freezeBitmap,
	stamp,
	type Bit,
	type Bitmap,
} from '../bitmap'
import type { CollectionId } from '../constants'
import type { ContentKind, RawCandidate } from '../types'

function filledRect(
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

function candidate(
	partial: Omit<RawCandidate, 'bitmap'> & { readonly bitmap: Bitmap },
): RawCandidate {
	return partial
}

/** Snowflake / star radial silhouettes. */
export function generateSnowflakes(): RawCandidate[] {
	const out: RawCandidate[] = []
	const sizes = [10, 15, 20] as const
	for (let sizeIdx = 0; sizeIdx < sizes.length; sizeIdx += 1) {
		const size = sizes[sizeIdx]!
		for (let arms = 4; arms <= 8; arms += 1) {
			for (let thick = 1; thick <= 2; thick += 1) {
				const seed = size * 100 + arms * 10 + thick
				const mid = Math.floor(size / 2)
				const bitmap = filledRect(size, size, (r, c) => {
					const dr = Math.abs(r - mid)
					const dc = Math.abs(c - mid)
					if (dr <= thick && dc <= mid - 1) {
						return true
					}
					if (dc <= thick && dr <= mid - 1) {
						return true
					}
					if (arms >= 6 && Math.abs(dr - dc) <= thick && dr + dc <= mid + thick) {
						return true
					}
					if (
						arms >= 8 &&
						Math.abs(dr + dc - mid) <= thick &&
						dr <= mid &&
						dc <= mid
					) {
						return true
					}
					return false
				})
				out.push(
					candidate({
						id: `nature-snowflake-${size}-a${arms}-t${thick}`,
						titleRu: 'Снежинка',
						collectionId: 'nature',
						family: 'snowflake-v1',
						variant: `s${size}-a${arms}-t${thick}`,
						kind: 'object',
						bitmap,
						seed,
					}),
				)
			}
		}
	}
	return out
}

/** Simple tree silhouettes with crown / trunk params. */
export function generateTrees(): RawCandidate[] {
	const out: RawCandidate[] = []
	const configs: Array<{
		readonly size: number
		readonly crown: number
		readonly trunk: number
		readonly title: string
	}> = [
		{ size: 10, crown: 3, trunk: 2, title: 'Ёлка' },
		{ size: 10, crown: 4, trunk: 2, title: 'Дерево' },
		{ size: 15, crown: 5, trunk: 3, title: 'Ёлка' },
		{ size: 15, crown: 6, trunk: 2, title: 'Сосна' },
		{ size: 20, crown: 7, trunk: 3, title: 'Дуб' },
		{ size: 20, crown: 8, trunk: 4, title: 'Ель' },
		{ size: 5, crown: 2, trunk: 1, title: 'Росток' },
		{ size: 10, crown: 2, trunk: 3, title: 'Тополь' },
	]
	for (let i = 0; i < configs.length; i += 1) {
		const cfg = configs[i]!
		const mid = Math.floor(cfg.size / 2)
		const bitmap = filledRect(cfg.size, cfg.size, (r, c) => {
			const crownBottom = mid + 1
			if (r < crownBottom) {
				const half = Math.max(
					0,
					Math.floor(((r + 1) / crownBottom) * cfg.crown),
				)
				return Math.abs(c - mid) <= half
			}
			return Math.abs(c - mid) < cfg.trunk && r < cfg.size - 1
		})
		out.push(
			candidate({
				id: `plants-tree-proc-${cfg.size}-${i}`,
				titleRu: cfg.title,
				collectionId: 'plants',
				family: 'tree-v1',
				variant: `s${cfg.size}-${i}`,
				kind: 'object',
				bitmap,
				seed: 2000 + i,
			}),
		)
	}
	return out
}

/** Flower / bloom silhouettes. */
export function generateFlowers(): RawCandidate[] {
	const out: RawCandidate[] = []
	for (let size of [10, 15] as const) {
		for (let petals = 4; petals <= 8; petals += 2) {
			const mid = Math.floor(size / 2)
			const seed = 3000 + size * 10 + petals
			const bitmap = filledRect(size, size, (r, c) => {
				const dr = r - mid
				const dc = c - mid
				const dist = Math.sqrt(dr * dr + dc * dc)
				if (dist <= 1.2) {
					return true
				}
				const angle = Math.atan2(dr, dc)
				const sector = Math.PI / petals
				const nearest = Math.round(angle / sector) * sector
				const delta = Math.abs(angle - nearest)
				return dist <= size * 0.35 && delta < sector * 0.45
			})
			out.push(
				candidate({
					id: `plants-flower-proc-${size}-p${petals}`,
					titleRu: petals >= 6 ? 'Ромашка' : 'Цветок',
					collectionId: 'plants',
					family: 'flower-v1',
					variant: `s${size}-p${petals}`,
					kind: 'object',
					bitmap,
					seed,
				}),
			)
		}
	}
	return out
}

/** House / building variants. */
export function generateBuildings(): RawCandidate[] {
	const out: RawCandidate[] = []
	const specs: Array<{
		readonly w: number
		readonly h: number
		readonly windows: number
		readonly chimney: boolean
		readonly title: string
		readonly collection: CollectionId
	}> = [
		{ w: 10, h: 10, windows: 2, chimney: false, title: 'Дом', collection: 'home' },
		{ w: 10, h: 10, windows: 4, chimney: true, title: 'Домик', collection: 'home' },
		{ w: 15, h: 15, windows: 6, chimney: true, title: 'Особняк', collection: 'home' },
		{ w: 15, h: 10, windows: 4, chimney: false, title: 'Бунгало', collection: 'home' },
		{ w: 20, h: 15, windows: 8, chimney: true, title: 'Вилла', collection: 'home' },
		{ w: 10, h: 15, windows: 3, chimney: true, title: 'Башня', collection: 'home' },
		{ w: 5, h: 10, windows: 2, chimney: false, title: 'Киоск', collection: 'home' },
	]
	for (let i = 0; i < specs.length; i += 1) {
		const s = specs[i]!
		const canvas = emptyBitmap(s.w, s.h)
		const roofTop = Math.floor(s.h * 0.15)
		const wallTop = Math.floor(s.h * 0.4)
		const mid = Math.floor(s.w / 2)
		for (let r = roofTop; r < wallTop; r += 1) {
			const span = Math.floor(
				((r - roofTop + 1) / (wallTop - roofTop)) * (mid - 1),
			)
			for (let c = mid - span; c <= mid + span; c += 1) {
				if (c >= 0 && c < s.w) {
					canvas[r]![c] = 1
				}
			}
		}
		for (let r = wallTop; r < s.h - 1; r += 1) {
			for (let c = 1; c < s.w - 1; c += 1) {
				canvas[r]![c] = 1
			}
		}
		if (s.chimney) {
			for (let r = roofTop - 1; r < wallTop; r += 1) {
				if (r >= 0) {
					canvas[r]![s.w - 3] = 1
					canvas[r]![s.w - 2] = 1
				}
			}
		}
		// Carve windows.
		const cols = Math.max(1, Math.ceil(Math.sqrt(s.windows)))
		let placed = 0
		for (let wr = 0; wr < cols && placed < s.windows; wr += 1) {
			for (let wc = 0; wc < cols && placed < s.windows; wc += 1) {
				const rr = wallTop + 2 + wr * 2
				const cc = 2 + wc * Math.max(2, Math.floor((s.w - 4) / cols))
				if (rr < s.h - 2 && cc < s.w - 2) {
					canvas[rr]![cc] = 0
					placed += 1
				}
			}
		}
		out.push(
			candidate({
				id: `home-building-proc-${s.w}x${s.h}-${i}`,
				titleRu: s.title,
				collectionId: s.collection,
				family: 'building-v1',
				variant: `${s.w}x${s.h}-w${s.windows}-c${s.chimney ? 1 : 0}`,
				kind: 'object',
				bitmap: freezeBitmap(canvas),
				seed: 4000 + i,
			}),
		)
	}
	return out
}

/** Boat / wave compositions. */
export function generateBoats(): RawCandidate[] {
	const out: RawCandidate[] = []
	const sizes = [
		[10, 10],
		[15, 10],
		[15, 15],
		[20, 15],
		[10, 5],
	] as const
	for (let i = 0; i < sizes.length; i += 1) {
		const [w, h] = sizes[i]!
		const canvas = emptyBitmap(w, h)
		const water = h - 2
		const mast = Math.floor(w / 2)
		for (let r = 2; r < water - 1; r += 1) {
			canvas[r]![mast] = 1
			if (r < water - 3) {
				for (let c = mast; c < mast + Math.min(3, w - mast - 1); c += 1) {
					canvas[r]![c] = 1
				}
			}
		}
		for (let c = 1; c < w - 1; c += 1) {
			canvas[water]![c] = 1
		}
		for (let c = 2; c < w - 2; c += 1) {
			canvas[water - 1]![c] = 1
		}
		out.push(
			candidate({
				id: `sea-boat-proc-${w}x${h}-${i}`,
				titleRu: i % 2 === 0 ? 'Лодка' : 'Парусник',
				collectionId: 'sea',
				family: 'boat-v1',
				variant: `${w}x${h}-${i}`,
				kind: 'scene',
				bitmap: freezeBitmap(canvas),
				seed: 5000 + i,
			}),
		)
	}
	return out
}

/** Cup / mug silhouettes. */
export function generateCups(): RawCandidate[] {
	const out: RawCandidate[] = []
	for (const size of [10, 15] as const) {
		for (let handle = 0; handle <= 1; handle += 1) {
			const canvas = emptyBitmap(size, size)
			const top = 2
			const bottom = size - 3
			const left = 2
			const right = size - 3 - handle
			for (let r = top; r <= bottom; r += 1) {
				canvas[r]![left] = 1
				canvas[r]![right] = 1
			}
			for (let c = left; c <= right; c += 1) {
				canvas[top]![c] = 1
				canvas[bottom]![c] = 1
			}
			if (handle === 1) {
				for (let r = top + 1; r <= bottom - 1; r += 1) {
					canvas[r]![size - 2] = 1
				}
				canvas[top + 1]![size - 3] = 1
				canvas[bottom - 1]![size - 3] = 1
			}
			out.push(
				candidate({
					id: `drinks-cup-proc-${size}-h${handle}`,
					titleRu: handle === 1 ? 'Кружка' : 'Чашка',
					collectionId: 'drinks',
					family: 'cup-v1',
					variant: `s${size}-h${handle}`,
					kind: 'object',
					bitmap: freezeBitmap(canvas),
					seed: 6000 + size + handle,
				}),
			)
		}
	}
	return out
}

/** Simple fish silhouettes. */
export function generateFish(): RawCandidate[] {
	const out: RawCandidate[] = []
	const configs = [
		{ w: 10, h: 10, body: 3 },
		{ w: 15, h: 10, body: 4 },
		{ w: 15, h: 15, body: 5 },
		{ w: 20, h: 10, body: 4 },
	]
	for (let i = 0; i < configs.length; i += 1) {
		const cfg = configs[i]!
		const mid = Math.floor(cfg.h / 2)
		const bitmap = filledRect(cfg.w, cfg.h, (r, c) => {
			const bodyEnd = cfg.w - 4
			if (c < bodyEnd) {
				const half = Math.max(
					1,
					Math.floor(
						cfg.body * (1 - Math.abs(c - bodyEnd / 2) / (bodyEnd / 2 + 1)),
					),
				)
				return Math.abs(r - mid) <= half
			}
			// Tail
			return Math.abs(r - mid) <= cfg.body - (c - bodyEnd)
		})
		out.push(
			candidate({
				id: `sea-fish-proc-${cfg.w}x${cfg.h}-${i}`,
				titleRu: 'Рыба',
				collectionId: 'sea',
				family: 'fish-v1',
				variant: `${cfg.w}x${cfg.h}-${i}`,
				kind: 'object',
				bitmap,
				seed: 7000 + i,
			}),
		)
	}
	return out
}

/** Vehicle silhouettes. */
export function generateVehicles(): RawCandidate[] {
	const out: RawCandidate[] = []
	const specs = [
		{ w: 10, h: 10, title: 'Машина', id: 'car' },
		{ w: 15, h: 10, title: 'Грузовик', id: 'truck' },
		{ w: 15, h: 15, title: 'Автобус', id: 'bus' },
		{ w: 20, h: 10, title: 'Поезд', id: 'train' },
		{ w: 10, h: 15, title: 'Ракета', id: 'rocket' },
	]
	for (let i = 0; i < specs.length; i += 1) {
		const s = specs[i]!
		const canvas = emptyBitmap(s.w, s.h)
		if (s.id === 'rocket') {
			const mid = Math.floor(s.w / 2)
			for (let r = 1; r < s.h - 3; r += 1) {
				const half = r < 4 ? 1 : 2
				for (let c = mid - half; c <= mid + half; c += 1) {
					canvas[r]![c] = 1
				}
			}
			canvas[s.h - 3]![mid - 2] = 1
			canvas[s.h - 3]![mid + 2] = 1
			canvas[s.h - 2]![mid] = 1
		} else {
			const bodyTop = Math.floor(s.h / 2) - 1
			const bodyBot = bodyTop + 2
			for (let r = bodyTop; r <= bodyBot; r += 1) {
				for (let c = 1; c < s.w - 1; c += 1) {
					canvas[r]![c] = 1
				}
			}
			for (let c = 3; c < s.w - 3; c += 1) {
				canvas[bodyTop - 1]![c] = 1
			}
			canvas[bodyBot + 1]![2] = 1
			canvas[bodyBot + 1]![3] = 1
			canvas[bodyBot + 1]![s.w - 4] = 1
			canvas[bodyBot + 1]![s.w - 3] = 1
		}
		out.push(
			candidate({
				id: `transport-${s.id}-proc-${s.w}x${s.h}`,
				titleRu: s.title,
				collectionId: s.id === 'rocket' ? 'space' : 'transport',
				family: 'vehicle-v1',
				variant: `${s.id}-${s.w}x${s.h}`,
				kind: 'object',
				bitmap: freezeBitmap(canvas),
				seed: 8000 + i,
			}),
		)
	}
	return out
}

/** Controlled geometric ornaments (pattern budget). */
export function generatePatterns(): RawCandidate[] {
	const out: RawCandidate[] = []
	// Nested frames
	for (const size of [10, 15, 20] as const) {
		for (let gap = 2; gap <= 3; gap += 1) {
			const bitmap = filledRect(size, size, (r, c) => {
				const d = Math.min(r, c, size - 1 - r, size - 1 - c)
				return d % gap === 0
			})
			out.push(
				candidate({
					id: `patterns-frame-proc-${size}-g${gap}`,
					titleRu: 'Рамка',
					collectionId: 'patterns',
					family: 'frame-v1',
					variant: `s${size}-g${gap}`,
					kind: 'pattern',
					bitmap,
					seed: 9000 + size + gap,
				}),
			)
		}
	}
	// Checker variants
	for (const size of [5, 10, 15] as const) {
		for (let period of [2, 3] as const) {
			const bitmap = filledRect(size, size, (r, c) => (r + c) % period === 0)
			out.push(
				candidate({
					id: `patterns-check-proc-${size}-p${period}`,
					titleRu: 'Шахматы',
					collectionId: 'patterns',
					family: 'checker-v1',
					variant: `s${size}-p${period}`,
					kind: 'pattern',
					bitmap,
					seed: 9100 + size * 10 + period,
				}),
			)
		}
	}
	// Cross lattice (tends Hard/Expert)
	for (const size of [10, 15, 20] as const) {
		const step = size <= 10 ? 3 : 4
		const bitmap = filledRect(size, size, (r, c) => {
			const border = r === 0 || c === 0 || r === size - 1 || c === size - 1
			const cross = r % step === 0 || c % step === 0
			return border || cross
		})
		out.push(
			candidate({
				id: `patterns-lattice-proc-${size}-st${step}`,
				titleRu: 'Решётка',
				collectionId: 'patterns',
				family: 'lattice-v1',
				variant: `s${size}-st${step}`,
				kind: 'pattern',
				bitmap,
				seed: 9200 + size,
			}),
		)
	}
	return out
}

/** Food silhouettes. */
export function generateFood(): RawCandidate[] {
	const out: RawCandidate[] = []
	// Apple
	for (const size of [10, 15] as const) {
		const mid = Math.floor(size / 2)
		const bitmap = filledRect(size, size, (r, c) => {
			if (r === 1 && c === mid) {
				return true
			}
			const dr = (r - mid) / (size * 0.35)
			const dc = (c - mid) / (size * 0.3)
			return dr * dr + dc * dc <= 1 && r >= 2
		})
		out.push(
			candidate({
				id: `food-apple-proc-${size}`,
				titleRu: 'Яблоко',
				collectionId: 'food',
				family: 'apple-v1',
				variant: `s${size}`,
				kind: 'object',
				bitmap,
				seed: 10000 + size,
			}),
		)
	}
	// Slice / pizza triangle-ish
	for (const size of [10, 15] as const) {
		const bitmap = filledRect(size, size, (r, c) => {
			const top = 2
			const progress = (r - top) / (size - top - 2)
			if (progress < 0 || progress > 1) {
				return false
			}
			const half = Math.floor(progress * (size / 2 - 1))
			const mid = Math.floor(size / 2)
			return Math.abs(c - mid) <= half
		})
		out.push(
			candidate({
				id: `food-slice-proc-${size}`,
				titleRu: 'Кусочек',
				collectionId: 'food',
				family: 'slice-v1',
				variant: `s${size}`,
				kind: 'object',
				bitmap,
				seed: 10100 + size,
			}),
		)
	}
	return out
}

/** Animal ear variants from a base cat silhouette. */
export function generateCatVariants(): RawCandidate[] {
	const out: RawCandidate[] = []
	const bases: Array<{ size: number; earGap: number; title: string }> = [
		{ size: 10, earGap: 2, title: 'Кот' },
		{ size: 10, earGap: 3, title: 'Котёнок' },
		{ size: 15, earGap: 3, title: 'Кот' },
		{ size: 15, earGap: 4, title: 'Спящий кот' },
		{ size: 20, earGap: 4, title: 'Кот' },
	]
	for (let i = 0; i < bases.length; i += 1) {
		const b = bases[i]!
		const mid = Math.floor(b.size / 2)
		const canvas = emptyBitmap(b.size, b.size)
		// Ears
		canvas[1]![mid - b.earGap] = 1
		canvas[1]![mid + b.earGap] = 1
		canvas[2]![mid - b.earGap] = 1
		canvas[2]![mid + b.earGap] = 1
		canvas[2]![mid - b.earGap + 1] = 1
		canvas[2]![mid + b.earGap - 1] = 1
		// Head
		for (let r = 3; r <= mid + 1; r += 1) {
			for (let c = mid - 3; c <= mid + 3; c += 1) {
				if (c >= 0 && c < b.size) {
					canvas[r]![c] = 1
				}
			}
		}
		// Eyes hollow
		canvas[4]![mid - 2] = 0
		canvas[4]![mid + 2] = 0
		// Body
		for (let r = mid + 1; r < b.size - 2; r += 1) {
			for (let c = mid - 2; c <= mid + 2; c += 1) {
				canvas[r]![c] = 1
			}
		}
		out.push(
			candidate({
				id: `animals-cat-proc-${b.size}-e${b.earGap}`,
				titleRu: b.title,
				collectionId: 'animals',
				family: 'cat-v1',
				variant: `s${b.size}-e${b.earGap}`,
				kind: 'object',
				bitmap: freezeBitmap(canvas),
				seed: 11000 + i,
			}),
		)
	}
	return out
}

/** Bird silhouettes. */
export function generateBirds(): RawCandidate[] {
	const out: RawCandidate[] = []
	for (const size of [10, 15, 20] as const) {
		const mid = Math.floor(size / 2)
		const bitmap = filledRect(size, size, (r, c) => {
			// Wings
			if (r === mid && c >= 1 && c <= size - 2) {
				return true
			}
			if (r === mid - 1 && c >= 2 && c <= size - 3) {
				return true
			}
			// Body / head
			if (Math.abs(c - mid) <= 1 && r >= mid - 2 && r <= mid + 2) {
				return true
			}
			if (c === mid + 2 && r === mid - 2) {
				return true
			}
			// Tail
			if (c <= 2 && Math.abs(r - mid) <= 1) {
				return true
			}
			return false
		})
		out.push(
			candidate({
				id: `birds-bird-proc-${size}`,
				titleRu: size >= 15 ? 'Чайка' : 'Птица',
				collectionId: 'birds',
				family: 'bird-v1',
				variant: `s${size}`,
				kind: 'object',
				bitmap,
				seed: 12000 + size,
			}),
		)
	}
	return out
}

/** Symbol pack: hearts, stars, arrows at multiple sizes. */
export function generateSymbols(): RawCandidate[] {
	const out: RawCandidate[] = []
	for (const size of [5, 10, 15] as const) {
		const mid = Math.floor(size / 2)
		// Heart
		const heart = filledRect(size, size, (r, c) => {
			if (r < mid) {
				const left = Math.abs(c - Math.floor(size * 0.3))
				const right = Math.abs(c - Math.floor(size * 0.7))
				return (left <= size * 0.2 && r >= 1) || (right <= size * 0.2 && r >= 1)
			}
			const half = Math.floor(((size - r) / (size - mid)) * mid)
			return Math.abs(c - mid) <= half
		})
		out.push(
			candidate({
				id: `symbols-heart-proc-${size}`,
				titleRu: 'Сердце',
				collectionId: 'symbols',
				family: 'heart-v1',
				variant: `s${size}`,
				kind: 'object',
				bitmap: heart,
				seed: 13000 + size,
			}),
		)
		// Star
		const star = filledRect(size, size, (r, c) => {
			if (c === mid || r === mid) {
				return Math.abs(c - mid) + Math.abs(r - mid) <= mid
			}
			return Math.abs(r - c) <= 1 && Math.abs(r - mid) <= mid - 1
		})
		out.push(
			candidate({
				id: `symbols-star-proc-${size}`,
				titleRu: 'Звезда',
				collectionId: 'symbols',
				family: 'star-v1',
				variant: `s${size}`,
				kind: 'object',
				bitmap: star,
				seed: 13100 + size,
			}),
		)
	}
	return out
}

/** Moon + star night scenes. */
export function generateNightScenes(): RawCandidate[] {
	const out: RawCandidate[] = []
	for (const size of [10, 15, 20] as const) {
		const canvas = emptyBitmap(size, size)
		const moonR = Math.floor(size * 0.22)
		const moonC = Math.floor(size * 0.35)
		const moonCenterR = Math.floor(size * 0.35)
		for (let r = 0; r < size; r += 1) {
			for (let c = 0; c < size; c += 1) {
				const d1 =
					(r - moonCenterR) * (r - moonCenterR) +
					(c - moonC) * (c - moonC)
				const d2 =
					(r - moonCenterR) * (r - moonCenterR) +
					(c - (moonC + Math.floor(moonR * 0.7))) *
						(c - (moonC + Math.floor(moonR * 0.7)))
				if (d1 <= moonR * moonR && d2 > moonR * moonR * 0.7) {
					canvas[r]![c] = 1
				}
			}
		}
		// Stars
		const starPts = [
			[2, size - 3],
			[4, size - 5],
			[size - 4, 3],
		] as const
		for (const [sr, sc] of starPts) {
			if (sr < size && sc < size) {
				canvas[sr]![sc] = 1
				if (sr + 1 < size) {
					canvas[sr + 1]![sc] = 1
				}
				if (sc + 1 < size) {
					canvas[sr]![sc + 1] = 1
				}
			}
		}
		out.push(
			candidate({
				id: `space-night-proc-${size}`,
				titleRu: 'Ночное небо',
				collectionId: 'space',
				family: 'night-v1',
				variant: `s${size}`,
				kind: 'scene',
				bitmap: freezeBitmap(canvas),
				seed: 14000 + size,
			}),
		)
	}
	return out
}

/** Stamp helper kept for future composition families. */
export function composeStamp(
	width: number,
	height: number,
	parts: ReadonlyArray<{
		readonly bitmap: Bitmap
		readonly row: number
		readonly col: number
	}>,
): Bitmap {
	const canvas = emptyBitmap(width, height)
	for (const part of parts) {
		stamp(canvas, part.bitmap, part.row, part.col)
	}
	return freezeBitmap(canvas)
}

/** All procedural candidates (deterministic order). */
export function allProceduralCandidates(): RawCandidate[] {
	return [
		...generateSnowflakes(),
		...generateTrees(),
		...generateFlowers(),
		...generateBuildings(),
		...generateBoats(),
		...generateCups(),
		...generateFish(),
		...generateVehicles(),
		...generatePatterns(),
		...generateFood(),
		...generateCatVariants(),
		...generateBirds(),
		...generateSymbols(),
		...generateNightScenes(),
	]
}
