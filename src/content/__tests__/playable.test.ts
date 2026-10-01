/**
 * Game open must go through production catalog gate (B1000 + lazy decode).
 */

import {
	getProductionPuzzleById,
	getHomePlayablePuzzles,
	resolvePlayablePuzzleById,
} from '../../content/playable'
import { LEGACY_DEVELOPMENT_PUZZLE_IDS } from '../../content/legacyCatalog'
import { PRODUCTION_PUZZLE_COUNT } from '../../content/runtime'
import { CAMPAIGN_ENTRIES } from '../../campaign/definition'

describe('playable content gate', () => {
	it('returns null for unknown ids', () => {
		expect(getProductionPuzzleById('does-not-exist')).toBeNull()
	})

	it('exposes production B1000 puzzles without eager full catalog', () => {
		expect(PRODUCTION_PUZZLE_COUNT).toBe(1000)
		const sample = getProductionPuzzleById(CAMPAIGN_ENTRIES[0]!.puzzleId)
		expect(sample).not.toBeNull()
		expect(sample!.width).toBeGreaterThan(0)
	})

	it('resolves legacy development IDs for compatibility only', () => {
		expect(LEGACY_DEVELOPMENT_PUZZLE_IDS.length).toBe(21)
		const legacy = resolvePlayablePuzzleById('mini-beginner-bar')
		expect(legacy?.id).toBe('mini-beginner-bar')
		expect(getProductionPuzzleById('mini-beginner-bar')).toBeNull()
	})

	it('Home shortcuts are empty under B1000 (Sets UX replaces them)', () => {
		expect(getHomePlayablePuzzles()).toEqual([])
	})
})
