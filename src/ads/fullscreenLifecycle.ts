/**
 * Fullscreen ad lifecycle coordinator for yandex-mobile-ads@8.5.0.
 *
 * SDK contract:
 * - show() may reject on start error; successful display does NOT settle when
 *   the user finishes the ad.
 * - Outcomes arrive via onAdDismissed / onAdFailedToShow / onRewarded.
 *
 * Application contract (Phase 9D / C1+N2):
 * - At most ONE active fullscreen operation (interstitial OR rewarded).
 * - Starting a second request returns BUSY — it never supersedes the first.
 * - Every operation settles exactly once, then cleans up listeners.
 * - After terminal, ALL later SDK callbacks are ignored (including reward).
 */

export type InterstitialOutcome =
	| 'shown_and_dismissed'
	| 'failed'
	| 'not_available'
	| 'busy'

export type RewardedOutcome =
	| 'rewarded_and_dismissed'
	| 'dismissed_without_reward'
	| 'failed'
	| 'not_available'
	| 'busy'

export type FullscreenOpType = 'interstitial' | 'rewarded'

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

interface ActiveFullscreenOperation {
	readonly operationId: number
	readonly type: FullscreenOpType
	terminal: boolean
	rewardSeen: boolean
	cleanup: () => void
}

let nextOperationId = 1
let activeOperation: ActiveFullscreenOperation | null = null

/** True while any fullscreen interstitial/rewarded operation is non-terminal. */
export function isFullscreenBusy(): boolean {
	return activeOperation !== null && !activeOperation.terminal
}

function clearActiveIf(operationId: number): void {
	if (activeOperation?.operationId === operationId) {
		activeOperation = null
	}
}

/**
 * Detach all SDK listeners so a terminal ad cannot affect a later operation.
 */
function detachListeners(ad: FullscreenAdHandle): void {
	ad.onAdDismissed = null
	ad.onAdFailedToShow = null
	if ('onRewarded' in ad) {
		;(ad as RewardedAdHandle).onRewarded = null
	}
}

/**
 * Show an interstitial and settle exactly once from dismiss/fail events.
 * Returns `busy` immediately when another fullscreen op is already active.
 */
export function runInterstitialLifecycle(
	ad: FullscreenAdHandle,
): Promise<InterstitialOutcome> {
	if (isFullscreenBusy()) {
		return Promise.resolve('busy')
	}

	const operationId = nextOperationId++
	const settler = createOnceSettler<InterstitialOutcome>()

	const finish = (value: InterstitialOutcome): void => {
		const op = activeOperation
		if (op === null || op.operationId !== operationId || op.terminal) {
			return
		}
		op.terminal = true
		op.cleanup()
		clearActiveIf(operationId)
		settler.settle(value)
	}

	const cleanup = (): void => {
		detachListeners(ad)
	}

	activeOperation = {
		operationId,
		type: 'interstitial',
		terminal: false,
		rewardSeen: false,
		cleanup,
	}

	ad.onAdDismissed = () => {
		finish('shown_and_dismissed')
	}
	ad.onAdFailedToShow = () => {
		finish('failed')
	}

	try {
		void ad.show().catch(() => {
			finish('failed')
		})
	} catch {
		finish('failed')
	}

	return settler.promise
}

/**
 * Show a rewarded ad. Reward is recorded via onRewardConfirmed (SDK onRewarded)
 * only while the operation is non-terminal. Promise settles on dismiss/fail.
 */
export function runRewardedLifecycle(
	ad: RewardedAdHandle,
	onRewardConfirmed: () => void,
): Promise<RewardedOutcome> {
	if (isFullscreenBusy()) {
		return Promise.resolve('busy')
	}

	const operationId = nextOperationId++
	const settler = createOnceSettler<RewardedOutcome>()

	const finish = (value: RewardedOutcome): void => {
		const op = activeOperation
		if (op === null || op.operationId !== operationId || op.terminal) {
			return
		}
		op.terminal = true
		op.cleanup()
		clearActiveIf(operationId)
		settler.settle(value)
	}

	const cleanup = (): void => {
		detachListeners(ad)
	}

	activeOperation = {
		operationId,
		type: 'rewarded',
		terminal: false,
		rewardSeen: false,
		cleanup,
	}

	ad.onRewarded = () => {
		const op = activeOperation
		// Terminal / wrong op / non-rewarded / already rewarded → ignore.
		if (
			op === null ||
			op.operationId !== operationId ||
			op.type !== 'rewarded' ||
			op.terminal ||
			op.rewardSeen
		) {
			return
		}
		op.rewardSeen = true
		onRewardConfirmed()
	}
	ad.onAdDismissed = () => {
		const op = activeOperation
		const rewarded =
			op !== null &&
			op.operationId === operationId &&
			op.rewardSeen
		finish(rewarded ? 'rewarded_and_dismissed' : 'dismissed_without_reward')
	}
	ad.onAdFailedToShow = () => {
		finish('failed')
	}

	try {
		void ad.show().catch(() => {
			finish('failed')
		})
	} catch {
		finish('failed')
	}

	return settler.promise
}

/** Test helper — force-clear coordinator so suites stay isolated. */
export function __resetFullscreenCoordinatorForTests(): void {
	if (activeOperation !== null && !activeOperation.terminal) {
		activeOperation.terminal = true
		activeOperation.cleanup()
	}
	activeOperation = null
}

/** @deprecated Use __resetFullscreenCoordinatorForTests — supersede is gone. */
export function __bumpFullscreenOperationSerialForTests(): void {
	__resetFullscreenCoordinatorForTests()
}

export function __getFullscreenOperationSerialForTests(): number {
	return activeOperation?.operationId ?? nextOperationId
}

export function __getActiveFullscreenOperationForTests(): {
	readonly operationId: number
	readonly type: FullscreenOpType
	readonly terminal: boolean
	readonly rewardSeen: boolean
} | null {
	if (activeOperation === null) {
		return null
	}
	return {
		operationId: activeOperation.operationId,
		type: activeOperation.type,
		terminal: activeOperation.terminal,
		rewardSeen: activeOperation.rewardSeen,
	}
}
