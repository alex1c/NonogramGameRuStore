/**
 * Yandex Mobile Ads service wrapper.
 * Screens never import SDK types — only this module and BannerSlot.
 */

import {
	InterstitialAdLoader,
	MobileAds,
	RewardedAdLoader,
	type InterstitialAd,
	type RewardedAd,
} from 'yandex-mobile-ads'
import { AD_UNIT_IDS } from './config'
import {
	canShowInterstitial,
	createInterstitialPolicyState,
	recordInterstitialShown,
	recordPuzzleCompleted,
	type InterstitialPolicyState,
} from './policy'
import { createRewardGrantGuard } from './rewardedPolicy'

let adsInitialized = false
let interstitialLoader: InterstitialAdLoader | null = null
let loadedInterstitial: InterstitialAd | null = null
let interstitialLoading = false
let interstitialShowing = false
let interstitialPolicy: InterstitialPolicyState = createInterstitialPolicyState()
let rewardedLoading = false

/** Initialize Mobile Ads once; failures never throw to callers. */
export function initializeAds(): void {
	if (adsInitialized) {
		return
	}
	adsInitialized = true
	try {
		const result = MobileAds.initialize()
		if (result && typeof (result as Promise<unknown>).catch === 'function') {
			void (result as Promise<unknown>).catch(() => undefined)
		}
	} catch {
		// Missing/failed ad service must never block gameplay.
	}
}

export async function preloadInterstitial(): Promise<void> {
	if (interstitialLoading || loadedInterstitial !== null) {
		return
	}
	interstitialLoading = true
	try {
		interstitialLoader ??= await InterstitialAdLoader.create()
		loadedInterstitial = await interstitialLoader.loadAd({
			adUnitId: AD_UNIT_IDS.interstitial,
		})
	} catch {
		loadedInterstitial = null
	} finally {
		interstitialLoading = false
	}
}

/**
 * Record a production completion, then optionally show a cached interstitial
 * only at a natural post-completion navigation boundary.
 * Never blocks the caller — failures resolve as false immediately.
 */
export async function maybeShowInterstitialAfterCompletion(options: {
	readonly isTutorial: boolean
	readonly now?: number
}): Promise<boolean> {
	const now = options.now ?? Date.now()
	interstitialPolicy = recordPuzzleCompleted(
		interstitialPolicy,
		options.isTutorial,
	)

	if (
		!canShowInterstitial(interstitialPolicy, {
			isTutorial: options.isTutorial,
			naturalBoundary: true,
			now,
		}) ||
		loadedInterstitial === null ||
		interstitialShowing
	) {
		void preloadInterstitial()
		return false
	}

	const ad = loadedInterstitial
	loadedInterstitial = null
	interstitialShowing = true
	// Cap consumes only on successful show attempt start; failed show still
	// counts as "shownThisSession" attempt to avoid retry spam — ForestMusic
	// WaterSort marks before show. Keep same: successful show path only.
	interstitialPolicy = recordInterstitialShown(interstitialPolicy, now)
	try {
		await ad.show()
		return true
	} catch {
		return false
	} finally {
		interstitialShowing = false
		void preloadInterstitial()
	}
}

/**
 * Rewarded infrastructure. UI is deferred while free Hint remains unlimited.
 * Grant only via verified onRewarded callback.
 */
export async function showRewarded(
	onRewardGranted: () => void,
): Promise<'granted' | 'dismissed' | 'unavailable'> {
	if (rewardedLoading) {
		return 'unavailable'
	}
	rewardedLoading = true
	try {
		const loader = await RewardedAdLoader.create()
		const ad: RewardedAd = await loader.loadAd({
			adUnitId: AD_UNIT_IDS.rewarded,
		})
		const guard = createRewardGrantGuard(onRewardGranted)
		ad.onRewarded = () => {
			guard.onVerifiedReward()
		}
		ad.onAdDismissed = () => {
			guard.onDismissed()
		}
		ad.onAdFailedToShow = () => {
			guard.onDismissed()
		}
		await ad.show()
		return guard.hasGranted() ? 'granted' : 'dismissed'
	} catch {
		return 'unavailable'
	} finally {
		rewardedLoading = false
	}
}

/** Test / DEV helper — replace policy state without touching SDK. */
export function __setInterstitialPolicyForTests(
	state: InterstitialPolicyState,
): void {
	interstitialPolicy = state
}

export function __getInterstitialPolicyForTests(): InterstitialPolicyState {
	return interstitialPolicy
}
