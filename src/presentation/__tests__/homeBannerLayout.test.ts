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
	'home-tutorial-offer',
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
		const tutorialIdx = homeSource.indexOf('testID="home-tutorial-offer"')
		expect(scrollIdx).toBeGreaterThan(-1)
		expect(statsIdx).toBeGreaterThan(scrollIdx)
		expect(levelsIdx).toBeGreaterThan(scrollIdx)
		// Soft tutorial offer must sit below Statistics (not above Continue/Daily).
		expect(tutorialIdx).toBeGreaterThan(statsIdx)
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

	it('places Settings below progress, away from top-right debug zone', () => {
		const homeSource = fs.readFileSync(
			path.join(__dirname, '../../screens/HomeScreen.tsx'),
			'utf8',
		)
		const titleIdx = homeSource.indexOf('accessibilityRole="header"')
		const settingsIdx = homeSource.indexOf('testID="home-settings"')
		const continueIdx = homeSource.indexOf('testID="home-continue"')
		const progressIdx = homeSource.indexOf('styles.progressTrack')
		expect(settingsIdx).toBeGreaterThan(titleIdx)
		expect(settingsIdx).toBeGreaterThan(progressIdx)
		expect(continueIdx).toBeGreaterThan(settingsIdx)
		// Must not inflate the hit area back into the Expo console corner.
		const settingsPressable = homeSource.slice(
			homeSource.lastIndexOf('<Pressable', settingsIdx),
			settingsIdx + 80,
		)
		expect(settingsPressable).not.toMatch(/hitSlop/)
		expect(homeSource).toContain('settingsButton:')
		expect(homeSource).toMatch(/settingsButton:[\s\S]*?minHeight:\s*48/)
		expect(homeSource).toContain('accessibilityLabel="Настройки"')
		// Exactly one Settings control.
		expect(homeSource.split('testID="home-settings"').length - 1).toBe(1)
		expect(homeSource.split('accessibilityLabel="Настройки"').length - 1).toBe(
			1,
		)
	})

	it('tutorial route never requests a shell banner', () => {
		expect(placementForShellRoute('tutorial')).toBeNull()
	})
})
