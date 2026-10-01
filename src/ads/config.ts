/**
 * Centralized РСЯ (Yandex Mobile Ads) production block IDs.
 * Screens must never hardcode these literals.
 */

export const AD_UNIT_IDS = {
	/** Banner 1 — Game */
	gameBanner: 'R-M-20146030-1',
	/** Banner 2 — Home / Sets / Levels */
	homeLevelsBanner: 'R-M-20146030-2',
	/** Banner 3 — Gallery / Achievements / Statistics / Settings / About */
	informationBanner: 'R-M-20146030-3',
	/** Rare post-completion interstitial */
	interstitial: 'R-M-20146030-4',
	/** Voluntary rewarded — infrastructure ready; UI deferred in v1 */
	rewarded: 'R-M-20146030-5',
} as const

export type BannerPlacement = 'game' | 'home_levels' | 'information'

export const BANNER_UNIT_BY_PLACEMENT: Record<BannerPlacement, string> = {
	game: AD_UNIT_IDS.gameBanner,
	home_levels: AD_UNIT_IDS.homeLevelsBanner,
	information: AD_UNIT_IDS.informationBanner,
}

/**
 * Free Hint / Teach Me remain unlimited. Inventing scarcity solely to
 * monetize would be dishonest — keep rewarded infrastructure, defer CTA.
 */
export const REWARDED_USER_FACING_ENABLED = false

export function getBannerUnitId(placement: BannerPlacement): string {
	return BANNER_UNIT_BY_PLACEMENT[placement]
}
