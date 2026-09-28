/**
 * Storage placeholders — concrete persistence arrives in later phases.
 * Domain serialization lives in domain/nonogram/playerState.ts.
 */

export const STORAGE_KEYS = {
	playerStatePrefix: 'nonogram.playerState.',
	settings: 'nonogram.settings',
} as const
