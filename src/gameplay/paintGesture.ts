/**
 * Pure paint / line-lock / drag interpolation logic.
 * No React, Skia, or Android dependencies.
 *
 * Gesture contract:
 * - movement below LOCK_THRESHOLD_PX keeps axis unlocked
 * - once |dx| or |dy| exceeds threshold, lock to row or column
 * - lock never switches mid-gesture
 * - each cell mutates at most once per gesture (visited set)
 * - fast moves interpolate all cells along the locked line (no holes)
 */

import { PlayerCell } from '../domain/nonogram/types'
import { PaintTool } from './tools'
import type { CellMutation } from './history'

export const LOCK_THRESHOLD_PX = 8

export type LockAxis = 'none' | 'row' | 'column'

export interface CellCoord {
	readonly row: number
	readonly col: number
}

export interface PaintGestureState {
	readonly tool: PaintTool
	readonly start: CellCoord
	readonly lock: LockAxis
	readonly originX: number
	readonly originY: number
	readonly visited: ReadonlySet<string>
	readonly mutations: readonly CellMutation[]
	readonly lastCell: CellCoord
}

function cellKey(row: number, col: number): string {
	return `${row},${col}`
}

export function targetCellForTool(
	current: PlayerCell,
	tool: PaintTool,
): PlayerCell | null {
	if (tool === PaintTool.FILLED) {
		return current === PlayerCell.FILLED ? null : PlayerCell.FILLED
	}
	if (tool === PaintTool.CROSSED) {
		return current === PlayerCell.CROSSED ? null : PlayerCell.CROSSED
	}
	// ERASE
	return current === PlayerCell.UNKNOWN ? null : PlayerCell.UNKNOWN
}

export function beginPaintGesture(input: {
	readonly tool: PaintTool
	readonly cell: CellCoord
	readonly x: number
	readonly y: number
	readonly current: PlayerCell
}): PaintGestureState {
	const after = targetCellForTool(input.current, input.tool)
	const mutations: CellMutation[] = []
	const visited = new Set<string>([cellKey(input.cell.row, input.cell.col)])
	if (after !== null) {
		mutations.push({
			row: input.cell.row,
			col: input.cell.col,
			before: input.current,
			after,
		})
	}
	return {
		tool: input.tool,
		start: input.cell,
		lock: 'none',
		originX: input.x,
		originY: input.y,
		visited,
		mutations: Object.freeze(mutations),
		lastCell: input.cell,
	}
}

export function resolveLock(
	state: PaintGestureState,
	x: number,
	y: number,
): LockAxis {
	if (state.lock !== 'none') {
		return state.lock
	}
	const dx = Math.abs(x - state.originX)
	const dy = Math.abs(y - state.originY)
	if (dx < LOCK_THRESHOLD_PX && dy < LOCK_THRESHOLD_PX) {
		return 'none'
	}
	return dx >= dy ? 'row' : 'column'
}

/**
 * Clamp a candidate cell to the locked line (or leave free before lock).
 */
export function applyLockToCell(
	state: PaintGestureState,
	cell: CellCoord,
): CellCoord {
	if (state.lock === 'row') {
		return { row: state.start.row, col: cell.col }
	}
	if (state.lock === 'column') {
		return { row: cell.row, col: state.start.col }
	}
	return cell
}

/**
 * Cells on a straight axis-aligned segment from a → b (inclusive).
 * Used to fill gaps when pointer events skip cells during fast drag.
 */
export function cellsOnAxisSegment(
	from: CellCoord,
	to: CellCoord,
): CellCoord[] {
	const cells: CellCoord[] = []
	if (from.row === to.row) {
		const row = from.row
		const step = to.col >= from.col ? 1 : -1
		for (let col = from.col; ; col += step) {
			cells.push({ row, col })
			if (col === to.col) {
				break
			}
		}
		return cells
	}
	if (from.col === to.col) {
		const col = from.col
		const step = to.row >= from.row ? 1 : -1
		for (let row = from.row; ; row += step) {
			cells.push({ row, col })
			if (row === to.row) {
				break
			}
		}
		return cells
	}
	// Diagonal before lock: only the destination cell (lock not yet set).
	return [to]
}

export function extendPaintGesture(input: {
	readonly gesture: PaintGestureState
	readonly cell: CellCoord
	readonly x: number
	readonly y: number
	readonly readCell: (row: number, col: number) => PlayerCell
	readonly width: number
	readonly height: number
}): PaintGestureState {
	const lock = resolveLock(input.gesture, input.x, input.y)
	const withLock: PaintGestureState = {
		...input.gesture,
		lock,
	}
	const lockedTarget = applyLockToCell(withLock, input.cell)
	if (
		lockedTarget.row < 0 ||
		lockedTarget.col < 0 ||
		lockedTarget.row >= input.height ||
		lockedTarget.col >= input.width
	) {
		return { ...withLock, lastCell: withLock.lastCell }
	}

	const path =
		withLock.lock === 'none'
			? [lockedTarget]
			: cellsOnAxisSegment(withLock.lastCell, lockedTarget)

	const visited = new Set(withLock.visited)
	const mutations = withLock.mutations.slice()

	for (const cell of path) {
		const key = cellKey(cell.row, cell.col)
		if (visited.has(key)) {
			continue
		}
		visited.add(key)
		const current = input.readCell(cell.row, cell.col)
		const after = targetCellForTool(current, withLock.tool)
		if (after !== null) {
			mutations.push({
				row: cell.row,
				col: cell.col,
				before: current,
				after,
			})
		}
	}

	return {
		...withLock,
		visited,
		mutations: Object.freeze(mutations),
		lastCell: lockedTarget,
	}
}
