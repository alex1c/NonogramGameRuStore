/**
 * Banner layout contract tests — no absolute overlay; collapse on failure;
 * placement map and tutorial isolation unchanged.
 */

import { resolveBannerHostHeight, BANNER_SLOT_HEIGHT } from '../BannerSlot'
import {
	BANNER_UNIT_BY_PLACEMENT,
	AD_UNIT_IDS,
	REWARDED_USER_FACING_ENABLED,
} from '../../ads/config'
import { placementForShellRoute } from '../../navigation/bannerPlacement'

describe('banner host height strategy', () => {
	it('collapses when idle or failed (no giant blank)', () => {
		expect(
			resolveBannerHostHeight({ loadState: 'idle', measuredHeight: null }),
		).toBe(0)
		expect(
			resolveBannerHostHeight({ loadState: 'failed', measuredHeight: 50 }),
		).toBe(0)
	})

	it('reserves minimal height while loading after size is known', () => {
		expect(
			resolveBannerHostHeight({ loadState: 'loading', measuredHeight: null }),
		).toBe(0)
		expect(
			resolveBannerHostHeight({ loadState: 'loading', measuredHeight: 64 }),
		).toBe(BANNER_SLOT_HEIGHT)
	})

	it('uses measured sticky height when ready', () => {
		expect(
			resolveBannerHostHeight({ loadState: 'ready', measuredHeight: 64 }),
		).toBe(64)
		expect(
			resolveBannerHostHeight({ loadState: 'ready', measuredHeight: null }),
		).toBe(BANNER_SLOT_HEIGHT)
	})
})

describe('banner placement map unchanged', () => {
	it('keeps production РСЯ IDs', () => {
		expect(BANNER_UNIT_BY_PLACEMENT.game).toBe('R-M-20146030-1')
		expect(BANNER_UNIT_BY_PLACEMENT.home_levels).toBe('R-M-20146030-2')
		expect(BANNER_UNIT_BY_PLACEMENT.information).toBe('R-M-20146030-3')
		expect(AD_UNIT_IDS.interstitial).toBe('R-M-20146030-4')
		expect(AD_UNIT_IDS.rewarded).toBe('R-M-20146030-5')
		expect(REWARDED_USER_FACING_ENABLED).toBe(true)
	})

	it('maps shell routes without putting banner on tutorial/game', () => {
		expect(placementForShellRoute('home')).toBe('home_levels')
		expect(placementForShellRoute('levels')).toBe('home_levels')
		expect(placementForShellRoute('gallery')).toBe('information')
		expect(placementForShellRoute('galleryCollection')).toBe('information')
		expect(placementForShellRoute('achievements')).toBe('information')
		expect(placementForShellRoute('statistics')).toBe('information')
		expect(placementForShellRoute('settings')).toBe('information')
		expect(placementForShellRoute('about')).toBe('information')
		expect(placementForShellRoute('daily')).toBe('information')
		expect(placementForShellRoute('tutorial')).toBeNull()
		expect(placementForShellRoute('game')).toBeNull()
	})
})
