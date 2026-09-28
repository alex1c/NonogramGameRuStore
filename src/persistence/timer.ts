/**
 * Active-solve timer helpers (pure, clock-injected).
 * Wall time while backgrounded must not accumulate.
 */

export interface ActiveTimerState {
	/** Already banked active milliseconds. */
	readonly accumulatedMs: number
	/** When the current active segment started; null if paused. */
	readonly segmentStartedAtMs: number | null
}

export function createPausedTimer(accumulatedMs: number = 0): ActiveTimerState {
	return Object.freeze({
		accumulatedMs: Math.max(0, accumulatedMs),
		segmentStartedAtMs: null,
	})
}

export function startOrResumeTimer(
	state: ActiveTimerState,
	nowMs: number,
): ActiveTimerState {
	if (state.segmentStartedAtMs !== null) {
		return state
	}
	return Object.freeze({
		accumulatedMs: state.accumulatedMs,
		segmentStartedAtMs: nowMs,
	})
}

export function pauseTimer(
	state: ActiveTimerState,
	nowMs: number,
): ActiveTimerState {
	if (state.segmentStartedAtMs === null) {
		return state
	}
	const delta = Math.max(0, nowMs - state.segmentStartedAtMs)
	return Object.freeze({
		accumulatedMs: state.accumulatedMs + delta,
		segmentStartedAtMs: null,
	})
}

/** Current active elapsed including open segment. */
export function readActiveElapsedMs(
	state: ActiveTimerState,
	nowMs: number,
): number {
	if (state.segmentStartedAtMs === null) {
		return state.accumulatedMs
	}
	return state.accumulatedMs + Math.max(0, nowMs - state.segmentStartedAtMs)
}
