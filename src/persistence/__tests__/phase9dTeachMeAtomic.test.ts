/**
 * Phase 9D — Teach Me atomic reveal (H3).
 *
 * Concurrent acquire with one remaining entitlement → exactly one grant.
 */

import { FREE_TEACH_ME_PER_DAY } from '../../help/allowance'
import { createGameProgressService } from '../progressService'
import { createSaveRepository } from '../repository'
import { createFakeClock } from '../clock'
import { createMemoryStorage } from '../../storage'
import { createDefaultSave } from '../createDefaultSave'
import type { SaveRoot } from '../schema'

const TODAY_MS = Date.parse('2026-10-02T12:00:00')

async function createService(initial?: SaveRoot) {
	const storage = createMemoryStorage(
		initial
			? {
					'nonogram.save.v1': JSON.stringify(initial),
				}
			: {},
	)
	const repo = createSaveRepository(storage)
	const service = createGameProgressService(
		repo,
		createFakeClock(TODAY_MS),
	)
	await service.hydrate()
	return { service, storage }
}

describe('tryAcquireTeachMeReveal (H3 atomic)', () => {
	it('one free remaining → two concurrent acquires → exactly one granted', async () => {
		const base = createDefaultSave()
		const seeded: SaveRoot = {
			...base,
			helpAllowanceDay: '2026-10-02',
			freeTeachMeUsedToday: FREE_TEACH_ME_PER_DAY - 1,
		}
		const { service } = await createService(seeded)

		const [a, b] = await Promise.all([
			service.tryAcquireTeachMeReveal(),
			service.tryAcquireTeachMeReveal(),
		])
		const grants = [a, b].filter((x) => x === 'granted').length
		const denies = [a, b].filter((x) => x === 'denied').length
		expect(grants).toBe(1)
		expect(denies).toBe(1)
		expect(service.getSave().freeTeachMeUsedToday).toBe(FREE_TEACH_ME_PER_DAY)
	})

	it('zero free + one pending rewarded → concurrent → exactly one granted', async () => {
		const base = createDefaultSave()
		const seeded: SaveRoot = {
			...base,
			helpAllowanceDay: '2026-10-02',
			freeTeachMeUsedToday: FREE_TEACH_ME_PER_DAY,
			pendingRewardedTeachMe: 1,
		}
		const { service } = await createService(seeded)

		const [a, b] = await Promise.all([
			service.tryAcquireTeachMeReveal(),
			service.tryAcquireTeachMeReveal(),
		])
		expect([a, b].filter((x) => x === 'granted')).toHaveLength(1)
		expect(service.getSave().pendingRewardedTeachMe).toBe(0)
	})

	it('rerun after grant is denied (no double consume)', async () => {
		const { service } = await createService()
		expect(await service.tryAcquireTeachMeReveal()).toBe('granted')
		// Exhaust remaining free pool then expect deny once empty.
		for (let i = 0; i < FREE_TEACH_ME_PER_DAY; i += 1) {
			await service.tryAcquireTeachMeReveal()
		}
		expect(await service.tryAcquireTeachMeReveal()).toBe('denied')
	})

	it('writesBlocked → acquire throws, no consumption', async () => {
		const storage = createMemoryStorage({
			'nonogram.save.v1': JSON.stringify({
				...createDefaultSave(),
				schemaVersion: 99,
			}),
		})
		// Force unsupported by putting a future schema via migrate — use io_error
		// path: reject getItem once so hydrate blocks writes.
		let failOnce = true
		const wrapped = {
			async getItem(key: string) {
				if (failOnce) {
					failOnce = false
					throw new Error('read fail')
				}
				return storage.getItem(key)
			},
			setItem: storage.setItem.bind(storage),
			removeItem: storage.removeItem.bind(storage),
		}
		const service = createGameProgressService(
			createSaveRepository(wrapped),
			createFakeClock(TODAY_MS),
		)
		const hydrated = await service.hydrate()
		expect(hydrated.status).toBe('ERROR_IO_READ')
		expect(service.isWritable()).toBe(false)
		await expect(service.tryAcquireTeachMeReveal()).rejects.toThrow()
	})
})
