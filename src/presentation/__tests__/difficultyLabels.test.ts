/**
 * Russian difficulty presentation mapping tests.
 */

import { DIFFICULTY_TIERS } from '../../domain/difficulty/tiers'
import { difficultyLabelRu } from '../difficultyLabels'

describe('difficultyLabelRu', () => {
	it('maps every production tier to Russian copy', () => {
		expect(difficultyLabelRu('BEGINNER')).toBe('Новичок')
		expect(difficultyLabelRu('EASY')).toBe('Легко')
		expect(difficultyLabelRu('MEDIUM')).toBe('Средне')
		expect(difficultyLabelRu('HARD')).toBe('Сложно')
		expect(difficultyLabelRu('EXPERT')).toBe('Эксперт')
	})

	it('covers all DIFFICULTY_TIERS without falling through', () => {
		for (const tier of DIFFICULTY_TIERS) {
			const label = difficultyLabelRu(tier)
			expect(label.length).toBeGreaterThan(0)
			expect(label).not.toBe(tier)
		}
	})

	it('does not expose UNRATED as an English token', () => {
		expect(difficultyLabelRu('UNRATED')).toBe('—')
	})
})
