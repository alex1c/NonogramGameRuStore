/**
 * Home scroll contract — anchors that must remain reachable above Banner 2.
 */

import fs from 'node:fs'
import path from 'node:path'
import { placementForShellRoute } from '../../navigation/bannerPlacement'

export const HOME_SCROLL_ANCHOR_TEST_IDS = [
	'home-settings',
	'home-continue',
	'home-play',
	'home-daily',
	'home-levels',
	'home-statistics',
] as const

describe('Home scroll layout contract', () => {
	it('declares scroll host and reachable navigation anchors', () => {
		const homeSource = fs.readFileSync(
			path.join(__dirname, '../../screens/HomeScreen.tsx'),
			'utf8',
		)
		expect(homeSource).toContain('testID="home-scroll"')
		expect(homeSource).toContain('ScrollView')
		for (const id of HOME_SCROLL_ANCHOR_TEST_IDS) {
			expect(homeSource).toContain(`testID="${id}"`)
		}
		const scrollIdx = homeSource.indexOf('testID="home-scroll"')
		const statsIdx = homeSource.indexOf('testID="home-statistics"')
		const levelsIdx = homeSource.indexOf('testID="home-levels"')
		expect(scrollIdx).toBeGreaterThan(-1)
		expect(statsIdx).toBeGreaterThan(scrollIdx)
		expect(levelsIdx).toBeGreaterThan(scrollIdx)
	})

	it('App shell keeps banner outside clipped content host', () => {
		const appSource = fs.readFileSync(
			path.join(__dirname, '../../../App.tsx'),
			'utf8',
		)
		expect(appSource).toContain('testID="app-content-host"')
		expect(appSource).toContain("overflow: 'hidden'")
		expect(appSource).toContain('<BannerSlot placement={bannerPlacement} />')
		const contentIdx = appSource.indexOf('app-content-host')
		const bannerIdx = appSource.indexOf(
			'<BannerSlot placement={bannerPlacement}',
		)
		expect(bannerIdx).toBeGreaterThan(contentIdx)
	})

	it('tutorial route never requests a shell banner', () => {
		expect(placementForShellRoute('tutorial')).toBeNull()
	})
})
