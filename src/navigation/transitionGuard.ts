/**
 * Route / completion transition tokens (Phase 9D / H6).
 *
 * A delayed interstitial completion must not navigate if the user has already
 * moved to another route or started another transition.
 */

export interface TransitionGuard {
	/**
	 * Begins a guarded transition. Returns a token, or null when another
	 * transition is already in flight (mutual exclusion).
	 */
	begin(): number | null
	/** True while the given token is still the active in-flight transition. */
	isCurrent(token: number): boolean
	/** Ends the transition if `token` is still current. */
	end(token: number): void
	/**
	 * Invalidates any in-flight transition (e.g. user navigated elsewhere).
	 * Subsequent `isCurrent` checks for the old token return false.
	 */
	cancel(): void
	isInFlight(): boolean
	/**
	 * Convenience: begin → run → end. Drops the call when busy.
	 * The operation receives `isCurrent` so it can abort after awaits.
	 */
	run(
		operation: (isCurrent: () => boolean) => Promise<void>,
	): Promise<boolean>
}

/** Creates an independent guard instance (one per navigator). */
export function createTransitionGuard(): TransitionGuard {
	let generation = 0
	let inFlightToken: number | null = null

	return {
		begin() {
			if (inFlightToken !== null) {
				return null
			}
			generation += 1
			inFlightToken = generation
			return inFlightToken
		},
		isCurrent(token) {
			return inFlightToken === token
		},
		end(token) {
			if (inFlightToken === token) {
				inFlightToken = null
			}
		},
		cancel() {
			inFlightToken = null
			generation += 1
		},
		isInFlight() {
			return inFlightToken !== null
		},
		async run(operation) {
			const token = this.begin()
			if (token === null) {
				return false
			}
			try {
				await operation(() => this.isCurrent(token))
				return true
			} finally {
				this.end(token)
			}
		},
	}
}
