/**
 * Shell banner placement — shared by App / RootNavigation / layout tests.
 * Game and Tutorial omit the shell banner (Game hosts Banner 1 itself).
 */

import type { BannerPlacement } from '../ads'

export type ShellBannerRouteName =
	| 'home'
	| 'levels'
	| 'statistics'
	| 'gallery'
	| 'galleryCollection'
	| 'galleryDetail'
	| 'achievements'
	| 'daily'
	| 'game'
	| 'tutorial'
	| 'settings'
	| 'about'

export function placementForShellRoute(
	name: ShellBannerRouteName,
): BannerPlacement | null {
	switch (name) {
		case 'tutorial':
		case 'game':
			return null
		case 'home':
		case 'levels':
			return 'home_levels'
		case 'gallery':
		case 'galleryCollection':
		case 'galleryDetail':
		case 'achievements':
		case 'statistics':
		case 'settings':
		case 'about':
		case 'daily':
			return 'information'
		default:
			return 'home_levels'
	}
}
