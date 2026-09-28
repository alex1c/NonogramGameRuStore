/**
 * Sanitize a loaded save against the current production catalog.
 * Unknown completed/solved IDs are kept; invalid active games are cleared.
 * Campaign and Daily branches are sanitized independently.
 */

import { getProductionPuzzleById } from '../content/playable'
import { localDayKey } from '../daily/dateUtils'
import { buildPuzzleContentFingerprint } from './fingerprint'
import type { SaveRoot } from './schema'
import {
	clearActiveDailyGame,
	clearActiveGame,
} from './progressReducers'
import { freezeSave } from './validate'
import type { Clock } from './clock'
import { createRealClock } from './clock'

export interface SanitizeResult {
	readonly save: SaveRoot
	readonly clearedActiveGame: boolean
	readonly clearedActiveDailyGame: boolean
	readonly reason?: string
}

function sanitizeCampaignActive(save: SaveRoot): {
	readonly save: SaveRoot
	readonly cleared: boolean
	readonly reason?: string
} {
	const active = save.activeGame
	if (active === null) {
		return { save, cleared: false }
	}
	const puzzle = getProductionPuzzleById(active.puzzleId)
	if (puzzle === null) {
		return {
			save: clearActiveGame(save),
			cleared: true,
			reason: `Active puzzle missing from catalog: ${active.puzzleId}`,
		}
	}
	const expected = buildPuzzleContentFingerprint(puzzle)
	if (expected !== active.contentFingerprint) {
		return {
			save: clearActiveGame(save),
			cleared: true,
			reason: `Content fingerprint mismatch for ${active.puzzleId}`,
		}
	}
	if (
		active.player.width !== puzzle.width ||
		active.player.height !== puzzle.height ||
		active.player.cells.length !== puzzle.width * puzzle.height
	) {
		return {
			save: clearActiveGame(save),
			cleared: true,
			reason: `Active player dimensions mismatch for ${active.puzzleId}`,
		}
	}
	return { save, cleared: false }
}

function sanitizeDailyActive(
	save: SaveRoot,
	today: string,
): {
	readonly save: SaveRoot
	readonly cleared: boolean
	readonly reason?: string
} {
	const active = save.activeDailyGame
	if (active === null) {
		return { save, cleared: false }
	}
	// Stale yesterday (or older) unfinished Daily — discard on hydration.
	if (active.dayKey < today) {
		return {
			save: clearActiveDailyGame(save),
			cleared: true,
			reason: `Stale Daily active dayKey ${active.dayKey} < today ${today}`,
		}
	}
	// Future corruption
	if (active.dayKey > today) {
		return {
			save: clearActiveDailyGame(save),
			cleared: true,
			reason: `Future Daily active dayKey ${active.dayKey}`,
		}
	}
	// Already completed that day
	if (save.dailyCompletionRecords.some((r) => r.dayKey === active.dayKey)) {
		return {
			save: clearActiveDailyGame(save),
			cleared: true,
			reason: `Daily active overlaps completed day ${active.dayKey}`,
		}
	}
	const puzzle = getProductionPuzzleById(active.puzzleId)
	if (puzzle === null) {
		return {
			save: clearActiveDailyGame(save),
			cleared: true,
			reason: `Daily puzzle missing: ${active.puzzleId}`,
		}
	}
	const expected = buildPuzzleContentFingerprint(puzzle)
	if (expected !== active.contentFingerprint) {
		return {
			save: clearActiveDailyGame(save),
			cleared: true,
			reason: `Daily fingerprint mismatch for ${active.puzzleId}`,
		}
	}
	if (
		active.player.width !== puzzle.width ||
		active.player.height !== puzzle.height ||
		active.player.cells.length !== puzzle.width * puzzle.height
	) {
		return {
			save: clearActiveDailyGame(save),
			cleared: true,
			reason: `Daily player dimensions mismatch for ${active.puzzleId}`,
		}
	}
	return { save, cleared: false }
}

/**
 * After migrate/validate, ensure Campaign + Daily active parties are openable.
 */
export function sanitizeSaveAgainstCatalog(
	save: SaveRoot,
	clock: Clock = createRealClock(),
): SanitizeResult {
	const today = localDayKey(new Date(clock.now()))
	const campaign = sanitizeCampaignActive(save)
	const daily = sanitizeDailyActive(campaign.save, today)
	const cleared =
		campaign.cleared || daily.cleared
	const reason = daily.reason ?? campaign.reason
	return {
		save: freezeSave(daily.save),
		clearedActiveGame: campaign.cleared,
		clearedActiveDailyGame: daily.cleared,
		reason: cleared ? reason : undefined,
	}
}
