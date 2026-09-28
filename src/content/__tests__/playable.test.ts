/**
 * Game open must go through production catalog gate.
 */

import {
	getProductionPuzzleById,
	getHomePlayablePuzzles,
} from '../../content/playable'
import { validateProductionPuzzle } from '../../solver/validator'

describe('playable content gate', () => {
	it('returns null for unknown ids', () => {
		expect(getProductionPuzzleById('does-not-exist')).toBeNull()
	})

	it('only exposes productionReady puzzles on Home', () => {
		const puzzles = getHomePlayablePuzzles()
		expect(puzzles.length).toBeGreaterThan(0)
		for (const puzzle of puzzles) {
			expect(validateProductionPuzzle(puzzle).productionReady).toBe(true)
		}
	})
})
