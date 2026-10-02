/**
 * Persistence health taxonomy (Phase 9D / N1).
 *
 * Distinguishes "in-memory may look fine" from "mutations are durable".
 * When health is not READY, commit/mutate APIs must reject — never return a
 * successful Promise for a memory-only fake save.
 */

export type PersistenceHealth =
	| 'READY'
	| 'READ_ERROR'
	| 'UNSUPPORTED_SCHEMA'
	| 'CORRUPT_RECOVERY_BLOCKED'
	| 'WRITE_ERROR'

export class PersistenceBlockedError extends Error {
	readonly health: PersistenceHealth

	constructor(health: PersistenceHealth, message?: string) {
		super(message ?? `Persistence blocked (${health})`)
		this.name = 'PersistenceBlockedError'
		this.health = health
	}
}

export function isPersistenceBlockedError(
	error: unknown,
): error is PersistenceBlockedError {
	return error instanceof PersistenceBlockedError
}
