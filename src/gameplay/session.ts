/**
 * UI-independent game session controller.
 * React / Skia / gesture libraries must call into this layer — not invert it.
 */

import {
	createEmptyPlayerState,
	isPuzzleComplete,
} from '../domain/nonogram/playerState'
import {
	PlayerCell,
	type PlayerState,
	type Puzzle,
} from '../domain/nonogram/types'
import {
	canRedo,
	canUndo,
	createHistory,
	pushTransaction,
	redo as historyRedo,
	undo as historyUndo,
	type CellMutation,
	type HistoryState,
} from './history'
import {
	beginPaintGesture,
	extendPaintGesture,
	type CellCoord,
	type PaintGestureState,
} from './paintGesture'
import { PaintTool } from './tools'
import {
	getSatisfiedColumns,
	getSatisfiedRows,
} from './clueSatisfaction'

export interface GameSession {
	readonly puzzle: Puzzle
	readonly player: PlayerState
	readonly tool: PaintTool
	readonly history: HistoryState
	readonly completed: boolean
	readonly activeGesture: PaintGestureState | null
	/** Player state before the active gesture; source for paint decisions. */
	readonly gestureBaseline: PlayerState | null
	readonly startedAtMs: number
	readonly completedAtMs: number | null
}

function applyMutationsToPlayer(
	player: PlayerState,
	mutations: readonly CellMutation[],
): PlayerState {
	if (mutations.length === 0) {
		return player
	}
	const cells = player.cells.slice()
	for (const mutation of mutations) {
		cells[mutation.row * player.width + mutation.col] = mutation.after
	}
	return Object.freeze({
		width: player.width,
		height: player.height,
		cells: Object.freeze(cells),
	})
}

function readCell(player: PlayerState, row: number, col: number): PlayerCell {
	return player.cells[row * player.width + col] ?? PlayerCell.UNKNOWN
}

function withCompletion(session: GameSession): GameSession {
	if (session.completed) {
		return session
	}
	if (!isPuzzleComplete(session.player, session.puzzle)) {
		return session
	}
	return Object.freeze({
		...session,
		completed: true,
		completedAtMs: Date.now(),
		activeGesture: null,
		gestureBaseline: null,
	})
}

export function createGameSession(
	puzzle: Puzzle,
	nowMs: number = Date.now(),
): GameSession {
	return Object.freeze({
		puzzle,
		player: createEmptyPlayerState(puzzle.width, puzzle.height),
		tool: PaintTool.FILLED,
		history: createHistory(),
		completed: false,
		activeGesture: null,
		gestureBaseline: null,
		startedAtMs: nowMs,
		completedAtMs: null,
	})
}

/**
 * Restore a live session from persisted player cells.
 * Undo/Redo history intentionally starts empty after Continue / relaunch.
 */
export function restoreGameSession(
	puzzle: Puzzle,
	player: PlayerState,
	tool: PaintTool = PaintTool.FILLED,
	nowMs: number = Date.now(),
): GameSession {
	if (player.width !== puzzle.width || player.height !== puzzle.height) {
		throw new Error(
			`Cannot restore session: player ${player.width}x${player.height} vs puzzle ${puzzle.width}x${puzzle.height}`,
		)
	}
	const base = Object.freeze({
		puzzle,
		player,
		tool,
		history: createHistory(),
		completed: false,
		activeGesture: null,
		gestureBaseline: null,
		startedAtMs: nowMs,
		completedAtMs: null,
	})
	return withCompletion(base)
}

export function setTool(session: GameSession, tool: PaintTool): GameSession {
	if (session.completed) {
		return session
	}
	return Object.freeze({ ...session, tool })
}

export function tapCell(
	session: GameSession,
	cell: CellCoord,
	pointer: { x: number; y: number },
): GameSession {
	if (session.completed) {
		return session
	}
	if (
		cell.row < 0 ||
		cell.col < 0 ||
		cell.row >= session.puzzle.height ||
		cell.col >= session.puzzle.width
	) {
		return session
	}

	const baseline = session.player
	const gesture = beginPaintGesture({
		tool: session.tool,
		cell,
		x: pointer.x,
		y: pointer.y,
		current: readCell(baseline, cell.row, cell.col),
	})
	const player = applyMutationsToPlayer(baseline, gesture.mutations)
	return Object.freeze({
		...session,
		player,
		activeGesture: gesture,
		gestureBaseline: baseline,
	})
}

export function continueGesture(
	session: GameSession,
	cell: CellCoord | null,
	pointer: { x: number; y: number },
): GameSession {
	if (
		session.completed ||
		session.activeGesture === null ||
		session.gestureBaseline === null
	) {
		return session
	}
	if (cell === null) {
		return session
	}

	const baseline = session.gestureBaseline
	const gesture = extendPaintGesture({
		gesture: session.activeGesture,
		cell,
		x: pointer.x,
		y: pointer.y,
		width: session.puzzle.width,
		height: session.puzzle.height,
		readCell: (row, col) => readCell(baseline, row, col),
	})
	const player = applyMutationsToPlayer(baseline, gesture.mutations)
	return Object.freeze({
		...session,
		player,
		activeGesture: gesture,
	})
}

export function endGesture(session: GameSession): GameSession {
	if (session.activeGesture === null) {
		return session
	}
	const mutations = session.activeGesture.mutations
	const history =
		mutations.length > 0
			? pushTransaction(session.history, mutations)
			: session.history
	const next = Object.freeze({
		...session,
		history,
		activeGesture: null,
		gestureBaseline: null,
	})
	return withCompletion(next)
}

/** Convenience: tap that immediately commits (no drag). */
export function tapAndCommit(
	session: GameSession,
	cell: CellCoord,
	pointer: { x: number; y: number } = { x: 0, y: 0 },
): GameSession {
	return endGesture(tapCell(session, cell, pointer))
}

export function undo(session: GameSession): GameSession {
	if (session.completed || session.activeGesture !== null) {
		return session
	}
	const result = historyUndo(session.history, session.player)
	if (result === null) {
		return session
	}
	return Object.freeze({
		...session,
		player: result.state,
		history: result.history,
		completed: false,
		completedAtMs: null,
	})
}

export function redo(session: GameSession): GameSession {
	if (session.completed || session.activeGesture !== null) {
		return session
	}
	const result = historyRedo(session.history, session.player)
	if (result === null) {
		return session
	}
	return withCompletion(
		Object.freeze({
			...session,
			player: result.state,
			history: result.history,
		}),
	)
}

export function sessionCanUndo(session: GameSession): boolean {
	return (
		!session.completed &&
		session.activeGesture === null &&
		canUndo(session.history)
	)
}

export function sessionCanRedo(session: GameSession): boolean {
	return (
		!session.completed &&
		session.activeGesture === null &&
		canRedo(session.history)
	)
}

export function sessionSatisfiedRows(session: GameSession): boolean[] {
	return getSatisfiedRows(session.player, session.puzzle.rowClues)
}

export function sessionSatisfiedColumns(session: GameSession): boolean[] {
	return getSatisfiedColumns(session.player, session.puzzle.columnClues)
}

export function elapsedMs(
	session: GameSession,
	nowMs: number = Date.now(),
): number {
	const end = session.completedAtMs ?? nowMs
	return Math.max(0, end - session.startedAtMs)
}
