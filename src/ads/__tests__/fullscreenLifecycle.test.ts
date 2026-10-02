/**
 * Regression tests for yandex-mobile-ads@8.5.0 fullscreen lifecycle.
 * Mocks reflect real SDK: show() does not settle the app operation.
 */

import {
	__bumpFullscreenOperationSerialForTests,
	runInterstitialLifecycle,
	runRewardedLifecycle,
	type FullscreenAdHandle,
	type RewardedAdHandle,
} from '../fullscreenLifecycle'

function createMockInterstitial(): FullscreenAdHandle & {
	triggerDismiss: () => void
	triggerFail: () => void
	showCalls: number
} {
	let dismiss: (() => void) | null = null
	let fail: ((error?: unknown) => void) | null = null
	const state = { showCalls: 0 }
	return {
		get showCalls() {
			return state.showCalls
		},
		set onAdDismissed(fn: (() => void) | null | undefined) {
			dismiss = fn ?? null
		},
		get onAdDismissed() {
			return dismiss ?? undefined
		},
		set onAdFailedToShow(fn: ((error?: unknown) => void) | null | undefined) {
			fail = fn ?? null
		},
		get onAdFailedToShow() {
			return fail ?? undefined
		},
		show: async () => {
			state.showCalls += 1
			await new Promise(() => undefined)
		},
		triggerDismiss: () => dismiss?.(),
		triggerFail: () => fail?.(),
	}
}

function createMockRewarded(): RewardedAdHandle & {
	triggerReward: () => void
	triggerDismiss: () => void
	triggerFail: () => void
	showCalls: number
} {
	let reward: ((r?: unknown) => void) | null = null
	let dismiss: (() => void) | null = null
	let fail: ((error?: unknown) => void) | null = null
	const state = { showCalls: 0 }
	return {
		get showCalls() {
			return state.showCalls
		},
		set onRewarded(fn: ((reward?: unknown) => void) | null | undefined) {
			reward = fn ?? null
		},
		get onRewarded() {
			return reward ?? undefined
		},
		set onAdDismissed(fn: (() => void) | null | undefined) {
			dismiss = fn ?? null
		},
		get onAdDismissed() {
			return dismiss ?? undefined
		},
		set onAdFailedToShow(fn: ((error?: unknown) => void) | null | undefined) {
			fail = fn ?? null
		},
		get onAdFailedToShow() {
			return fail ?? undefined
		},
		show: async () => {
			state.showCalls += 1
			await new Promise(() => undefined)
		},
		triggerReward: () => reward?.(),
		triggerDismiss: () => dismiss?.(),
		triggerFail: () => fail?.(),
	}
}

describe('fullscreen ad lifecycle (C1)', () => {
	it('does not settle interstitial from show() alone', async () => {
		const ad = createMockInterstitial()
		let settled = false
		const pending = runInterstitialLifecycle(ad).then((outcome) => {
			settled = true
			return outcome
		})
		await Promise.resolve()
		expect(ad.showCalls).toBe(1)
		expect(settled).toBe(false)
		ad.triggerDismiss()
		await expect(pending).resolves.toBe('shown_and_dismissed')
		expect(settled).toBe(true)
	})

	it('settles interstitial on failure without hanging', async () => {
		const ad = createMockInterstitial()
		const pending = runInterstitialLifecycle(ad)
		ad.triggerFail()
		await expect(pending).resolves.toBe('failed')
	})

	it('rewarded: reward then dismiss → rewarded_and_dismissed once', async () => {
		const ad = createMockRewarded()
		let grants = 0
		const pending = runRewardedLifecycle(ad, () => {
			grants += 1
		})
		await Promise.resolve()
		expect(grants).toBe(0)
		ad.triggerReward()
		ad.triggerReward() // duplicate SDK callback
		expect(grants).toBe(1)
		ad.triggerDismiss()
		ad.triggerDismiss()
		await expect(pending).resolves.toBe('rewarded_and_dismissed')
		expect(grants).toBe(1)
	})

	it('rewarded: dismiss without reward → dismissed_without_reward', async () => {
		const ad = createMockRewarded()
		let grants = 0
		const pending = runRewardedLifecycle(ad, () => {
			grants += 1
		})
		ad.triggerDismiss()
		await expect(pending).resolves.toBe('dismissed_without_reward')
		expect(grants).toBe(0)
	})

	it('rewarded: failure → failed, zero grants', async () => {
		const ad = createMockRewarded()
		let grants = 0
		const pending = runRewardedLifecycle(ad, () => {
			grants += 1
		})
		ad.triggerFail()
		await expect(pending).resolves.toBe('failed')
		expect(grants).toBe(0)
	})

	it('stale events from previous ad cannot settle a newer operation', async () => {
		const first = createMockRewarded()
		const firstPending = runRewardedLifecycle(first, () => undefined)
		__bumpFullscreenOperationSerialForTests()
		const second = createMockRewarded()
		const secondPending = runRewardedLifecycle(second, () => undefined)
		first.triggerReward()
		first.triggerDismiss()
		// First op was superseded — its promise must not resolve as success for us
		// to await forever; settle second instead.
		second.triggerDismiss()
		await expect(secondPending).resolves.toBe('dismissed_without_reward')
		// Ensure first never resolved with a usable outcome after bump.
		let firstSettled = false
		void firstPending.then(() => {
			firstSettled = true
		})
		await Promise.resolve()
		expect(firstSettled).toBe(false)
	})
})
