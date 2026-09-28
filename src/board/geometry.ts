/**
 * Board geometry + view transform — single source of truth for render & hit-test.
 */

export interface BoardLayout {
	readonly width: number
	readonly height: number
	readonly cellSize: number
	readonly clueColWidth: number
	readonly clueRowHeight: number
	readonly gridOriginX: number
	readonly gridOriginY: number
	readonly gridWidth: number
	readonly gridHeight: number
	readonly totalWidth: number
	readonly totalHeight: number
	readonly maxRowClueCount: number
	readonly maxColClueCount: number
}

export interface ViewTransform {
	readonly scale: number
	readonly tx: number
	readonly ty: number
}

export interface Rect {
	readonly x: number
	readonly y: number
	readonly width: number
	readonly height: number
}

export interface CellCoord {
	readonly row: number
	readonly col: number
}

export const MIN_SCALE = 0.55
export const MAX_SCALE = 4
export const GROUP_SEPARATOR_EVERY = 5

function maxClueCount(clues: readonly (readonly number[])[]): number {
	let max = 1
	for (const clue of clues) {
		max = Math.max(max, Math.max(clue.length, 1))
	}
	return max
}

/**
 * Compute an unscaled board layout that fits inside the viewport at scale=1
 * when possible. cellSize is chosen to fit the full board (clues + grid).
 */
export function computeBoardLayout(input: {
	readonly puzzleWidth: number
	readonly puzzleHeight: number
	readonly rowClues: readonly (readonly number[])[]
	readonly columnClues: readonly (readonly number[])[]
	readonly viewportWidth: number
	readonly viewportHeight: number
	readonly minCellSize?: number
	readonly maxCellSize?: number
}): BoardLayout {
	const maxRowClueCount = maxClueCount(input.rowClues)
	const maxColClueCount = maxClueCount(input.columnClues)
	const minCell = input.minCellSize ?? 10
	const maxCell = input.maxCellSize ?? 48

	// total = clueColWidth + gridWidth, clueColWidth ≈ maxRowClueCount * (cell*0.55)
	// Solve for cellSize that fits viewport.
	const clueFactorX = maxRowClueCount * 0.55
	const clueFactorY = maxColClueCount * 0.7
	const cellByWidth =
		input.viewportWidth / (input.puzzleWidth + clueFactorX)
	const cellByHeight =
		input.viewportHeight / (input.puzzleHeight + clueFactorY)
	const cellSize = Math.max(
		minCell,
		Math.min(maxCell, Math.floor(Math.min(cellByWidth, cellByHeight))),
	)

	const clueColWidth = Math.max(24, Math.ceil(maxRowClueCount * cellSize * 0.55))
	const clueRowHeight = Math.max(24, Math.ceil(maxColClueCount * cellSize * 0.7))
	const gridWidth = input.puzzleWidth * cellSize
	const gridHeight = input.puzzleHeight * cellSize

	return {
		width: input.puzzleWidth,
		height: input.puzzleHeight,
		cellSize,
		clueColWidth,
		clueRowHeight,
		gridOriginX: clueColWidth,
		gridOriginY: clueRowHeight,
		gridWidth,
		gridHeight,
		totalWidth: clueColWidth + gridWidth,
		totalHeight: clueRowHeight + gridHeight,
		maxRowClueCount,
		maxColClueCount,
	}
}

export function identityTransform(): ViewTransform {
	return { scale: 1, tx: 0, ty: 0 }
}

/** Fit the full board into the viewport and center it. */
export function fitTransform(
	layout: BoardLayout,
	viewportWidth: number,
	viewportHeight: number,
): ViewTransform {
	const padding = 8
	const availableW = Math.max(1, viewportWidth - padding * 2)
	const availableH = Math.max(1, viewportHeight - padding * 2)
	const scale = Math.max(
		MIN_SCALE,
		Math.min(
			MAX_SCALE,
			availableW / layout.totalWidth,
			availableH / layout.totalHeight,
		),
	)
	const drawnW = layout.totalWidth * scale
	const drawnH = layout.totalHeight * scale
	return {
		scale,
		tx: (viewportWidth - drawnW) / 2,
		ty: (viewportHeight - drawnH) / 2,
	}
}

export function clampScale(scale: number): number {
	return Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale))
}

/**
 * Keep at least a fraction of the board visible after pan.
 */
export function clampTranslation(
	transform: ViewTransform,
	layout: BoardLayout,
	viewportWidth: number,
	viewportHeight: number,
): ViewTransform {
	const drawnW = layout.totalWidth * transform.scale
	const drawnH = layout.totalHeight * transform.scale
	const margin = 48
	const minTx = Math.min(margin, viewportWidth - drawnW - margin)
	const maxTx = Math.max(margin, viewportWidth - margin)
	const minTy = Math.min(margin, viewportHeight - drawnH - margin)
	const maxTy = Math.max(margin, viewportHeight - margin)
	return {
		scale: transform.scale,
		tx: Math.max(minTx, Math.min(maxTx, transform.tx)),
		ty: Math.max(minTy, Math.min(maxTy, transform.ty)),
	}
}

/** Board-local point from a viewport pointer using the shared transform. */
export function viewportToBoardPoint(
	x: number,
	y: number,
	transform: ViewTransform,
): { x: number; y: number } {
	return {
		x: (x - transform.tx) / transform.scale,
		y: (y - transform.ty) / transform.scale,
	}
}

export function cellRect(layout: BoardLayout, row: number, col: number): Rect {
	return {
		x: layout.gridOriginX + col * layout.cellSize,
		y: layout.gridOriginY + row * layout.cellSize,
		width: layout.cellSize,
		height: layout.cellSize,
	}
}

/**
 * Map a viewport pointer to a grid cell, or null if outside the grid.
 * Boundary rule: left/top inclusive, right/bottom exclusive of the next cell,
 * and the far outer edges of the last cells are inclusive via clamping only
 * when the point is strictly inside the grid rectangle.
 */
export function pointerToCell(
	viewportX: number,
	viewportY: number,
	layout: BoardLayout,
	transform: ViewTransform,
): CellCoord | null {
	const local = viewportToBoardPoint(viewportX, viewportY, transform)
	const relX = local.x - layout.gridOriginX
	const relY = local.y - layout.gridOriginY
	if (relX < 0 || relY < 0 || relX >= layout.gridWidth || relY >= layout.gridHeight) {
		return null
	}
	const col = Math.min(layout.width - 1, Math.floor(relX / layout.cellSize))
	const row = Math.min(layout.height - 1, Math.floor(relY / layout.cellSize))
	if (col < 0 || row < 0) {
		return null
	}
	return { row, col }
}

/** Round-trip helper for tests: cell center in viewport coordinates. */
export function cellCenterViewport(
	layout: BoardLayout,
	transform: ViewTransform,
	row: number,
	col: number,
): { x: number; y: number } {
	const rect = cellRect(layout, row, col)
	return {
		x: transform.tx + (rect.x + rect.width / 2) * transform.scale,
		y: transform.ty + (rect.y + rect.height / 2) * transform.scale,
	}
}

/**
 * Scale around a focal point in viewport space (pinch anchor).
 */
export function scaleAroundFocal(
	transform: ViewTransform,
	focalX: number,
	focalY: number,
	nextScale: number,
): ViewTransform {
	const scale = clampScale(nextScale)
	const boardX = (focalX - transform.tx) / transform.scale
	const boardY = (focalY - transform.ty) / transform.scale
	return {
		scale,
		tx: focalX - boardX * scale,
		ty: focalY - boardY * scale,
	}
}
