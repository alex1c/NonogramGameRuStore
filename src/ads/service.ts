/**
 * Yandex Mobile Ads service wrapper.
 * Screens never import SDK types — only this module and BannerSlot.
 *
 * Fullscreen show() is lifecycle-event driven (see fullscreenLifecycle.ts).
 * Completions for interstitial eligibility are recorded separately from show.
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
	runInterstitialLifecycle,
	runRewardedLifecycle,
	type InterstitialOutcome,
	type RewardedOutcome,
} from './fullscreenLifecycle'
import {
	canShowInterstitial,
	createInterstitialPolicyState,
	recordInterstitialShown,
	recordPuzzleCompleted,
	type InterstitialPolicyState,
} from './policy'
import { createRewardGrantGuard } from './rewardedPolicy'
import { trackEvent } from '../analytics'

let adsInitialized = false
let interstitialLoader: InterstitialAdLoader | null = null
let loadedInterstitial: InterstitialAd | null = null
let interstitialLoading = false
let interstitialShowing = false
let interstitialPolicy: InterstitialPolicyState = createInterstitialPolicyState()
let rewardedLoading = false

/** Track completion runIds already counted toward interstitial eligibility. */
const countedCompletionRunIds = new Set<string>()

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
 * Record one confirmed production completion for interstitial eligibility.
 * Idempotent per runId — CTA presses must not increment.
 */
export function recordCompletionForAdPolicy(options: {
	readonly runId: string
	readonly isTutorial: boolean
}): void {
	if (options.isTutorial) {
		return
	}
	if (countedCompletionRunIds.has(options.runId)) {
		return
	}
	countedCompletionRunIds.add(options.runId)
	interstitialPolicy = recordPuzzleCompleted(interstitialPolicy, false)
}

/**
 * Optionally show a cached interstitial at a natural post-completion boundary.
 * Always settles — navigation must never hang on show().
 */
export async function maybeShowInterstitial(options: {
	readonly isTutorial: boolean
	readonly now?: number
}): Promise<InterstitialOutcome> {
	const now = options.now ?? Date.now()

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
		return 'not_available'
	}

	const ad = loadedInterstitial
	loadedInterstitial = null
	interstitialShowing = true
	try {
		const outcome = await runInterstitialLifecycle(ad)
		if (outcome === 'shown_and_dismissed') {
			interstitialPolicy = recordInterstitialShown(interstitialPolicy, now)
			trackEvent('interstitial_shown', {})
		}
		return outcome
	} finally {
		interstitialShowing = false
		void preloadInterstitial()
	}
}

/**
 * @deprecated Prefer recordCompletionForAdPolicy + maybeShowInterstitial.
 * Kept temporarily for call-site migration; still event-driven.
 */
export async function maybeShowInterstitialAfterCompletion(options: {
	readonly isTutorial: boolean
	readonly now?: number
	readonly runId?: string
}): Promise<boolean> {
	if (options.runId !== undefined) {
		recordCompletionForAdPolicy({
			runId: options.runId,
			isTutorial: options.isTutorial,
		})
	} else if (!options.isTutorial) {
		// Legacy path without runId — still count once per call (tests).
		interstitialPolicy = recordPuzzleCompleted(interstitialPolicy, false)
	}
	const outcome = await maybeShowInterstitial(options)
	return outcome === 'shown_and_dismissed'
}

/**
 * Show rewarded ad. Entitlement persistence belongs in onRewardConfirmed
 * (SDK onRewarded), not after await show().
 */
export async function showRewarded(
	onRewardConfirmed: () => void | Promise<void>,
): Promise<RewardedOutcome> {
	if (rewardedLoading) {
		return 'not_available'
	}
	rewardedLoading = true
	try {
		const loader = await RewardedAdLoader.create()
		const ad: RewardedAd = await loader.loadAd({
			adUnitId: AD_UNIT_IDS.rewarded,
		})
		const guard = createRewardGrantGuard(() => {
			void Promise.resolve(onRewardConfirmed())
		})
		const outcome = await runRewardedLifecycle(ad, () => {
			guard.onVerifiedReward()
		})
		return outcome
	} catch {
		return 'not_available'
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

export function __clearCountedCompletionRunIdsForTests(): void {
	countedCompletionRunIds.clear()
}
