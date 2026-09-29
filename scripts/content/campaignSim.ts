/**
 * Campaign set simulation for pilot (does NOT touch runtime Campaign).
 */

import type { DifficultyTier } from '../../src/domain/difficulty/tiers'
import type { CandidateAuditRecord } from './types'

export interface SimulatedSet {
	readonly setId: string
	readonly titleRu: string
	readonly displayOrder: number
	readonly puzzleIds: readonly string[]
}

export interface CampaignSimulation {
	readonly sets: readonly SimulatedSet[]
	readonly order: readonly string[]
	readonly maxDifficultyStreak: number
	readonly maxCollectionStreak: number
	readonly maxSizeStreak: number
}

const TIER_RANK: Record<DifficultyTier, number> = {
	BEGINNER: 0,
	EASY: 1,
	MEDIUM: 2,
	HARD: 3,
	EXPERT: 4,
}

/**
 * Arrange pilot into soft progressive order (2 sets × 50 for pilot scale).
 */
export function arrangePilotCampaign(
	records: readonly CandidateAuditRecord[],
): CampaignSimulation {
	const sorted = [...records].sort((a, b) => {
		const ta = a.tier === 'UNRATED' ? 99 : TIER_RANK[a.tier]
		const tb = b.tier === 'UNRATED' ? 99 : TIER_RANK[b.tier]
		if (ta !== tb) {
			return ta - tb
		}
		const sa = a.score ?? 0
		const sb = b.score ?? 0
		if (sa !== sb) {
			return sa - sb
		}
		return a.id.localeCompare(b.id)
	})

	// Interleave recovery: avoid long hard streaks by rotating every 4 picks
	// from remaining mid tiers when possible.
	const buckets = new Map<DifficultyTier, CandidateAuditRecord[]>()
	for (const row of sorted) {
		if (row.tier === 'UNRATED') {
			continue
		}
		const list = buckets.get(row.tier) ?? []
		list.push(row)
		buckets.set(row.tier, list)
	}

	const order: CandidateAuditRecord[] = []
	const sequence: DifficultyTier[] = [
		'BEGINNER',
		'BEGINNER',
		'EASY',
		'EASY',
		'EASY',
		'MEDIUM',
		'EASY',
		'MEDIUM',
		'MEDIUM',
		'HARD',
		'MEDIUM',
		'HARD',
		'EASY',
		'HARD',
		'EXPERT',
	]

	let guard = 0
	while (order.length < records.length && guard < records.length * 4) {
		guard += 1
		const prefer = sequence[order.length % sequence.length]!
		const preferBucket = buckets.get(prefer)
		if (preferBucket !== undefined && preferBucket.length > 0) {
			order.push(preferBucket.shift()!)
			continue
		}
		// Fallback: next available lowest tier.
		let picked = false
		for (const tier of [
			'BEGINNER',
			'EASY',
			'MEDIUM',
			'HARD',
			'EXPERT',
		] as DifficultyTier[]) {
			const bucket = buckets.get(tier)
			if (bucket !== undefined && bucket.length > 0) {
				order.push(bucket.shift()!)
				picked = true
				break
			}
		}
		if (!picked) {
			break
		}
	}

	const setSize = 50
	const sets: SimulatedSet[] = []
	for (let i = 0; i < order.length; i += setSize) {
		const chunk = order.slice(i, i + setSize)
		const n = sets.length + 1
		sets.push({
			setId: `pilot-set-${String(n).padStart(2, '0')}`,
			titleRu: `Набор ${n}`,
			displayOrder: n,
			puzzleIds: chunk.map((r) => r.id),
		})
	}

	let maxDiff = 1
	let maxCol = 1
	let maxSize = 1
	let runDiff = 1
	let runCol = 1
	let runSize = 1
	for (let i = 1; i < order.length; i += 1) {
		const prev = order[i - 1]!
		const cur = order[i]!
		runDiff = prev.tier === cur.tier ? runDiff + 1 : 1
		runCol =
			prev.collectionId === cur.collectionId ? runCol + 1 : 1
		runSize = prev.sizeKey === cur.sizeKey ? runSize + 1 : 1
		maxDiff = Math.max(maxDiff, runDiff)
		maxCol = Math.max(maxCol, runCol)
		maxSize = Math.max(maxSize, runSize)
	}

	return {
		sets,
		order: order.map((r) => r.id),
		maxDifficultyStreak: maxDiff,
		maxCollectionStreak: maxCol,
		maxSizeStreak: maxSize,
	}
}
