/**
 * Phase 9D — N1 blocked writes must not look successful.
 */

import { createMemoryStorage } from '../../storage'
import type { KeyValueStorage } from '../../storage/types'
import { SAVE_STORAGE_KEY } from '../../storage/keys'
import { createDefaultSave } from '../createDefaultSave'
import { createFakeClock } from '../clock'
import { createSaveRepository } from '../repository'
import { createGameProgressService } from '../progressService'
import { PersistenceBlockedError } from '../persistenceHealth'
import type { SaveRoot } from '../schema'
import { getRuntimePuzzleIds } from '../../content/runtime'

const FIXED_NOW_MS = Date.parse('2026-09-28T12:00:00')
const PUZZLE = getRuntimePuzzleIds()[0] ?? 'missing'

function createFaultyStorage(
	initial: Readonly<Record<string, string>> = {},
): {
	readonly storage: KeyValueStorage
	failReads: (count: number) => void
	failWrites: (enabled: boolean) => void
	readonly setCalls: string[]
	readonly peek: (key: string) => Promise<string | null>
} {
	const base = createMemoryStorage(initial)
	let readFailuresLeft = 0
	let writesFail = false
	const setCalls: string[] = []
	const storage: KeyValueStorage = {
		async getItem(key: string) {
			if (readFailuresLeft > 0) {
				if (Number.isFinite(readFailuresLeft)) {
					readFailuresLeft -= 1
				}
				throw new Error('Simulated storage read failure')
			}
			return base.getItem(key)
		},
		async setItem(key: string, value: string) {
			setCalls.push(key)
			if (writesFail) {
				throw new Error('Simulated storage write failure')
			}
			await base.setItem(key, value)
		},
		async removeItem(key: string) {
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
		setCalls,
		peek: (key) => base.getItem(key),
	}
}

function validPayload(): { readonly json: string; readonly save: SaveRoot } {
	const base = createDefaultSave()
	const save: SaveRoot = {
		...base,
		tutorialVersionCompleted: 1,
		statistics: {
			...base.statistics,
			totalCompletions: 7,
		},
	}
	return { json: JSON.stringify(save), save }
}

describe('N1 persistence health / blocked mutations', () => {
	it('IO read error → blocked → mutation rejects → 0 writes → retry restores', async () => {
		const { json, save } = validPayload()
		const faulty = createFaultyStorage({ [SAVE_STORAGE_KEY]: json })
		faulty.failReads(1)
		const service = createGameProgressService(
			createSaveRepository(faulty.storage),
			createFakeClock(FIXED_NOW_MS),
		)
		const first = await service.hydrate()
		expect(first.status).toBe('ERROR_IO_READ')
		expect(service.isWritable()).toBe(false)
		expect(service.getPersistenceHealth()).toBe('READ_ERROR')
		const writesBefore = faulty.setCalls.length

		await expect(service.markTutorialFirstRunSkipped()).rejects.toBeInstanceOf(
			PersistenceBlockedError,
		)
		await expect(
			service.completePuzzle({
				puzzleId: PUZZLE,
				activeTimeMs: 1000,
			}),
		).rejects.toBeInstanceOf(PersistenceBlockedError)
		expect(faulty.setCalls.length).toBe(writesBefore)

		const second = await service.hydrate()
		expect(second.status).toBe('READY')
		expect(service.isWritable()).toBe(true)
		expect(service.getSave().statistics.totalCompletions).toBe(
			save.statistics.totalCompletions,
		)
	})

	it('future schema → blocked → mutation rejects → payload untouched', async () => {
		const future = JSON.stringify({
			...createDefaultSave(),
			schemaVersion: 99,
		})
		const faulty = createFaultyStorage({ [SAVE_STORAGE_KEY]: future })
		const service = createGameProgressService(
			createSaveRepository(faulty.storage),
			createFakeClock(FIXED_NOW_MS),
		)
		const hydrated = await service.hydrate()
		expect(hydrated.status).toBe('ERROR_UNSUPPORTED_SCHEMA')
		expect(service.getPersistenceHealth()).toBe('UNSUPPORTED_SCHEMA')
		await expect(service.markTutorialCompleted(1)).rejects.toBeInstanceOf(
			PersistenceBlockedError,
		)
		expect(await faulty.peek(SAVE_STORAGE_KEY)).toBe(future)
	})

	it('write error during READY → reports failure, memory unchanged', async () => {
		const { json } = validPayload()
		const faulty = createFaultyStorage({ [SAVE_STORAGE_KEY]: json })
		const service = createGameProgressService(
			createSaveRepository(faulty.storage),
			createFakeClock(FIXED_NOW_MS),
		)
		await service.hydrate()
		expect(service.isWritable()).toBe(true)
		const before = service.getSave().statistics.totalCompletions
		faulty.failWrites(true)
		await expect(
			service.completePuzzle({
				puzzleId: PUZZLE,
				activeTimeMs: 1000,
			}),
		).rejects.toThrow()
		expect(service.getSave().statistics.totalCompletions).toBe(before)
		faulty.failWrites(false)
		const result = await service.completePuzzle({
			puzzleId: PUZZLE,
			activeTimeMs: 1000,
		})
		expect(result.event.firstCompletion).toBe(true)
		expect(service.getSave().statistics.totalCompletions).toBe(before + 1)
	})

	it('completion analytics survive write retry (M4)', async () => {
		const { json } = validPayload()
		const faulty = createFaultyStorage({ [SAVE_STORAGE_KEY]: json })
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
		faulty.failWrites(false)
		const first = await service.completePuzzle({
			puzzleId: PUZZLE,
			activeTimeMs: 1000,
		})
		expect(first.event.firstPuzzleSolve).toBe(true)
		const second = await service.completePuzzle({
			puzzleId: PUZZLE,
			activeTimeMs: 1000,
		})
		expect(second.event.firstPuzzleSolve).toBe(false)
		expect(second.event.newlyUnlockedAchievements).toEqual([])
	})
})
