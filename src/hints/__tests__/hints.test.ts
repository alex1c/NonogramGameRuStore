/**
 * Phase 7 — Hint engine, explanation, apply, schema v3.
 */

import { createEmptyPlayerState } from '../../domain/nonogram/playerState'
import { PlayerCell, type PlayerState } from '../../domain/nonogram/types'
import {
	applyHintStep,
	explainTeachMe,
	getHint,
	normalizeLogicalStep,
} from '../index'
import { puzzleToSpec } from '../../solver/completeSolver'
import { solveLogically } from '../../solver/logicalSolver'
import {
	FIXTURE_A_SIMPLE_5X5,
	FIXTURE_I_STALLED_UNIQUE,
} from '../../tests/fixtures/nonogramFixtures'
import { getProductionPuzzleById } from '../../content/playable'
import {
	applyHintToSession,
	createGameSession,
	redo,
	setTool,
	tapAndCommit,
	undo,
} from '../../gameplay/session'
import { PaintTool } from '../../gameplay/tools'

function filledPartial(
	width: number,
	height: number,
	cells: readonly { row: number; col: number; value: PlayerCell }[],
): PlayerState {
	const base = createEmptyPlayerState(width, height)
	const next = base.cells.slice()
	for (const cell of cells) {
		next[cell.row * width + cell.col] = cell.value
	}
	return Object.freeze({
		width,
		height,
		cells: Object.freeze(next),
	})
}

describe('hint engine — no solution input', () => {
	it('returns STEP from clue-only PuzzleSpec + empty player', () => {
		const spec = puzzleToSpec(FIXTURE_A_SIMPLE_5X5)
		const player = createEmptyPlayerState(spec.width, spec.height)
		const result = getHint({ spec, player, revision: 0, mode: 'HINT' })
		expect(result.kind).toBe('STEP')
		if (result.kind === 'STEP') {
			expect(result.step.revision).toBe(0)
			expect(result.step.targets.length).toBeGreaterThan(0)
			expect(result.step.clue).toBeDefined()
		}
	})

	it('is deterministic for identical state', () => {
		const spec = puzzleToSpec(FIXTURE_A_SIMPLE_5X5)
		const player = createEmptyPlayerState(spec.width, spec.height)
		const a = getHint({ spec, player, revision: 1, mode: 'HINT' })
		const b = getHint({ spec, player, revision: 1, mode: 'HINT' })
		expect(a).toEqual(b)
	})

	it('returns STALLED after logical exhaustion on fixture I', () => {
		const spec = puzzleToSpec(FIXTURE_I_STALLED_UNIQUE)
		const logical = solveLogically(spec)
		expect(logical.status).toBe('STALLED')
		const player = Object.freeze({
			width: spec.width,
			height: spec.height,
			cells: Object.freeze(
				logical.grid.map((cell) => {
					if (cell === 1) {
						return PlayerCell.FILLED
					}
					if (cell === -1) {
						return PlayerCell.CROSSED
					}
					return PlayerCell.UNKNOWN
				}),
			),
		})
		const result = getHint({ spec, player, revision: 0 })
		expect(result.kind).toBe('STALLED')
	})

	it('returns CONTRADICTION for overfilled row without using solution', () => {
		const spec = puzzleToSpec(FIXTURE_A_SIMPLE_5X5)
		// Row 0 clue is [1,1] on A — fill entire row → impossible
		const cells = Array.from({ length: spec.width }, (_, col) => ({
			row: 0,
			col,
			value: PlayerCell.FILLED,
		}))
		const player = filledPartial(spec.width, spec.height, cells)
		const result = getHint({ spec, player, revision: 0 })
		expect(result.kind).toBe('CONTRADICTION')
	})

	it('returns COMPLETE when board has no UNKNOWN cells', () => {
		const puzzle = FIXTURE_A_SIMPLE_5X5
		const cells = puzzle.solution.map((v) =>
			v === 1 ? PlayerCell.FILLED : PlayerCell.CROSSED,
		)
		const player = Object.freeze({
			width: puzzle.width,
			height: puzzle.height,
			cells: Object.freeze(cells),
		})
		const result = getHint({
			spec: puzzleToSpec(puzzle),
			player,
			revision: 0,
		})
		expect(result.kind).toBe('COMPLETE')
	})
})

describe('hint apply + session revision', () => {
	it('applies one transaction and rejects stale revision', () => {
		const puzzle = FIXTURE_A_SIMPLE_5X5
		let session = createGameSession(puzzle)
		const result = getHint({
			spec: puzzleToSpec(puzzle),
			player: session.player,
			revision: session.revision,
		})
		expect(result.kind).toBe('STEP')
		if (result.kind !== 'STEP') {
			return
		}
		const stale = applyHintStep(session.player, result.step, 99)
		expect(stale.ok).toBe(false)
		if (!stale.ok) {
			expect(stale.reason).toBe('STALE')
		}

		const applied = applyHintStep(
			session.player,
			result.step,
			session.revision,
		)
		expect(applied.ok).toBe(true)
		if (!applied.ok) {
			return
		}
		session = applyHintToSession(
			session,
			applied.mutations,
			applied.player,
		)
		expect(session.revision).toBe(1)
		expect(session.history.undoStack.length).toBe(1)

		session = undo(session)
		expect(session.history.undoStack.length).toBe(0)
		session = redo(session)
		expect(session.history.undoStack.length).toBe(1)
	})

	it('tool change does not bump revision', () => {
		let session = createGameSession(FIXTURE_A_SIMPLE_5X5)
		expect(session.revision).toBe(0)
		session = setTool(session, PaintTool.CROSSED)
		expect(session.revision).toBe(0)
	})

	it('board mutation after hint invalidates apply', () => {
		const puzzle = FIXTURE_A_SIMPLE_5X5
		let session = createGameSession(puzzle)
		const result = getHint({
			spec: puzzleToSpec(puzzle),
			player: session.player,
			revision: session.revision,
		})
		expect(result.kind).toBe('STEP')
		if (result.kind !== 'STEP') {
			return
		}
		session = tapAndCommit(session, { row: 0, col: 0 })
		const applied = applyHintStep(
			session.player,
			result.step,
			session.revision,
		)
		expect(applied.ok).toBe(false)
		if (!applied.ok) {
			expect(applied.reason).toBe('STALE')
		}
	})
})

describe('hint explanation layer', () => {
	it('formats Russian overlap / forced text without enum leakage', () => {
		const puzzle = FIXTURE_A_SIMPLE_5X5
		const result = getHint({
			spec: puzzleToSpec(puzzle),
			player: createEmptyPlayerState(puzzle.width, puzzle.height),
			revision: 0,
			mode: 'TEACH',
		})
		expect(result.kind).toBe('STEP')
		if (result.kind !== 'STEP') {
			return
		}
		const explanation = explainTeachMe(result.step, null)
		expect(explanation.lineTitle).toMatch(/^(Строка|Столбец) \d+$/)
		expect(explanation.body).not.toMatch(/forced_|overlap|candidate/)
		expect(explanation.actionLabel).toMatch(/Закрасьте|крестик/)
		expect(explanation.clueText.length).toBeGreaterThan(0)
		expect(explanation.whyAccent).toBe('Почему так?')
	})
})

describe('hint chain soundness (oracle)', () => {
	it('solves a production puzzle via Hint → Apply chain', () => {
		const puzzle = getProductionPuzzleById('mini-beginner-bar')
		expect(puzzle).not.toBeNull()
		if (puzzle === null) {
			return
		}
		let player = createEmptyPlayerState(puzzle.width, puzzle.height)
		let revision = 0
		const spec = puzzleToSpec(puzzle)
		let guard = 0
		while (guard < 200) {
			guard += 1
			const result = getHint({ spec, player, revision, mode: 'HINT' })
			if (result.kind === 'COMPLETE') {
				break
			}
			expect(result.kind).toBe('STEP')
			if (result.kind !== 'STEP') {
				return
			}
			for (const target of result.step.targets) {
				const expected =
					puzzle.solution[target.row * puzzle.width + target.col]
				if (result.step.action === 'FILLED') {
					expect(expected).toBe(1)
				} else {
					expect(expected).toBe(0)
				}
			}
			const applied = applyHintStep(player, result.step, revision)
			expect(applied.ok).toBe(true)
			if (!applied.ok) {
				return
			}
			player = applied.player
			revision += 1
		}
		expect(
			player.cells.every((cell) => cell !== PlayerCell.UNKNOWN),
		).toBe(true)
	})
})

describe('hint engine architecture', () => {
	it('normalizeLogicalStep freezes pedagogical steps', () => {
		const steps = normalizeLogicalStep(
			{
				orientation: 'row',
				lineIndex: 0,
				clue: Object.freeze([3]),
				cells: Object.freeze([
					Object.freeze({
						row: 0,
						col: 1,
						action: 'FILLED' as const,
						reason: 'forced_filled' as const,
					}),
					Object.freeze({
						row: 0,
						col: 2,
						action: 'EMPTY' as const,
						reason: 'forced_empty' as const,
					}),
				]),
				reason: 'forced_filled',
				candidateCountBefore: 2,
			},
			7,
		)
		expect(steps).toHaveLength(2)
		expect(steps[0]?.action).toBe('FILLED')
		expect(steps[1]?.action).toBe('CROSSED')
		expect(steps[0]?.revision).toBe(7)
	})
})
