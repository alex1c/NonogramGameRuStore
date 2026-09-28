/**
 * Phase 5 gallery content definitions.
 *
 * Development campaign baseline — NOT the final RuStore pack.
 * Stable puzzle IDs remain the unlock source of truth (`solvedPuzzleIds`).
 * Presentation titles/collections do NOT affect active-game fingerprints.
 */

export interface GalleryCollectionDef {
	readonly collectionId: string
	readonly titleRu: string
	readonly descriptionRu?: string
	readonly displayOrder: number
}

export interface GalleryItemDef {
	readonly puzzleId: string
	/** Revealed only after unlock — describing the solved bitmap. */
	readonly titleRu: string
	readonly collectionId: string
	/** Stable order within the collection (1-based). */
	readonly galleryOrder: number
}

export const GALLERY_COLLECTIONS: readonly GalleryCollectionDef[] = Object.freeze([
	{
		collectionId: 'shapes',
		titleRu: 'Фигуры',
		descriptionRu: 'Простые узнаваемые формы',
		displayOrder: 1,
	},
	{
		collectionId: 'objects',
		titleRu: 'Предметы',
		descriptionRu: 'Небольшие объекты и сцены',
		displayOrder: 2,
	},
	{
		collectionId: 'patterns',
		titleRu: 'Узоры',
		descriptionRu: 'Повторяющиеся и абстрактные рисунки',
		displayOrder: 3,
	},
])

/**
 * All 21 productionReady campaign puzzles are included.
 * Titles match the authored solution bitmaps (development content).
 */
export const GALLERY_ITEMS: readonly GalleryItemDef[] = Object.freeze([
	// shapes
	{ puzzleId: 'mini-beginner-bar', titleRu: 'Полоска', collectionId: 'shapes', galleryOrder: 1 },
	{ puzzleId: 'mini-beginner-full', titleRu: 'Квадрат', collectionId: 'shapes', galleryOrder: 2 },
	{ puzzleId: 'mini-beginner-frame', titleRu: 'Рамка', collectionId: 'shapes', galleryOrder: 3 },
	{ puzzleId: 'mini-easy-block', titleRu: 'Блок', collectionId: 'shapes', galleryOrder: 4 },
	{ puzzleId: 'mini-easy-stairs', titleRu: 'Лестница', collectionId: 'shapes', galleryOrder: 5 },
	{ puzzleId: 'mini-easy-plus', titleRu: 'Плюс', collectionId: 'shapes', galleryOrder: 6 },
	{ puzzleId: 'mini-medium-heart', titleRu: 'Сердце', collectionId: 'shapes', galleryOrder: 7 },
	{ puzzleId: 'mini-medium-letter-h', titleRu: 'Буква Н', collectionId: 'shapes', galleryOrder: 8 },
	{ puzzleId: 'mini-medium-diamond', titleRu: 'Ромб', collectionId: 'shapes', galleryOrder: 9 },
	// objects
	{ puzzleId: 'mini-medium-boat', titleRu: 'Лодка', collectionId: 'objects', galleryOrder: 1 },
	{ puzzleId: 'mini-hard-tree', titleRu: 'Дерево', collectionId: 'objects', galleryOrder: 2 },
	{ puzzleId: 'mini-hard-bridge', titleRu: 'Мост', collectionId: 'objects', galleryOrder: 3 },
	{ puzzleId: 'mini-hard-arrows', titleRu: 'Стрелки', collectionId: 'objects', galleryOrder: 4 },
	{ puzzleId: 'mini-hard-window', titleRu: 'Окно', collectionId: 'objects', galleryOrder: 5 },
	// patterns
	{ puzzleId: 'mini-easy-checker', titleRu: 'Шахматка', collectionId: 'patterns', galleryOrder: 1 },
	{ puzzleId: 'mini-easy-weave', titleRu: 'Плетение', collectionId: 'patterns', galleryOrder: 2 },
	{ puzzleId: 'mini-medium-spiral', titleRu: 'Спираль', collectionId: 'patterns', galleryOrder: 3 },
	{ puzzleId: 'mini-hard-frame-cross', titleRu: 'Крест в рамке', collectionId: 'patterns', galleryOrder: 4 },
	{ puzzleId: 'mini-medium-maze', titleRu: 'Лабиринт', collectionId: 'patterns', galleryOrder: 5 },
	{ puzzleId: 'mini-expert-scatter', titleRu: 'Россыпь', collectionId: 'patterns', galleryOrder: 6 },
	{ puzzleId: 'mini-expert-lattice', titleRu: 'Решётка', collectionId: 'patterns', galleryOrder: 7 },
])

/** Explicitly excluded campaign puzzles (none in Phase 5 — all 21 included). */
export const GALLERY_EXCLUDED: readonly {
	readonly puzzleId: string
	readonly reason: string
}[] = Object.freeze([])

export function getGalleryItemDef(puzzleId: string): GalleryItemDef | null {
	return GALLERY_ITEMS.find((item) => item.puzzleId === puzzleId) ?? null
}

export function getGalleryCollectionDef(
	collectionId: string,
): GalleryCollectionDef | null {
	return (
		GALLERY_COLLECTIONS.find((item) => item.collectionId === collectionId) ??
		null
	)
}

export function getGalleryTotalCount(): number {
	return GALLERY_ITEMS.length
}
