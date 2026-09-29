/**
 * Presentation layer — HintStep → compact Hint vs pedagogical Teach Me.
 * Never reads authored solution. May use current player line marks.
 */

import { PlayerCell } from '../domain/nonogram/types'
import { russianPlural } from '../presentation/russianPlural'
import type { HintMode, HintResult, HintStep } from './types'

function formatClue(clue: readonly number[]): string {
	if (clue.length === 0) {
		return '0'
	}
	return clue.join(' ')
}

function lineLabelCapital(step: {
	readonly orientation: 'row' | 'column'
	readonly lineIndex: number
}): string {
	const n = step.lineIndex + 1
	return step.orientation === 'row' ? `Строка ${n}` : `Столбец ${n}`
}

function wherePhrase(step: {
	readonly orientation: 'row' | 'column'
}): string {
	return step.orientation === 'row' ? `этой строке` : `этом столбце`
}

function lineNounFull(step: {
	readonly orientation: 'row' | 'column'
}): string {
	return step.orientation === 'row' ? 'строки' : 'столбца'
}

/** Accusative target count for compact Hint actions. */
export function formatTargetAccusative(count: number): string {
	if (count === 1) {
		return '1 выделенную клетку'
	}
	const n = Math.abs(Math.floor(count)) % 100
	const n1 = n % 10
	const teen = n > 10 && n < 20
	const few = !teen && n1 >= 2 && n1 <= 4
	if (few) {
		return `${count} выделенные ${russianPlural(count, 'cell')}`
	}
	return `${count} выделенных ${russianPlural(count, 'cell')}`
}

/**
 * Compact «Что сделать?» action for ordinary Hint.
 * Example: «Закрасьте 2 выделенные клетки»
 */
export function formatHintAction(step: HintStep): string {
	const count = step.targets.length
	if (step.action === 'FILLED') {
		if (count === 1) {
			return 'Закрасьте выделенную клетку'
		}
		return `Закрасьте ${formatTargetAccusative(count)}`
	}
	if (count === 1) {
		return 'Поставьте крестик в выделенной клетке'
	}
	return `Поставьте крестики в ${count} выделенных ${russianPlural(count, 'cell')}`
}

export interface LinePlayerContext {
	/** Total cells on the affected line. */
	readonly lineLength: number
	/** Current player marks on that line (same order as board). */
	readonly cells: readonly PlayerCell[]
}

export interface HintExplanation {
	readonly mode: HintMode
	readonly title: string
	/** Compact line label, e.g. «Строка 1». */
	readonly lineTitle: string
	/** Clue as user text, e.g. «3» or «2 4». Empty clue → «0». */
	readonly clueText: string
	/** Teach Me only accent, e.g. «Почему так?». Null for Hint. */
	readonly whyAccent: string | null
	/** Hint: action only. Teach Me: unused (body holds pedagogy). */
	readonly actionLabel: string
	/** Hint: empty. Teach Me: pedagogical body. */
	readonly body: string
}

function countFilled(cells: readonly PlayerCell[]): number {
	let n = 0
	for (const cell of cells) {
		if (cell === PlayerCell.FILLED) {
			n += 1
		}
	}
	return n
}

function countCrossed(cells: readonly PlayerCell[]): number {
	let n = 0
	for (const cell of cells) {
		if (cell === PlayerCell.CROSSED) {
			n += 1
		}
	}
	return n
}

function singleBlockLength(clue: readonly number[]): number | null {
	if (clue.length === 1 && clue[0] !== undefined && clue[0] > 0) {
		return clue[0]
	}
	return null
}

/**
 * Compact Hint presentation — answers only «Что сделать?»
 */
export function explainHintCompact(step: HintStep): HintExplanation {
	return {
		mode: 'HINT',
		title: 'Подсказка',
		lineTitle: lineLabelCapital(step),
		clueText: formatClue(step.clue),
		whyAccent: null,
		actionLabel: formatHintAction(step),
		body: '',
	}
}

/**
 * Pedagogical Teach Me — answers «Почему это можно сделать?»
 * Uses clue + optional current player line (not authored solution).
 */
export function explainTeachMe(
	step: HintStep,
	line: LinePlayerContext | null = null,
): HintExplanation {
	const lineTitle = lineLabelCapital(step)
	const clueText = formatClue(step.clue)
	const targets = step.targets.length
	const where = wherePhrase(step)
	const lineLen = line?.lineLength ?? null
	const filledOnLine = line !== null ? countFilled(line.cells) : 0
	const crossedOnLine = line !== null ? countCrossed(line.cells) : 0
	const run = singleBlockLength(step.clue)
	const overlapRun = step.proof.runLength

	let body: string

	switch (step.reason) {
		case 'completed_line': {
			if (step.action === 'CROSSED') {
				body =
					`Все блоки в ${where} уже найдены. Остальные клетки не входят ни в один блок, поэтому их можно отметить крестиками.`
				break
			}
			// Partial continuous block — prefer when some cells already FILLED
			if (run !== null && filledOnLine > 0 && targets > 0) {
				const already =
					filledOnLine === 1
						? 'Одна клетка уже закрашена'
						: `${filledOnLine} ${russianPlural(filledOnLine, 'cell')} уже закрашены`
				body =
					`Подсказка ${run} означает один непрерывный блок из ${run} ${run === 1 ? 'клетки' : 'клеток'}. ` +
					`${already}, поэтому ${targets === 1 ? 'оставшаяся клетка' : `ещё ${targets} ${russianPlural(targets, 'cell')}`} ${lineNounFull(step)} тоже ${targets === 1 ? 'должна быть закрашена' : 'должны быть закрашены'}.`
				break
			}
			// Full-line single block (empty board or all targets)
			if (run !== null && lineLen !== null && run === lineLen) {
				body =
					`Подсказка ${run} означает непрерывный блок из ${run === 1 ? 'одной клетки' : `${run} клеток`}. ` +
					`В ${where} ${lineLen} ${russianPlural(lineLen, 'cell')}, поэтому все они должны быть закрашены.`
				break
			}
			if (run !== null) {
				body =
					`Подсказка ${run} означает непрерывный блок из ${run} ${run === 1 ? 'клетки' : 'клеток'}. ` +
					`Часть блока уже найдена. Чтобы получить этот блок, закрасьте выделенные клетки.`
				break
			}
			body =
				`По подсказкам ${where} выделенные клетки должны быть закрашены — блоки clue уже однозначно определяют их.`
			break
		}
		case 'overlap': {
			if (overlapRun !== null && step.action === 'FILLED' && lineLen !== null) {
				body =
					`В ${where} ${lineLen} ${russianPlural(lineLen, 'cell')}. ` +
					`Блок из ${overlapRun} можно сдвигать, но выделенные клетки входят во все возможные положения блока. Поэтому их можно закрасить.`
				break
			}
			if (overlapRun !== null && step.action === 'FILLED') {
				body =
					`Блок из ${overlapRun} клеток можно расположить несколькими способами, но выделенные клетки входят во все варианты. Поэтому их можно закрасить.`
				break
			}
			body =
				`По подсказкам ${where} выделенные клетки можно определить однозначно.`
			break
		}
		case 'forced_filled':
			body =
				`По подсказкам ${where} выделенные клетки закрашены во всех допустимых вариантах расположения блоков.`
			break
		case 'forced_empty':
			body =
				targets === 1
					? `Выделенная клетка не входит ни в один допустимый вариант расположения блоков, поэтому здесь можно поставить крестик.`
					: `Выделенные клетки не входят ни в один допустимый вариант расположения блоков, поэтому здесь можно поставить крестики.`
			break
		case 'impossible_positions_eliminated':
			if (filledOnLine > 0 || crossedOnLine > 0) {
				body =
					`С учётом уже отмеченных клеток в ${where} допустимые положения блоков сужаются, и выделенные клетки определяются однозначно.`
			} else {
				body =
					`По подсказкам ${where} выделенные клетки можно определить однозначно.`
			}
			break
		default:
			body =
				`По подсказкам ${where} выделенные клетки можно определить однозначно.`
			break
	}

	return {
		mode: 'TEACH',
		title: 'Научи меня',
		lineTitle,
		clueText,
		whyAccent: 'Почему так?',
		actionLabel: formatHintAction(step),
		body,
	}
}

/** @deprecated Prefer explainHintCompact / explainTeachMe. Kept for call-site migration. */
export function explainHintStep(step: HintStep): HintExplanation {
	return explainTeachMe(step, null)
}

export function explainHintResult(
	result: HintResult,
	mode: HintMode = 'HINT',
	line: LinePlayerContext | null = null,
): {
	readonly title: string
	readonly body: string
	readonly canApply: boolean
	readonly explanation: HintExplanation | null
} {
	switch (result.kind) {
		case 'STEP': {
			const explanation =
				mode === 'TEACH'
					? explainTeachMe(result.step, line)
					: explainHintCompact(result.step)
			return {
				title: explanation.title,
				body: explanation.body,
				canApply: true,
				explanation,
			}
		}
		case 'CONTRADICTION': {
			if (
				result.orientation !== null &&
				result.lineIndex !== null &&
				result.clue !== null
			) {
				const lineLabel =
					result.orientation === 'row'
						? `строку ${result.lineIndex + 1}`
						: `столбец ${result.lineIndex + 1}`
				return {
					title: 'Противоречие',
					body: `Проверьте ${lineLabel}: текущие отметки не позволяют выполнить подсказку ${formatClue(result.clue)}.`,
					canApply: false,
					explanation: null,
				}
			}
			return {
				title: 'Противоречие',
				body: 'На поле есть противоречие. Проверьте отмеченные клетки и крестики.',
				canApply: false,
				explanation: null,
			}
		}
		case 'STALLED':
			return {
				title: 'Ход не найден',
				body: 'Сейчас не удалось найти следующий логический ход. Проверьте уже отмеченные клетки и строки.',
				canApply: false,
				explanation: null,
			}
		case 'COMPLETE':
			return {
				title: 'Готово',
				body: 'Кроссворд уже решён.',
				canApply: false,
				explanation: null,
			}
		default:
			return {
				title: 'Подсказка',
				body: '',
				canApply: false,
				explanation: null,
			}
	}
}

/** Build line context from full player grid for a HintStep (no solution). */
export function lineContextForStep(
	step: HintStep,
	player: {
		readonly width: number
		readonly height: number
		readonly cells: readonly PlayerCell[]
	},
): LinePlayerContext {
	if (step.orientation === 'row') {
		const row = step.lineIndex
		const cells: PlayerCell[] = []
		for (let col = 0; col < player.width; col += 1) {
			cells.push(
				player.cells[row * player.width + col] ?? PlayerCell.UNKNOWN,
			)
		}
		return { lineLength: player.width, cells: Object.freeze(cells) }
	}
	const col = step.lineIndex
	const cells: PlayerCell[] = []
	for (let row = 0; row < player.height; row += 1) {
		cells.push(
			player.cells[row * player.width + col] ?? PlayerCell.UNKNOWN,
		)
	}
	return { lineLength: player.height, cells: Object.freeze(cells) }
}
