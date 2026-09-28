/**
 * Paint gesture / line-lock / fast-drag interpolation tests.
 */

import { PlayerCell } from '../../domain/nonogram/types'
import {
	LOCK_THRESHOLD_PX,
	beginPaintGesture,
	cellsOnAxisSegment,
	extendPaintGesture,
	resolveLock,
} from '../paintGesture'
import { PaintTool } from '../tools'

describe('paint gesture', () => {
	it('fills cells on an axis segment without holes', () => {
		expect(cellsOnAxisSegment({ row: 0, col: 0 }, { row: 0, col: 7 })).toEqual([
			{ row: 0, col: 0 },
			{ row: 0, col: 1 },
			{ row: 0, col: 2 },
			{ row: 0, col: 3 },
			{ row: 0, col: 4 },
			{ row: 0, col: 5 },
			{ row: 0, col: 6 },
			{ row: 0, col: 7 },
		])
	})

	it('does not lock on tiny movement', () => {
		const gesture = beginPaintGesture({
			tool: PaintTool.FILLED,
			cell: { row: 1, col: 1 },
			x: 0,
			y: 0,
			current: PlayerCell.UNKNOWN,
		})
		expect(resolveLock(gesture, 3, 2)).toBe('none')
	})

	it('locks to a row on horizontal movement', () => {
		const gesture = beginPaintGesture({
			tool: PaintTool.FILLED,
			cell: { row: 2, col: 1 },
			x: 0,
			y: 0,
			current: PlayerCell.UNKNOWN,
		})
		expect(resolveLock(gesture, LOCK_THRESHOLD_PX + 5, 1)).toBe('row')
	})

	it('locks to a column on vertical movement', () => {
		const gesture = beginPaintGesture({
			tool: PaintTool.FILLED,
			cell: { row: 1, col: 2 },
			x: 0,
			y: 0,
			current: PlayerCell.UNKNOWN,
		})
		expect(resolveLock(gesture, 1, LOCK_THRESHOLD_PX + 5)).toBe('column')
	})

	it('keeps row lock despite vertical drift and skips duplicate cells', () => {
		let gesture = beginPaintGesture({
			tool: PaintTool.FILLED,
			cell: { row: 1, col: 0 },
			x: 0,
			y: 0,
			current: PlayerCell.UNKNOWN,
		})
		const grid = Array.from({ length: 5 * 5 }, () => PlayerCell.UNKNOWN)
		const read = (row: number, col: number) => grid[row * 5 + col]!

		gesture = extendPaintGesture({
			gesture,
			cell: { row: 1, col: 3 },
			x: 40,
			y: 2,
			readCell: read,
			width: 5,
			height: 5,
		})
		expect(gesture.lock).toBe('row')

		gesture = extendPaintGesture({
			gesture,
			cell: { row: 3, col: 4 },
			x: 55,
			y: 30,
			readCell: read,
			width: 5,
			height: 5,
		})
		expect(gesture.lock).toBe('row')
		expect(gesture.lastCell).toEqual({ row: 1, col: 4 })

		// reverse drag should not remutate
		const beforeCount = gesture.mutations.length
		gesture = extendPaintGesture({
			gesture,
			cell: { row: 1, col: 2 },
			x: 30,
			y: 4,
			readCell: read,
			width: 5,
			height: 5,
		})
		expect(gesture.mutations.length).toBe(beforeCount)
	})

	it('fast jump along a locked line fills intermediate cells', () => {
		let gesture = beginPaintGesture({
			tool: PaintTool.FILLED,
			cell: { row: 0, col: 0 },
			x: 0,
			y: 0,
			current: PlayerCell.UNKNOWN,
		})
		gesture = {
			...gesture,
			lock: 'row',
		}
		gesture = extendPaintGesture({
			gesture,
			cell: { row: 0, col: 8 },
			x: 120,
			y: 1,
			readCell: () => PlayerCell.UNKNOWN,
			width: 10,
			height: 1,
		})
		expect(gesture.mutations.map((m) => m.col)).toEqual([
			0, 1, 2, 3, 4, 5, 6, 7, 8,
		])
	})
})
