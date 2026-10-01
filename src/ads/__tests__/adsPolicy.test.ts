/**
 * Phase 9 — interstitial policy + rewarded grant guard unit tests.
 */

import {
	canShowInterstitial,
	createInterstitialPolicyState,
	INTERSTITIAL_POLICY,
	recordInterstitialShown,
	recordPuzzleCompleted,
} from '../policy'
import { createRewardGrantGuard } from '../rewardedPolicy'
import {
	AD_UNIT_IDS,
	BANNER_UNIT_BY_PLACEMENT,
	REWARDED_USER_FACING_ENABLED,
} from '../config'

describe('ads config', () => {
	it('maps production banner placements to exact РСЯ IDs', () => {
		expect(BANNER_UNIT_BY_PLACEMENT.game).toBe('R-M-20146030-1')
		expect(BANNER_UNIT_BY_PLACEMENT.home_levels).toBe('R-M-20146030-2')
		expect(BANNER_UNIT_BY_PLACEMENT.information).toBe('R-M-20146030-3')
		expect(AD_UNIT_IDS.interstitial).toBe('R-M-20146030-4')
		expect(AD_UNIT_IDS.rewarded).toBe('R-M-20146030-5')
	})

	it('defers user-facing rewarded while free Hint remains unlimited', () => {
		expect(REWARDED_USER_FACING_ENABLED).toBe(false)
	})
})

describe('interstitial policy', () => {
	const t0 = 1_000_000

	it('blocks tutorial and non-natural boundaries', () => {
		let state = createInterstitialPolicyState(t0)
		for (let i = 0; i < 5; i += 1) {
			state = recordPuzzleCompleted(state, false)
		}
		const later = t0 + INTERSTITIAL_POLICY.minimumIntervalMs + 1
		expect(
			canShowInterstitial(state, {
				isTutorial: true,
				naturalBoundary: true,
				now: later,
			}),
		).toBe(false)
		expect(
			canShowInterstitial(state, {
				isTutorial: false,
				naturalBoundary: false,
				now: later,
			}),
		).toBe(false)
	})

	it('requires 5 completions, 5 minutes session age, max 1/session', () => {
		let state = createInterstitialPolicyState(t0)
		const later = t0 + INTERSTITIAL_POLICY.minimumIntervalMs + 1
		expect(
			canShowInterstitial(state, {
				isTutorial: false,
				naturalBoundary: true,
				now: later,
			}),
		).toBe(false)

		for (let i = 0; i < 4; i += 1) {
			state = recordPuzzleCompleted(state, false)
		}
		expect(
			canShowInterstitial(state, {
				isTutorial: false,
				naturalBoundary: true,
				now: later,
			}),
		).toBe(false)

		state = recordPuzzleCompleted(state, false)
		expect(
			canShowInterstitial(state, {
				isTutorial: false,
				naturalBoundary: true,
				now: later,
			}),
		).toBe(true)

		state = recordInterstitialShown(state, later)
		expect(
			canShowInterstitial(state, {
				isTutorial: false,
				naturalBoundary: true,
				now: later + INTERSTITIAL_POLICY.minimumIntervalMs * 2,
			}),
		).toBe(false)
	})

	it('does not count tutorial completions', () => {
		let state = createInterstitialPolicyState(t0)
		for (let i = 0; i < 10; i += 1) {
			state = recordPuzzleCompleted(state, true)
		}
		expect(state.completedPuzzles).toBe(0)
	})
})

describe('reward grant guard', () => {
	it('grants once only from verified callback', () => {
		let grants = 0
		const guard = createRewardGrantGuard(() => {
			grants += 1
		})
		expect(guard.onVerifiedReward()).toBe(true)
		expect(guard.onVerifiedReward()).toBe(false)
		guard.onDismissed()
		expect(grants).toBe(1)
		expect(guard.hasGranted()).toBe(true)
	})
})
