/**
 * Daily day-rollover helpers.
 *
 * A Daily session is bound to one local calendar day. When the device clock
 * crosses midnight the session becomes stale: it must not persist, restart or
 * complete (that would credit the wrong day / streak).
 */

import type { DayKey } from './dateUtils'

/** Thrown by the progress service when a Daily mutation targets a past day. */
export class DailyRolloverError extends Error {
	readonly code = 'DAILY_DAY_ROLLOVER'
	readonly sessionDayKey: DayKey
	readonly todayDayKey: DayKey

	constructor(sessionDayKey: DayKey, todayDayKey: DayKey) {
		super(
			`Daily session for ${sessionDayKey} is stale (today is ${todayDayKey})`,
		)
		this.name = 'DailyRolloverError'
		this.sessionDayKey = sessionDayKey
		this.todayDayKey = todayDayKey
	}
}

/** Type guard usable across module boundaries (no instanceof pitfalls). */
export function isDailyRolloverError(
	value: unknown,
): value is DailyRolloverError {
	return (
		typeof value === 'object' &&
		value !== null &&
		(value as { code?: unknown }).code === 'DAILY_DAY_ROLLOVER'
	)
}

/** True when a Daily session no longer matches today's local day key. */
export function isDailySessionStale(
	sessionDayKey: DayKey,
	todayDayKey: DayKey,
): boolean {
	return sessionDayKey !== todayDayKey
}
