/**
 * Diversity-aware pilot selection (Phase 8A.1).
 *
 * Order of concerns (documented tie-break):
 * 1. Tier quota
 * 2. Prefer new concept over 2nd composition of existing concept
 * 3. Pattern / Expert-pattern caps
 * 4. Family share cap
 * 5. Collection balance (underrepresented first)
 * 6. Fewer structural warnings
 * 7. Prefer authored over procedural (soft)
 * 8. Stable puzzle id
 */

import type { DifficultyTier } from '../../src/domain/difficulty/tiers'
import {
	MAX_COLLECTION_SHARE_WARN,
	MAX_CONCEPT_FREQUENCY,
	MAX_EXPERT_PATTERN_COUNT,
	MAX_FAMILY_SHARE,
	MAX_PATTERN_COUNT,
	MIN_DISTINCT_CONCEPTS,
	PILOT_TARGET,
	PILOT_TIER_QUOTA,
} from './constants'
import type { CandidateAuditRecord } from './types'

export type TierQuota = Readonly<Record<DifficultyTier, number>>

export interface DiversitySelectionResult {
	readonly selected: readonly CandidateAuditRecord[]
	readonly quotaTarget: TierQuota
	readonly quotaActual: TierQuota
	readonly shortage: readonly DifficultyTier[]
	readonly patternShare: number
	readonly patternCount: number
	readonly expertPatternCount: number
	readonly distinctConcepts: number
	readonly maxConceptFrequency: number
	readonly maxFamilyShare: number
	readonly maxCollectionShare: number
	readonly gateFailures: readonly string[]
	readonly notSelected: readonly CandidateAuditRecord[]
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

function isPattern(row: CandidateAuditRecord): boolean {
	return row.kind === 'pattern' || row.collectionId === 'patterns'
}

function qualityRank(row: CandidateAuditRecord): number {
	// Lower is better.
	let rank = row.warnings.length * 10
	if (row.sourceKind === 'procedural') {
		rank += 2
	}
	if (row.kind === 'pattern') {
		rank += 5
	}
	// Prefer healthier canvas usage.
	if (row.bboxCoverage < 0.2) {
		rank += 3
	}
	if (row.fillRatio < 0.08 || row.fillRatio > 0.85) {
		rank += 2
	}
	// Prefer mid sizes for objects (10–15).
	const cells = row.width * row.height
	if (cells >= 80 && cells <= 225) {
		rank -= 1
	}
	return rank
}

function compareCandidates(
	a: CandidateAuditRecord,
	b: CandidateAuditRecord,
	usedCollections: ReadonlyMap<string, number>,
	usedFamilies: ReadonlyMap<string, number>,
	usedConcepts: ReadonlySet<string>,
): number {
	const aNewConcept = usedConcepts.has(a.conceptId) ? 1 : 0
	const bNewConcept = usedConcepts.has(b.conceptId) ? 1 : 0
	if (aNewConcept !== bNewConcept) {
		return aNewConcept - bNewConcept
	}
	const ca = usedCollections.get(a.collectionId) ?? 0
	const cb = usedCollections.get(b.collectionId) ?? 0
	if (ca !== cb) {
		return ca - cb
	}
	const fa = usedFamilies.get(a.family) ?? 0
	const fb = usedFamilies.get(b.family) ?? 0
	if (fa !== fb) {
		return fa - fb
	}
	const qa = qualityRank(a)
	const qb = qualityRank(b)
	if (qa !== qb) {
		return qa - qb
	}
	return a.id.localeCompare(b.id)
}

function canTake(
	row: CandidateAuditRecord,
	selected: readonly CandidateAuditRecord[],
	target: number,
): { readonly ok: boolean; readonly reason: string | null } {
	const conceptCount = selected.filter((s) => s.conceptId === row.conceptId).length
	if (conceptCount >= MAX_CONCEPT_FREQUENCY) {
		return { ok: false, reason: 'concept_cap' }
	}
	if (conceptCount === 1) {
		const existing = selected.find((s) => s.conceptId === row.conceptId)!
		if (existing.compositionId === row.compositionId) {
			return { ok: false, reason: 'duplicate_composition' }
		}
		if (
			existing.compositionId === 'default' &&
			row.compositionId === 'default'
		) {
			return { ok: false, reason: 'duplicate_default_composition' }
		}
	}

	const patterns = selected.filter(isPattern).length
	if (isPattern(row) && patterns >= MAX_PATTERN_COUNT) {
		return { ok: false, reason: 'pattern_cap' }
	}

	const expertPatterns = selected.filter(
		(s) => s.tier === 'EXPERT' && isPattern(s),
	).length
	if (
		row.tier === 'EXPERT' &&
		isPattern(row) &&
		expertPatterns >= MAX_EXPERT_PATTERN_COUNT
	) {
		return { ok: false, reason: 'expert_pattern_cap' }
	}

	const familyCount = selected.filter((s) => s.family === row.family).length
	if ((familyCount + 1) / target > MAX_FAMILY_SHARE + 1e-9) {
		return { ok: false, reason: 'family_cap' }
	}

	const titleCount = selected.filter((s) => s.titleRu === row.titleRu).length
	if (titleCount >= 1) {
		// Exact title duplicates only allowed for distinct concept+composition pairs
		// that intentionally share wording — still block same title by default.
		return { ok: false, reason: 'duplicate_title' }
	}

	return { ok: true, reason: null }
}

/**
 * Select up to PILOT_TARGET with tier quotas and semantic diversity gates.
 */
export function selectWithDiversity(
	passed: readonly CandidateAuditRecord[],
	quota: TierQuota = PILOT_TIER_QUOTA,
	target = PILOT_TARGET,
): DiversitySelectionResult {
	const byTier = new Map<DifficultyTier, CandidateAuditRecord[]>()
	for (const row of passed) {
		if (row.tier === 'UNRATED' || !row.productionReady) {
			continue
		}
		const list = byTier.get(row.tier) ?? []
		list.push(row)
		byTier.set(row.tier, list)
	}

	const selected: CandidateAuditRecord[] = []
	const usedCollections = new Map<string, number>()
	const usedFamilies = new Map<string, number>()
	const usedConcepts = new Set<string>()
	const usedCompositions = new Set<string>()
	const actual = emptyQuota()
	const shortage: DifficultyTier[] = []
	const skipped = new Map<string, string>()

	const tiers = Object.keys(quota) as DifficultyTier[]
	for (const tier of tiers) {
		const need = quota[tier]
		const pool = [...(byTier.get(tier) ?? [])]
		let taken = 0
		while (taken < need && pool.length > 0) {
			pool.sort((a, b) =>
				compareCandidates(
					a,
					b,
					usedCollections,
					usedFamilies,
					usedConcepts,
				),
			)
			let pickedIndex = -1
			for (let i = 0; i < pool.length; i += 1) {
				const candidate = pool[i]!
				const gate = canTake(candidate, selected, target)
				if (gate.ok) {
					pickedIndex = i
					break
				}
				skipped.set(candidate.id, gate.reason ?? 'diversity')
			}
			if (pickedIndex < 0) {
				break
			}
			const next = pool.splice(pickedIndex, 1)[0]!
			selected.push({ ...next, notSelectedReason: null })
			usedCollections.set(
				next.collectionId,
				(usedCollections.get(next.collectionId) ?? 0) + 1,
			)
			usedFamilies.set(
				next.family,
				(usedFamilies.get(next.family) ?? 0) + 1,
			)
			usedConcepts.add(next.conceptId)
			usedCompositions.add(`${next.conceptId}::${next.compositionId}`)
			taken += 1
			actual[tier] += 1
		}
		if (taken < need) {
			shortage.push(tier)
		}
	}

	const selectedIds = new Set(selected.map((r) => r.id))
	const notSelected: CandidateAuditRecord[] = passed
		.filter((r) => !selectedIds.has(r.id))
		.map((r) => ({
			...r,
			notSelectedReason:
				skipped.get(r.id) ??
				(shortage.length > 0 ? 'tier_quota_full_or_unmet' : 'not_needed'),
		}))
		.sort((a, b) => a.id.localeCompare(b.id))

	selected.sort((a, b) => a.id.localeCompare(b.id))

	const patternCount = selected.filter(isPattern).length
	const expertPatternCount = selected.filter(
		(s) => s.tier === 'EXPERT' && isPattern(s),
	).length
	const conceptFreq = new Map<string, number>()
	const familyFreq = new Map<string, number>()
	const collectionFreq = new Map<string, number>()
	for (const row of selected) {
		conceptFreq.set(row.conceptId, (conceptFreq.get(row.conceptId) ?? 0) + 1)
		familyFreq.set(row.family, (familyFreq.get(row.family) ?? 0) + 1)
		collectionFreq.set(
			row.collectionId,
			(collectionFreq.get(row.collectionId) ?? 0) + 1,
		)
	}
	const maxConceptFrequency =
		conceptFreq.size === 0
			? 0
			: Math.max(...conceptFreq.values())
	const maxFamilyShare =
		selected.length === 0
			? 0
			: Math.max(0, ...[...familyFreq.values()].map((n) => n / selected.length))
	const maxCollectionShare =
		selected.length === 0
			? 0
			: Math.max(
					0,
					...[...collectionFreq.values()].map((n) => n / selected.length),
				)

	const gateFailures: string[] = []
	if (selected.length !== target) {
		gateFailures.push(`selected_count=${selected.length} expected=${target}`)
	}
	if (shortage.length > 0) {
		gateFailures.push(`tier_shortage=${shortage.join(',')}`)
	}
	if (conceptFreq.size < MIN_DISTINCT_CONCEPTS) {
		gateFailures.push(
			`distinct_concepts=${conceptFreq.size} expected>=${MIN_DISTINCT_CONCEPTS}`,
		)
	}
	if (maxConceptFrequency > MAX_CONCEPT_FREQUENCY) {
		gateFailures.push(`max_concept_frequency=${maxConceptFrequency}`)
	}
	if (patternCount > MAX_PATTERN_COUNT) {
		gateFailures.push(`pattern_count=${patternCount}`)
	}
	if (selected.length > 0 && patternCount / selected.length > MAX_PATTERN_COUNT / target) {
		// share vs absolute already covered by count for n=100
	}
	if (expertPatternCount > MAX_EXPERT_PATTERN_COUNT) {
		gateFailures.push(`expert_patterns=${expertPatternCount}`)
	}
	if (maxFamilyShare > MAX_FAMILY_SHARE + 1e-9) {
		gateFailures.push(`max_family_share=${maxFamilyShare.toFixed(3)}`)
	}
	if (maxCollectionShare > MAX_COLLECTION_SHARE_WARN + 1e-9) {
		const patternsShare =
			(collectionFreq.get('patterns') ?? 0) / Math.max(1, selected.length)
		if (patternsShare > 0.1 + 1e-9) {
			gateFailures.push(`patterns_collection_share=${patternsShare.toFixed(3)}`)
		}
		// Non-pattern collections above warn threshold are soft unless extreme.
	}

	return {
		selected,
		quotaTarget: quota,
		quotaActual: actual,
		shortage,
		patternShare: selected.length === 0 ? 0 : patternCount / selected.length,
		patternCount,
		expertPatternCount,
		distinctConcepts: conceptFreq.size,
		maxConceptFrequency,
		maxFamilyShare,
		maxCollectionShare,
		gateFailures,
		notSelected,
	}
}

/** Keep legacy name used by older tests; delegates to diversity selector. */
export function selectByTierQuota(
	passed: readonly CandidateAuditRecord[],
	quota: TierQuota = PILOT_TIER_QUOTA,
	target = PILOT_TARGET,
): DiversitySelectionResult {
	return selectWithDiversity(passed, quota, target)
}
