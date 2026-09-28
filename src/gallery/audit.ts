/**
 * Gallery content audit — fail-closed.
 */

import { PHASE4_CAMPAIGN_ENTRIES } from '../campaign/definition'
import { getProductionPuzzleById } from '../content/playable'
import {
	GALLERY_COLLECTIONS,
	GALLERY_EXCLUDED,
	GALLERY_ITEMS,
} from './definitions'

export interface GalleryAuditSummary {
	readonly collections: number
	readonly items: number
	readonly included: number
	readonly excluded: number
	readonly duplicateIds: number
	readonly duplicateOrders: number
	readonly missingPuzzles: number
	readonly notProductionReady: number
	readonly untitledUnlockedItems: number
	readonly orphanCampaign: readonly string[]
	readonly issues: readonly string[]
	readonly ok: boolean
}

export function auditGallery(): GalleryAuditSummary {
	const issues: string[] = []
	let duplicateIds = 0
	let duplicateOrders = 0
	let missingPuzzles = 0
	let notProductionReady = 0
	let untitledUnlockedItems = 0

	const collectionIds = new Set<string>()
	for (const collection of GALLERY_COLLECTIONS) {
		if (collectionIds.has(collection.collectionId)) {
			issues.push(`Duplicate collectionId: ${collection.collectionId}`)
		}
		collectionIds.add(collection.collectionId)
		if (!collection.titleRu.trim()) {
			issues.push(`Untitled collection: ${collection.collectionId}`)
		}
	}

	const puzzleIds = new Set<string>()
	const orderKeys = new Set<string>()

	for (const item of GALLERY_ITEMS) {
		if (puzzleIds.has(item.puzzleId)) {
			duplicateIds += 1
			issues.push(`Duplicate gallery puzzleId: ${item.puzzleId}`)
		}
		puzzleIds.add(item.puzzleId)

		const orderKey = `${item.collectionId}:${item.galleryOrder}`
		if (orderKeys.has(orderKey)) {
			duplicateOrders += 1
			issues.push(`Duplicate gallery order: ${orderKey}`)
		}
		orderKeys.add(orderKey)

		if (!collectionIds.has(item.collectionId)) {
			issues.push(
				`Orphan item collection: ${item.puzzleId} → ${item.collectionId}`,
			)
		}
		if (!item.titleRu.trim()) {
			untitledUnlockedItems += 1
			issues.push(`Untitled gallery item: ${item.puzzleId}`)
		}

		const puzzle = getProductionPuzzleById(item.puzzleId)
		if (puzzle === null) {
			missingPuzzles += 1
			notProductionReady += 1
			issues.push(`Missing/not productionReady: ${item.puzzleId}`)
		}
	}

	const excludedIds = new Set(GALLERY_EXCLUDED.map((item) => item.puzzleId))
	const orphanCampaign: string[] = []
	for (const entry of PHASE4_CAMPAIGN_ENTRIES) {
		if (!puzzleIds.has(entry.puzzleId) && !excludedIds.has(entry.puzzleId)) {
			orphanCampaign.push(entry.puzzleId)
			issues.push(`Campaign puzzle not in gallery/excluded: ${entry.puzzleId}`)
		}
	}

	for (const excluded of GALLERY_EXCLUDED) {
		if (!excluded.reason.trim()) {
			issues.push(`Excluded without reason: ${excluded.puzzleId}`)
		}
	}

	const ok = issues.length === 0
	return {
		collections: GALLERY_COLLECTIONS.length,
		items: GALLERY_ITEMS.length,
		included: GALLERY_ITEMS.length,
		excluded: GALLERY_EXCLUDED.length,
		duplicateIds,
		duplicateOrders,
		missingPuzzles,
		notProductionReady,
		untitledUnlockedItems,
		orphanCampaign,
		issues,
		ok,
	}
}
