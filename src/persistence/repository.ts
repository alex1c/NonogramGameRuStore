/**
 * SaveRepository — single-key load/save with serialized write queue.
 */

import type { KeyValueStorage } from '../storage/types'
import { SAVE_STORAGE_KEY } from '../storage/keys'
import { migrateSaveJson, type MigrateSaveResult } from './migrate'
import type { SaveRoot } from './schema'
import { freezeSave } from './validate'

export interface SaveRepository {
	load(): Promise<MigrateSaveResult>
	save(save: SaveRoot): Promise<void>
	clear(): Promise<void>
}

/**
 * Create a repository that serializes writes so older async completions
 * cannot overwrite newer state. Failed writes do not permanently poison
 * the queue — the next save still runs.
 */
export function createSaveRepository(
	storage: KeyValueStorage,
	key: string = SAVE_STORAGE_KEY,
): SaveRepository {
	let writeChain: Promise<void> = Promise.resolve()
	let revision = 0

	const enqueue = (task: () => Promise<void>): Promise<void> => {
		const run = writeChain.then(task, task)
		// Keep the chain alive after rejection so later writes still schedule.
		writeChain = run.then(
			() => undefined,
			() => undefined,
		)
		return run
	}

	return {
		async load(): Promise<MigrateSaveResult> {
			try {
				const raw = await storage.getItem(key)
				return migrateSaveJson(raw)
			} catch (error) {
				const reason =
					error instanceof Error ? error.message : 'Storage read failed'
				return {
					kind: 'recovered',
					save: migrateSaveJson(null).save,
					reason,
				}
			}
		},

		save(save: SaveRoot): Promise<void> {
			const frozen = freezeSave(save)
			const myRevision = ++revision
			return enqueue(async () => {
				// Skip stale enqueued writes superseded while waiting.
				if (myRevision !== revision) {
					return
				}
				const payload = JSON.stringify(frozen)
				await storage.setItem(key, payload)
			})
		},

		clear(): Promise<void> {
			const myRevision = ++revision
			return enqueue(async () => {
				if (myRevision !== revision) {
					return
				}
				await storage.removeItem(key)
			})
		},
	}
}
