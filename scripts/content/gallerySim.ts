/**
 * Candidate Gallery projection for Phase 8C B1000.
 * Does NOT touch runtime Gallery definitions.
 */

import type { CandidateAuditRecord } from './types'

export interface GalleryCollectionProjection {
	readonly collectionId: string
	readonly count: number
	readonly share: number
	readonly sampleIds: readonly string[]
	readonly uniqueTitles: number
}

export interface GallerySimulation {
	readonly total: number
	readonly collectionCount: number
	readonly collections: readonly GalleryCollectionProjection[]
	readonly maxShare: number
	readonly duplicateTitles: readonly string[]
}

/**
 * Build a Gallery-style collection projection from selected production candidates.
 */
export function simulateGallery(
	records: readonly CandidateAuditRecord[],
	samplePerCollection = 5,
): GallerySimulation {
	const byCollection = new Map<string, CandidateAuditRecord[]>()
	const titleCounts = new Map<string, number>()
	for (const row of records) {
		const list = byCollection.get(row.collectionId) ?? []
		list.push(row)
		byCollection.set(row.collectionId, list)
		titleCounts.set(row.titleRu, (titleCounts.get(row.titleRu) ?? 0) + 1)
	}

	const total = records.length
	const collections: GalleryCollectionProjection[] = [...byCollection.entries()]
		.sort((a, b) => a[0].localeCompare(b[0]))
		.map(([collectionId, rows]) => {
			const sorted = [...rows].sort((a, b) => a.id.localeCompare(b.id))
			const titles = new Set(sorted.map((r) => r.titleRu))
			return {
				collectionId,
				count: sorted.length,
				share: total > 0 ? sorted.length / total : 0,
				sampleIds: sorted.slice(0, samplePerCollection).map((r) => r.id),
				uniqueTitles: titles.size,
			}
		})

	const duplicateTitles = [...titleCounts.entries()]
		.filter(([, n]) => n > 1)
		.map(([title]) => title)
		.sort((a, b) => a.localeCompare(b))

	const maxShare =
		collections.length === 0
			? 0
			: Math.max(...collections.map((c) => c.share))

	return {
		total,
		collectionCount: collections.length,
		collections,
		maxShare,
		duplicateTitles,
	}
}
