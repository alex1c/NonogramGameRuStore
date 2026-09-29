/**
 * Frozen Phase 7 / 8A runtime gallery membership for v3→v4 sticky seeding.
 *
 * Migration must NOT depend on the live GALLERY_ITEMS array — future production
 * taxonomy swaps must not change which achievements a v3 user already earned.
 */

export interface LegacyV3GalleryItem {
	readonly puzzleId: string
	readonly collectionId: string
}

/**
 * Snapshot of the 21-puzzle development Gallery used when schema was v3.
 * Keep in sync with Phase 5–8A `GALLERY_ITEMS` at the time of Phase 8B freeze.
 */
export const LEGACY_V3_GALLERY_ITEMS: readonly LegacyV3GalleryItem[] =
	Object.freeze([
		{ puzzleId: 'mini-beginner-bar', collectionId: 'shapes' },
		{ puzzleId: 'mini-beginner-full', collectionId: 'shapes' },
		{ puzzleId: 'mini-beginner-frame', collectionId: 'shapes' },
		{ puzzleId: 'mini-easy-block', collectionId: 'shapes' },
		{ puzzleId: 'mini-easy-stairs', collectionId: 'shapes' },
		{ puzzleId: 'mini-easy-plus', collectionId: 'shapes' },
		{ puzzleId: 'mini-medium-heart', collectionId: 'shapes' },
		{ puzzleId: 'mini-medium-letter-h', collectionId: 'shapes' },
		{ puzzleId: 'mini-medium-diamond', collectionId: 'shapes' },
		{ puzzleId: 'mini-medium-boat', collectionId: 'objects' },
		{ puzzleId: 'mini-hard-tree', collectionId: 'objects' },
		{ puzzleId: 'mini-hard-bridge', collectionId: 'objects' },
		{ puzzleId: 'mini-hard-arrows', collectionId: 'objects' },
		{ puzzleId: 'mini-hard-window', collectionId: 'objects' },
		{ puzzleId: 'mini-easy-checker', collectionId: 'patterns' },
		{ puzzleId: 'mini-easy-weave', collectionId: 'patterns' },
		{ puzzleId: 'mini-medium-spiral', collectionId: 'patterns' },
		{ puzzleId: 'mini-hard-frame-cross', collectionId: 'patterns' },
		{ puzzleId: 'mini-medium-maze', collectionId: 'patterns' },
		{ puzzleId: 'mini-expert-scatter', collectionId: 'patterns' },
		{ puzzleId: 'mini-expert-lattice', collectionId: 'patterns' },
	])
