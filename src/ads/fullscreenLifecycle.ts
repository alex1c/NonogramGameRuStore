/**
 * Fullscreen ad lifecycle adapter for yandex-mobile-ads@8.5.0.
 *
 * SDK contract (verified against RewardedAd.ts / InterstitialAd.ts):
 * - show() Promise rejects on start error; successful display does NOT mean
 *   the Promise settles when the user finishes the ad.
 * - Lifecycle outcomes arrive via onAdDismissed / onAdFailedToShow / onRewarded.
 *
 * Application code must settle app-level Promises from those events, never from
 * assuming await show() means "ad finished".
 */

export type InterstitialOutcome =
	| 'shown_and_dismissed'
	| 'failed'
	| 'not_available'

export type RewardedOutcome =
	| 'rewarded_and_dismissed'
	| 'dismissed_without_reward'
	| 'failed'
	| 'not_available'

/** Minimal surface required from Yandex RewardedAd / InterstitialAd. */
export interface FullscreenAdHandle {
	onAdDismissed: ((...args: never[]) => void) | null | undefined
	onAdFailedToShow: ((...args: never[]) => void) | null | undefined
	show: () => Promise<void>
}

export interface RewardedAdHandle extends FullscreenAdHandle {
	onRewarded: ((...args: never[]) => void) | null | undefined
}

interface OnceSettler<T> {
	readonly promise: Promise<T>
	settle: (value: T) => boolean
	isSettled: () => boolean
}

function createOnceSettler<T>(): OnceSettler<T> {
	let settled = false
	let resolveFn: ((value: T) => void) | null = null
	const promise = new Promise<T>((resolve) => {
		resolveFn = resolve
	})
	return {
		promise,
		settle(value: T): boolean {
			if (settled) {
				return false
			}
			settled = true
			resolveFn?.(value)
			return true
		},
		isSettled: () => settled,
	}
}

let operationSerial = 0

/**
 * Show an interstitial and settle exactly once from dismiss/fail events.
 * show() is started but not treated as completion.
 */
export function runInterstitialLifecycle(
	ad: FullscreenAdHandle,
): Promise<InterstitialOutcome> {
	const opId = ++operationSerial
	const settler = createOnceSettler<InterstitialOutcome>()

	const settleIfCurrent = (value: InterstitialOutcome): void => {
		if (opId !== operationSerial) {
			return
		}
		settler.settle(value)
	}

	ad.onAdDismissed = () => {
		settleIfCurrent('shown_and_dismissed')
	}
	ad.onAdFailedToShow = () => {
		settleIfCurrent('failed')
	}

	try {
		void ad.show().catch(() => {
			settleIfCurrent('failed')
		})
	} catch {
		settleIfCurrent('failed')
	}

	return settler.promise
}

/**
 * Show a rewarded ad. Reward is recorded via onRewardConfirmed (SDK onRewarded).
 * The returned Promise settles on dismiss/fail — never by awaiting show() alone.
 */
export function runRewardedLifecycle(
	ad: RewardedAdHandle,
	onRewardConfirmed: () => void,
): Promise<RewardedOutcome> {
	const opId = ++operationSerial
	const settler = createOnceSettler<RewardedOutcome>()
	let rewardSeen = false

	const settleIfCurrent = (value: RewardedOutcome): void => {
		if (opId !== operationSerial) {
			return
		}
		settler.settle(value)
	}

	ad.onRewarded = () => {
		if (opId !== operationSerial) {
			return
		}
		if (rewardSeen) {
			return
		}
		rewardSeen = true
		onRewardConfirmed()
	}
	ad.onAdDismissed = () => {
		settleIfCurrent(
			rewardSeen ? 'rewarded_and_dismissed' : 'dismissed_without_reward',
		)
	}
	ad.onAdFailedToShow = () => {
		settleIfCurrent('failed')
	}

	try {
		void ad.show().catch(() => {
			settleIfCurrent('failed')
		})
	} catch {
		settleIfCurrent('failed')
	}

	return settler.promise
}

/** Test helper — bump serial so stale callbacks cannot settle a newer op. */
export function __bumpFullscreenOperationSerialForTests(): void {
	operationSerial += 1
}

export function __getFullscreenOperationSerialForTests(): number {
	return operationSerial
}
