/**
 * SaveRepository — single-key load/save with serialized write queue.
 */

import type { KeyValueStorage } from '../storage/types'
import { SAVE_STORAGE_KEY } from '../storage/keys'
import { createDefaultSave } from './createDefaultSave'
import { migrateSaveJson, type MigrateSaveResult } from './migrate'
import type { SaveRoot } from './schema'
import { freezeSave } from './validate'

export interface SaveRepository {
	/**
	 * Load and classify the persisted save. NEVER writes to storage.
	 * See {@link MigrateSaveResult} for the taxonomy and overwrite rules.
	 */
	load(): Promise<MigrateSaveResult>
	save(save: SaveRoot): Promise<void>
	clear(): Promise<void>
	/**
	 * Preserve a corrupt raw payload under `${key}.corrupt.${timestamp}`
	 * before it is overwritten. Resolves with the backup key; rejects when the
	 * backup could not be written (caller must then NOT overwrite).
	 */
	backupCorruptPayload(rawPayload: string, timestampMs: number): Promise<string>
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
			let raw: string | null
			try {
				raw = await storage.getItem(key)
			} catch (error) {
				// A failed read says nothing about what is stored. Report it as
				// io_error so callers never treat it as "corrupt → overwrite".
				// The default save is for in-memory / safe-UI use only.
				const reason =
					error instanceof Error ? error.message : 'Storage read failed'
				return {
					kind: 'io_error',
					save: createDefaultSave(),
					reason,
				}
			}
			return migrateSaveJson(raw)
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

		async backupCorruptPayload(
			rawPayload: string,
			timestampMs: number,
		): Promise<string> {
			const backupKey = `${key}.corrupt.${timestampMs}`
			// Serialized with normal writes; not subject to revision skipping.
			await enqueue(async () => {
				await storage.setItem(backupKey, rawPayload)
			})
			return backupKey
		},
	}
}
