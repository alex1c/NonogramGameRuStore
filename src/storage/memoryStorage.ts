/**
 * In-memory KeyValueStorage for unit tests and DEV helpers.
 */

import type { KeyValueStorage } from './types'

export function createMemoryStorage(
	initial: Readonly<Record<string, string>> = {},
): KeyValueStorage {
	const map = new Map<string, string>(Object.entries(initial))
	return {
		async getItem(key: string): Promise<string | null> {
			return map.has(key) ? (map.get(key) ?? null) : null
		},
		async setItem(key: string, value: string): Promise<void> {
			map.set(key, value)
		},
		async removeItem(key: string): Promise<void> {
			map.delete(key)
		},
	}
}

/**
 * Test helper: delayed / flaky storage for write-queue race tests.
 * Writes can be delayed and optionally fail once.
 */
export function createControllableMemoryStorage(): {
	readonly storage: KeyValueStorage
	readonly getRaw: (key: string) => string | null
	failNextWrite: () => void
	setWriteDelayMs: (ms: number) => void
} {
	const map = new Map<string, string>()
	let failNext = false
	let delayMs = 0

	const storage: KeyValueStorage = {
		async getItem(key: string): Promise<string | null> {
			return map.has(key) ? (map.get(key) ?? null) : null
		},
		async setItem(key: string, value: string): Promise<void> {
			const wait = delayMs
			if (wait > 0) {
				await new Promise<void>((resolve) => {
					setTimeout(resolve, wait)
				})
			}
			if (failNext) {
				failNext = false
				throw new Error('Simulated storage write failure')
			}
			map.set(key, value)
		},
		async removeItem(key: string): Promise<void> {
			map.delete(key)
		},
	}

	return {
		storage,
		getRaw: (key) => (map.has(key) ? (map.get(key) ?? null) : null),
		failNextWrite: () => {
			failNext = true
		},
		setWriteDelayMs: (ms) => {
			delayMs = ms
		},
	}
}
