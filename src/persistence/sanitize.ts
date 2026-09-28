/**
 * Sanitize a loaded save against the current production catalog.
 * Unknown completed IDs are kept; invalid active games are cleared.
 */

import { getProductionPuzzleById } from '../content/playable'
import { buildPuzzleContentFingerprint } from './fingerprint'
import type { SaveRoot } from './schema'
import { clearActiveGame } from './progressReducers'
import { freezeSave } from './validate'

export interface SanitizeResult {
	readonly save: SaveRoot
	readonly clearedActiveGame: boolean
	readonly reason?: string
}

/**
 * After migrate/validate, ensure the active party is still openable.
 */
export function sanitizeSaveAgainstCatalog(save: SaveRoot): SanitizeResult {
	const active = save.activeGame
	if (active === null) {
		return { save, clearedActiveGame: false }
	}

	const puzzle = getProductionPuzzleById(active.puzzleId)
	if (puzzle === null) {
		return {
			save: clearActiveGame(save),
			clearedActiveGame: true,
			reason: `Active puzzle missing from catalog: ${active.puzzleId}`,
		}
	}

	const expected = buildPuzzleContentFingerprint(puzzle)
	if (expected !== active.contentFingerprint) {
		return {
			save: clearActiveGame(save),
			clearedActiveGame: true,
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
			clearedActiveGame: true,
			reason: `Active player dimensions mismatch for ${active.puzzleId}`,
		}
	}

	return { save: freezeSave(save), clearedActiveGame: false }
}
