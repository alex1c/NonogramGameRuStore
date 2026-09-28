/**
 * Undo/Redo history of paint transactions.
 * One tap = one transaction. One drag (any length) = one transaction.
 */

import { PlayerCell, type PlayerState } from '../domain/nonogram/types'

export interface CellMutation {
	readonly row: number
	readonly col: number
	readonly before: PlayerCell
	readonly after: PlayerCell
}

export interface PaintTransaction {
	readonly id: number
	readonly mutations: readonly CellMutation[]
}

export interface HistoryState {
	readonly undoStack: readonly PaintTransaction[]
	readonly redoStack: readonly PaintTransaction[]
	readonly nextId: number
}

export function createHistory(): HistoryState {
	return Object.freeze({
		undoStack: Object.freeze([]),
		redoStack: Object.freeze([]),
		nextId: 1,
	})
}

function applyMutations(
	state: PlayerState,
	mutations: readonly CellMutation[],
	direction: 'forward' | 'backward',
): PlayerState {
	const cells = state.cells.slice()
	for (const mutation of mutations) {
		const index = mutation.row * state.width + mutation.col
		cells[index] =
			direction === 'forward' ? mutation.after : mutation.before
	}
	return Object.freeze({
		width: state.width,
		height: state.height,
		cells: Object.freeze(cells),
	})
}

export function pushTransaction(
	history: HistoryState,
	mutations: readonly CellMutation[],
): HistoryState {
	if (mutations.length === 0) {
		return history
	}
	const transaction: PaintTransaction = Object.freeze({
		id: history.nextId,
		mutations: Object.freeze(mutations.slice()),
	})
	return Object.freeze({
		undoStack: Object.freeze([...history.undoStack, transaction]),
		redoStack: Object.freeze([]),
		nextId: history.nextId + 1,
	})
}

export function undo(
	history: HistoryState,
	state: PlayerState,
): { history: HistoryState; state: PlayerState } | null {
	if (history.undoStack.length === 0) {
		return null
	}
	const transaction = history.undoStack[history.undoStack.length - 1]!
	const nextState = applyMutations(state, transaction.mutations, 'backward')
	return {
		state: nextState,
		history: Object.freeze({
			undoStack: Object.freeze(history.undoStack.slice(0, -1)),
			redoStack: Object.freeze([...history.redoStack, transaction]),
			nextId: history.nextId,
		}),
	}
}

export function redo(
	history: HistoryState,
	state: PlayerState,
): { history: HistoryState; state: PlayerState } | null {
	if (history.redoStack.length === 0) {
		return null
	}
	const transaction = history.redoStack[history.redoStack.length - 1]!
	const nextState = applyMutations(state, transaction.mutations, 'forward')
	return {
		state: nextState,
		history: Object.freeze({
			undoStack: Object.freeze([...history.undoStack, transaction]),
			redoStack: Object.freeze(history.redoStack.slice(0, -1)),
			nextId: history.nextId,
		}),
	}
}

export function canUndo(history: HistoryState): boolean {
	return history.undoStack.length > 0
}

export function canRedo(history: HistoryState): boolean {
	return history.redoStack.length > 0
}
