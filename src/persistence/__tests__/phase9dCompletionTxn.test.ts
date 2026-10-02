/**
 * Phase 9D — completion transaction elapsed freeze (H6) + analytics (M4).
 * Service-level: failed write must not mutate memory; retry uses same elapsed.
 */

import { createMemoryStorage } from '../../storage'
import type { KeyValueStorage } from '../../storage/types'
import { SAVE_STORAGE_KEY } from '../../storage/keys'
import { createDefaultSave } from '../createDefaultSave'
import { createFakeClock } from '../clock'
import { createSaveRepository } from '../repository'
import { createGameProgressService } from '../progressService'
import { getRuntimePuzzleIds } from '../../content/runtime'

const FIXED_NOW_MS = Date.parse('2026-09-28T12:00:00')
const PUZZLE = getRuntimePuzzleIds()[0] ?? 'missing'

function createFaultyStorage(initial: Readonly<Record<string, string>> = {}) {
	const base = createMemoryStorage(initial)
	let writesFail = false
	const storage: KeyValueStorage = {
		getItem: (key) => base.getItem(key),
		async setItem(key, value) {
			if (writesFail) {
				throw new Error('write fail')
			}
			await base.setItem(key, value)
		},
		removeItem: (key) => base.removeItem(key),
	}
	return {
		storage,
		failWrites: (enabled: boolean) => {
			writesFail = enabled
		},
	}
}

describe('H6 completion elapsed freeze via durable commit', () => {
	it('failed write at 1000ms then retry at 1000ms → persisted best is 1000', async () => {
		const faulty = createFaultyStorage({
			[SAVE_STORAGE_KEY]: JSON.stringify(createDefaultSave()),
		})
		const service = createGameProgressService(
			createSaveRepository(faulty.storage),
			createFakeClock(FIXED_NOW_MS),
		)
		await service.hydrate()
		faulty.failWrites(true)
		await expect(
			service.completePuzzle({
				puzzleId: PUZZLE,
				activeTimeMs: 1000,
			}),
		).rejects.toThrow()
		expect(
			service.getSave().bestTimes.find((b) => b.puzzleId === PUZZLE),
		).toBeUndefined()
		faulty.failWrites(false)
		await service.completePuzzle({
			puzzleId: PUZZLE,
			activeTimeMs: 1000,
		})
		const best = service
			.getSave()
			.bestTimes.find((b) => b.puzzleId === PUZZLE)
		expect(best?.bestActiveTimeMs).toBe(1000)
	})
})
