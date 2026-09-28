/**
 * Production KeyValueStorage adapter over AsyncStorage.
 * Only this module may import @react-native-async-storage/async-storage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import type { KeyValueStorage } from './types'

export function createAsyncStorageAdapter(): KeyValueStorage {
	return {
		getItem(key: string): Promise<string | null> {
			return AsyncStorage.getItem(key)
		},
		setItem(key: string, value: string): Promise<void> {
			return AsyncStorage.setItem(key, value)
		},
		removeItem(key: string): Promise<void> {
			return AsyncStorage.removeItem(key)
		},
	}
}
