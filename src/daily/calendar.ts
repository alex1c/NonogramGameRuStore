/**
 * Pure Daily calendar month projection.
 */

import {
	buildMonthGrid,
	compareDayKeys,
	DAILY_EPOCH_DAY,
	formatDayTitleRu,
	formatMonthTitleRu,
	type DayKey,
} from './dateUtils'
import type { DailyCompletionRecord } from './streak'
import { effectiveParticipationStart } from './streak'

export type CalendarCellState =
	| 'EMPTY'
	| 'BEFORE_EPOCH'
	| 'BEFORE_USER_START'
	| 'FUTURE'
	| 'MISSED'
	| 'TODAY_AVAILABLE'
	| 'TODAY_IN_PROGRESS'
	| 'COMPLETED'
	| 'RESTORED'

export interface CalendarCellViewModel {
	readonly dayNumber: number | null
	readonly dayKey: DayKey | null
	readonly state: CalendarCellState
	readonly isToday: boolean
	readonly tappable: boolean
	readonly accessibilityLabel: string
}

export interface CalendarMonthViewModel {
	readonly year: number
	readonly month: number
	readonly titleRu: string
	readonly cells: readonly CalendarCellViewModel[]
	readonly canGoPrevious: boolean
	readonly canGoNext: boolean
}

export function projectCalendarMonth(input: {
	readonly year: number
	readonly month: number
	readonly today: DayKey
	readonly completions: readonly DailyCompletionRecord[]
	readonly restoredDays: readonly DayKey[]
	readonly dailyStartedDay: DayKey | null
	readonly activeDailyDayKey: DayKey | null
}): CalendarMonthViewModel {
	const participation = effectiveParticipationStart(
		input.dailyStartedDay,
		input.completions,
	)
	const completed = new Set(input.completions.map((r) => r.dayKey))
	const restored = new Set(input.restoredDays)
	const grid = buildMonthGrid(input.year, input.month)
	const cells: CalendarCellViewModel[] = grid.map((spec) => {
		if (spec.dayKey === null || spec.dayNumber === null) {
			return {
				dayNumber: null,
				dayKey: null,
				state: 'EMPTY',
				isToday: false,
				tappable: false,
				accessibilityLabel: '',
			}
		}
		const dayKey = spec.dayKey
		const isToday = dayKey === input.today
		const dateLabel = formatDayTitleRu(dayKey, input.today.slice(0, 4) === dayKey.slice(0, 4) ? Number(input.today.slice(0, 4)) : undefined)

		if (compareDayKeys(dayKey, DAILY_EPOCH_DAY) < 0) {
			return {
				dayNumber: spec.dayNumber,
				dayKey,
				state: 'BEFORE_EPOCH',
				isToday,
				tappable: false,
				accessibilityLabel: `${dateLabel}, недоступно`,
			}
		}
		if (compareDayKeys(dayKey, input.today) > 0) {
			return {
				dayNumber: spec.dayNumber,
				dayKey,
				state: 'FUTURE',
				isToday: false,
				tappable: false,
				accessibilityLabel: `${dateLabel}, ещё не доступно`,
			}
		}
		if (completed.has(dayKey)) {
			return {
				dayNumber: spec.dayNumber,
				dayKey,
				state: 'COMPLETED',
				isToday,
				tappable: true,
				accessibilityLabel: isToday
					? `${dateLabel}, сегодня, пройдено`
					: `${dateLabel}, пройдено`,
			}
		}
		if (restored.has(dayKey)) {
			return {
				dayNumber: spec.dayNumber,
				dayKey,
				state: 'RESTORED',
				isToday,
				tappable: true,
				accessibilityLabel: `${dateLabel}, восстановлено`,
			}
		}
		if (
			participation !== null &&
			compareDayKeys(dayKey, participation) < 0
		) {
			return {
				dayNumber: spec.dayNumber,
				dayKey,
				state: 'BEFORE_USER_START',
				isToday,
				tappable: false,
				accessibilityLabel: `${dateLabel}, до начала`,
			}
		}
		if (isToday) {
			const inProgress = input.activeDailyDayKey === dayKey
			return {
				dayNumber: spec.dayNumber,
				dayKey,
				state: inProgress ? 'TODAY_IN_PROGRESS' : 'TODAY_AVAILABLE',
				isToday: true,
				tappable: true,
				accessibilityLabel: inProgress
					? `${dateLabel}, сегодня, в процессе`
					: `${dateLabel}, сегодня, доступно`,
			}
		}
		// Past day after participation / epoch — missed (only if participation started)
		if (participation === null) {
			return {
				dayNumber: spec.dayNumber,
				dayKey,
				state: 'BEFORE_USER_START',
				isToday: false,
				tappable: false,
				accessibilityLabel: `${dateLabel}, до начала`,
			}
		}
		return {
			dayNumber: spec.dayNumber,
			dayKey,
			state: 'MISSED',
			isToday: false,
			tappable: true,
			accessibilityLabel: `${dateLabel}, пропущено`,
		}
	})

	const epochParts = DAILY_EPOCH_DAY.split('-').map(Number)
	const epochYear = epochParts[0]!
	const epochMonth = epochParts[1]!
	const canGoPrevious =
		input.year > epochYear ||
		(input.year === epochYear && input.month > epochMonth)
	const todayParts = input.today.split('-').map(Number)
	const canGoNext =
		input.year < todayParts[0]! ||
		(input.year === todayParts[0]! && input.month < todayParts[1]!)

	return {
		year: input.year,
		month: input.month,
		titleRu: formatMonthTitleRu(input.year, input.month),
		cells,
		canGoPrevious,
		canGoNext,
	}
}
