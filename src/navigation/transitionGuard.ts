/**
 * In-flight transition guard.
 *
 * Post-completion CTAs (Next / Home / Calendar) run an interstitial and then
 * navigate. Rapid repeated taps must not stack several interstitial +
 * navigation operations, so only the first call runs until it settles.
 */

export interface TransitionGuard {
	/**
	 * Runs `operation` unless another guarded operation is still in flight.
	 * Resolves true when the operation ran, false when it was dropped.
	 * The guard is always released, even when the operation throws.
	 */
	run(operation: () => Promise<void>): Promise<boolean>
	/** True while a guarded operation has not settled yet. */
	isInFlight(): boolean
}

/** Creates an independent guard instance (one per navigator). */
export function createTransitionGuard(): TransitionGuard {
	let inFlight = false
	return {
		async run(operation) {
			if (inFlight) {
				return false
			}
			// Set synchronously so a second tap in the same tick is dropped.
			inFlight = true
			try {
				await operation()
				return true
			} finally {
				inFlight = false
			}
		},
		isInFlight() {
			return inFlight
		},
	}
}
