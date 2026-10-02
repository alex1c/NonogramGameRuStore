/**
 * Android Back policy unit tests (M5).
 */

import { resolveAndroidBackAction } from '../androidBackPolicy'

describe('android back policy', () => {
	it('Home Back exits app', () => {
		expect(resolveAndroidBackAction({ routeName: 'home' })).toEqual({
			kind: 'exit_app',
		})
	})

	it('Levels / Daily / Gallery / Achievements / Statistics / Settings → Home', () => {
		for (const routeName of [
			'levels',
			'daily',
			'gallery',
			'achievements',
			'statistics',
			'settings',
		] as const) {
			expect(resolveAndroidBackAction({ routeName })).toEqual({
				kind: 'go',
				route: 'home',
			})
		}
	})

	it('Gallery collection → Gallery root', () => {
		expect(
			resolveAndroidBackAction({
				routeName: 'galleryCollection',
				collectionId: 'shapes',
			}),
		).toEqual({ kind: 'go', route: 'gallery' })
	})

	it('Gallery detail → collection', () => {
		expect(
			resolveAndroidBackAction({
				routeName: 'galleryDetail',
				collectionId: 'shapes',
			}),
		).toEqual({
			kind: 'go_gallery_collection',
			collectionId: 'shapes',
		})
	})

	it('About → Settings', () => {
		expect(resolveAndroidBackAction({ routeName: 'about' })).toEqual({
			kind: 'go',
			route: 'settings',
		})
	})

	it('Tutorial → confirm exit (not app exit)', () => {
		expect(resolveAndroidBackAction({ routeName: 'tutorial' })).toEqual({
			kind: 'tutorial_confirm_exit',
		})
	})

	it('Game → flush exit; help overlay consumes first', () => {
		expect(resolveAndroidBackAction({ routeName: 'game' })).toEqual({
			kind: 'game_flush_exit',
		})
		expect(
			resolveAndroidBackAction({ routeName: 'game', helpOpen: true }),
		).toEqual({ kind: 'consume_help_overlay' })
	})
})
