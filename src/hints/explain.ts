/**
 * Russian explanation layer — HintStep → user-facing copy.
 * Does not change mathematical step; no solver enums leak to UI.
 */

import { russianPlural } from '../presentation/russianPlural'
import type { HintResult, HintStep } from './types'

function formatClue(clue: readonly number[]): string {
	if (clue.length === 0) {
		return '0'
	}
	return clue.join(' ')
}

function lineLabel(step: {
	readonly orientation: 'row' | 'column'
	readonly lineIndex: number
}): string {
	const n = step.lineIndex + 1
	return step.orientation === 'row' ? `строке ${n}` : `столбце ${n}`
}

function lineLabelCapital(step: {
	readonly orientation: 'row' | 'column'
	readonly lineIndex: number
}): string {
	const n = step.lineIndex + 1
	return step.orientation === 'row' ? `Строка ${n}` : `Столбец ${n}`
}

function targetPhrase(count: number): string {
	if (count === 1) {
		return 'эта клетка'
	}
	return `эти ${count} ${russianPlural(count, 'cell')}`
}

export interface HintExplanation {
	readonly headline: string
	readonly body: string
	readonly actionLabel: string
	readonly lineTitle: string
	readonly clueLabel: string
}

export function explainHintStep(step: HintStep): HintExplanation {
	const lineTitle = lineLabelCapital(step)
	const clueLabel = formatClue(step.clue)
	const targets = step.targets.length
	const where = lineLabel(step)
	const cells = targetPhrase(targets)

	let body: string
	switch (step.reason) {
		case 'overlap': {
			const run = step.proof.runLength
			if (run !== null && step.action === 'FILLED') {
				// Genitive after «из»: 1 клетки / 2–4 клетки is wrong — use клеток for 2+.
				const cellWord = run === 1 ? 'клетки' : 'клеток'
				const agree = targets === 1 ? 'закрашена' : 'закрашены'
				body = `В ${where} блок из ${run} ${cellWord} можно расположить несколькими способами, но ${cells} ${agree} во всех вариантах.`
			} else {
				body = `По подсказкам ${where} ${cells} можно определить однозначно.`
			}
			break
		}
		case 'completed_line':
			if (step.action === 'CROSSED') {
				body = `В ${where} все блоки уже найдены. Остальные клетки можно отметить крестиками.`
			} else {
				body = `В ${where} остался единственный допустимый вариант расположения блоков — ${cells} должны быть закрашены.`
			}
			break
		case 'forced_filled':
			body = `По подсказкам ${where} ${cells} ${targets === 1 ? 'должна быть закрашена' : 'должны быть закрашены'} при любом допустимом расположении блоков.`
			break
		case 'forced_empty':
			body = `${cells.charAt(0).toUpperCase()}${cells.slice(1)} не ${targets === 1 ? 'может входить' : 'могут входить'} ни в один допустимый вариант расположения блоков ${where}, поэтому ${targets === 1 ? 'здесь можно поставить крестик' : 'здесь можно поставить крестики'}.`
			break
		case 'impossible_positions_eliminated':
		default:
			body = `По подсказкам ${where} ${cells} можно определить однозначно.`
			break
	}

	const actionLabel =
		step.action === 'FILLED'
			? targets === 1
				? 'Закрасьте выделенную клетку'
				: 'Закрасьте выделенные клетки'
			: targets === 1
				? 'Поставьте крестик в выделенной клетке'
				: 'Поставьте крестики в выделенных клетках'

	return {
		headline: lineTitle,
		body,
		actionLabel,
		lineTitle,
		clueLabel: `Подсказка: ${clueLabel}`,
	}
}

export function explainHintResult(result: HintResult): {
	readonly title: string
	readonly body: string
	readonly canApply: boolean
	readonly explanation: HintExplanation | null
} {
	switch (result.kind) {
		case 'STEP': {
			const explanation = explainHintStep(result.step)
			return {
				title: 'Подсказка',
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
				const line =
					result.orientation === 'row'
						? `строку ${result.lineIndex + 1}`
						: `столбец ${result.lineIndex + 1}`
				return {
					title: 'Противоречие',
					body: `Проверьте ${line}: текущие отметки не позволяют выполнить подсказку ${formatClue(result.clue)}.`,
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
