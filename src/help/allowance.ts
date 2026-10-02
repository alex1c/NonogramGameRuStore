/**
 * Daily free Hint / Teach Me allowances (local calendar day).
 * Separate counters; rewarded grants exactly one pending entitlement per type.
 */

import type { DayKey } from '../daily/dateUtils'
import { localDayKey } from '../daily/dateUtils'

export const FREE_HINTS_PER_DAY = 5 as const
export const FREE_TEACH_ME_PER_DAY = 5 as const

export type HelpType = 'hint' | 'teach_me'

export interface HelpAllowanceState {
	readonly helpAllowanceDay: DayKey
	readonly freeHintsUsedToday: number
	readonly freeTeachMeUsedToday: number
	/** At most one pending rewarded Hint entitlement. */
	readonly pendingRewardedHints: number
	/** At most one pending rewarded Teach Me entitlement. */
	readonly pendingRewardedTeachMe: number
}

export function createDefaultHelpAllowance(
	today: DayKey = localDayKey(),
): HelpAllowanceState {
	return {
		helpAllowanceDay: today,
		freeHintsUsedToday: 0,
		freeTeachMeUsedToday: 0,
		pendingRewardedHints: 0,
		pendingRewardedTeachMe: 0,
	}
}

/** Roll to today if the stored day differs — free counters reset to 0. */
export function rollHelpAllowanceToDay(
	state: HelpAllowanceState,
	today: DayKey,
): HelpAllowanceState {
	if (state.helpAllowanceDay === today) {
		return state
	}
	return {
		helpAllowanceDay: today,
		freeHintsUsedToday: 0,
		freeTeachMeUsedToday: 0,
		// Preserve pending entitlements across midnight so a rewarded watch
		// just before midnight is not silently lost.
		pendingRewardedHints: state.pendingRewardedHints > 0 ? 1 : 0,
		pendingRewardedTeachMe: state.pendingRewardedTeachMe > 0 ? 1 : 0,
	}
}

export function freeHintsRemaining(state: HelpAllowanceState): number {
	return Math.max(0, FREE_HINTS_PER_DAY - state.freeHintsUsedToday)
}

export function freeTeachMeRemaining(state: HelpAllowanceState): number {
	return Math.max(0, FREE_TEACH_ME_PER_DAY - state.freeTeachMeUsedToday)
}

export function canUseHintWithoutRewarded(state: HelpAllowanceState): boolean {
	return freeHintsRemaining(state) > 0 || state.pendingRewardedHints > 0
}

export function canUseTeachMeWithoutRewarded(
	state: HelpAllowanceState,
): boolean {
	return freeTeachMeRemaining(state) > 0 || state.pendingRewardedTeachMe > 0
}

/**
 * Result of the Hint Apply gate (H3).
 * - 'free'            → a free daily Hint is available.
 * - 'pending_rewarded' → free Hints are exhausted but a rewarded one is pending.
 * - 'needs_rewarded'  → Apply must NOT mutate the board; offer rewarded opt-in.
 */
export type HintApplyGate = 'free' | 'pending_rewarded' | 'needs_rewarded'

/**
 * Decide whether a board-mutating Apply may proceed.
 *
 * Apply ALWAYS draws from the Hint allowance — even when the STEP being
 * applied was revealed through Teach Me (which only spends Teach Me quota).
 */
export function evaluateHintApplyGate(
	state: HelpAllowanceState,
): HintApplyGate {
	if (freeHintsRemaining(state) > 0) {
		return 'free'
	}
	if (state.pendingRewardedHints > 0) {
		return 'pending_rewarded'
	}
	return 'needs_rewarded'
}

export function willConsumeFreeHint(state: HelpAllowanceState): boolean {
	return freeHintsRemaining(state) > 0
}

export function willConsumeFreeTeachMe(state: HelpAllowanceState): boolean {
	return freeTeachMeRemaining(state) > 0
}

export function willConsumePendingHint(state: HelpAllowanceState): boolean {
	return freeHintsRemaining(state) <= 0 && state.pendingRewardedHints > 0
}

export function willConsumePendingTeachMe(state: HelpAllowanceState): boolean {
	return (
		freeTeachMeRemaining(state) <= 0 && state.pendingRewardedTeachMe > 0
	)
}

/** Successful Hint Apply — free first, else pending rewarded. */
export function consumeHintApply(
	state: HelpAllowanceState,
): HelpAllowanceState | null {
	if (freeHintsRemaining(state) > 0) {
		return {
			...state,
			freeHintsUsedToday: state.freeHintsUsedToday + 1,
		}
	}
	if (state.pendingRewardedHints > 0) {
		return {
			...state,
			pendingRewardedHints: 0,
		}
	}
	return null
}

/** Valid Teach Me STEP explanation revealed. */
export function consumeTeachMeReveal(
	state: HelpAllowanceState,
): HelpAllowanceState | null {
	if (freeTeachMeRemaining(state) > 0) {
		return {
			...state,
			freeTeachMeUsedToday: state.freeTeachMeUsedToday + 1,
		}
	}
	if (state.pendingRewardedTeachMe > 0) {
		return {
			...state,
			pendingRewardedTeachMe: 0,
		}
	}
	return null
}

/** SDK-confirmed reward — at most one pending per type. */
export function grantRewardedHintEntitlement(
	state: HelpAllowanceState,
): HelpAllowanceState {
	return {
		...state,
		pendingRewardedHints: 1,
	}
}

export function grantRewardedTeachMeEntitlement(
	state: HelpAllowanceState,
): HelpAllowanceState {
	return {
		...state,
		pendingRewardedTeachMe: 1,
	}
}

export function formatFreeRemainingLabel(
	remaining: number,
	total: number,
): string {
	return `Бесплатно сегодня: ${remaining} из ${total} осталось`
}
