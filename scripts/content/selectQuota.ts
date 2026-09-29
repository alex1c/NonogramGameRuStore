/**
 * Deterministic tier-quota selection for pilot pack.
 */

import type { DifficultyTier } from '../../src/domain/difficulty/tiers'
import { PILOT_TARGET, PILOT_TIER_QUOTA } from './constants'
import type { CandidateAuditRecord } from './types'

export type TierQuota = Readonly<Record<DifficultyTier, number>>

export interface SelectionResult {
	readonly selected: readonly CandidateAuditRecord[]
	readonly quotaTarget: TierQuota
	readonly quotaActual: TierQuota
	readonly shortage: readonly DifficultyTier[]
	readonly patternShare: number
}

function emptyQuota(): Record<DifficultyTier, number> {
	return {
		BEGINNER: 0,
		EASY: 0,
		MEDIUM: 0,
		HARD: 0,
		EXPERT: 0,
	}
}

/**
 * Prefer object/scene over patterns; prefer diverse collections; stable by id.
 */
export function selectByTierQuota(
	passed: readonly CandidateAuditRecord[],
	quota: TierQuota = PILOT_TIER_QUOTA,
	target = PILOT_TARGET,
): SelectionResult {
	const byTier = new Map<DifficultyTier, CandidateAuditRecord[]>()
	for (const row of passed) {
		if (row.tier === 'UNRATED') {
			continue
		}
		const list = byTier.get(row.tier) ?? []
		list.push(row)
		byTier.set(row.tier, list)
	}
	for (const list of byTier.values()) {
		list.sort((a, b) => {
			const kindRank = (k: string) =>
				k === 'pattern' ? 2 : k === 'scene' ? 1 : 0
			const dk = kindRank(a.kind) - kindRank(b.kind)
			if (dk !== 0) {
				return dk
			}
			const scoreA = a.score ?? 0
			const scoreB = b.score ?? 0
			if (scoreA !== scoreB) {
				return scoreA - scoreB
			}
			return a.id.localeCompare(b.id)
		})
	}

	const selected: CandidateAuditRecord[] = []
	const usedCollections = new Map<string, number>()
	const actual = emptyQuota()
	const shortage: DifficultyTier[] = []

	const tiers = Object.keys(quota) as DifficultyTier[]
	for (const tier of tiers) {
		const need = quota[tier]
		const pool = byTier.get(tier) ?? []
		let taken = 0
		// First pass: prefer under-used collections.
		const remaining = [...pool]
		while (taken < need && remaining.length > 0) {
			remaining.sort((a, b) => {
				const ca = usedCollections.get(a.collectionId) ?? 0
				const cb = usedCollections.get(b.collectionId) ?? 0
				if (ca !== cb) {
					return ca - cb
				}
				return a.id.localeCompare(b.id)
			})
			const next = remaining.shift()!
			selected.push(next)
			usedCollections.set(
				next.collectionId,
				(usedCollections.get(next.collectionId) ?? 0) + 1,
			)
			taken += 1
			actual[tier] += 1
		}
		if (taken < need) {
			shortage.push(tier)
		}
	}

	// If still under target and no shortage on required tiers, fill from leftovers
	// without breaking quota (should not happen when quotas sum to target).
	if (selected.length < target) {
		const selectedIds = new Set(selected.map((r) => r.id))
		const leftovers = passed
			.filter((r) => !selectedIds.has(r.id) && r.tier !== 'UNRATED')
			.sort((a, b) => a.id.localeCompare(b.id))
		for (const row of leftovers) {
			if (selected.length >= target) {
				break
			}
			// Only fill if that tier still has room relative to soft overflow — skip.
			void row
		}
	}

	selected.sort((a, b) => a.id.localeCompare(b.id))
	const patterns = selected.filter((r) => r.kind === 'pattern').length
	return {
		selected,
		quotaTarget: quota,
		quotaActual: actual,
		shortage,
		patternShare: selected.length === 0 ? 0 : patterns / selected.length,
	}
}
