/**
 * Streak + restore eligibility — pure, no I/O.
 */

import {
	calendarDayDiff,
	compareDayKeys,
	DAILY_EPOCH_DAY,
	isValidDayKey,
	localMonthKey,
	previousDayKey,
	type DayKey,
	type MonthKey,
} from './dateUtils'

export interface DailyCompletionRecord {
	readonly dayKey: DayKey
	readonly puzzleId: string
	readonly selectionVersion: string
	readonly activeTimeMs: number
}

/** Covered days = completed ∪ restored (for streak continuity). */
export function coveredDaySet(
	completions: readonly DailyCompletionRecord[],
	restoredDays: readonly DayKey[],
): Set<DayKey> {
	const set = new Set<DayKey>()
	for (const record of completions) {
		if (isValidDayKey(record.dayKey)) {
			set.add(record.dayKey)
		}
	}
	for (const day of restoredDays) {
		if (isValidDayKey(day)) {
			set.add(day)
		}
	}
	return set
}

/**
 * Effective participation start: min(dailyStartedDay, earliest completion)
 * when both exist; null means user has not started Daily feature.
 */
export function effectiveParticipationStart(
	dailyStartedDay: DayKey | null,
	completions: readonly DailyCompletionRecord[],
): DayKey | null {
	let earliest: DayKey | null = null
	for (const record of completions) {
		if (!isValidDayKey(record.dayKey)) {
			continue
		}
		if (earliest === null || compareDayKeys(record.dayKey, earliest) < 0) {
			earliest = record.dayKey
		}
	}
	if (dailyStartedDay === null) {
		return earliest
	}
	if (earliest === null) {
		return dailyStartedDay
	}
	return compareDayKeys(dailyStartedDay, earliest) <= 0
		? dailyStartedDay
		: earliest
}

/**
 * Current live streak:
 * - If today covered → count consecutive covered days ending today
 * - Else if yesterday covered → count consecutive ending yesterday (live)
 * - Else → 0
 * Days before participation start / epoch are ignored.
 */
export function computeCurrentStreak(input: {
	readonly today: DayKey
	readonly completions: readonly DailyCompletionRecord[]
	readonly restoredDays: readonly DayKey[]
	readonly dailyStartedDay: DayKey | null
}): number {
	const start = effectiveParticipationStart(
		input.dailyStartedDay,
		input.completions,
	)
	if (start === null) {
		return 0
	}
	const covered = coveredDaySet(input.completions, input.restoredDays)
	const todayCovered = covered.has(input.today)
	const yesterday = previousDayKey(input.today)
	const endDay = todayCovered
		? input.today
		: covered.has(yesterday)
			? yesterday
			: null
	if (endDay === null) {
		return 0
	}
	let count = 0
	let cursor: DayKey = endDay
	while (true) {
		if (compareDayKeys(cursor, start) < 0) {
			break
		}
		if (compareDayKeys(cursor, DAILY_EPOCH_DAY) < 0) {
			break
		}
		if (!covered.has(cursor)) {
			break
		}
		count += 1
		cursor = previousDayKey(cursor)
	}
	return count
}

export function computeLongestStreak(input: {
	readonly completions: readonly DailyCompletionRecord[]
	readonly restoredDays: readonly DayKey[]
	readonly dailyStartedDay: DayKey | null
}): number {
	const start = effectiveParticipationStart(
		input.dailyStartedDay,
		input.completions,
	)
	if (start === null) {
		return 0
	}
	const covered = [
		...coveredDaySet(input.completions, input.restoredDays),
	]
		.filter(
			(day) =>
				compareDayKeys(day, start) >= 0 &&
				compareDayKeys(day, DAILY_EPOCH_DAY) >= 0,
		)
		.sort(compareDayKeys)
	if (covered.length === 0) {
		return 0
	}
	let best = 1
	let run = 1
	for (let i = 1; i < covered.length; i += 1) {
		if (calendarDayDiff(covered[i]!, covered[i - 1]!) === 1) {
			run += 1
			best = Math.max(best, run)
		} else {
			run = 1
		}
	}
	return best
}

export type RestoreIneligibilityReason =
	| 'TODAY_NOT_COMPLETED'
	| 'NO_GAP'
	| 'MULTI_GAP'
	| 'GAP_NOT_CURRENT_MONTH'
	| 'MONTH_RESTORE_USED'
	| 'ALREADY_RESTORED'
	| 'BEFORE_PARTICIPATION'
	| 'BEFORE_EPOCH'
	| 'NO_PARTICIPATION'

export interface RestoreEligibility {
	readonly eligible: boolean
	readonly missingDayKey: DayKey | null
	readonly monthKey: MonthKey | null
	readonly reason: RestoreIneligibilityReason | null
}

/**
 * Restore contract (Phase 6):
 * - Today must be completed
 * - Exactly one missed day between last covered streak and today
 * - Missed day must be in the current calendar month (same as today)
 * - One restore per month of the missed day
 * - Cross-month gap → not eligible
 */
export function getRestoreEligibility(input: {
	readonly today: DayKey
	readonly completions: readonly DailyCompletionRecord[]
	readonly restoredDays: readonly DayKey[]
	readonly dailyStartedDay: DayKey | null
}): RestoreEligibility {
	const start = effectiveParticipationStart(
		input.dailyStartedDay,
		input.completions,
	)
	if (start === null) {
		return {
			eligible: false,
			missingDayKey: null,
			monthKey: null,
			reason: 'NO_PARTICIPATION',
		}
	}
	const completedKeys = new Set(
		input.completions.map((r) => r.dayKey).filter(isValidDayKey),
	)
	if (!completedKeys.has(input.today)) {
		return {
			eligible: false,
			missingDayKey: null,
			monthKey: null,
			reason: 'TODAY_NOT_COMPLETED',
		}
	}
	const covered = coveredDaySet(input.completions, input.restoredDays)
	const yesterday = previousDayKey(input.today)
	if (covered.has(yesterday)) {
		return {
			eligible: false,
			missingDayKey: null,
			monthKey: null,
			reason: 'NO_GAP',
		}
	}
	// Exactly one gap day = yesterday not covered, day-before-yesterday covered
	const dayBefore = previousDayKey(yesterday)
	if (!covered.has(dayBefore)) {
		return {
			eligible: false,
			missingDayKey: null,
			monthKey: null,
			reason: 'MULTI_GAP',
		}
	}
	const missing = yesterday
	if (compareDayKeys(missing, DAILY_EPOCH_DAY) < 0) {
		return {
			eligible: false,
			missingDayKey: missing,
			monthKey: null,
			reason: 'BEFORE_EPOCH',
		}
	}
	if (compareDayKeys(missing, start) < 0) {
		return {
			eligible: false,
			missingDayKey: missing,
			monthKey: null,
			reason: 'BEFORE_PARTICIPATION',
		}
	}
	if (localMonthKey(missing) !== localMonthKey(input.today)) {
		return {
			eligible: false,
			missingDayKey: missing,
			monthKey: localMonthKey(missing),
			reason: 'GAP_NOT_CURRENT_MONTH',
		}
	}
	if (input.restoredDays.includes(missing)) {
		return {
			eligible: false,
			missingDayKey: missing,
			monthKey: localMonthKey(missing),
			reason: 'ALREADY_RESTORED',
		}
	}
	const monthKey = localMonthKey(missing)
	const monthAlreadyUsed = input.restoredDays.some(
		(day) => localMonthKey(day) === monthKey,
	)
	if (monthAlreadyUsed) {
		return {
			eligible: false,
			missingDayKey: missing,
			monthKey,
			reason: 'MONTH_RESTORE_USED',
		}
	}
	return {
		eligible: true,
		missingDayKey: missing,
		monthKey,
		reason: null,
	}
}
