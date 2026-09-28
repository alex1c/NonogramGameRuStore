/**
 * Storage abstraction — domain / progress code must not import AsyncStorage.
 */

/** Minimal key-value contract used by SaveRepository. */
export interface KeyValueStorage {
	getItem(key: string): Promise<string | null>
	setItem(key: string, value: string): Promise<void>
	removeItem(key: string): Promise<void>
}
