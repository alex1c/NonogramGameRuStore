/**
 * Russian plural helper tests.
 */

import {
	formatAchievementCount,
	formatDayPlural,
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

	it('handles day forms', () => {
		expect(formatDayPlural(1)).toBe('1 день')
		expect(formatDayPlural(2)).toBe('2 дня')
		expect(formatDayPlural(5)).toBe('5 дней')
		expect(formatDayPlural(21)).toBe('21 день')
	})
})
