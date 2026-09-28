/**
 * Injectable clock — production uses Date.now; tests use a fake.
 */

export interface Clock {
	now(): number
}

export function createRealClock(): Clock {
	return {
		now(): number {
			return Date.now()
		},
	}
}

/** Mutable fake clock for deterministic timer / persistence tests. */
export function createFakeClock(initialMs: number = 0): Clock & {
	advance(ms: number): void
	set(ms: number): void
} {
	let current = initialMs
	return {
		now(): number {
			return current
		},
		advance(ms: number): void {
			current += ms
		},
		set(ms: number): void {
			current = ms
		},
	}
}
