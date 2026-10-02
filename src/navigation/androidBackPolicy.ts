/**
 * Route-aware Android Back policy for the custom navigator.
 * Pure decision table — no RN navigation library.
 */

export type BackPolicyRouteName =
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

export type BackPolicyAction =
	| { readonly kind: 'exit_app' }
	| { readonly kind: 'go'; readonly route: BackPolicyRouteName }
	| { readonly kind: 'go_gallery_collection'; readonly collectionId: string }
	| { readonly kind: 'tutorial_confirm_exit' }
	| { readonly kind: 'game_flush_exit' }
	| { readonly kind: 'consume_help_overlay' }

export interface BackPolicyContext {
	readonly routeName: BackPolicyRouteName
	readonly collectionId?: string
	readonly helpOpen?: boolean
}

/**
 * Decide Android hardware Back behavior for the current route.
 * Home exits the app (Android convention). Nested screens pop toward Home.
 */
export function resolveAndroidBackAction(
	ctx: BackPolicyContext,
): BackPolicyAction {
	if (ctx.routeName === 'game' && ctx.helpOpen) {
		return { kind: 'consume_help_overlay' }
	}
	switch (ctx.routeName) {
		case 'home':
			return { kind: 'exit_app' }
		case 'levels':
		case 'statistics':
		case 'gallery':
		case 'achievements':
		case 'daily':
		case 'settings':
			return { kind: 'go', route: 'home' }
		case 'galleryCollection':
			return { kind: 'go', route: 'gallery' }
		case 'galleryDetail':
			if (ctx.collectionId !== undefined && ctx.collectionId.length > 0) {
				return {
					kind: 'go_gallery_collection',
					collectionId: ctx.collectionId,
				}
			}
			return { kind: 'go', route: 'gallery' }
		case 'about':
			return { kind: 'go', route: 'settings' }
		case 'tutorial':
			return { kind: 'tutorial_confirm_exit' }
		case 'game':
			return { kind: 'game_flush_exit' }
		default:
			return { kind: 'go', route: 'home' }
	}
}
