/**
 * Campaign set simulation for production candidates (does NOT touch runtime Campaign).
 * Target shape at B1000: 20 sets × 50 puzzles with soft progression and diversity.
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
	/** Suggested unlock: next set after ~35/50 of previous. */
	readonly unlockAfterCompletions: number
}

const TIER_RANK: Record<DifficultyTier, number> = {
	BEGINNER: 0,
	EASY: 1,
	MEDIUM: 2,
	HARD: 3,
	EXPERT: 4,
}

const SET_SIZE = 50
const UNLOCK_AFTER = 35
const MAX_LOCAL_TIER_STREAK = 4
const MAX_LOCAL_COL_STREAK = 2
const MAX_LOCAL_SIZE_STREAK = 4

const ALL_TIERS: readonly DifficultyTier[] = [
	'BEGINNER',
	'EASY',
	'MEDIUM',
	'HARD',
	'EXPERT',
]

function streakStats(order: readonly CandidateAuditRecord[]): {
	readonly maxDiff: number
	readonly maxCol: number
	readonly maxSize: number
} {
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
	return { maxDiff, maxCol, maxSize }
}

function recentRun(
	order: readonly CandidateAuditRecord[],
	keyOf: (r: CandidateAuditRecord) => string,
): { readonly key: string | null; readonly len: number } {
	if (order.length === 0) return { key: null, len: 0 }
	const key = keyOf(order[order.length - 1]!)
	let len = 1
	for (let i = order.length - 2; i >= 0; i -= 1) {
		if (keyOf(order[i]!) !== key) break
		len += 1
	}
	return { key, len }
}

/**
 * Build a soft progression weight vector over catalog progress [0,1].
 * Early: Beginner/Easy heavy. Mid: Medium. Late: Hard/Expert — never exclusive.
 */
function tierWeights(progress: number): Record<DifficultyTier, number> {
	const p = Math.min(1, Math.max(0, progress))
	return {
		BEGINNER: Math.max(0.05, 0.35 - p * 0.35),
		EASY: Math.max(0.1, 0.3 - p * 0.1),
		MEDIUM: 0.15 + Math.sin(p * Math.PI) * 0.2,
		HARD: Math.max(0.08, 0.08 + p * 0.22),
		EXPERT: Math.max(0.04, p * 0.22),
	}
}

/**
 * Arrange candidates into progressive Campaign sets with paced tiers and
 * local streak caps (collection / size / difficulty).
 */
export function arrangePilotCampaign(
	records: readonly CandidateAuditRecord[],
): CampaignSimulation {
	const buckets = new Map<DifficultyTier, CandidateAuditRecord[]>()
	for (const row of [...records].sort((a, b) => {
		const ta = a.tier === 'UNRATED' ? 99 : TIER_RANK[a.tier]
		const tb = b.tier === 'UNRATED' ? 99 : TIER_RANK[b.tier]
		if (ta !== tb) return ta - tb
		const sa = a.score ?? 0
		const sb = b.score ?? 0
		if (sa !== sb) return sa - sb
		return a.id.localeCompare(b.id)
	})) {
		if (row.tier === 'UNRATED') continue
		const list = buckets.get(row.tier) ?? []
		list.push(row)
		buckets.set(row.tier, list)
	}

	const remaining = new Set(
		records.filter((r) => r.tier !== 'UNRATED').map((r) => r.id),
	)
	const byId = new Map(records.map((r) => [r.id, r]))
	const order: CandidateAuditRecord[] = []
	const total = remaining.size

	const remainingByTier = (): Record<DifficultyTier, number> => {
		const out: Record<DifficultyTier, number> = {
			BEGINNER: 0,
			EASY: 0,
			MEDIUM: 0,
			HARD: 0,
			EXPERT: 0,
		}
		for (const tier of ALL_TIERS) {
			out[tier] = (buckets.get(tier) ?? []).length
		}
		return out
	}

	const pickFromTier = (
		tier: DifficultyTier,
	): CandidateAuditRecord | null => {
		const bucket = buckets.get(tier)
		if (bucket === undefined || bucket.length === 0) return null
		const colRun = recentRun(order, (r) => r.collectionId)
		const sizeRun = recentRun(order, (r) => r.sizeKey)
		let bestIdx = 0
		let bestScore = -Infinity
		for (let i = 0; i < bucket.length; i += 1) {
			const cand = bucket[i]!
			let score = 0
			if (colRun.key === cand.collectionId) {
				score -=
					colRun.len >= MAX_LOCAL_COL_STREAK ? 500 : colRun.len * 40
			} else {
				score += 20
			}
			if (sizeRun.key === cand.sizeKey) {
				score -=
					sizeRun.len >= MAX_LOCAL_SIZE_STREAK ? 400 : sizeRun.len * 25
			} else {
				score += 15
			}
			// Stable tie-break by id.
			score -= cand.id.charCodeAt(0) * 0.001
			if (score > bestScore) {
				bestScore = score
				bestIdx = i
			}
		}
		const picked = bucket.splice(bestIdx, 1)[0]!
		remaining.delete(picked.id)
		return picked
	}

	while (remaining.size > 0) {
		const progress = order.length / Math.max(1, total)
		const weights = tierWeights(progress)
		const left = remainingByTier()
		const tierRun = recentRun(order, (r) => String(r.tier))

		const ranked = ALL_TIERS.map((tier) => {
			let score = weights[tier] * 100 + left[tier] * 0.01
			// Pace: if this tier is over-represented vs remaining share, downrank.
			const remShare = left[tier] / Math.max(1, remaining.size)
			const targetShare =
				weights[tier] /
				ALL_TIERS.reduce((s, t) => s + (left[t] > 0 ? weights[t] : 0), 0)
			if (Number.isFinite(targetShare) && remShare > targetShare + 0.08) {
				score += 30
			}
			if (tierRun.key === String(tier) && tierRun.len >= MAX_LOCAL_TIER_STREAK) {
				score -= 1000
			} else if (tierRun.key === String(tier)) {
				score -= tierRun.len * 50
			}
			if (left[tier] === 0) score = -Infinity
			return { tier, score }
		}).sort((a, b) => b.score - a.score || a.tier.localeCompare(b.tier))

		let picked: CandidateAuditRecord | null = null
		for (const { tier } of ranked) {
			picked = pickFromTier(tier)
			if (picked !== null) break
		}
		if (picked === null) break
		order.push(picked)
	}

	if (remaining.size > 0) {
		const leftover = [...remaining]
			.map((id) => byId.get(id)!)
			.sort((a, b) => a.id.localeCompare(b.id))
		for (const row of leftover) {
			order.push(row)
			remaining.delete(row.id)
		}
	}

	const sets: SimulatedSet[] = []
	for (let i = 0; i < order.length; i += SET_SIZE) {
		const chunk = order.slice(i, i + SET_SIZE)
		const n = sets.length + 1
		sets.push({
			setId: `candidate-set-${String(n).padStart(2, '0')}`,
			titleRu: `Набор ${n}`,
			displayOrder: n,
			puzzleIds: chunk.map((r) => r.id),
		})
	}

	const { maxDiff, maxCol, maxSize } = streakStats(order)
	return {
		sets,
		order: order.map((r) => r.id),
		maxDifficultyStreak: maxDiff,
		maxCollectionStreak: maxCol,
		maxSizeStreak: maxSize,
		unlockAfterCompletions: UNLOCK_AFTER,
	}
}
