/**
 * Repository write ordering and failure recovery.
 */

import {
	createControllableMemoryStorage,
	createMemoryStorage,
} from '../../storage'
import { SAVE_STORAGE_KEY } from '../../storage/keys'
import { createDefaultSave } from '../createDefaultSave'
import { createSaveRepository } from '../repository'
import type { SaveRoot } from '../schema'

function withCompletions(ids: string[]): SaveRoot {
	return {
		...createDefaultSave(),
		completedPuzzleIds: Object.freeze(ids),
	}
}

describe('SaveRepository', () => {
	it('load missing → empty default', async () => {
		const repo = createSaveRepository(createMemoryStorage())
		const loaded = await repo.load()
		expect(loaded.kind).toBe('empty')
	})

	it('save then load restores', async () => {
		const repo = createSaveRepository(createMemoryStorage())
		const save = withCompletions(['mini-beginner-bar'])
		await repo.save(save)
		const loaded = await repo.load()
		expect(loaded.kind).toBe('ok')
		expect(loaded.save.completedPuzzleIds).toEqual(['mini-beginner-bar'])
	})

	it('ordered writes: slow A then fast B → storage is B', async () => {
		const ctrl = createControllableMemoryStorage()
		const repo = createSaveRepository(ctrl.storage)
		ctrl.setWriteDelayMs(40)
		const saveA = withCompletions(['A'])
		const promiseA = repo.save(saveA)
		ctrl.setWriteDelayMs(0)
		const saveB = withCompletions(['B'])
		const promiseB = repo.save(saveB)
		await Promise.all([promiseA, promiseB])
		const raw = ctrl.getRaw(SAVE_STORAGE_KEY)
		expect(raw).not.toBeNull()
		const parsed = JSON.parse(raw as string) as SaveRoot
		expect(parsed.completedPuzzleIds).toEqual(['B'])
	})

	it('write failure does not permanently block later saves', async () => {
		const ctrl = createControllableMemoryStorage()
		const repo = createSaveRepository(ctrl.storage)
		ctrl.failNextWrite()
		await expect(repo.save(withCompletions(['fail']))).rejects.toThrow(
			/Simulated storage write failure/,
		)
		await repo.save(withCompletions(['ok']))
		const loaded = await repo.load()
		expect(loaded.save.completedPuzzleIds).toEqual(['ok'])
	})
})
