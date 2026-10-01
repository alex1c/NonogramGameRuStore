/**
 * ForestMusic interstitial frequency policy (session-scoped).
 * Meaningful action = completed production puzzle (not cell paints).
 */

export const INTERSTITIAL_POLICY = {
	/** Minimum completed puzzles this process session before eligibility. */
	minimumCompletedPuzzles: 5,
	/** Minimum wall-clock gap since last successful show. */
	minimumIntervalMs: 5 * 60 * 1000,
	/** Hard max successful shows per app process session. */
	maximumPerSession: 1,
} as const

export interface InterstitialPolicyState {
	readonly completedPuzzles: number
	readonly lastShownAt: number | null
	readonly shownThisSession: boolean
	readonly sessionStartMs: number
}

export interface InterstitialEligibilityRequest {
	readonly isTutorial: boolean
	readonly naturalBoundary: boolean
	readonly now: number
}

export function createInterstitialPolicyState(
	now: number = Date.now(),
): InterstitialPolicyState {
	return {
		completedPuzzles: 0,
		lastShownAt: null,
		shownThisSession: false,
		sessionStartMs: now,
	}
}

export function canShowInterstitial(
	state: InterstitialPolicyState,
	request: InterstitialEligibilityRequest,
): boolean {
	if (request.isTutorial || !request.naturalBoundary) {
		return false
	}
	if (state.shownThisSession) {
		return false
	}
	if (state.completedPuzzles < INTERSTITIAL_POLICY.minimumCompletedPuzzles) {
		return false
	}
	// Session must also be at least as old as the gap (avoids early spam).
	if (request.now - state.sessionStartMs < INTERSTITIAL_POLICY.minimumIntervalMs) {
		return false
	}
	if (
		state.lastShownAt !== null &&
		request.now - state.lastShownAt < INTERSTITIAL_POLICY.minimumIntervalMs
	) {
		return false
	}
	return true
}

export function recordPuzzleCompleted(
	state: InterstitialPolicyState,
	isTutorial: boolean,
): InterstitialPolicyState {
	if (isTutorial) {
		return state
	}
	return {
		...state,
		completedPuzzles: state.completedPuzzles + 1,
	}
}

export function recordInterstitialShown(
	state: InterstitialPolicyState,
	now: number,
): InterstitialPolicyState {
	return {
		...state,
		lastShownAt: now,
		shownThisSession: true,
	}
}
