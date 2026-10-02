/**
 * Pure gate deciding whether the active-solve timer may (re)start.
 *
 * The Game screen has several independent callers that can resume the timer
 * (interval tick, AppState "active", rewarded-ad dismissal). Every one of them
 * must go through this gate so that a backgrounded app, a completed puzzle,
 * an open rewarded ad, or a stale callback from a previous run can never
 * silently resume the clock.
 */

/** Mirrors React Native's `AppStateStatus` without importing RN in pure code. */
export type ActiveTimerAppState =
	| 'active'
	| 'background'
	| 'inactive'
	| 'unknown'
	| 'extension'

export interface ActiveTimerGateInput {
	/** Last AppState observed by the Game screen. */
	readonly appState: ActiveTimerAppState
	/** True once the completion has been persisted (or the board is solved). */
	readonly completed: boolean
	/** True while a rewarded ad is on screen. */
	readonly rewardedOpen: boolean
	/**
	 * Run identifier captured when the caller (interval / listener) was
	 * created. Omit for callers that do not capture a run.
	 */
	readonly callbackRunId?: string | number
	/** Run identifier that is current right now. */
	readonly currentRunId?: string | number
}

/**
 * Returns true only when the timer is allowed to run.
 *
 * Rules (all must hold):
 * - the app is in the foreground (`appState === 'active'`);
 * - the puzzle is not completed;
 * - no rewarded ad is open;
 * - when run ids are supplied, the callback belongs to the current run.
 *
 * @example
 * shouldRunActiveTimer({
 * 	appState: 'background',
 * 	completed: false,
 * 	rewardedOpen: false,
 * }) // false
 */
export function shouldRunActiveTimer(input: ActiveTimerGateInput): boolean {
	if (input.appState !== 'active') {
		return false
	}
	if (input.completed || input.rewardedOpen) {
		return false
	}
	if (
		input.callbackRunId !== undefined &&
		input.currentRunId !== undefined &&
		input.callbackRunId !== input.currentRunId
	) {
		// Stale callback from a previous run must never resume this run.
		return false
	}
	return true
}
