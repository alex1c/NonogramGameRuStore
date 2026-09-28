/**
 * Russian plural helper tests.
 */

import {
	formatAchievementCount,
	russianPlural,
} from '../russianPlural'

describe('russianPlural', () => {
	it('handles achievement forms', () => {
		expect(russianPlural(1, 'achievement')).toBe('достижение')
		expect(russianPlural(2, 'achievement')).toBe('достижения')
		expect(russianPlural(5, 'achievement')).toBe('достижений')
		expect(russianPlural(11, 'achievement')).toBe('достижений')
		expect(russianPlural(21, 'achievement')).toBe('достижение')
		expect(formatAchievementCount(3)).toBe('3 достижения')
	})
})
