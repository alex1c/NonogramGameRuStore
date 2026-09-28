/**
 * Home Daily card view-model — pure projection (no I/O).
 */

import { getProductionPuzzleById } from '../content/playable'
import {
	selectDailyPuzzle,
	getDailyPoolIndex,
} from '../daily/selector'
import {
	computeCurrentStreak,
	computeLongestStreak,
} from '../daily/streak'
import type { DayKey } from '../daily/dateUtils'
import type { SaveRoot } from '../persistence/schema'
import { difficultyLabelRu } from './difficultyLabels'
import {
	determinedProgressPercent,
	formatMarkedPercent,
} from './progressPercent'
import { formatDayPlural } from './russianPlural'

export type HomeDailyCardState =
	| 'UNAVAILABLE'
	| 'TRY'
	| 'NOT_STARTED'
	| 'IN_PROGRESS'
	| 'COMPLETED'

export interface HomeDailyCardView {
	readonly state: HomeDailyCardState
	readonly title: string
	readonly metaLine: string
	readonly ctaLabel: string
	readonly accessibilityLabel: string
	readonly streakLabel: string | null
	readonly sizeLabel: string | null
	readonly difficultyLabel: string | null
}

export interface HomeDualActiveView {
	readonly hasCampaignActive: boolean
	readonly hasDailyActive: boolean
	readonly todayCompleted: boolean
	readonly dailyCard: HomeDailyCardView
}

export function buildHomeDailyCard(
	save: SaveRoot,
	today: DayKey,
): HomeDailyCardView {
	const streak = computeCurrentStreak({
		today,
		completions: save.dailyCompletionRecords,
		restoredDays: save.restoredDailyDays,
		dailyStartedDay: save.dailyStartedDay,
	})
	const streakLabel =
		streak > 0 ? `Серия: ${formatDayPlural(streak)}` : null

	const completed = save.dailyCompletionRecords.find(
		(r) => r.dayKey === today,
	)
	if (completed !== undefined) {
		return {
			state: 'COMPLETED',
			title: 'Кроссворд дня',
			metaLine: 'Сегодня пройдено ✓',
			ctaLabel: 'Календарь',
			accessibilityLabel: `Кроссворд дня, сегодня пройдено${streakLabel !== null ? `, ${streakLabel}` : ''}`,
			streakLabel,
			sizeLabel: null,
			difficultyLabel: null,
		}
	}

	let selection
	try {
		selection = selectDailyPuzzle(today, getDailyPoolIndex())
	} catch {
		return {
			state: 'UNAVAILABLE',
			title: 'Кроссворд дня',
			metaLine: 'Кроссворд дня временно недоступен',
			ctaLabel: 'Календарь',
			accessibilityLabel: 'Кроссворд дня временно недоступен',
			streakLabel: null,
			sizeLabel: null,
			difficultyLabel: null,
		}
	}

	const puzzle = getProductionPuzzleById(selection.puzzleId)
	const sizeLabel =
		puzzle !== null ? `${puzzle.width}×${puzzle.height}` : null
	const difficultyLabel = difficultyLabelRu(selection.actualTier)

	const active = save.activeDailyGame
	if (active !== null && active.dayKey === today) {
		const marked = determinedProgressPercent(active.player.cells)
		const markedLabel = formatMarkedPercent(marked)
		return {
			state: 'IN_PROGRESS',
			title: 'Кроссворд дня',
			metaLine: `Сегодня · ${markedLabel}`,
			ctaLabel: 'Продолжить',
			accessibilityLabel: `Кроссворд дня, продолжить, ${markedLabel}`,
			streakLabel,
			sizeLabel,
			difficultyLabel,
		}
	}

	// Before first Daily screen open — soft CTA
	if (save.dailyStartedDay === null) {
		return {
			state: 'TRY',
			title: 'Кроссворд дня',
			metaLine:
				sizeLabel !== null && difficultyLabel !== null
					? `Сегодня · ${sizeLabel} · ${difficultyLabel}`
					: 'Сегодня',
			ctaLabel: 'Попробовать',
			accessibilityLabel: `Кроссворд дня, попробовать${sizeLabel !== null ? `, ${sizeLabel}` : ''}${difficultyLabel !== null ? `, ${difficultyLabel}` : ''}`,
			streakLabel: null,
			sizeLabel,
			difficultyLabel,
		}
	}

	return {
		state: 'NOT_STARTED',
		title: 'Кроссворд дня',
		metaLine:
			sizeLabel !== null && difficultyLabel !== null
				? `Сегодня · ${sizeLabel} · ${difficultyLabel}`
				: 'Сегодня',
		ctaLabel: 'Начать',
		accessibilityLabel: `Кроссворд дня, начать${sizeLabel !== null ? `, ${sizeLabel}` : ''}${difficultyLabel !== null ? `, ${difficultyLabel}` : ''}`,
		streakLabel,
		sizeLabel,
		difficultyLabel,
	}
}

export function buildHomeDualActiveView(
	save: SaveRoot,
	today: DayKey,
): HomeDualActiveView {
	const todayCompleted = save.dailyCompletionRecords.some(
		(r) => r.dayKey === today,
	)
	const hasDailyActive =
		save.activeDailyGame !== null &&
		save.activeDailyGame.dayKey === today &&
		!todayCompleted
	return {
		hasCampaignActive: save.activeGame !== null,
		hasDailyActive,
		todayCompleted,
		dailyCard: buildHomeDailyCard(save, today),
	}
}

export function buildDailyStatsSummary(
	save: SaveRoot,
	today: DayKey,
): {
	readonly completedCount: number
	readonly currentStreak: number
	readonly longestStreak: number
	readonly currentStreakLabel: string
	readonly longestStreakLabel: string
} {
	const currentStreak = computeCurrentStreak({
		today,
		completions: save.dailyCompletionRecords,
		restoredDays: save.restoredDailyDays,
		dailyStartedDay: save.dailyStartedDay,
	})
	const longestStreak = computeLongestStreak({
		completions: save.dailyCompletionRecords,
		restoredDays: save.restoredDailyDays,
		dailyStartedDay: save.dailyStartedDay,
	})
	return {
		completedCount: save.dailyCompletionRecords.length,
		currentStreak,
		longestStreak,
		currentStreakLabel: `Серия: ${formatDayPlural(currentStreak)}`,
		longestStreakLabel: `Рекорд: ${formatDayPlural(longestStreak)}`,
	}
}
