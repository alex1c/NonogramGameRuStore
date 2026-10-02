/**
 * Phase 9C (H1) — repository / hydrate fault injection.
 *
 * Core invariant: a failed or unclassifiable READ must never cause the
 * in-memory default save to be written over data that may still be valid.
 *
 * Overwrite policy per load kind (see `migrate.ts` and `progressService.ts`):
 *  - empty        → default may be written (nothing to lose).
 *  - ok           → normal (writes only for sanitize / daily rollover).
 *  - recovered    → corrupt raw is backed up to `${key}.corrupt.${ts}` FIRST;
 *                   the default overwrites the main key only if backup worked.
 *  - unsupported  → NEVER overwritten (newer app data).
 *  - io_error     → NEVER overwritten (stored state unknown).
 */

import { createMemoryStorage } from '../../storage'
import type { KeyValueStorage } from '../../storage/types'
import { SAVE_STORAGE_KEY } from '../../storage/keys'
import { createDefaultSave } from '../createDefaultSave'
import { createFakeClock } from '../clock'
import { createSaveRepository } from '../repository'
import { createGameProgressService } from '../progressService'
import type { SaveRoot } from '../schema'

/** Fixed local noon so the help-allowance day roll is deterministic. */
const FIXED_NOW_MS = Date.parse('2026-09-28T12:00:00')
const FIXED_DAY = '2026-09-28'

interface FaultyStorage {
	readonly storage: KeyValueStorage
	/** Make the next `count` getItem calls reject (Infinity = always). */
	failReads: (count: number) => void
	/** Make every setItem call reject while enabled. */
	failWrites: (enabled: boolean) => void
	/** Make setItem reject only for keys that contain this fragment. */
	failWritesForKeyFragment: (fragment: string | null) => void
	/** Every key passed to setItem (including failed attempts). */
	readonly setCalls: string[]
	/** Count of removeItem calls. */
	readonly removeCalls: () => number
	/** Read the raw value without going through fault injection. */
	readonly peek: (key: string) => Promise<string | null>
}

/** Wrap an in-memory storage with controllable read / write failures. */
function createFaultyStorage(
	initial: Readonly<Record<string, string>> = {},
): FaultyStorage {
	const base = createMemoryStorage(initial)
	let readFailuresLeft = 0
	let writesFail = false
	let failFragment: string | null = null
	let removes = 0
	const setCalls: string[] = []

	const storage: KeyValueStorage = {
		async getItem(key: string): Promise<string | null> {
			if (readFailuresLeft > 0) {
				if (Number.isFinite(readFailuresLeft)) {
					readFailuresLeft -= 1
				}
				throw new Error('Simulated storage read failure')
			}
			return base.getItem(key)
		},
		async setItem(key: string, value: string): Promise<void> {
			setCalls.push(key)
			if (writesFail || (failFragment !== null && key.includes(failFragment))) {
				throw new Error('Simulated storage write failure')
			}
			await base.setItem(key, value)
		},
		async removeItem(key: string): Promise<void> {
			removes += 1
			await base.removeItem(key)
		},
	}

	return {
		storage,
		failReads: (count) => {
			readFailuresLeft = count
		},
		failWrites: (enabled) => {
			writesFail = enabled
		},
		failWritesForKeyFragment: (fragment) => {
			failFragment = fragment
		},
		setCalls,
		removeCalls: () => removes,
		peek: (key) => base.getItem(key),
	}
}

/** A valid current-schema payload that is distinguishable from a default. */
function validPayload(): { readonly json: string; readonly save: SaveRoot } {
	const save: SaveRoot = {
		...createDefaultSave(),
		tutorialVersionCompleted: 1,
		tutorialOfferDismissed: true,
		helpAllowanceDay: FIXED_DAY,
	}
	return { json: JSON.stringify(save), save }
}

function createService(faulty: FaultyStorage) {
	const repo = createSaveRepository(faulty.storage)
	const service = createGameProgressService(
		repo,
		createFakeClock(FIXED_NOW_MS),
	)
	return { repo, service }
}

describe('repository.load taxonomy', () => {
	it('missing payload → empty', async () => {
		const faulty = createFaultyStorage()
		const loaded = await createSaveRepository(faulty.storage).load()
		expect(loaded.kind).toBe('empty')
	})

	it('getItem rejects → io_error with reason (not recovered)', async () => {
		const faulty = createFaultyStorage({
			[SAVE_STORAGE_KEY]: validPayload().json,
		})
		faulty.failReads(1)
		const loaded = await createSaveRepository(faulty.storage).load()
		expect(loaded.kind).toBe('io_error')
		if (loaded.kind === 'io_error') {
			expect(loaded.reason).toMatch(/Simulated storage read failure/)
			// Default is only for in-memory safe UI.
			expect(loaded.save).toEqual(createDefaultSave())
		}
		// load() itself never writes.
		expect(faulty.setCalls).toEqual([])
		expect(faulty.removeCalls()).toBe(0)
	})

	it('valid current payload → ok, not migrated', async () => {
		const faulty = createFaultyStorage({
			[SAVE_STORAGE_KEY]: validPayload().json,
		})
		const loaded = await createSaveRepository(faulty.storage).load()
		expect(loaded.kind).toBe('ok')
		if (loaded.kind === 'ok') {
			expect(loaded.migrated).toBe(false)
		}
	})

	it('older schema payload → ok with migrated flag', async () => {
		const v6 = {
			...JSON.parse(validPayload().json),
			schemaVersion: 6,
		} as Record<string, unknown>
		delete v6.tutorialFirstRunSkipped
		const faulty = createFaultyStorage({
			[SAVE_STORAGE_KEY]: JSON.stringify(v6),
		})
		const loaded = await createSaveRepository(faulty.storage).load()
		expect(loaded.kind).toBe('ok')
		if (loaded.kind === 'ok') {
			expect(loaded.migrated).toBe(true)
			expect(loaded.save.schemaVersion).toBe(7)
			expect(loaded.save.tutorialFirstRunSkipped).toBe(false)
			expect(loaded.save.tutorialVersionCompleted).toBe(1)
		}
	})

	it('malformed JSON → recovered with reason and rawPayload', async () => {
		const faulty = createFaultyStorage({ [SAVE_STORAGE_KEY]: '{not-json' })
		const loaded = await createSaveRepository(faulty.storage).load()
		expect(loaded.kind).toBe('recovered')
		if (loaded.kind === 'recovered') {
			expect(loaded.reason).toBe('Malformed JSON')
			expect(loaded.rawPayload).toBe('{not-json')
		}
	})

	it('future schema → unsupported with rawPayload', async () => {
		const raw = JSON.stringify({ schemaVersion: 99, secret: 'newer' })
		const faulty = createFaultyStorage({ [SAVE_STORAGE_KEY]: raw })
		const loaded = await createSaveRepository(faulty.storage).load()
		expect(loaded.kind).toBe('unsupported')
		if (loaded.kind === 'unsupported') {
			expect(loaded.rawPayload).toBe(raw)
		}
	})
})

describe('hydrate fault injection — read failures', () => {
	it('getItem rejects once → no overwrite, data recoverable next hydrate', async () => {
		const { json } = validPayload()
		const faulty = createFaultyStorage({ [SAVE_STORAGE_KEY]: json })
		const { service } = createService(faulty)

		faulty.failReads(1)
		const first = await service.hydrate()
		expect(first.status).not.toBe('READY')
		expect(first.status).toBe('ERROR_IO_READ')
		expect(first.reason).toMatch(/Simulated storage read failure/)

		// Nothing was written and the stored document is byte-identical.
		expect(faulty.setCalls).toEqual([])
		expect(await faulty.peek(SAVE_STORAGE_KEY)).toBe(json)

		// Session mutations stay in memory only while writes are blocked.
		await service.markTutorialFirstRunSkipped()
		await service.flush()
		expect(faulty.setCalls).toEqual([])
		expect(await faulty.peek(SAVE_STORAGE_KEY)).toBe(json)

		// Retry succeeds and original data is intact (not the default).
		const second = await service.hydrate()
		expect(second.status).toBe('READY')
		expect(second.save.tutorialVersionCompleted).toBe(1)
		expect(second.save.tutorialOfferDismissed).toBe(true)
	})

	it('getItem rejects repeatedly → never overwrites', async () => {
		const { json } = validPayload()
		const faulty = createFaultyStorage({ [SAVE_STORAGE_KEY]: json })
		const { service } = createService(faulty)

		faulty.failReads(Number.POSITIVE_INFINITY)
		for (let attempt = 0; attempt < 5; attempt += 1) {
			const result = await service.hydrate()
			expect(result.status).toBe('ERROR_IO_READ')
			await service.markTutorialFirstRunSkipped()
			await service.flush()
		}

		expect(faulty.setCalls).toEqual([])
		expect(faulty.removeCalls()).toBe(0)
		expect(await faulty.peek(SAVE_STORAGE_KEY)).toBe(json)
	})
})

describe('hydrate fault injection — corrupt payloads', () => {
	it('malformed JSON → recovered: backup raw first, then overwrite default', async () => {
		const raw = '{"schemaVersion": 7, "broken'
		const faulty = createFaultyStorage({ [SAVE_STORAGE_KEY]: raw })
		const { service } = createService(faulty)

		const result = await service.hydrate()
		expect(result.status).toBe('ERROR_RECOVERED')
		expect(result.reason).toBe('Malformed JSON')

		// Overwrite policy: raw evidence is preserved under a corrupt key.
		const backupKey = `${SAVE_STORAGE_KEY}.corrupt.${FIXED_NOW_MS}`
		expect(await faulty.peek(backupKey)).toBe(raw)
		// Backup is written BEFORE the main key is replaced.
		expect(faulty.setCalls.indexOf(backupKey)).toBeLessThan(
			faulty.setCalls.indexOf(SAVE_STORAGE_KEY),
		)
		// Main key now holds a valid default document.
		const stored = await faulty.peek(SAVE_STORAGE_KEY)
		expect(stored).not.toBe(raw)
		expect(JSON.parse(stored as string).schemaVersion).toBe(7)
	})

	it('corrupt payload + backup failure → main key is NOT overwritten', async () => {
		const raw = '{definitely-not-json'
		const faulty = createFaultyStorage({ [SAVE_STORAGE_KEY]: raw })
		faulty.failWritesForKeyFragment('.corrupt.')
		const { service } = createService(faulty)

		const result = await service.hydrate()
		expect(result.status).toBe('ERROR_RECOVERED')

		expect(await faulty.peek(SAVE_STORAGE_KEY)).toBe(raw)
		expect(faulty.setCalls).not.toContain(SAVE_STORAGE_KEY)

		// Later mutations are in-memory only as well.
		await service.markTutorialFirstRunSkipped()
		expect(await faulty.peek(SAVE_STORAGE_KEY)).toBe(raw)
	})
})

describe('hydrate fault injection — unsupported future schema', () => {
	it('future schema → no overwrite, no backup churn', async () => {
		const raw = JSON.stringify({ schemaVersion: 99, payload: 'from-newer-app' })
		const faulty = createFaultyStorage({ [SAVE_STORAGE_KEY]: raw })
		const { service } = createService(faulty)

		const result = await service.hydrate()
		expect(result.status).toBe('ERROR_UNSUPPORTED_SCHEMA')
		expect(result.reason).toMatch(/Future schemaVersion 99/)

		expect(faulty.setCalls).toEqual([])
		expect(faulty.removeCalls()).toBe(0)
		expect(await faulty.peek(SAVE_STORAGE_KEY)).toBe(raw)

		await service.markTutorialFirstRunSkipped()
		await service.flush()
		expect(faulty.setCalls).toEqual([])
		expect(await faulty.peek(SAVE_STORAGE_KEY)).toBe(raw)
	})
})

describe('write failures surface to the caller', () => {
	it('repository.save rejects when setItem rejects', async () => {
		const faulty = createFaultyStorage()
		const repo = createSaveRepository(faulty.storage)
		faulty.failWrites(true)
		await expect(repo.save(createDefaultSave())).rejects.toThrow(
			/Simulated storage write failure/,
		)
		// Queue is not poisoned: a later save succeeds once storage recovers.
		faulty.failWrites(false)
		await repo.save(createDefaultSave())
		expect(await faulty.peek(SAVE_STORAGE_KEY)).not.toBeNull()
	})

	it('service mutation rejects when persistence fails', async () => {
		const { json } = validPayload()
		const faulty = createFaultyStorage({ [SAVE_STORAGE_KEY]: json })
		const { service } = createService(faulty)
		const hydrated = await service.hydrate()
		expect(hydrated.status).toBe('READY')

		faulty.failWrites(true)
		await expect(service.markTutorialFirstRunSkipped()).rejects.toThrow(
			/Simulated storage write failure/,
		)
	})
})
