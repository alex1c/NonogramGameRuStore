/**
 * Difficulty analyzer tests.
 */

import { analyzeDifficulty, analyzeDifficultySpec } from '../analyzer'
import {
	CALIBRATION_BEGINNER,
	CALIBRATION_EASY,
	CALIBRATION_EXPERT,
	CALIBRATION_HARD,
	CALIBRATION_MEDIUM,
	CALIBRATION_ORDERED,
} from '../../../tests/fixtures/difficultyCalibration'
import {
	FIXTURE_F_AMBIGUOUS,
	FIXTURE_G_IMPOSSIBLE,
	FIXTURE_I_STALLED_UNIQUE,
} from '../../../tests/fixtures/nonogramFixtures'

describe('analyzeDifficulty', () => {
	it('is deterministic for the same puzzle', () => {
		const a = analyzeDifficulty(CALIBRATION_MEDIUM)
		const b = analyzeDifficulty(CALIBRATION_MEDIUM)
		expect(a).toEqual(b)
	})

	it('rates invalid / stalled / ambiguous as UNRATED', () => {
		expect(analyzeDifficultySpec(FIXTURE_G_IMPOSSIBLE).tier).toBe('UNRATED')
		expect(analyzeDifficultySpec(FIXTURE_F_AMBIGUOUS).tier).toBe('UNRATED')
		expect(analyzeDifficulty(FIXTURE_I_STALLED_UNIQUE).tier).toBe('UNRATED')
		expect(analyzeDifficulty(FIXTURE_I_STALLED_UNIQUE).score).toBeNull()
	})

	it('does not call STALLED an EXPERT puzzle', () => {
		const result = analyzeDifficulty(FIXTURE_I_STALLED_UNIQUE)
		expect(result.tier).toBe('UNRATED')
		expect(result.notes.toLowerCase()).toContain('stalled')
	})

	it('assigns expected calibration tiers under phase2-v1', () => {
		expect(analyzeDifficulty(CALIBRATION_BEGINNER).tier).toBe('BEGINNER')
		expect(analyzeDifficulty(CALIBRATION_EASY).tier).toBe('EASY')
		expect(analyzeDifficulty(CALIBRATION_MEDIUM).tier).toBe('MEDIUM')
		expect(analyzeDifficulty(CALIBRATION_HARD).tier).toBe('HARD')
		expect(analyzeDifficulty(CALIBRATION_EXPERT).tier).toBe('EXPERT')
	})

	it('keeps calibration scores strictly increasing', () => {
		const scores = CALIBRATION_ORDERED.map(
			(puzzle) => analyzeDifficulty(puzzle).score,
		)
		for (const score of scores) {
			expect(score).not.toBeNull()
		}
		for (let i = 1; i < scores.length; i += 1) {
			expect(scores[i]!).toBeGreaterThan(scores[i - 1]!)
		}
	})
})
