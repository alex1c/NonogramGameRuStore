/**
 * Geometry + transform unit tests.
 */

import {
	cellCenterViewport,
	cellRect,
	clampTranslation,
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

describe('board geometry', () => {
	it('builds rectangular layouts with clue areas', () => {
		expect(layout.width).toBe(5)
		expect(layout.height).toBe(4)
		expect(layout.gridWidth).toBe(layout.width * layout.cellSize)
		expect(layout.gridHeight).toBe(layout.height * layout.cellSize)
		expect(layout.totalWidth).toBe(layout.clueColWidth + layout.gridWidth)
		expect(layout.totalHeight).toBe(layout.clueRowHeight + layout.gridHeight)
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

	it('cellRect sizes match cellSize', () => {
		const rect = cellRect(layout, 1, 2)
		expect(rect.width).toBe(layout.cellSize)
		expect(rect.height).toBe(layout.cellSize)
		expect(rect.x).toBe(layout.gridOriginX + 2 * layout.cellSize)
		expect(rect.y).toBe(layout.gridOriginY + 1 * layout.cellSize)
	})
})
