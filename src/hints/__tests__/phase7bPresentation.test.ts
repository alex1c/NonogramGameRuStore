/**
 * Phase 7B — Hint compact vs Teach Me pedagogy + physical 3×3 regression.
 */

import { createPuzzleFromSolution, gridFromMatrix } from '../../domain/nonogram/clues'
import { createEmptyPlayerState } from '../../domain/nonogram/playerState'
import { PlayerCell } from '../../domain/nonogram/types'
import {
	explainHintCompact,
	explainTeachMe,
	formatHintAction,
	getHint,
	lineContextForStep,
} from '../index'
import { puzzleToSpec } from '../../solver/completeSolver'
import type { HintStep } from '../types'
import { FIXTURE_A_SIMPLE_5X5 } from '../../tests/fixtures/nonogramFixtures'
import { computeBoardLayout } from '../../board/geometry'

/** Physical OPPO case: 3×3 with a full-row clue [3]. */
const PHASE7B_ROW3 = createPuzzleFromSolution({
	id: 'phase7b-row3-block',
	width: 3,
	height: 3,
	solution: gridFromMatrix([
		[1, 1, 1],
		[0, 1, 0],
		[1, 0, 1],
	]),
	metadata: { title: 'Phase7B row3' },
})

function makeStep(partial: {
	readonly orientation?: 'row' | 'column'
	readonly lineIndex?: number
	readonly clue: readonly number[]
	readonly action: 'FILLED' | 'CROSSED'
	readonly targets: readonly { row: number; col: number }[]
	readonly reason: HintStep['reason']
	readonly runLength?: number | null
}): HintStep {
	return Object.freeze({
		orientation: partial.orientation ?? 'row',
		lineIndex: partial.lineIndex ?? 0,
		clue: Object.freeze([...partial.clue]),
		action: partial.action,
		targets: Object.freeze(partial.targets.map((t) => Object.freeze({ ...t }))),
		reason: partial.reason,
		proof: Object.freeze({
			reason: partial.reason,
			candidateCount: 2,
			forcedCount: partial.targets.length,
			runLength: partial.runLength ?? null,
		}),
		revision: 0,
	})
}

describe('Phase 7B Hint compact presentation', () => {
	it('shows only line + action, no pedagogical body', () => {
		const step = makeStep({
			clue: [3],
			action: 'FILLED',
			targets: [
				{ row: 0, col: 1 },
				{ row: 0, col: 2 },
			],
			reason: 'completed_line',
			runLength: 3,
		})
		const hint = explainHintCompact(step)
		expect(hint.mode).toBe('HINT')
		expect(hint.title).toBe('Подсказка')
		expect(hint.lineTitle).toBe('Строка 1')
		expect(hint.whyAccent).toBeNull()
		expect(hint.body).toBe('')
		expect(hint.actionLabel).toBe('Закрасьте 2 выделенные клетки')
		expect(hint.actionLabel).not.toMatch(/непрерывн|вариант|потому что/i)
	})

	it('formats Russian plurals for target counts', () => {
		expect(
			formatHintAction(
				makeStep({
					clue: [1],
					action: 'FILLED',
					targets: [{ row: 0, col: 0 }],
					reason: 'forced_filled',
				}),
			),
		).toBe('Закрасьте выделенную клетку')
		expect(
			formatHintAction(
				makeStep({
					clue: [2],
					action: 'FILLED',
					targets: [
						{ row: 0, col: 0 },
						{ row: 0, col: 1 },
					],
					reason: 'forced_filled',
				}),
			),
		).toBe('Закрасьте 2 выделенные клетки')
		expect(
			formatHintAction(
				makeStep({
					clue: [5],
					action: 'FILLED',
					targets: Array.from({ length: 5 }, (_, col) => ({
						row: 0,
						col,
					})),
					reason: 'forced_filled',
				}),
			),
		).toBe('Закрасьте 5 выделенных клеток')
	})
})

describe('Phase 7B Teach Me pedagogy', () => {
	it('completed_line FILLED explains continuous block clue', () => {
		const step = makeStep({
			clue: [3],
			action: 'FILLED',
			targets: [
				{ row: 0, col: 0 },
				{ row: 0, col: 1 },
				{ row: 0, col: 2 },
			],
			reason: 'completed_line',
			runLength: 3,
		})
		const line = {
			lineLength: 3,
			cells: Object.freeze([
				PlayerCell.UNKNOWN,
				PlayerCell.UNKNOWN,
				PlayerCell.UNKNOWN,
			]),
		}
		const teach = explainTeachMe(step, line)
		expect(teach.whyAccent).toBe('Почему так?')
		expect(teach.title).toBe('Научи меня')
		expect(teach.body).toMatch(/Подсказка 3/)
		expect(teach.body).toMatch(/непрерывн/)
		expect(teach.body).not.toMatch(/единственный допустимый вариант/)
	})

	it('completed_line CROSSED explains leftover empties', () => {
		const step = makeStep({
			clue: [1],
			action: 'CROSSED',
			targets: [
				{ row: 0, col: 0 },
				{ row: 0, col: 2 },
			],
			reason: 'completed_line',
		})
		const teach = explainTeachMe(step, null)
		expect(teach.body).toMatch(/Все блоки/)
		expect(teach.body).toMatch(/крестик/)
	})

	it('overlap uses line length + run when known', () => {
		const step = makeStep({
			clue: [8],
			action: 'FILLED',
			targets: [
				{ row: 3, col: 2 },
				{ row: 3, col: 3 },
			],
			reason: 'overlap',
			runLength: 8,
			lineIndex: 3,
		})
		const teach = explainTeachMe(step, {
			lineLength: 10,
			cells: Object.freeze(
				Array.from({ length: 10 }, () => PlayerCell.UNKNOWN),
			),
		})
		expect(teach.body).toMatch(/10/)
		expect(teach.body).toMatch(/8/)
		expect(teach.body).toMatch(/все возможные/)
	})

	it('forced_filled / forced_empty / fallback stay honest', () => {
		const filled = explainTeachMe(
			makeStep({
				clue: [2, 1],
				action: 'FILLED',
				targets: [{ row: 0, col: 2 }],
				reason: 'forced_filled',
			}),
			null,
		)
		expect(filled.body).toMatch(/во всех допустимых вариантах/)
		expect(filled.body).not.toMatch(/перекрывает/)

		const empty = explainTeachMe(
			makeStep({
				clue: [2],
				action: 'CROSSED',
				targets: [{ row: 0, col: 0 }],
				reason: 'forced_empty',
			}),
			null,
		)
		expect(empty.body).toMatch(/не входит/)

		const fallback = explainTeachMe(
			makeStep({
				clue: [1, 1],
				action: 'FILLED',
				targets: [{ row: 0, col: 1 }],
				reason: 'impossible_positions_eliminated',
			}),
			null,
		)
		expect(fallback.body).toMatch(/однозначно/)
	})
})

describe('Phase 7B Hint body ≠ Teach Me body', () => {
	it('same step yields different presentation bodies', () => {
		const step = makeStep({
			clue: [3],
			action: 'FILLED',
			targets: [
				{ row: 0, col: 1 },
				{ row: 0, col: 2 },
			],
			reason: 'completed_line',
			runLength: 3,
		})
		const line = {
			lineLength: 3,
			cells: Object.freeze([
				PlayerCell.FILLED,
				PlayerCell.UNKNOWN,
				PlayerCell.UNKNOWN,
			]),
		}
		const hint = explainHintCompact(step)
		const teach = explainTeachMe(step, line)
		expect(hint.body).toBe('')
		expect(teach.body.length).toBeGreaterThan(20)
		expect(hint.actionLabel).not.toEqual(teach.body)
		expect(teach.body).toMatch(/уже закрашена/)
	})
})

describe('Phase 7B physical 3×3 regression (OPPO)', () => {
	it('partial row [3] with one FILLED → Hint action only, Teach Me explains clue 3', () => {
		const player = createEmptyPlayerState(3, 3)
		const cells = player.cells.slice()
		cells[0] = PlayerCell.FILLED
		const state = Object.freeze({
			width: 3,
			height: 3,
			cells: Object.freeze(cells),
		})
		const result = getHint({
			spec: puzzleToSpec(PHASE7B_ROW3),
			player: state,
			revision: 0,
			mode: 'HINT',
		})
		expect(result.kind).toBe('STEP')
		if (result.kind !== 'STEP') {
			return
		}
		expect(result.step.orientation).toBe('row')
		expect(result.step.lineIndex).toBe(0)
		expect(result.step.action).toBe('FILLED')
		expect(result.step.targets.length).toBe(2)

		const line = lineContextForStep(result.step, state)
		const hint = explainHintCompact(result.step)
		const teach = explainTeachMe(result.step, line)

		expect(hint.lineTitle).toBe('Строка 1')
		expect(hint.actionLabel).toBe('Закрасьте 2 выделенные клетки')
		expect(hint.body).toBe('')

		expect(teach.whyAccent).toBe('Почему так?')
		expect(teach.clueText).toBe('3')
		expect(teach.body).toMatch(/Подсказка 3/)
		expect(teach.body).toMatch(/непрерывн/)
		expect(teach.body).toMatch(/уже закрашена/)
		expect(hint.body).not.toEqual(teach.body)
	})
})

describe('Phase 7B board cellSize impact (controls two rows)', () => {
	/**
	 * Approximate OPPO-like widths. Before: single wrap row (~60px).
	 * After: two control rows (~116px). Board viewport loses that delta.
	 */
	it('15×15 Frame Cross cellSize drop stays within 3px for typical viewport', () => {
		const puzzle = FIXTURE_A_SIMPLE_5X5
		const width = 360
		const boardHBefore = 520
		const boardHAfter = 520 - 56 // extra control row (~52 + gap)
		const before = computeBoardLayout({
			puzzleWidth: 15,
			puzzleHeight: 15,
			rowClues: Array.from({ length: 15 }, () => [5]),
			columnClues: Array.from({ length: 15 }, () => [5]),
			viewportWidth: width,
			viewportHeight: boardHBefore,
		})
		const after = computeBoardLayout({
			puzzleWidth: 15,
			puzzleHeight: 15,
			rowClues: Array.from({ length: 15 }, () => [5]),
			columnClues: Array.from({ length: 15 }, () => [5]),
			viewportWidth: width,
			viewportHeight: boardHAfter,
		})
		expect(before.cellSize - after.cellSize).toBeLessThanOrEqual(3)
		expect(after.cellSize).toBeGreaterThanOrEqual(18)
		void puzzle
	})
})
