/**
 * Storage barrel — adapters + keys. Domain must not import AsyncStorage.
 */

export { SAVE_STORAGE_KEY } from './keys'
export type { KeyValueStorage } from './types'
export {
	createMemoryStorage,
	createControllableMemoryStorage,
} from './memoryStorage'

/**
 * AsyncStorage adapter is NOT re-exported from the barrel so Jest unit tests
 * that import memory helpers do not load the native module. Production App
 * code imports `./asyncStorageAdapter` directly.
 */
