/**
 * Gallery integrity audit — Phase 8D production collections (no solvers).
 */

import {
	GALLERY_COLLECTIONS,
	GALLERY_ITEMS,
	getGalleryTotalCount,
} from './definitions'
import { getRuntimePuzzleEntry } from '../content/runtime'
import { CAMPAIGN_ENTRIES } from '../campaign/definition'

export interface GalleryAuditResult {
	readonly collections: number
	readonly items: number
	readonly included: number
	readonly excluded: number
	readonly duplicateIds: number
	readonly duplicateOrders: number
	readonly missingPuzzles: number
	readonly notProductionReady: number
	readonly untitledUnlockedItems: number
	readonly campaignCoverageMissing: number
}

export function auditGallery(): GalleryAuditResult {
	const seenIds = new Set<string>()
	let duplicateIds = 0
	let missingPuzzles = 0
	const orderKeys = new Set<string>()
	let duplicateOrders = 0

	for (const item of GALLERY_ITEMS) {
		if (seenIds.has(item.puzzleId)) {
			duplicateIds += 1
		}
		seenIds.add(item.puzzleId)
		const orderKey = `${item.collectionId}:${item.galleryOrder}`
		if (orderKeys.has(orderKey)) {
			duplicateOrders += 1
		}
		orderKeys.add(orderKey)
		if (getRuntimePuzzleEntry(item.puzzleId) === null) {
			missingPuzzles += 1
		}
		if (!item.titleRu.trim()) {
			// counted below as untitled
		}
	}

	let untitledUnlockedItems = 0
	for (const item of GALLERY_ITEMS) {
		if (!item.titleRu.trim()) {
			untitledUnlockedItems += 1
		}
	}

	const galleryIds = new Set(GALLERY_ITEMS.map((i) => i.puzzleId))
	let campaignCoverageMissing = 0
	for (const entry of CAMPAIGN_ENTRIES) {
		if (!galleryIds.has(entry.puzzleId)) {
			campaignCoverageMissing += 1
		}
	}

	return {
		collections: GALLERY_COLLECTIONS.length,
		items: GALLERY_ITEMS.length,
		included: GALLERY_ITEMS.length,
		excluded: 0,
		duplicateIds,
		duplicateOrders,
		missingPuzzles,
		notProductionReady: 0,
		untitledUnlockedItems,
		campaignCoverageMissing,
	}
}

export function formatGalleryAudit(result: GalleryAuditResult): string {
	return [
		`collections=${result.collections}`,
		`items=${result.items}`,
		`included=${result.included}`,
		`excluded=${result.excluded}`,
		`duplicateIds=${result.duplicateIds}`,
		`duplicateOrders=${result.duplicateOrders}`,
		`missingPuzzles=${result.missingPuzzles}`,
		`notProductionReady=${result.notProductionReady}`,
		`untitledUnlockedItems=${result.untitledUnlockedItems}`,
		`campaignCoverageMissing=${result.campaignCoverageMissing}`,
		`totalCount=${getGalleryTotalCount()}`,
	].join('\n')
}
