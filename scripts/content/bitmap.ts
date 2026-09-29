/**
 * Bitmap coordinate contract (Phase 8A):
 * - row-major
 * - origin top-left
 * - 1 = FILLED, 0 = EMPTY
 */

export type Bit = 0 | 1
export type Bitmap = readonly (readonly Bit[])[]

export function assertBitmap(bitmap: Bitmap, width: number, height: number): void {
	if (bitmap.length !== height) {
		throw new Error(`Expected height ${height}, got ${bitmap.length}`)
	}
	for (let row = 0; row < height; row += 1) {
		const line = bitmap[row]
		if (line === undefined || line.length !== width) {
			throw new Error(`Row ${row}: expected width ${width}`)
		}
		for (const cell of line) {
			if (cell !== 0 && cell !== 1) {
				throw new Error(`Invalid bit at row ${row}`)
			}
		}
	}
}

export function cloneBitmap(bitmap: Bitmap): Bit[][] {
	return bitmap.map((row) => [...row])
}

export function freezeBitmap(bitmap: Bit[][]): Bitmap {
	return Object.freeze(bitmap.map((row) => Object.freeze([...row])))
}

export function countFilled(bitmap: Bitmap): number {
	let n = 0
	for (const row of bitmap) {
		for (const cell of row) {
			if (cell === 1) {
				n += 1
			}
		}
	}
	return n
}

export function fillRatio(bitmap: Bitmap): number {
	const h = bitmap.length
	const w = bitmap[0]?.length ?? 0
	if (h === 0 || w === 0) {
		return 0
	}
	return countFilled(bitmap) / (h * w)
}

export function mirrorHorizontal(bitmap: Bitmap): Bitmap {
	return freezeBitmap(bitmap.map((row) => [...row].reverse()))
}

export function mirrorVertical(bitmap: Bitmap): Bitmap {
	return freezeBitmap([...bitmap].reverse().map((row) => [...row]))
}

export function rotate180(bitmap: Bitmap): Bitmap {
	return mirrorVertical(mirrorHorizontal(bitmap))
}

/** Bounding box of filled cells; null if empty. */
export function boundingBox(bitmap: Bitmap): {
	readonly minRow: number
	readonly maxRow: number
	readonly minCol: number
	readonly maxCol: number
	readonly width: number
	readonly height: number
} | null {
	const h = bitmap.length
	const w = bitmap[0]?.length ?? 0
	let minRow = h
	let maxRow = -1
	let minCol = w
	let maxCol = -1
	for (let r = 0; r < h; r += 1) {
		for (let c = 0; c < w; c += 1) {
			if (bitmap[r]![c] === 1) {
				minRow = Math.min(minRow, r)
				maxRow = Math.max(maxRow, r)
				minCol = Math.min(minCol, c)
				maxCol = Math.max(maxCol, c)
			}
		}
	}
	if (maxRow < 0) {
		return null
	}
	return {
		minRow,
		maxRow,
		minCol,
		maxCol,
		width: maxCol - minCol + 1,
		height: maxRow - minRow + 1,
	}
}

/** 4-connected component analysis. */
export function analyzeComponents(bitmap: Bitmap): {
	readonly count: number
	readonly sizes: readonly number[]
	readonly singletons: number
	readonly largestShare: number
} {
	const h = bitmap.length
	const w = bitmap[0]?.length ?? 0
	const seen = Array.from({ length: h }, () => Array.from({ length: w }, () => false))
	const sizes: number[] = []
	for (let r = 0; r < h; r += 1) {
		for (let c = 0; c < w; c += 1) {
			if (bitmap[r]![c] !== 1 || seen[r]![c]) {
				continue
			}
			let size = 0
			const stack: Array<[number, number]> = [[r, c]]
			seen[r]![c] = true
			while (stack.length > 0) {
				const [cr, cc] = stack.pop()!
				size += 1
				const neighbors: Array<[number, number]> = [
					[cr - 1, cc],
					[cr + 1, cc],
					[cr, cc - 1],
					[cr, cc + 1],
				]
				for (const [nr, nc] of neighbors) {
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
			sizes.push(size)
		}
	}
	const filled = countFilled(bitmap)
	const largest = sizes.length === 0 ? 0 : Math.max(...sizes)
	return {
		count: sizes.length,
		sizes: Object.freeze(sizes.sort((a, b) => b - a)),
		singletons: sizes.filter((s) => s === 1).length,
		largestShare: filled === 0 ? 0 : largest / filled,
	}
}

/** Hamming similarity in [0,1] for equal-dimension bitmaps (1 = identical). */
export function hammingSimilarity(a: Bitmap, b: Bitmap): number {
	const h = a.length
	const w = a[0]?.length ?? 0
	if (h !== b.length || w !== (b[0]?.length ?? 0) || h === 0 || w === 0) {
		return 0
	}
	let same = 0
	const total = h * w
	for (let r = 0; r < h; r += 1) {
		for (let c = 0; c < w; c += 1) {
			if (a[r]![c] === b[r]![c]) {
				same += 1
			}
		}
	}
	return same / total
}

export function emptyBitmap(width: number, height: number): Bit[][] {
	return Array.from({ length: height }, () =>
		Array.from({ length: width }, () => 0 as Bit),
	)
}

export function stamp(
	canvas: Bit[][],
	stampBitmap: Bitmap,
	originRow: number,
	originCol: number,
): void {
	for (let r = 0; r < stampBitmap.length; r += 1) {
		for (let c = 0; c < stampBitmap[r]!.length; c += 1) {
			if (stampBitmap[r]![c] !== 1) {
				continue
			}
			const rr = originRow + r
			const cc = originCol + c
			if (
				rr >= 0 &&
				cc >= 0 &&
				rr < canvas.length &&
				cc < (canvas[0]?.length ?? 0)
			) {
				canvas[rr]![cc] = 1
			}
		}
	}
}

export function parseAscii(
	lines: readonly string[],
	filledChar = '#',
): Bitmap {
	if (lines.length === 0) {
		throw new Error('Empty ASCII bitmap')
	}
	const width = lines[0]!.length
	const matrix: Bit[][] = []
	for (let i = 0; i < lines.length; i += 1) {
		const line = lines[i]!
		if (line.length !== width) {
			throw new Error(`ASCII row ${i} width mismatch`)
		}
		const row: Bit[] = []
		for (const ch of line) {
			if (ch === filledChar) {
				row.push(1)
			} else if (ch === '.' || ch === ' ') {
				row.push(0)
			} else {
				throw new Error(`Invalid ASCII char '${ch}' at row ${i}`)
			}
		}
		matrix.push(row)
	}
	return freezeBitmap(matrix)
}

export function toAscii(bitmap: Bitmap, filledChar = '#', emptyChar = '.'): string {
	return bitmap
		.map((row) => row.map((cell) => (cell === 1 ? filledChar : emptyChar)).join(''))
		.join('\n')
}
