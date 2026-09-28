/**
 * Persistence barrel — schema, repository, progress service, timer.
 */

export { CURRENT_SAVE_SCHEMA_VERSION } from './schema'
export type {
	ActiveGameSave,
	HydrationStatus,
	ProgressStatistics,
	SaveRoot,
	SaveSchemaVersion,
} from './schema'
export { createDefaultSave, createEmptyStatistics } from './createDefaultSave'
export { migrateSave, migrateSaveJson } from './migrate'
export { parseAndValidateSave } from './validate'
export { createSaveRepository } from './repository'
export type { SaveRepository } from './repository'
export { createGameProgressService } from './progressService'
export type { GameProgressService, PersistGameSnapshotInput } from './progressService'
export { buildPuzzleContentFingerprint } from './fingerprint'
export { sanitizeSaveAgainstCatalog } from './sanitize'
export {
	createPausedTimer,
	startOrResumeTimer,
	pauseTimer,
	readActiveElapsedMs,
	type ActiveTimerState,
} from './timer'
export { createRealClock, createFakeClock, type Clock } from './clock'
export * from './progressReducers'
