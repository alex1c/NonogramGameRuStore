/**
 * Geometry + transform unit tests (Phase 3 + 3B clue layout).
 */

import {
	ROW_CLUE_GAP_MIN,
	ROW_CLUE_SLOT_FACTOR,
	cellCenterViewport,
	cellRect,
	clampTranslation,
	clueFontSize,
	computeBoardLayout,
	fitTransform,
	pointerToCell,
	scaleAroundFocal,
} from '../geometry'

const layout = computeBoardLayout({
	puzzleWidth: 5,
	puzzleHeight: 4,
	rowClues: [[1], [2], [], [1, 1]],
	columnClues: [[2], [1], [1], [1], [1]],
	viewportWidth: 360,
	viewportHeight: 480,
})

/** Typical OPPO-like portrait board viewport used for fit sanity. */
const DEVICE_VIEWPORT = { width: 360, height: 520 }

function layoutForSize(
	size: number,
	maxRowDepth: number,
	maxColDepth: number,
) {
	const rowClues = Array.from({ length: size }, (_, row) =>
		row === 0
			? Array.from({ length: maxRowDepth }, (__, i) => (i === 0 ? 15 : 1))
			: [1],
	)
	const columnClues = Array.from({ length: size }, (_, col) =>
		col === 0
			? Array.from({ length: maxColDepth }, (__, i) => (i === 0 ? 11 : 1))
			: [1],
	)
	return computeBoardLayout({
		puzzleWidth: size,
		puzzleHeight: size,
		rowClues,
		columnClues,
		viewportWidth: DEVICE_VIEWPORT.width,
		viewportHeight: DEVICE_VIEWPORT.height,
	})
}

describe('board geometry', () => {
	it('builds rectangular layouts with clue areas', () => {
		expect(layout.width).toBe(5)
		expect(layout.height).toBe(4)
		expect(layout.gridWidth).toBe(layout.width * layout.cellSize)
		expect(layout.gridHeight).toBe(layout.height * layout.cellSize)
		expect(layout.totalWidth).toBe(layout.clueColWidth + layout.gridWidth)
		expect(layout.totalHeight).toBe(layout.clueRowHeight + layout.gridHeight)
		expect(layout.rowClueGridGap).toBeGreaterThanOrEqual(ROW_CLUE_GAP_MIN)
		expect(layout.rowClueSlotWidth).toBeGreaterThan(0)
	})

	it('grows clue areas when clue depth increases', () => {
		const shallow = computeBoardLayout({
			puzzleWidth: 10,
			puzzleHeight: 10,
			rowClues: Array.from({ length: 10 }, () => [1]),
			columnClues: Array.from({ length: 10 }, () => [1]),
			viewportWidth: DEVICE_VIEWPORT.width,
			viewportHeight: DEVICE_VIEWPORT.height,
		})
		const deep = computeBoardLayout({
			puzzleWidth: 10,
			puzzleHeight: 10,
			rowClues: Array.from({ length: 10 }, () => [2, 1, 3]),
			columnClues: Array.from({ length: 10 }, () => [1, 1, 1]),
			viewportWidth: DEVICE_VIEWPORT.width,
			viewportHeight: DEVICE_VIEWPORT.height,
		})
		expect(deep.maxRowClueCount).toBeGreaterThan(shallow.maxRowClueCount)
		expect(deep.clueColWidth).toBeGreaterThan(shallow.clueColWidth)
		expect(deep.clueRowHeight).toBeGreaterThan(shallow.clueRowHeight)
	})

	it('keeps 5×5 / 10×10 / 15×15 layouts valid and fittable', () => {
		for (const size of [5, 10, 15]) {
			const board = layoutForSize(size, 3, 3)
			expect(board.cellSize).toBeGreaterThanOrEqual(10)
			expect(board.totalWidth).toBe(board.clueColWidth + board.gridWidth)
			expect(board.totalHeight).toBe(board.clueRowHeight + board.gridHeight)
			const fit = fitTransform(
				board,
				DEVICE_VIEWPORT.width,
				DEVICE_VIEWPORT.height,
			)
			expect(fit.scale).toBeGreaterThan(0)
			expect(board.totalWidth * fit.scale).toBeLessThanOrEqual(
				DEVICE_VIEWPORT.width + 0.5,
			)
			expect(board.totalHeight * fit.scale).toBeLessThanOrEqual(
				DEVICE_VIEWPORT.height + 0.5,
			)
		}
	})

	it('reserves multi-digit row clue slot space', () => {
		const board = layoutForSize(15, 4, 3)
		const font = clueFontSize(board.cellSize)
		// Two-digit glyph budget: slot must be wider than a generous "15" estimate.
		expect(board.rowClueSlotWidth).toBeGreaterThanOrEqual(
			Math.ceil(font * 1.2),
		)
		expect(board.rowClueSlotWidth).toBeGreaterThanOrEqual(
			Math.ceil(board.cellSize * ROW_CLUE_SLOT_FACTOR),
		)
		expect(board.clueColWidth).toBeGreaterThanOrEqual(
			board.rowClueGridGap + board.maxRowClueCount * board.rowClueSlotWidth,
		)
	})

	it('maps cell center pointer back to the same cell', () => {
		const transform = fitTransform(layout, 360, 480)
		for (let row = 0; row < layout.height; row += 1) {
			for (let col = 0; col < layout.width; col += 1) {
				const point = cellCenterViewport(layout, transform, row, col)
				expect(pointerToCell(point.x, point.y, layout, transform)).toEqual({
					row,
					col,
				})
			}
		}
	})

	it('returns null outside the grid (including outer edges beyond board)', () => {
		const transform = { scale: 1, tx: 0, ty: 0 }
		expect(pointerToCell(0, 0, layout, transform)).toBeNull()
		expect(
			pointerToCell(
				layout.gridOriginX + layout.gridWidth + 1,
				layout.gridOriginY + 1,
				layout,
				transform,
			),
		).toBeNull()
		expect(
			pointerToCell(
				layout.gridOriginX + 1,
				layout.gridOriginY + layout.gridHeight + 1,
				layout,
				transform,
			),
		).toBeNull()
	})

	it('handles exact left/top grid edges as first cell', () => {
		const transform = { scale: 1, tx: 0, ty: 0 }
		expect(
			pointerToCell(layout.gridOriginX, layout.gridOriginY, layout, transform),
		).toEqual({ row: 0, col: 0 })
	})

	it('handles zoom + pan transform consistently', () => {
		const transform = scaleAroundFocal(
			{ scale: 1, tx: 10, ty: 20 },
			100,
			120,
			2,
		)
		const clamped = clampTranslation(transform, layout, 360, 480)
		const point = cellCenterViewport(layout, clamped, 2, 3)
		expect(pointerToCell(point.x, point.y, layout, clamped)).toEqual({
			row: 2,
			col: 3,
		})
	})

	it('preserves hit-testing after Phase 3B clue geometry for 15×15', () => {
		const board = layoutForSize(15, 4, 3)
		const transform = fitTransform(
			board,
			DEVICE_VIEWPORT.width,
			DEVICE_VIEWPORT.height,
		)
		const point = cellCenterViewport(board, transform, 7, 8)
		expect(pointerToCell(point.x, point.y, board, transform)).toEqual({
			row: 7,
			col: 8,
		})
		// Pointer inside the row-clue gutter must not paint a cell.
		expect(
			pointerToCell(
				transform.tx + (board.gridOriginX - 2) * transform.scale,
				transform.ty +
					(board.gridOriginY + board.cellSize * 0.5) * transform.scale,
				board,
				transform,
			),
		).toBeNull()
	})

	it('cellRect sizes match cellSize', () => {
		const rect = cellRect(layout, 1, 2)
		expect(rect.width).toBe(layout.cellSize)
		expect(rect.height).toBe(layout.cellSize)
		expect(rect.x).toBe(layout.gridOriginX + 2 * layout.cellSize)
		expect(rect.y).toBe(layout.gridOriginY + 1 * layout.cellSize)
	})

	it('clamps clue font size into the Phase 3B range', () => {
		expect(clueFontSize(10)).toBeGreaterThanOrEqual(10)
		expect(clueFontSize(48)).toBeLessThanOrEqual(20)
		expect(clueFontSize(30)).toBe(Math.round(30 * 0.45))
	})
})
