/**
 * Production Gallery definitions — Phase 8D B1000 (20 collections).
 * Stable puzzle IDs remain the unlock source of truth (`solvedPuzzleIds`).
 */

import {
	getRuntimeCollections,
	getRuntimePuzzleEntry,
	getRuntimePuzzleIds,
	PRODUCTION_PUZZLE_COUNT,
} from '../content/runtime'

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

function buildGallery(): {
	readonly collections: readonly GalleryCollectionDef[]
	readonly items: readonly GalleryItemDef[]
} {
	const collections: GalleryCollectionDef[] = getRuntimeCollections().map(
		(c) => ({
			collectionId: c.id,
			titleRu: c.titleRu,
			displayOrder: c.displayOrder,
		}),
	)

	const byCollection = new Map<string, GalleryItemDef[]>()
	for (const id of getRuntimePuzzleIds()) {
		const entry = getRuntimePuzzleEntry(id)
		if (entry === null) {
			continue
		}
		const list = byCollection.get(entry.collectionId) ?? []
		list.push({
			puzzleId: entry.id,
			titleRu: entry.titleRu,
			collectionId: entry.collectionId,
			galleryOrder: 0,
		})
		byCollection.set(entry.collectionId, list)
	}

	const items: GalleryItemDef[] = []
	for (const col of collections) {
		const list = (byCollection.get(col.collectionId) ?? []).sort((a, b) =>
			a.puzzleId.localeCompare(b.puzzleId),
		)
		list.forEach((item, index) => {
			items.push({
				...item,
				galleryOrder: index + 1,
			})
		})
	}

	return {
		collections: Object.freeze(collections),
		items: Object.freeze(items),
	}
}

const BUILT = buildGallery()

export const GALLERY_COLLECTIONS: readonly GalleryCollectionDef[] =
	BUILT.collections
export const GALLERY_ITEMS: readonly GalleryItemDef[] = BUILT.items

/** Explicitly excluded campaign puzzles (none — full B1000 in Gallery). */
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
	return PRODUCTION_PUZZLE_COUNT
}

export function getGalleryItemsForCollection(
	collectionId: string,
): readonly GalleryItemDef[] {
	return GALLERY_ITEMS.filter((item) => item.collectionId === collectionId)
}
