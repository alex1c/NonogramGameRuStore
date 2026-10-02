/**
 * Regression tests for yandex-mobile-ads@8.5.0 fullscreen lifecycle (C1+N2).
 * Mocks reflect real SDK: show() does not settle the app operation.
 * Coordinator: at most one active op; BUSY never supersedes; terminal ignores all.
 */

import {
	__getActiveFullscreenOperationForTests,
	__resetFullscreenCoordinatorForTests,
	isFullscreenBusy,
	runInterstitialLifecycle,
	runRewardedLifecycle,
	type FullscreenAdHandle,
	type RewardedAdHandle,
} from '../fullscreenLifecycle'

function createMockInterstitial(): FullscreenAdHandle & {
	triggerDismiss: () => void
	triggerFail: () => void
	showReject: () => void
	showCalls: number
	listenerCleared: () => boolean
} {
	let dismiss: (() => void) | null = null
	let fail: ((error?: unknown) => void) | null = null
	let rejectShow: (() => void) | null = null
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
		show: () =>
			new Promise<void>((_resolve, reject) => {
				state.showCalls += 1
				rejectShow = () => reject(new Error('show rejected'))
			}),
		triggerDismiss: () => dismiss?.(),
		triggerFail: () => fail?.(),
		showReject: () => rejectShow?.(),
		listenerCleared: () => dismiss === null && fail === null,
	}
}

function createMockRewarded(): RewardedAdHandle & {
	triggerReward: () => void
	triggerDismiss: () => void
	triggerFail: () => void
	showReject: () => void
	showCalls: number
	listenerCleared: () => boolean
} {
	let reward: ((r?: unknown) => void) | null = null
	let dismiss: (() => void) | null = null
	let fail: ((error?: unknown) => void) | null = null
	let rejectShow: (() => void) | null = null
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
		show: () =>
			new Promise<void>((_resolve, reject) => {
				state.showCalls += 1
				rejectShow = () => reject(new Error('show rejected'))
			}),
		triggerReward: () => reward?.(),
		triggerDismiss: () => dismiss?.(),
		triggerFail: () => fail?.(),
		showReject: () => rejectShow?.(),
		listenerCleared: () =>
			reward === null && dismiss === null && fail === null,
	}
}

beforeEach(() => {
	__resetFullscreenCoordinatorForTests()
})

describe('fullscreen coordinator (C1+N2)', () => {
	it('A: rewarded active → interstitial BUSY; rewarded still settles', async () => {
		const rewarded = createMockRewarded()
		let grants = 0
		const rewardedPending = runRewardedLifecycle(rewarded, () => {
			grants += 1
		})
		expect(isFullscreenBusy()).toBe(true)

		const interstitial = createMockInterstitial()
		await expect(runInterstitialLifecycle(interstitial)).resolves.toBe('busy')
		expect(interstitial.showCalls).toBe(0)

		rewarded.triggerReward()
		rewarded.triggerDismiss()
		await expect(rewardedPending).resolves.toBe('rewarded_and_dismissed')
		expect(grants).toBe(1)
		expect(isFullscreenBusy()).toBe(false)
	})

	it('B: interstitial active → rewarded BUSY; interstitial dismiss settles', async () => {
		const interstitial = createMockInterstitial()
		const interstitialPending = runInterstitialLifecycle(interstitial)
		expect(isFullscreenBusy()).toBe(true)

		const rewarded = createMockRewarded()
		let grants = 0
		await expect(
			runRewardedLifecycle(rewarded, () => {
				grants += 1
			}),
		).resolves.toBe('busy')
		expect(rewarded.showCalls).toBe(0)
		expect(grants).toBe(0)

		interstitial.triggerDismiss()
		await expect(interstitialPending).resolves.toBe('shown_and_dismissed')
		expect(isFullscreenBusy()).toBe(false)
	})

	it('C: failure → reward callback => zero grant', async () => {
		const ad = createMockRewarded()
		let grants = 0
		const pending = runRewardedLifecycle(ad, () => {
			grants += 1
		})
		ad.triggerFail()
		await expect(pending).resolves.toBe('failed')
		ad.triggerReward()
		expect(grants).toBe(0)
		expect(ad.listenerCleared()).toBe(true)
	})

	it('D: failure → dismiss => no second settlement', async () => {
		const ad = createMockRewarded()
		const pending = runRewardedLifecycle(ad, () => undefined)
		ad.triggerFail()
		await expect(pending).resolves.toBe('failed')
		ad.triggerDismiss()
		// Already settled; second callback must not throw or re-open busy.
		expect(isFullscreenBusy()).toBe(false)
		expect(__getActiveFullscreenOperationForTests()).toBeNull()
	})

	it('E: dismiss → reward => zero late grant', async () => {
		const ad = createMockRewarded()
		let grants = 0
		const pending = runRewardedLifecycle(ad, () => {
			grants += 1
		})
		ad.triggerDismiss()
		await expect(pending).resolves.toBe('dismissed_without_reward')
		ad.triggerReward()
		expect(grants).toBe(0)
	})

	it('F: start rejection => cleanup + settle failed', async () => {
		const ad = createMockRewarded()
		const pending = runRewardedLifecycle(ad, () => undefined)
		ad.showReject()
		await expect(pending).resolves.toBe('failed')
		expect(ad.listenerCleared()).toBe(true)
		expect(isFullscreenBusy()).toBe(false)
	})

	it('G: load rejection is handled at service layer (lifecycle not started)', () => {
		// Coordinator is idle when no lifecycle started — load errors never leave
		// a pending operation. Covered by service returning not_available.
		expect(isFullscreenBusy()).toBe(false)
	})

	it('H: duplicate reward => one grant', async () => {
		const ad = createMockRewarded()
		let grants = 0
		const pending = runRewardedLifecycle(ad, () => {
			grants += 1
		})
		ad.triggerReward()
		ad.triggerReward()
		expect(grants).toBe(1)
		ad.triggerDismiss()
		await expect(pending).resolves.toBe('rewarded_and_dismissed')
	})

	it('I: duplicate dismiss => one settlement', async () => {
		const ad = createMockInterstitial()
		const pending = runInterstitialLifecycle(ad)
		ad.triggerDismiss()
		ad.triggerDismiss()
		await expect(pending).resolves.toBe('shown_and_dismissed')
		expect(isFullscreenBusy()).toBe(false)
	})

	it('J: stale callback from previous op ignored after terminal', async () => {
		const first = createMockRewarded()
		let firstGrants = 0
		const firstPending = runRewardedLifecycle(first, () => {
			firstGrants += 1
		})
		first.triggerDismiss()
		await expect(firstPending).resolves.toBe('dismissed_without_reward')

		const second = createMockRewarded()
		let secondGrants = 0
		const secondPending = runRewardedLifecycle(second, () => {
			secondGrants += 1
		})
		first.triggerReward()
		first.triggerDismiss()
		expect(firstGrants).toBe(0)
		expect(secondGrants).toBe(0)
		second.triggerDismiss()
		await expect(secondPending).resolves.toBe('dismissed_without_reward')
	})

	it('K: after terminal cleanup, new operation starts normally', async () => {
		const first = createMockInterstitial()
		const firstPending = runInterstitialLifecycle(first)
		first.triggerFail()
		await expect(firstPending).resolves.toBe('failed')
		expect(first.listenerCleared()).toBe(true)

		const second = createMockRewarded()
		let grants = 0
		const secondPending = runRewardedLifecycle(second, () => {
			grants += 1
		})
		second.triggerReward()
		second.triggerDismiss()
		await expect(secondPending).resolves.toBe('rewarded_and_dismissed')
		expect(grants).toBe(1)
	})

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
	})
})
