/**
 * Game session / history / completion tests.
 */

import {
	createPuzzleFromSolution,
	gridFromMatrix,
} from '../../domain/nonogram/clues'
import { PlayerCell } from '../../domain/nonogram/types'
import {
	continueGesture,
	createGameSession,
	endGesture,
	redo,
	sessionCanRedo,
	sessionCanUndo,
	setTool,
	tapAndCommit,
	tapCell,
	undo,
} from '../session'
import { PaintTool } from '../tools'

const puzzle = createPuzzleFromSolution({
	id: 'session-test',
	width: 3,
	height: 2,
	solution: gridFromMatrix([
		[1, 1, 0],
		[0, 1, 0],
	]),
})

describe('game session', () => {
	it('applies tap fill / cross / erase with explicit tools', () => {
		let session = createGameSession(puzzle)
		session = tapAndCommit(session, { row: 0, col: 0 })
		expect(session.player.cells[0]).toBe(PlayerCell.FILLED)

		session = setTool(session, PaintTool.CROSSED)
		session = tapAndCommit(session, { row: 0, col: 2 })
		expect(session.player.cells[2]).toBe(PlayerCell.CROSSED)

		session = setTool(session, PaintTool.ERASE)
		session = tapAndCommit(session, { row: 0, col: 0 })
		expect(session.player.cells[0]).toBe(PlayerCell.UNKNOWN)
	})

	it('treats a drag as one undo transaction', () => {
		let session = createGameSession(puzzle)
		session = tapCell(session, { row: 0, col: 0 }, { x: 0, y: 0 })
		session = continueGesture(session, { row: 0, col: 1 }, { x: 40, y: 1 })
		session = endGesture(session)
		expect(session.player.cells[0]).toBe(PlayerCell.FILLED)
		expect(session.player.cells[1]).toBe(PlayerCell.FILLED)
		expect(session.history.undoStack.length).toBe(1)

		session = undo(session)
		expect(session.player.cells[0]).toBe(PlayerCell.UNKNOWN)
		expect(session.player.cells[1]).toBe(PlayerCell.UNKNOWN)
		expect(sessionCanRedo(session)).toBe(true)

		session = redo(session)
		expect(session.player.cells[0]).toBe(PlayerCell.FILLED)
		expect(session.player.cells[1]).toBe(PlayerCell.FILLED)
	})

	it('restores mixed previous states and clears redo after new action', () => {
		let session = createGameSession(puzzle)
		session = setTool(session, PaintTool.CROSSED)
		session = tapAndCommit(session, { row: 0, col: 0 })
		session = setTool(session, PaintTool.FILLED)
		session = tapCell(session, { row: 0, col: 0 }, { x: 0, y: 0 })
		session = continueGesture(session, { row: 0, col: 1 }, { x: 30, y: 0 })
		session = endGesture(session)
		expect(session.player.cells[0]).toBe(PlayerCell.FILLED)
		expect(session.player.cells[1]).toBe(PlayerCell.FILLED)

		session = undo(session)
		expect(session.player.cells[0]).toBe(PlayerCell.CROSSED)
		expect(session.player.cells[1]).toBe(PlayerCell.UNKNOWN)

		session = tapAndCommit(session, { row: 1, col: 1 })
		expect(sessionCanRedo(session)).toBe(false)
		expect(sessionCanUndo(session)).toBe(true)
	})

	it('completes when FILLED set matches solution and blocks further paint', () => {
		let session = createGameSession(puzzle)
		session = tapAndCommit(session, { row: 0, col: 0 })
		session = tapAndCommit(session, { row: 0, col: 1 })
		session = tapAndCommit(session, { row: 1, col: 1 })
		expect(session.completed).toBe(true)

		const blocked = tapAndCommit(session, { row: 0, col: 2 })
		expect(blocked.player.cells[2]).toBe(PlayerCell.UNKNOWN)
		expect(blocked.completed).toBe(true)
	})
})
