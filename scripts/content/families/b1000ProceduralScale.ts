/**
 * Phase 8C controlled procedural scale pool.
 * Each candidate gets a unique conceptId + natural Russian title.
 * Families are per-concept to avoid family-share explosions.
 * Not random mutation filler — parameterized recognizable silhouettes.
 */

import {
	freezeBitmap,
	type Bit,
	type Bitmap,
} from '../bitmap'
import { normalizeConceptId, type CollectionId } from '../constants'
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

function setCell(grid: Bit[][], r: number, c: number, v: Bit = 1): void {
	if (r < 0 || c < 0 || r >= grid.length || c >= (grid[0]?.length ?? 0)) {
		return
	}
	grid[r]![c] = v
}

function stampRect(
	grid: Bit[][],
	r0: number,
	c0: number,
	h: number,
	w: number,
	v: Bit = 1,
): void {
	for (let r = r0; r < r0 + h; r += 1) {
		for (let c = c0; c < c0 + w; c += 1) {
			setCell(grid, r, c, v)
		}
	}
}

function emptyGrid(width: number, height: number): Bit[][] {
	return Array.from({ length: height }, () =>
		Array.from({ length: width }, () => 0 as Bit),
	)
}

function toBitmap(grid: Bit[][]): Bitmap {
	return freezeBitmap(grid.map((row) => [...row]))
}

function cand(
	partial: Omit<RawCandidate, 'sourceKind' | 'contentRole' | 'family'> & {
		readonly family?: string
	},
): RawCandidate {
	return {
		...partial,
		family: partial.family ?? `scale-${normalizeConceptId(partial.conceptId)}`,
		sourceKind: 'procedural',
		contentRole: 'production',
	}
}

/** Building facade with window grid — good HARD uniqueness signal. */
function buildingFacade(
	size: number,
	rows: number,
	cols: number,
	doorCol: number,
	roof: 'flat' | 'peak' | 'dome',
): Bitmap {
	const g = emptyGrid(size, size)
	const margin = 1
	const bodyTop = roof === 'flat' ? 1 : 2
	stampRect(g, bodyTop, margin, size - bodyTop - 1, size - 2 * margin)
	// Carve windows.
	const usableH = size - bodyTop - 2
	const usableW = size - 2 * margin - 2
	const cellH = Math.max(1, Math.floor(usableH / (rows * 2 + 1)))
	const cellW = Math.max(1, Math.floor(usableW / (cols * 2 + 1)))
	for (let wr = 0; wr < rows; wr += 1) {
		for (let wc = 0; wc < cols; wc += 1) {
			const r0 = bodyTop + 1 + wr * (cellH + 1)
			const c0 = margin + 1 + wc * (cellW + 1)
			stampRect(g, r0, c0, cellH, cellW, 0)
		}
	}
	// Door carve at bottom.
	const doorW = Math.max(1, Math.floor(size / 5))
	const doorH = Math.max(2, Math.floor(size / 4))
	const dc = Math.min(size - doorW - 2, Math.max(2, doorCol))
	stampRect(g, size - 1 - doorH, dc, doorH, doorW, 0)
	if (roof === 'peak') {
		const mid = Math.floor(size / 2)
		for (let c = margin; c < size - margin; c += 1) {
			const rise = Math.floor(((mid - Math.abs(c - mid)) * 2) / mid)
			for (let r = 0; r <= rise; r += 1) {
				setCell(g, r, c, 1)
			}
		}
	} else if (roof === 'dome') {
		const mid = Math.floor(size / 2)
		const rad = Math.floor(size / 3)
		for (let r = 0; r < bodyTop + 1; r += 1) {
			for (let c = 0; c < size; c += 1) {
				const dr = r - (bodyTop - 1)
				const dc2 = c - mid
				if (dr * dr + dc2 * dc2 <= rad * rad) {
					setCell(g, r, c, 1)
				}
			}
		}
	}
	return toBitmap(g)
}

/** Side-view vehicle with cabin/body/wheels — asymmetric for uniqueness. */
function vehicleSide(
	width: number,
	height: number,
	cabinStart: number,
	wheelGap: number,
	hasRoofRack: boolean,
): Bitmap {
	const g = emptyGrid(width, height)
	const bodyY = Math.floor(height * 0.45)
	const bodyH = Math.floor(height * 0.35)
	stampRect(g, bodyY, 1, bodyH, width - 2)
	const cabinH = Math.floor(height * 0.28)
	const cabinW = Math.floor(width * 0.4)
	stampRect(g, bodyY - cabinH + 1, cabinStart, cabinH, cabinW)
	// Windows.
	stampRect(
		g,
		bodyY - cabinH + 2,
		cabinStart + 1,
		Math.max(1, cabinH - 3),
		Math.max(1, Math.floor(cabinW / 2) - 1),
		0,
	)
	stampRect(
		g,
		bodyY - cabinH + 2,
		cabinStart + Math.floor(cabinW / 2) + 1,
		Math.max(1, cabinH - 3),
		Math.max(1, Math.floor(cabinW / 2) - 2),
		0,
	)
	if (hasRoofRack) {
		stampRect(g, bodyY - cabinH - 1, cabinStart + 1, 1, cabinW - 2)
	}
	const wheelY = bodyY + bodyH
	const wheelR = Math.max(1, Math.floor(height / 8))
	for (const wx of [2 + wheelGap, width - 3 - wheelGap]) {
		for (let r = -wheelR; r <= wheelR; r += 1) {
			for (let c = -wheelR; c <= wheelR; c += 1) {
				if (r * r + c * c <= wheelR * wheelR) {
					setCell(g, wheelY + r, wx + c, 1)
				}
			}
		}
		setCell(g, wheelY, wx, 0)
	}
	return toBitmap(g)
}

/** Animal-ish blob with head/ears/legs — not a solid rectangle. */
function creatureProfile(
	size: number,
	earGap: number,
	legSpread: number,
	tailSide: 'left' | 'right',
	neckLift: number,
): Bitmap {
	const g = emptyGrid(size, size)
	const bodyR0 = Math.floor(size * 0.35)
	const bodyC0 = Math.floor(size * 0.25)
	const bodyH = Math.floor(size * 0.35)
	const bodyW = Math.floor(size * 0.45)
	stampRect(g, bodyR0, bodyC0, bodyH, bodyW)
	const headSize = Math.floor(size * 0.22)
	const headR = bodyR0 - neckLift
	const headC = bodyC0 + bodyW - 1
	stampRect(g, headR, headC, headSize, headSize)
	setCell(g, headR + 1, headC + headSize - 2, 0) // eye hole
	setCell(g, headR, headC + earGap, 1)
	setCell(g, headR, headC + headSize - 1 - earGap, 1)
	const legH = Math.floor(size * 0.22)
	const legY = bodyR0 + bodyH
	stampRect(g, legY, bodyC0 + 1, legH, 2)
	stampRect(g, legY, bodyC0 + legSpread, legH, 2)
	stampRect(g, legY, bodyC0 + bodyW - 3, legH, 2)
	if (tailSide === 'left') {
		stampRect(g, bodyR0 + 1, bodyC0 - 2, 2, 2)
	} else {
		stampRect(g, bodyR0 + bodyH - 2, headC + headSize, 2, 2)
	}
	return toBitmap(g)
}

/** Plant / tree with irregular crown. */
function treeSilhouette(
	size: number,
	crownSkew: number,
	trunkW: number,
	layers: number,
): Bitmap {
	const g = emptyGrid(size, size)
	const mid = Math.floor(size / 2)
	for (let layer = 0; layer < layers; layer += 1) {
		const top = 1 + layer * Math.floor(size / (layers + 2))
		const half = Math.floor(size / 3) - layer + crownSkew
		for (let r = 0; r < Math.floor(size / (layers + 1)); r += 1) {
			const span = Math.max(1, half - Math.floor(r / 2))
			stampRect(g, top + r, mid - span, 1, span * 2 + 1)
		}
	}
	const trunkH = Math.floor(size * 0.28)
	stampRect(g, size - trunkH - 1, mid - Math.floor(trunkW / 2), trunkH, trunkW)
	return toBitmap(g)
}

/** Food / object roundish with bite or stem detail. */
function foodRound(
	size: number,
	radius: number,
	stem: boolean,
	bite: boolean,
	leaf: boolean,
): Bitmap {
	const g = emptyGrid(size, size)
	const mid = Math.floor(size / 2)
	for (let r = 0; r < size; r += 1) {
		for (let c = 0; c < size; c += 1) {
			const dr = r - mid
			const dc = c - mid
			if (dr * dr + dc * dc <= radius * radius) {
				setCell(g, r, c, 1)
			}
		}
	}
	if (stem) {
		stampRect(g, mid - radius - 1, mid, 2, 1)
	}
	if (leaf) {
		setCell(g, mid - radius, mid + 1, 1)
		setCell(g, mid - radius - 1, mid + 2, 1)
	}
	if (bite) {
		const br = mid - Math.floor(radius / 2)
		const bc = mid + Math.floor(radius * 0.6)
		for (let r = -2; r <= 2; r += 1) {
			for (let c = -2; c <= 2; c += 1) {
				if (r * r + c * c <= 4) {
					setCell(g, br + r, bc + c, 0)
				}
			}
		}
	}
	return toBitmap(g)
}

/** Scene: ground + object + optional sky accent. */
function sceneCompose(
	size: number,
	groundH: number,
	object: Bitmap,
	objR: number,
	objC: number,
	sun: boolean,
): Bitmap {
	const g = emptyGrid(size, size)
	stampRect(g, size - groundH, 0, groundH, size)
	for (let r = 0; r < object.length; r += 1) {
		for (let c = 0; c < (object[0]?.length ?? 0); c += 1) {
			if (object[r]![c] === 1) {
				setCell(g, objR + r, objC + c, 1)
			}
		}
	}
	if (sun) {
		const sr = 1
		const sc = size - 4
		stampRect(g, sr, sc, 3, 3)
		setCell(g, sr + 1, sc + 1, 0)
	}
	return toBitmap(g)
}

/** Symbol-ish arrow / star / note variants. */
function symbolShape(
	size: number,
	kind: 'arrow' | 'star' | 'note' | 'plus' | 'moon',
	thick: number,
): Bitmap {
	const mid = Math.floor(size / 2)
	return filledRect(size, size, (r, c) => {
		const dr = r - mid
		const dc = c - mid
		if (kind === 'arrow') {
			if (c >= mid - thick && c <= mid + thick && r >= 1 && r <= size - 2) {
				return true
			}
			if (r <= mid && Math.abs(c - mid) <= mid - r + thick) {
				return true
			}
			return false
		}
		if (kind === 'plus') {
			return (
				(Math.abs(dr) <= thick && Math.abs(dc) <= mid - 1) ||
				(Math.abs(dc) <= thick && Math.abs(dr) <= mid - 1)
			)
		}
		if (kind === 'moon') {
			const inOuter = dr * dr + dc * dc <= (mid - 1) * (mid - 1)
			const inInner =
				(dr + 1) * (dr + 1) + (dc - 2) * (dc - 2) <= (mid - 2) * (mid - 2)
			return inOuter && !inInner
		}
		if (kind === 'note') {
			if (r >= mid && c >= mid - thick && c <= mid + thick) {
				return true
			}
			if (
				(r - 2) * (r - 2) + (c - (mid + 2)) * (c - (mid + 2)) <=
				(thick + 1) * (thick + 1)
			) {
				return true
			}
			if (r <= 3 && c >= mid - 1 && c <= size - 2) {
				return true
			}
			return false
		}
		// star
		if (Math.abs(dr) <= thick || Math.abs(dc) <= thick) {
			return Math.abs(dr) + Math.abs(dc) <= mid
		}
		return Math.abs(dr) === Math.abs(dc) && Math.abs(dr) <= mid - 1
	})
}

interface ScaleSpec {
	readonly id: string
	readonly titleRu: string
	readonly collectionId: CollectionId
	readonly conceptId: string
	readonly compositionId: string
	readonly kind: ContentKind
	readonly bitmap: Bitmap
	readonly seed: number
}

function buildSpecs(): ScaleSpec[] {
	const out: ScaleSpec[] = []
	let seed = 800_000

	const buildings: Array<{
		title: string
		slug: string
		col: CollectionId
		size: number
		rows: number
		cols: number
		door: number
		roof: 'flat' | 'peak' | 'dome'
	}> = [
		{ title: 'Школьный корпус', slug: 'school-wing', col: 'city', size: 15, rows: 3, cols: 4, door: 6, roof: 'flat' },
		{ title: 'Почтовое отделение', slug: 'post-office', col: 'city', size: 15, rows: 2, cols: 3, door: 5, roof: 'peak' },
		{ title: 'Библиотека города', slug: 'city-library', col: 'city', size: 15, rows: 3, cols: 3, door: 7, roof: 'flat' },
		{ title: 'Музей фасад', slug: 'museum-facade', col: 'city', size: 15, rows: 2, cols: 5, door: 4, roof: 'dome' },
		{ title: 'Театр с колоннами', slug: 'theatre-cols', col: 'city', size: 15, rows: 2, cols: 4, door: 6, roof: 'peak' },
		{ title: 'Гостиница у парка', slug: 'park-hotel', col: 'travel', size: 15, rows: 4, cols: 3, door: 5, roof: 'flat' },
		{ title: 'Вокзальное крыло', slug: 'station-wing', col: 'transport', size: 15, rows: 2, cols: 6, door: 8, roof: 'flat' },
		{ title: 'Обсерватория башня', slug: 'observatory-tower', col: 'space', size: 15, rows: 3, cols: 2, door: 6, roof: 'dome' },
		{ title: 'Ратуша с часами', slug: 'town-hall-clock', col: 'city', size: 15, rows: 3, cols: 3, door: 6, roof: 'peak' },
		{ title: 'Фабрика цех', slug: 'factory-hall', col: 'city', size: 15, rows: 2, cols: 5, door: 3, roof: 'flat' },
		{ title: 'Больничный корпус', slug: 'hospital-wing', col: 'city', size: 15, rows: 3, cols: 4, door: 7, roof: 'flat' },
		{ title: 'Университетский зал', slug: 'uni-hall', col: 'city', size: 15, rows: 3, cols: 5, door: 5, roof: 'peak' },
		{ title: 'Крепость бастион', slug: 'bastion-fort', col: 'travel', size: 15, rows: 2, cols: 2, door: 6, roof: 'flat' },
		{ title: 'Маяк на скале', slug: 'cliff-lighthouse', col: 'sea', size: 15, rows: 4, cols: 1, door: 7, roof: 'dome' },
		{ title: 'Небоскрёб узкий', slug: 'slim-skyscraper', col: 'city', size: 20, rows: 6, cols: 2, door: 9, roof: 'flat' },
		{ title: 'Офисный корпус', slug: 'office-block', col: 'city', size: 20, rows: 5, cols: 4, door: 8, roof: 'flat' },
		{ title: 'Аэровокзал', slug: 'air-terminal', col: 'travel', size: 20, rows: 2, cols: 6, door: 10, roof: 'flat' },
		{ title: 'Стадион трибуна', slug: 'stadium-stand', col: 'sport', size: 20, rows: 3, cols: 5, door: 7, roof: 'peak' },
		{ title: 'Собор купол', slug: 'cathedral-dome', col: 'city', size: 20, rows: 3, cols: 3, door: 9, roof: 'dome' },
		{ title: 'Замок с башнями', slug: 'castle-towers', col: 'travel', size: 20, rows: 3, cols: 4, door: 8, roof: 'peak' },
	]

	for (const b of buildings) {
		seed += 1
		out.push({
			id: `s8c-bldg-${b.slug}`,
			titleRu: b.title,
			collectionId: b.col,
			conceptId: normalizeConceptId(b.slug),
			compositionId: `facade-${b.size}`,
			kind: 'object',
			bitmap: buildingFacade(b.size, b.rows, b.cols, b.door, b.roof),
			seed,
		})
	}

	const vehicles: Array<{
		title: string
		slug: string
		col: CollectionId
		w: number
		h: number
		cabin: number
		gap: number
		rack: boolean
	}> = [
		{ title: 'Городской автобус', slug: 'city-bus', col: 'transport', w: 15, h: 10, cabin: 2, gap: 2, rack: false },
		{ title: 'Школьный автобус', slug: 'school-bus', col: 'transport', w: 15, h: 10, cabin: 3, gap: 1, rack: false },
		{ title: 'Почтовый фургон', slug: 'mail-van', col: 'transport', w: 12, h: 8, cabin: 2, gap: 1, rack: false },
		{ title: 'Пожарная машина', slug: 'fire-truck', col: 'transport', w: 15, h: 10, cabin: 2, gap: 2, rack: true },
		{ title: 'Трактор в поле', slug: 'field-tractor', col: 'transport', w: 12, h: 10, cabin: 4, gap: 2, rack: false },
		{ title: 'Самосвал карьер', slug: 'quarry-dump', col: 'transport', w: 15, h: 10, cabin: 2, gap: 3, rack: false },
		{ title: 'Кемпер на колёсах', slug: 'camper-van', col: 'travel', w: 15, h: 10, cabin: 3, gap: 2, rack: true },
		{ title: 'Такси жёлтое', slug: 'city-taxi', col: 'transport', w: 10, h: 8, cabin: 3, gap: 1, rack: false },
		{ title: 'Полицейский седан', slug: 'police-sedan', col: 'transport', w: 12, h: 8, cabin: 3, gap: 1, rack: true },
		{ title: 'Скорая помощь', slug: 'ambulance-van', col: 'transport', w: 15, h: 10, cabin: 2, gap: 2, rack: false },
		{ title: 'Молоковоз', slug: 'milk-tanker', col: 'transport', w: 15, h: 8, cabin: 2, gap: 3, rack: false },
		{ title: 'Эвакуатор', slug: 'tow-truck', col: 'transport', w: 15, h: 10, cabin: 2, gap: 2, rack: false },
		{ title: 'Каток дорожный', slug: 'road-roller', col: 'transport', w: 12, h: 8, cabin: 5, gap: 2, rack: false },
		{ title: 'Бетономешалка', slug: 'cement-mixer', col: 'transport', w: 15, h: 10, cabin: 2, gap: 2, rack: false },
		{ title: 'Автодом длинный', slug: 'long-rv', col: 'travel', w: 20, h: 10, cabin: 3, gap: 3, rack: true },
		{ title: 'Грузовик с тентом', slug: 'covered-lorry', col: 'transport', w: 20, h: 12, cabin: 2, gap: 3, rack: false },
		{ title: 'Лимузин свадебный', slug: 'wedding-limo', col: 'transport', w: 20, h: 8, cabin: 4, gap: 2, rack: false },
		{ title: 'Фургон мороженщика', slug: 'ice-cream-van', col: 'food', w: 12, h: 10, cabin: 3, gap: 1, rack: true },
	]

	for (const v of vehicles) {
		seed += 1
		out.push({
			id: `s8c-veh-${v.slug}`,
			titleRu: v.title,
			collectionId: v.col,
			conceptId: normalizeConceptId(v.slug),
			compositionId: `side-${v.w}x${v.h}`,
			kind: 'object',
			bitmap: vehicleSide(v.w, v.h, v.cabin, v.gap, v.rack),
			seed,
		})
	}

	const creatures: Array<{
		title: string
		slug: string
		col: CollectionId
		size: number
		ear: number
		leg: number
		tail: 'left' | 'right'
		neck: number
	}> = [
		{ title: 'Лиса в поле', slug: 'fox-field', col: 'animals', size: 15, ear: 1, leg: 4, tail: 'left', neck: 1 },
		{ title: 'Волк на холме', slug: 'wolf-hill', col: 'animals', size: 15, ear: 0, leg: 5, tail: 'left', neck: 2 },
		{ title: 'Енот у реки', slug: 'raccoon-river', col: 'animals', size: 12, ear: 1, leg: 3, tail: 'right', neck: 1 },
		{ title: 'Барсук норный', slug: 'badger-den', col: 'animals', size: 12, ear: 0, leg: 4, tail: 'left', neck: 0 },
		{ title: 'Выдра плавучая', slug: 'otter-float', col: 'animals', size: 12, ear: 0, leg: 5, tail: 'right', neck: 1 },
		{ title: 'Белка на ветке', slug: 'squirrel-branch', col: 'animals', size: 10, ear: 1, leg: 3, tail: 'right', neck: 2 },
		{ title: 'Заяц в траве', slug: 'hare-grass', col: 'animals', size: 12, ear: 0, leg: 4, tail: 'left', neck: 2 },
		{ title: 'Лось лесной', slug: 'forest-moose', col: 'animals', size: 15, ear: 2, leg: 6, tail: 'left', neck: 3 },
		{ title: 'Олень благородный', slug: 'noble-deer', col: 'animals', size: 15, ear: 1, leg: 5, tail: 'left', neck: 2 },
		{ title: 'Кабан вепрь', slug: 'wild-boar', col: 'animals', size: 12, ear: 0, leg: 4, tail: 'left', neck: 0 },
		{ title: 'Козёл горный', slug: 'mountain-goat', col: 'animals', size: 12, ear: 1, leg: 3, tail: 'right', neck: 2 },
		{ title: 'Лама андийская', slug: 'andean-llama', col: 'animals', size: 15, ear: 1, leg: 5, tail: 'left', neck: 3 },
		{ title: 'Панда бамбук', slug: 'bamboo-panda', col: 'animals', size: 15, ear: 1, leg: 4, tail: 'left', neck: 1 },
		{ title: 'Коала на эвкалипте', slug: 'eucalyptus-koala', col: 'animals', size: 12, ear: 2, leg: 3, tail: 'right', neck: 1 },
		{ title: 'Кенгуру прыжок', slug: 'kangaroo-hop', col: 'animals', size: 15, ear: 1, leg: 6, tail: 'left', neck: 2 },
		{ title: 'Верблюд одногорбый', slug: 'dromedary', col: 'animals', size: 15, ear: 0, leg: 5, tail: 'left', neck: 3 },
		{ title: 'Зебра саванна', slug: 'savanna-zebra', col: 'animals', size: 15, ear: 1, leg: 5, tail: 'right', neck: 2 },
		{ title: 'Жираф высокий', slug: 'tall-giraffe', col: 'animals', size: 20, ear: 1, leg: 7, tail: 'left', neck: 5 },
		{ title: 'Слон африканский', slug: 'african-elephant', col: 'animals', size: 20, ear: 2, leg: 6, tail: 'left', neck: 1 },
		{ title: 'Носорог толстокожий', slug: 'thick-rhino', col: 'animals', size: 15, ear: 0, leg: 5, tail: 'left', neck: 0 },
		{ title: 'Бегемот речной', slug: 'river-hippo', col: 'animals', size: 15, ear: 0, leg: 4, tail: 'right', neck: 0 },
		{ title: 'Крокодил берег', slug: 'bank-crocodile', col: 'animals', size: 15, ear: 0, leg: 6, tail: 'right', neck: 0 },
		{ title: 'Черепаха панцирная', slug: 'shell-turtle', col: 'animals', size: 12, ear: 0, leg: 3, tail: 'left', neck: 1 },
		{ title: 'Лягушка пруд', slug: 'pond-frog', col: 'animals', size: 10, ear: 0, leg: 3, tail: 'left', neck: 0 },
		{ title: 'Пингвин император', slug: 'emperor-penguin', col: 'birds', size: 12, ear: 0, leg: 2, tail: 'left', neck: 2 },
		{ title: 'Сова ночная', slug: 'night-owl', col: 'birds', size: 10, ear: 1, leg: 2, tail: 'left', neck: 0 },
		{ title: 'Пеликан клюв', slug: 'pelican-bill', col: 'birds', size: 15, ear: 0, leg: 3, tail: 'right', neck: 2 },
		{ title: 'Фламинго розовый', slug: 'pink-flamingo', col: 'birds', size: 15, ear: 0, leg: 4, tail: 'left', neck: 4 },
		{ title: 'Страус бег', slug: 'running-ostrich', col: 'birds', size: 15, ear: 0, leg: 5, tail: 'right', neck: 3 },
		{ title: 'Дятел на стволе', slug: 'trunk-woodpecker', col: 'birds', size: 12, ear: 0, leg: 2, tail: 'left', neck: 1 },
	]

	for (const cr of creatures) {
		seed += 1
		out.push({
			id: `s8c-crt-${cr.slug}`,
			titleRu: cr.title,
			collectionId: cr.col,
			conceptId: normalizeConceptId(cr.slug),
			compositionId: `profile-${cr.size}`,
			kind: 'object',
			bitmap: creatureProfile(cr.size, cr.ear, cr.leg, cr.tail, cr.neck),
			seed,
		})
	}

	const trees: Array<{
		title: string
		slug: string
		size: number
		skew: number
		trunk: number
		layers: number
	}> = [
		{ title: 'Дуб раскидистый', slug: 'spreading-oak', size: 15, skew: 1, trunk: 3, layers: 3 },
		{ title: 'Берёза стройная', slug: 'slim-birch', size: 15, skew: 0, trunk: 2, layers: 4 },
		{ title: 'Ива плакучая', slug: 'weeping-willow', size: 15, skew: 2, trunk: 2, layers: 3 },
		{ title: 'Клён осенний', slug: 'autumn-maple', size: 12, skew: 1, trunk: 2, layers: 3 },
		{ title: 'Пальма курортная', slug: 'resort-palm', size: 15, skew: 0, trunk: 2, layers: 2 },
		{ title: 'Ель заснеженная', slug: 'snowy-fir', size: 15, skew: 0, trunk: 2, layers: 5 },
		{ title: 'Кипарис узкий', slug: 'slim-cypress', size: 12, skew: 0, trunk: 1, layers: 4 },
		{ title: 'Сакура цветёт', slug: 'blooming-sakura', size: 15, skew: 2, trunk: 2, layers: 3 },
		{ title: 'Баобаб африканский', slug: 'baobab-tree', size: 15, skew: 1, trunk: 4, layers: 2 },
		{ title: 'Секвойя великан', slug: 'giant-sequoia', size: 20, skew: 0, trunk: 4, layers: 5 },
		{ title: 'Кактус сагуаро', slug: 'saguaro-cactus', size: 15, skew: 0, trunk: 3, layers: 2 },
		{ title: 'Бамбук роща мини', slug: 'mini-bamboo', size: 12, skew: 0, trunk: 1, layers: 3 },
	]

	for (const t of trees) {
		seed += 1
		out.push({
			id: `s8c-tree-${t.slug}`,
			titleRu: t.title,
			collectionId: 'plants',
			conceptId: normalizeConceptId(t.slug),
			compositionId: `tree-${t.size}`,
			kind: 'object',
			bitmap: treeSilhouette(t.size, t.skew, t.trunk, t.layers),
			seed,
		})
	}

	const foods: Array<{
		title: string
		slug: string
		col: CollectionId
		size: number
		r: number
		stem: boolean
		bite: boolean
		leaf: boolean
	}> = [
		{ title: 'Слива спелая', slug: 'ripe-plum', col: 'food', size: 10, r: 3, stem: true, bite: false, leaf: true },
		{ title: 'Персик пушистый', slug: 'fuzzy-peach', col: 'food', size: 10, r: 3, stem: true, bite: false, leaf: true },
		{ title: 'Абрикос садовый', slug: 'garden-apricot', col: 'food', size: 10, r: 3, stem: true, bite: false, leaf: false },
		{ title: 'Мандарин долька', slug: 'tangerine-fruit', col: 'food', size: 10, r: 3, stem: false, bite: false, leaf: true },
		{ title: 'Гранат раскрытый', slug: 'open-pomegranate', col: 'food', size: 12, r: 4, stem: true, bite: true, leaf: false },
		{ title: 'Киви в разрезе', slug: 'kiwi-slice', col: 'food', size: 10, r: 3, stem: false, bite: true, leaf: false },
		{ title: 'Кокос тропический', slug: 'tropic-coconut', col: 'food', size: 12, r: 4, stem: false, bite: false, leaf: false },
		{ title: 'Авокадо половинка', slug: 'avocado-half', col: 'food', size: 12, r: 4, stem: false, bite: true, leaf: false },
		{ title: 'Лук репчатый', slug: 'bulb-onion', col: 'food', size: 10, r: 3, stem: true, bite: false, leaf: false },
		{ title: 'Чеснок головка', slug: 'garlic-bulb', col: 'food', size: 10, r: 3, stem: true, bite: false, leaf: false },
		{ title: 'Помидор черри', slug: 'cherry-tomato', col: 'food', size: 8, r: 2, stem: true, bite: false, leaf: true },
		{ title: 'Баклажан глянцевый', slug: 'glossy-eggplant', col: 'food', size: 12, r: 3, stem: true, bite: false, leaf: true },
		{ title: 'Тыква оранжевая', slug: 'orange-pumpkin', col: 'food', size: 12, r: 4, stem: true, bite: false, leaf: false },
		{ title: 'Кабачок дачный', slug: 'garden-zucchini', col: 'food', size: 12, r: 3, stem: false, bite: false, leaf: true },
		{ title: 'Кукурузный початок', slug: 'corn-ear', col: 'food', size: 12, r: 3, stem: true, bite: false, leaf: true },
		{ title: 'Булочка с кунжутом', slug: 'sesame-bun', col: 'food', size: 10, r: 3, stem: false, bite: false, leaf: false },
		{ title: 'Пончик глазурь', slug: 'glazed-donut', col: 'food', size: 10, r: 3, stem: false, bite: true, leaf: false },
		{ title: 'Маффин ягодный', slug: 'berry-muffin', col: 'food', size: 10, r: 3, stem: false, bite: false, leaf: false },
		{ title: 'Эклер кремовый', slug: 'cream-eclair', col: 'food', size: 12, r: 2, stem: false, bite: false, leaf: false },
		{ title: 'Чизкейк кусок', slug: 'cheesecake-slice', col: 'food', size: 10, r: 3, stem: false, bite: true, leaf: false },
	]

	for (const f of foods) {
		seed += 1
		out.push({
			id: `s8c-food-${f.slug}`,
			titleRu: f.title,
			collectionId: f.col,
			conceptId: normalizeConceptId(f.slug),
			compositionId: `round-${f.size}`,
			kind: 'object',
			bitmap: foodRound(f.size, f.r, f.stem, f.bite, f.leaf),
			seed,
		})
	}

	const symbols: Array<{
		title: string
		slug: string
		kind: 'arrow' | 'star' | 'note' | 'plus' | 'moon'
		size: number
		thick: number
	}> = [
		{ title: 'Стрелка вправо', slug: 'arrow-right-sym', kind: 'arrow', size: 10, thick: 1 },
		{ title: 'Звезда путеводная', slug: 'guide-star', kind: 'star', size: 10, thick: 1 },
		{ title: 'Нота восьмая', slug: 'eighth-note', kind: 'note', size: 10, thick: 1 },
		{ title: 'Плюс медицинский', slug: 'medical-plus', kind: 'plus', size: 7, thick: 1 },
		{ title: 'Полумесяц ясный', slug: 'clear-crescent', kind: 'moon', size: 10, thick: 1 },
		{ title: 'Звезда цирка', slug: 'circus-star', kind: 'star', size: 12, thick: 1 },
		{ title: 'Нота басовая', slug: 'bass-note', kind: 'note', size: 12, thick: 1 },
		{ title: 'Стрелка вниз', slug: 'arrow-down-sym', kind: 'arrow', size: 8, thick: 1 },
	]

	for (const s of symbols) {
		seed += 1
		out.push({
			id: `s8c-sym-${s.slug}`,
			titleRu: s.title,
			collectionId: 'symbols',
			conceptId: normalizeConceptId(s.slug),
			compositionId: `sym-${s.size}`,
			kind: 'symbol',
			bitmap: symbolShape(s.size, s.kind, s.thick),
			seed,
		})
	}

	// Composed scenes — distinct conceptIds from their objects.
	const sceneDefs: Array<{
		title: string
		slug: string
		col: CollectionId
		size: number
		ground: number
		builder: () => Bitmap
		or: number
		oc: number
		sun: boolean
	}> = [
		{
			title: 'Дом у дерева',
			slug: 'house-by-tree',
			col: 'home',
			size: 15,
			ground: 2,
			builder: () => buildingFacade(7, 2, 2, 3, 'peak'),
			or: 5,
			oc: 1,
			sun: true,
		},
		{
			title: 'Лодка на волнах',
			slug: 'boat-on-waves',
			col: 'sea',
			size: 15,
			ground: 3,
			builder: () => vehicleSide(8, 5, 2, 1, false),
			or: 6,
			oc: 3,
			sun: true,
		},
		{
			title: 'Горы и солнце',
			slug: 'mountains-sun',
			col: 'nature',
			size: 15,
			ground: 2,
			builder: () => treeSilhouette(8, 1, 2, 2),
			or: 4,
			oc: 2,
			sun: true,
		},
		{
			title: 'Палатка у костра',
			slug: 'tent-campfire',
			col: 'travel',
			size: 15,
			ground: 2,
			builder: () => buildingFacade(6, 1, 1, 2, 'peak'),
			or: 6,
			oc: 2,
			sun: false,
		},
		{
			title: 'Ракета и планета',
			slug: 'rocket-planet',
			col: 'space',
			size: 15,
			ground: 1,
			builder: () => foodRound(6, 2, true, false, false),
			or: 3,
			oc: 8,
			sun: false,
		},
		{
			title: 'Маяк у моря',
			slug: 'lighthouse-shore',
			col: 'sea',
			size: 15,
			ground: 3,
			builder: () => buildingFacade(5, 3, 1, 2, 'dome'),
			or: 3,
			oc: 5,
			sun: true,
		},
		{
			title: 'Поезд у станции',
			slug: 'train-at-station',
			col: 'transport',
			size: 20,
			ground: 2,
			builder: () => vehicleSide(12, 6, 2, 2, false),
			or: 8,
			oc: 2,
			sun: false,
		},
		{
			title: 'Кот у окна',
			slug: 'cat-at-window',
			col: 'home',
			size: 12,
			ground: 1,
			builder: () => creatureProfile(6, 1, 2, 'left', 1),
			or: 4,
			oc: 3,
			sun: false,
		},
		{
			title: 'Мост над рекой',
			slug: 'bridge-over-river',
			col: 'city',
			size: 20,
			ground: 3,
			builder: () => buildingFacade(10, 1, 4, 4, 'flat'),
			or: 6,
			oc: 5,
			sun: true,
		},
		{
			title: 'Ферма с амбаром',
			slug: 'farm-barn',
			col: 'nature',
			size: 15,
			ground: 2,
			builder: () => buildingFacade(8, 2, 2, 3, 'peak'),
			or: 4,
			oc: 3,
			sun: true,
		},
	]

	for (const sc of sceneDefs) {
		seed += 1
		const obj = sc.builder()
		out.push({
			id: `s8c-scn-${sc.slug}`,
			titleRu: sc.title,
			collectionId: sc.col,
			conceptId: normalizeConceptId(sc.slug),
			compositionId: `scene-${sc.size}`,
			kind: 'scene',
			bitmap: sceneCompose(sc.size, sc.ground, obj, sc.or, sc.oc, sc.sun),
			seed,
		})
	}

	// Extra parameter sweeps for buildings/vehicles to boost HARD/EXPERT yield.
	const roofCycle: Array<'flat' | 'peak' | 'dome'> = ['flat', 'peak', 'dome']
	const districts = [
		'северный',
		'южный',
		'восточный',
		'западный',
		'центральный',
		'новый',
		'старый',
		'малый',
		'большой',
		'речной',
		'горный',
		'парковый',
	]
	const buildingKinds = [
		'Жилой корпус',
		'Деловой центр',
		'Выставочный павильон',
		'Спортивный комплекс',
		'Научный институт',
		'Культурный центр',
		'Торговый пассаж',
		'Концертный дом',
		'Архив города',
		'Планетарий',
		'Бассейн крытый',
		'Галерея искусств',
	]
	const materials = [
		'из красного кирпича',
		'из белого камня',
		'со стеклянным фасадом',
		'с зелёной крышей',
		'у набережной',
		'на площади',
		'за парком',
		'у вокзала',
		'на холме',
		'у реки',
		'в старом квартале',
		'у моста',
	]
	for (let i = 0; i < 120; i += 1) {
		seed += 1
		const size = i % 4 === 0 ? 20 : i % 3 === 0 ? 12 : 15
		const rows = 2 + (i % 5)
		const cols = 2 + ((i * 3) % 6)
		const roof = roofCycle[i % 3]!
		const slug = `tower-block-${i + 1}`
		const title = `${buildingKinds[i % buildingKinds.length]} ${districts[Math.floor(i / buildingKinds.length) % districts.length]} ${materials[Math.floor(i / (buildingKinds.length * districts.length)) % materials.length]}`
		out.push({
			id: `s8c-twr-${slug}`,
			titleRu: title,
			collectionId: i % 5 === 0 ? 'travel' : 'city',
			conceptId: normalizeConceptId(slug),
			compositionId: `twr-${size}-r${rows}-c${cols}-${roof}`,
			kind: 'object',
			bitmap: buildingFacade(size, rows, cols, 3 + (i % 6), roof),
			seed,
		})
	}

	const fleetAdj = [
		'Сервисный',
		'Курьерский',
		'Ремонтный',
		'Садовый',
		'Строительный',
		'Свадебный',
		'Ночной',
		'Городской',
		'Пригородный',
		'Экспедиционный',
	]
	const fleetNoun = [
		'фургон',
		'минивэн',
		'пикап',
		'универсал',
		'автобусик',
		'вездеход',
	]
	const fleetExtra = [
		'с ящиком',
		'с тентом',
		'с лестницей',
		'с багажником',
		'на базе',
		'для дачи',
		'для стройки',
		'для почты',
	]
	for (let i = 0; i < 80; i += 1) {
		seed += 1
		const w = 10 + (i % 4) * 3
		const h = 8 + (i % 3) * 2
		const slug = `fleet-van-${i + 1}`
		const title = `${fleetAdj[i % fleetAdj.length]} ${fleetNoun[Math.floor(i / fleetAdj.length) % fleetNoun.length]} ${fleetExtra[Math.floor(i / (fleetAdj.length * fleetNoun.length)) % fleetExtra.length]}`
		out.push({
			id: `s8c-fltv-${slug}`,
			titleRu: title,
			collectionId: 'transport',
			conceptId: normalizeConceptId(slug),
			compositionId: `fleet-${w}x${h}-c${2 + (i % 3)}`,
			kind: 'object',
			bitmap: vehicleSide(w, h, 2 + (i % 3), 1 + (i % 3), i % 2 === 0),
			seed,
		})
	}

	const critterNames = [
		'Куница лесная',
		'Хорёк степной',
		'Сурок байбак',
		'Бобр плотинный',
		'Ондатра речная',
		'Рысь таёжная',
		'Росомаха северная',
		'Песец полярный',
		'Норка европейская',
		'Соболь сибирский',
		'Ласка малая',
		'Горностай белый',
		'Енотовидная собака',
		'Шакал степной',
		'Мангуст ловкий',
	]
	const critterPlaces = [
		'у ручья',
		'на поляне',
		'у норы',
		'в чаще',
		'на склоне',
		'у камня',
	]
	for (let i = 0; i < 90; i += 1) {
		seed += 1
		const size = i % 3 === 0 ? 15 : i % 2 === 0 ? 12 : 10
		const slug = `woodland-critter-${i + 1}`
		out.push({
			id: `s8c-wld-${slug}`,
			titleRu: `${critterNames[i % critterNames.length]} ${critterPlaces[i % critterPlaces.length]}`,
			collectionId: 'animals',
			conceptId: normalizeConceptId(slug),
			compositionId: `critter-${size}-v${i % 7}`,
			kind: 'object',
			bitmap: creatureProfile(
				size,
				i % 3,
				3 + (i % 4),
				i % 2 === 0 ? 'left' : 'right',
				i % 3,
			),
			seed,
		})
	}

	const fruits = [
		'Айва душистая',
		'Инжир средиземный',
		'Финик сахарный',
		'Папайя спелая',
		'Гуава тропическая',
		'Личи сахарное',
		'Рамбутан колючий',
		'Манго спелое',
		'Хурма восточная',
		'Нектарин сочный',
		'Алыча южная',
		'Кизил лесной',
		'Шелковица сладкая',
		'Рябина садовая',
		'Ирга мягкая',
		'Боярышник красный',
		'Калина ягодная',
		'Черноплодка',
		'Облепиха яркая',
		'Брусника северная',
	]
	for (let i = 0; i < 60; i += 1) {
		seed += 1
		const size = 8 + (i % 4) * 2
		const slug = `orchard-fruit-${i + 1}`
		out.push({
			id: `s8c-orc-${slug}`,
			titleRu: `${fruits[i % fruits.length]} ${['с ветки', 'в корзине', 'на блюде', 'с листом'][i % 4]}`,
			collectionId: 'food',
			conceptId: normalizeConceptId(slug),
			compositionId: `fruit-${size}-v${i % 5}`,
			kind: 'object',
			bitmap: foodRound(
				size,
				2 + (i % 3),
				i % 2 === 0,
				i % 3 === 0,
				i % 2 === 1,
			),
			seed,
		})
	}

	const treeNames = [
		'Тополь серебристый',
		'Ясень высокий',
		'Ольха чёрная',
		'Рябина обыкновенная',
		'Липа душистая',
		'Каштан конский',
		'Орех грецкий',
		'Платан тенистый',
		'Эвкалипт высокий',
		'Магнолия южная',
	]
	for (let i = 0; i < 40; i += 1) {
		seed += 1
		const size = 12 + (i % 3) * 3
		const slug = `grove-tree-${i + 1}`
		out.push({
			id: `s8c-grv-${slug}`,
			titleRu: `${treeNames[i % treeNames.length]} ${['у дороги', 'у озера', 'в парке', 'на холме'][i % 4]}`,
			collectionId: 'plants',
			conceptId: normalizeConceptId(slug),
			compositionId: `grove-${size}`,
			kind: 'object',
			bitmap: treeSilhouette(size, i % 3, 1 + (i % 3), 2 + (i % 3)),
			seed,
		})
	}

	const sceneNouns = [
		'Хутор',
		'Пристань',
		'Поляна',
		'Мыс',
		'Долина',
		'Перевал',
		'Залив',
		'Овраг',
		'Роща',
		'Утёс',
	]
	const scenePlaces = [
		'у озера',
		'на рассвете',
		'в тумане',
		'под луной',
		'после дождя',
		'зимой',
		'весной',
		'осенью',
	]
	for (let i = 0; i < 50; i += 1) {
		seed += 1
		const size = i % 2 === 0 ? 15 : 20
		const slug = `vista-scene-${i + 1}`
		const obj =
			i % 3 === 0
				? buildingFacade(7 + (i % 3), 2, 2 + (i % 2), 3, roofCycle[i % 3]!)
				: i % 3 === 1
					? treeSilhouette(8, i % 2, 2, 3)
					: vehicleSide(8, 5, 2, 1, false)
		out.push({
			id: `s8c-vst-${slug}`,
			titleRu: `${sceneNouns[i % sceneNouns.length]} ${scenePlaces[Math.floor(i / sceneNouns.length) % scenePlaces.length]}`,
			collectionId: i % 2 === 0 ? 'nature' : 'travel',
			conceptId: normalizeConceptId(slug),
			compositionId: `vista-${size}-${i % 9}`,
			kind: 'scene',
			bitmap: sceneCompose(
				size,
				2 + (i % 2),
				obj,
				3 + (i % 4),
				2 + (i % 5),
				i % 2 === 0,
			),
			seed,
		})
	}

	for (let i = 0; i < 50; i += 1) {
		seed += 1
		const size = 20
		const rows = 4 + (i % 4)
		const cols = 3 + (i % 5)
		const roof = roofCycle[i % 3]!
		const slug = `expert-citadel-${i + 1}`
		const title = `${['Цитадель', 'Дворец', 'Академия', 'Арсенал', 'Обсерватория', 'Колизей'][i % 6]} ${['туманная', 'закатная', 'рассветная', 'лунная', 'грозовавая', 'звёздная', 'вечерняя', 'утренняя'][i % 8]} ${['у моря', 'в горах', 'на острове', 'у леса', 'над рекой', 'в пустыне'][i % 6]}`
		out.push({
			id: `s8c-xpt-${slug}`,
			titleRu: title,
			collectionId: i % 2 === 0 ? 'city' : 'travel',
			conceptId: normalizeConceptId(slug),
			compositionId: `citadel-20-r${rows}-c${cols}-${roof}`,
			kind: 'object',
			bitmap: buildingFacade(size, rows, cols, 4 + (i % 8), roof),
			seed,
		})
	}

	return out
}

/** Build RawCandidate list for Phase 8C scale-up (additive pool only). */
export function buildScaleProceduralCandidates(): RawCandidate[] {
	const specs = buildSpecs()
	const seenIds = new Set<string>()
	const seenTitles = new Set<string>()
	const seenConcepts = new Set<string>()
	const out: RawCandidate[] = []
	for (const s of specs) {
		if (seenIds.has(s.id) || seenTitles.has(s.titleRu) || seenConcepts.has(s.conceptId)) {
			continue
		}
		seenIds.add(s.id)
		seenTitles.add(s.titleRu)
		seenConcepts.add(s.conceptId)
		out.push(
			cand({
				id: s.id,
				titleRu: s.titleRu,
				collectionId: s.collectionId,
				conceptId: s.conceptId,
				compositionId: s.compositionId,
				variant: s.compositionId,
				kind: s.kind,
				bitmap: s.bitmap,
				seed: s.seed,
			}),
		)
	}
	out.sort((a, b) => a.id.localeCompare(b.id))
	return out
}
