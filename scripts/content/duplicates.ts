/**
 * Duplicate / near-duplicate analysis for production content.
 */

import { hammingSimilarity, type Bitmap } from './bitmap'
import { NEAR_SIMILARITY_REPORT } from './constants'
import type { CandidateAuditRecord, SimilarityPair } from './types'

export function findExactDuplicateIds(
	records: readonly CandidateAuditRecord[],
): readonly string[] {
	const byHash = new Map<string, string[]>()
	for (const row of records) {
		const list = byHash.get(row.solutionHash) ?? []
		list.push(row.id)
		byHash.set(row.solutionHash, list)
	}
	return [...byHash.values()]
		.filter((ids) => ids.length > 1)
		.flat()
		.sort()
}

export function findTransformDuplicatePairs(
	records: readonly CandidateAuditRecord[],
): readonly SimilarityPair[] {
	const byCanon = new Map<string, CandidateAuditRecord[]>()
	for (const row of records) {
		const list = byCanon.get(row.canonicalHash) ?? []
		list.push(row)
		byCanon.set(row.canonicalHash, list)
	}
	const pairs: SimilarityPair[] = []
	for (const group of byCanon.values()) {
		if (group.length < 2) {
			continue
		}
		// Same canonical hash but different solution hash ⇒ transform dup.
		for (let i = 0; i < group.length; i += 1) {
			for (let j = i + 1; j < group.length; j += 1) {
				const a = group[i]!
				const b = group[j]!
				if (a.solutionHash === b.solutionHash) {
					continue
				}
				pairs.push({
					idA: a.id,
					titleA: a.titleRu,
					conceptA: a.conceptId,
					idB: b.id,
					titleB: b.titleRu,
					conceptB: b.conceptId,
					sizeKey: a.sizeKey,
					similarity: 1,
				})
			}
		}
	}
	return pairs
}

export interface NearDuplicateStats {
	readonly absolute: number
	readonly eligibleSameSizePairs: number
	readonly normalizedRate: number
	readonly pairs: readonly SimilarityPair[]
}

/**
 * Full same-size near-duplicate scan with normalized rate.
 * Absolute pair count alone is not comparable across catalog sizes.
 */
export function computeNearDuplicateStats(
	records: readonly CandidateAuditRecord[],
	bitmaps: ReadonlyMap<string, Bitmap>,
	threshold = NEAR_SIMILARITY_REPORT,
): NearDuplicateStats {
	const bySize = new Map<string, CandidateAuditRecord[]>()
	for (const row of records) {
		const list = bySize.get(row.sizeKey) ?? []
		list.push(row)
		bySize.set(row.sizeKey, list)
	}
	const pairs: SimilarityPair[] = []
	let eligible = 0
	for (const group of bySize.values()) {
		for (let i = 0; i < group.length; i += 1) {
			for (let j = i + 1; j < group.length; j += 1) {
				eligible += 1
				const a = group[i]!
				const b = group[j]!
				if (a.solutionHash === b.solutionHash) {
					continue
				}
				if (a.canonicalHash === b.canonicalHash) {
					continue
				}
				if (Math.abs(a.fillRatio - b.fillRatio) > 0.25) {
					continue
				}
				const ba = bitmaps.get(a.id)
				const bb = bitmaps.get(b.id)
				if (ba === undefined || bb === undefined) {
					continue
				}
				const similarity = hammingSimilarity(ba, bb)
				if (similarity >= threshold) {
					pairs.push({
						idA: a.id,
						titleA: a.titleRu,
						conceptA: a.conceptId,
						idB: b.id,
						titleB: b.titleRu,
						conceptB: b.conceptId,
						sizeKey: a.sizeKey,
						similarity,
					})
				}
			}
		}
	}
	pairs.sort(
		(x, y) => y.similarity - x.similarity || x.idA.localeCompare(y.idA),
	)
	return {
		absolute: pairs.length,
		eligibleSameSizePairs: eligible,
		normalizedRate: eligible === 0 ? 0 : pairs.length / eligible,
		pairs,
	}
}

export function topNearDuplicatePairs(
	records: readonly CandidateAuditRecord[],
	bitmaps: ReadonlyMap<string, Bitmap>,
	limit = 20,
): readonly SimilarityPair[] {
	return computeNearDuplicateStats(records, bitmaps).pairs.slice(0, limit)
}

export function findDuplicateTitles(
	records: readonly CandidateAuditRecord[],
): Readonly<Record<string, string[]>> {
	const map = new Map<string, string[]>()
	for (const row of records) {
		const list = map.get(row.titleRu) ?? []
		list.push(row.id)
		map.set(row.titleRu, list)
	}
	const out: Record<string, string[]> = {}
	for (const [title, ids] of map) {
		if (ids.length > 1) {
			out[title] = ids
		}
	}
	return out
}
