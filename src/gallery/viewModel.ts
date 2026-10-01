/**
 * Pure gallery projection — UI must not decide solution visibility.
 *
 * Locked items NEVER receive:
 * - authored solution / cropped bitmap
 * - revealing object title
 * - secret accessibility labels
 */

import type { DifficultyRating } from '../domain/difficulty/tiers'
import type { SolutionGrid } from '../domain/nonogram/types'
import { getProductionPuzzleById } from '../content/playable'
import { getRuntimePuzzleEntry } from '../content/runtime'
import type { SaveRoot } from '../persistence/schema'
import { difficultyLabelRu } from '../presentation/difficultyLabels'
import { formatBestTime } from '../presentation/timeFormat'
import { cropSolutionBitmap, type CroppedBitmap } from './crop'
import {
	GALLERY_COLLECTIONS,
	GALLERY_ITEMS,
	getGalleryCollectionDef,
	getGalleryItemDef,
	getGalleryItemsForCollection,
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

/** Prefer precomputed runtime tier — avoid analyzer on Gallery list. */
function catalogTier(puzzleId: string): DifficultyRating {
	const entry = getRuntimePuzzleEntry(puzzleId)
	return entry?.tier ?? 'UNRATED'
}

function lockedTitle(order: number): string {
	return `Картинка ${order}`
}

export function buildGalleryItemView(
	def: GalleryItemDef,
	completedIds: ReadonlySet<string>,
	bestTimes: SaveRoot['bestTimes'],
	/** When false, skip solution decode for locked-only list cards. */
	options: { readonly decodeSolution?: boolean } = {},
): GalleryItemView | null {
	const meta = getRuntimePuzzleEntry(def.puzzleId)
	if (meta === null) {
		return null
	}
	const unlocked = completedIds.has(def.puzzleId)
	const tier = catalogTier(def.puzzleId)
	const sizeLabel = `${meta.width}×${meta.height}`
	const difficultyLabel = difficultyLabelRu(tier)

	if (!unlocked) {
		const displayTitle = lockedTitle(def.galleryOrder)
		return {
			puzzleId: def.puzzleId,
			collectionId: def.collectionId,
			galleryOrder: def.galleryOrder,
			width: meta.width,
			height: meta.height,
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

	const puzzle = getProductionPuzzleById(def.puzzleId)
	if (puzzle === null) {
		// Unlocked but missing production entry — treat as unavailable.
		return null
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
		width: meta.width,
		height: meta.height,
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
	// Gallery unlock source = solvedPuzzleIds (any mode), not campaign-only.
	const completed = new Set(save.solvedPuzzleIds)
	const collections: GalleryCollectionView[] = []
	let unlockedCount = 0

	const sortedCollections = [...GALLERY_COLLECTIONS].sort(
		(a, b) => a.displayOrder - b.displayOrder,
	)

	for (const collection of sortedCollections) {
		const defs = getGalleryItemsForCollection(collection.collectionId)
		let completedInCollection = 0
		for (const def of defs) {
			if (completed.has(def.puzzleId)) {
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
			total: defs.length,
			isComplete: defs.length > 0 && completedInCollection === defs.length,
			// Root Gallery lists collections only — items load in collection detail.
			items: [],
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

/** Virtualized collection detail — decode solutions only for unlocked cards. */
export function buildGalleryCollectionDetailView(
	collectionId: string,
	save: SaveRoot,
): GalleryCollectionView | null {
	const collection = getGalleryCollectionDef(collectionId)
	if (collection === null) {
		return null
	}
	const completed = new Set(save.solvedPuzzleIds)
	const defs = getGalleryItemsForCollection(collectionId)
	const items: GalleryItemView[] = []
	let completedInCollection = 0
	for (const def of defs) {
		const view = buildGalleryItemView(def, completed, save.bestTimes, {
			decodeSolution: completed.has(def.puzzleId),
		})
		if (view === null) {
			continue
		}
		items.push(view)
		if (view.access === 'UNLOCKED') {
			completedInCollection += 1
		}
	}
	return {
		collectionId: collection.collectionId,
		titleRu: collection.titleRu,
		descriptionRu: collection.descriptionRu,
		displayOrder: collection.displayOrder,
		completed: completedInCollection,
		total: items.length,
		isComplete: items.length > 0 && completedInCollection === items.length,
		items,
	}
}

export function countGalleryUnlocked(solvedPuzzleIds: readonly string[]): {
	readonly unlocked: number
	readonly total: number
} {
	const solved = new Set(solvedPuzzleIds)
	let unlocked = 0
	for (const item of GALLERY_ITEMS) {
		if (solved.has(item.puzzleId)) {
			unlocked += 1
		}
	}
	return { unlocked, total: GALLERY_ITEMS.length }
}

export function isGalleryPuzzleUnlocked(
	puzzleId: string,
	solvedPuzzleIds: readonly string[],
): boolean {
	if (getGalleryItemDef(puzzleId) === null) {
		return false
	}
	return solvedPuzzleIds.includes(puzzleId)
}

export function collectionJustCompleted(
	beforeSolved: readonly string[],
	afterSolved: readonly string[],
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
	const beforeSet = new Set(beforeSolved)
	const afterSet = new Set(afterSolved)
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
	solvedPuzzleIds: readonly string[],
): { readonly width: number; readonly height: number; readonly solution: SolutionGrid } | null {
	if (!solvedPuzzleIds.includes(puzzleId)) {
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
