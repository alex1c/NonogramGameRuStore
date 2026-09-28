/**
 * Pure gallery projection — UI must not decide solution visibility.
 *
 * Locked items NEVER receive:
 * - authored solution / cropped bitmap
 * - revealing object title
 * - secret accessibility labels
 */

import { analyzeDifficulty } from '../domain/difficulty/analyzer'
import type { DifficultyRating } from '../domain/difficulty/tiers'
import type { SolutionGrid } from '../domain/nonogram/types'
import { getProductionPuzzleById } from '../content/playable'
import type { SaveRoot } from '../persistence/schema'
import { difficultyLabelRu } from '../presentation/difficultyLabels'
import { formatBestTime } from '../presentation/timeFormat'
import { cropSolutionBitmap, type CroppedBitmap } from './crop'
import {
	GALLERY_COLLECTIONS,
	GALLERY_ITEMS,
	getGalleryCollectionDef,
	getGalleryItemDef,
	getGalleryTotalCount,
	type GalleryItemDef,
} from './definitions'

export type GalleryItemAccess = 'LOCKED' | 'UNLOCKED'

/** Safe presentation fields shared by locked and unlocked cards. */
export interface GalleryItemBaseView {
	readonly puzzleId: string
	readonly collectionId: string
	readonly galleryOrder: number
	readonly width: number
	readonly height: number
	readonly sizeLabel: string
	readonly difficultyTier: DifficultyRating
	readonly difficultyLabel: string
	readonly access: GalleryItemAccess
	/** Safe display title — placeholder when locked. */
	readonly displayTitle: string
	readonly accessibilityLabel: string
}

export interface GalleryLockedItemView extends GalleryItemBaseView {
	readonly access: 'LOCKED'
	readonly preview: null
	readonly bestTimeLabel: null
	/** Never populated for locked items. */
	readonly secretTitle: null
}

export interface GalleryUnlockedItemView extends GalleryItemBaseView {
	readonly access: 'UNLOCKED'
	readonly preview: CroppedBitmap
	readonly bestTimeLabel: string | null
	readonly secretTitle: string
}

export type GalleryItemView = GalleryLockedItemView | GalleryUnlockedItemView

export interface GalleryCollectionView {
	readonly collectionId: string
	readonly titleRu: string
	readonly descriptionRu?: string
	readonly displayOrder: number
	readonly completed: number
	readonly total: number
	readonly isComplete: boolean
	readonly items: readonly GalleryItemView[]
}

export interface GalleryScreenView {
	readonly collections: readonly GalleryCollectionView[]
	readonly unlockedCount: number
	readonly totalCount: number
	readonly progressLabel: string
	readonly introLabel: string
}

const difficultyCache = new Map<string, DifficultyRating>()

function cachedTier(
	puzzleId: string,
	width: number,
	height: number,
): DifficultyRating {
	const hit = difficultyCache.get(puzzleId)
	if (hit !== undefined) {
		return hit
	}
	const puzzle = getProductionPuzzleById(puzzleId)
	const tier =
		puzzle === null ? 'UNRATED' : analyzeDifficulty(puzzle).tier
	difficultyCache.set(puzzleId, tier)
	void width
	void height
	return tier
}

function lockedTitle(order: number): string {
	return `Картинка ${order}`
}

export function buildGalleryItemView(
	def: GalleryItemDef,
	completedIds: ReadonlySet<string>,
	bestTimes: SaveRoot['bestTimes'],
): GalleryItemView | null {
	const puzzle = getProductionPuzzleById(def.puzzleId)
	if (puzzle === null) {
		return null
	}
	const unlocked = completedIds.has(def.puzzleId)
	const tier = cachedTier(def.puzzleId, puzzle.width, puzzle.height)
	const sizeLabel = `${puzzle.width}×${puzzle.height}`
	const difficultyLabel = difficultyLabelRu(tier)

	if (!unlocked) {
		const displayTitle = lockedTitle(def.galleryOrder)
		return {
			puzzleId: def.puzzleId,
			collectionId: def.collectionId,
			galleryOrder: def.galleryOrder,
			width: puzzle.width,
			height: puzzle.height,
			sizeLabel,
			difficultyTier: tier,
			difficultyLabel,
			access: 'LOCKED',
			displayTitle,
			accessibilityLabel: `${displayTitle}, не открыта, ${sizeLabel}, ${difficultyLabel}`,
			preview: null,
			bestTimeLabel: null,
			secretTitle: null,
		}
	}

	const best = bestTimes.find((item) => item.puzzleId === def.puzzleId)
	const preview = cropSolutionBitmap(
		puzzle.width,
		puzzle.height,
		puzzle.solution,
	)
	return {
		puzzleId: def.puzzleId,
		collectionId: def.collectionId,
		galleryOrder: def.galleryOrder,
		width: puzzle.width,
		height: puzzle.height,
		sizeLabel,
		difficultyTier: tier,
		difficultyLabel,
		access: 'UNLOCKED',
		displayTitle: def.titleRu,
		accessibilityLabel: `${def.titleRu}, открыта, ${sizeLabel}, ${difficultyLabel}`,
		preview,
		bestTimeLabel:
			best !== undefined ? formatBestTime(best.bestActiveTimeMs) : null,
		secretTitle: def.titleRu,
	}
}

export function buildGalleryScreenView(save: SaveRoot): GalleryScreenView {
	const completed = new Set(save.completedPuzzleIds)
	const collections: GalleryCollectionView[] = []
	let unlockedCount = 0

	const sortedCollections = [...GALLERY_COLLECTIONS].sort(
		(a, b) => a.displayOrder - b.displayOrder,
	)

	for (const collection of sortedCollections) {
		const defs = GALLERY_ITEMS.filter(
			(item) => item.collectionId === collection.collectionId,
		).sort((a, b) => a.galleryOrder - b.galleryOrder)

		const items: GalleryItemView[] = []
		let completedInCollection = 0
		for (const def of defs) {
			const view = buildGalleryItemView(def, completed, save.bestTimes)
			if (view === null) {
				continue
			}
			items.push(view)
			if (view.access === 'UNLOCKED') {
				completedInCollection += 1
				unlockedCount += 1
			}
		}

		collections.push({
			collectionId: collection.collectionId,
			titleRu: collection.titleRu,
			descriptionRu: collection.descriptionRu,
			displayOrder: collection.displayOrder,
			completed: completedInCollection,
			total: items.length,
			isComplete: items.length > 0 && completedInCollection === items.length,
			items,
		})
	}

	const totalCount = getGalleryTotalCount()
	return {
		collections,
		unlockedCount,
		totalCount,
		progressLabel: `Открыто ${unlockedCount} из ${totalCount}`,
		introLabel: 'Решайте кроссворды — картинки появятся здесь.',
	}
}

export function countGalleryUnlocked(completedPuzzleIds: readonly string[]): {
	readonly unlocked: number
	readonly total: number
} {
	const completed = new Set(completedPuzzleIds)
	let unlocked = 0
	for (const item of GALLERY_ITEMS) {
		if (completed.has(item.puzzleId)) {
			unlocked += 1
		}
	}
	return { unlocked, total: GALLERY_ITEMS.length }
}

export function isGalleryPuzzleUnlocked(
	puzzleId: string,
	completedPuzzleIds: readonly string[],
): boolean {
	if (getGalleryItemDef(puzzleId) === null) {
		return false
	}
	return completedPuzzleIds.includes(puzzleId)
}

export function collectionJustCompleted(
	beforeCompleted: readonly string[],
	afterCompleted: readonly string[],
	puzzleId: string,
): string | null {
	const item = getGalleryItemDef(puzzleId)
	if (item === null) {
		return null
	}
	const collection = getGalleryCollectionDef(item.collectionId)
	if (collection === null) {
		return null
	}
	const members = GALLERY_ITEMS.filter(
		(entry) => entry.collectionId === item.collectionId,
	)
	const beforeSet = new Set(beforeCompleted)
	const afterSet = new Set(afterCompleted)
	const beforeDone = members.every((entry) => beforeSet.has(entry.puzzleId))
	const afterDone = members.every((entry) => afterSet.has(entry.puzzleId))
	if (!beforeDone && afterDone) {
		return collection.titleRu
	}
	return null
}

/** Extract solution only when unlock is proven — for completion/detail. */
export function getUnlockedSolution(
	puzzleId: string,
	completedPuzzleIds: readonly string[],
): { readonly width: number; readonly height: number; readonly solution: SolutionGrid } | null {
	if (!completedPuzzleIds.includes(puzzleId)) {
		return null
	}
	const puzzle = getProductionPuzzleById(puzzleId)
	if (puzzle === null) {
		return null
	}
	return {
		width: puzzle.width,
		height: puzzle.height,
		solution: puzzle.solution,
	}
}
