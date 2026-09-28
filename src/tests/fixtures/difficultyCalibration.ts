/**
 * Phase 2 difficulty calibration fixtures.
 * Tiers are expectations under phase2-v1 thresholds — preliminary.
 */

import {
	createPuzzleFromSolution,
	gridFromMatrix,
} from '../../domain/nonogram/clues'
import type { Puzzle } from '../../domain/nonogram/types'
import {
	FIXTURE_F_AMBIGUOUS,
	FIXTURE_G_IMPOSSIBLE,
	FIXTURE_I_STALLED_UNIQUE,
} from './nonogramFixtures'

export const CALIBRATION_BEGINNER: Puzzle = createPuzzleFromSolution({
	id: 'calib-beginner-bar',
	width: 5,
	height: 3,
	solution: gridFromMatrix([
		[0, 0, 0, 0, 0],
		[1, 1, 1, 1, 1],
		[0, 0, 0, 0, 0],
	]),
	metadata: { title: 'Calibration Beginner' },
})

export const CALIBRATION_EASY: Puzzle = createPuzzleFromSolution({
	id: 'calib-easy-stairs',
	width: 5,
	height: 5,
	solution: gridFromMatrix([
		[1, 0, 0, 0, 0],
		[1, 1, 0, 0, 0],
		[1, 1, 1, 0, 0],
		[1, 1, 1, 1, 0],
		[1, 1, 1, 1, 1],
	]),
	metadata: { title: 'Calibration Easy' },
})

export const CALIBRATION_MEDIUM: Puzzle = createPuzzleFromSolution({
	id: 'calib-medium-diamond',
	width: 7,
	height: 7,
	solution: gridFromMatrix([
		[0, 0, 0, 1, 0, 0, 0],
		[0, 0, 1, 1, 1, 0, 0],
		[0, 1, 1, 1, 1, 1, 0],
		[1, 1, 1, 1, 1, 1, 1],
		[0, 1, 1, 1, 1, 1, 0],
		[0, 0, 1, 1, 1, 0, 0],
		[0, 0, 0, 1, 0, 0, 0],
	]),
	metadata: { title: 'Calibration Medium' },
})

export const CALIBRATION_HARD: Puzzle = createPuzzleFromSolution({
	id: 'calib-hard-arrows',
	width: 9,
	height: 9,
	solution: gridFromMatrix([
		[0, 0, 0, 0, 1, 0, 0, 0, 0],
		[0, 0, 0, 1, 1, 1, 0, 0, 0],
		[0, 0, 1, 1, 1, 1, 1, 0, 0],
		[0, 0, 0, 0, 1, 0, 0, 0, 0],
		[1, 1, 1, 1, 1, 1, 1, 1, 1],
		[0, 0, 0, 0, 1, 0, 0, 0, 0],
		[0, 0, 1, 1, 1, 1, 1, 0, 0],
		[0, 0, 0, 1, 1, 1, 0, 0, 0],
		[0, 0, 0, 0, 1, 0, 0, 0, 0],
	]),
	metadata: { title: 'Calibration Hard' },
})

export const CALIBRATION_EXPERT: Puzzle = createPuzzleFromSolution({
	id: 'calib-expert-scatter',
	width: 10,
	height: 10,
	solution: gridFromMatrix([
		[1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
		[0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
		[1, 0, 1, 1, 0, 0, 1, 1, 0, 1],
		[0, 1, 1, 0, 1, 1, 0, 1, 1, 0],
		[1, 0, 0, 1, 0, 1, 0, 1, 0, 1],
		[0, 1, 1, 0, 1, 0, 1, 0, 1, 0],
		[1, 0, 1, 1, 0, 1, 1, 0, 0, 1],
		[0, 1, 0, 1, 1, 0, 0, 1, 1, 0],
		[1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
		[0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
	]),
	metadata: { title: 'Calibration Expert' },
})

export const CALIBRATION_ORDERED: readonly Puzzle[] = [
	CALIBRATION_BEGINNER,
	CALIBRATION_EASY,
	CALIBRATION_MEDIUM,
	CALIBRATION_HARD,
	CALIBRATION_EXPERT,
]

export {
	FIXTURE_F_AMBIGUOUS,
	FIXTURE_G_IMPOSSIBLE,
	FIXTURE_I_STALLED_UNIQUE,
}
