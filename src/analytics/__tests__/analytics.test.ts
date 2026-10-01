/**
 * Phase 9 — AppMetrica event contract tests (no real SDK).
 */

import AppMetrica from '@appmetrica/react-native-analytics'
import {
	__isAnalyticsInitializedForTests,
	__resetAnalyticsForTests,
	buildAnalyticsEvent,
	initializeAnalytics,
	trackEvent,
} from '../index'

describe('analytics contract', () => {
	beforeEach(() => {
		__resetAnalyticsForTests()
		jest.clearAllMocks()
	})

	it('activates once', () => {
		initializeAnalytics()
		initializeAnalytics()
		expect(AppMetrica.activate).toHaveBeenCalledTimes(1)
		expect(__isAnalyticsInitializedForTests()).toBe(true)
	})

	it('strips unknown parameters and never accepts board payloads', () => {
		const event = buildAnalyticsEvent('puzzle_complete', {
			mode: 'campaign',
			puzzleId: 'p1',
			solution: [[1, 0]],
			width: 10,
			height: 10,
			hintsUsed: 1,
			isFirstCompletion: true,
			elapsedSec: 42,
		})
		expect(event.parameters).toEqual({
			mode: 'campaign',
			puzzleId: 'p1',
			width: 10,
			height: 10,
			hintsUsed: 1,
			isFirstCompletion: true,
			elapsedSec: 42,
		})
		expect(event.parameters).not.toHaveProperty('solution')
	})

	it('trackEvent is failure-safe', () => {
		;(AppMetrica.reportEvent as jest.Mock).mockImplementationOnce(() => {
			throw new Error('native down')
		})
		expect(() => trackEvent('app_open')).not.toThrow()
	})
})
