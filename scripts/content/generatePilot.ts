/**
 * Deterministic Batch 250 generation (Phase 8B).
 * npm run content:generate-b250
 *
 * Writes generated/content-b250/ + review-artifacts/.../b250-r1/
 * Does NOT modify runtime Campaign / Gallery / Daily.
 * Does NOT overwrite historical R1 / R2 baselines.
 */

import fs from 'node:fs'
import path from 'node:path'
import {
	generateColumnClues,
	generateRowClues,
	gridFromMatrix,
} from '../../src/domain/nonogram/clues'
import {
	CONTENT_CATALOG_VERSION,
	CONTENT_GENERATOR_VERSION,
	MAX_CANDIDATE_ATTEMPTS,
	MAX_EXPERT_PATTERN_COUNT,
	MAX_PATTERN_COUNT,
	MIN_DISTINCT_CONCEPTS,
	NEAR_DUPLICATE_PAIR_TARGET,
	PILOT_R1_HUMAN_STATUS,
	PILOT_R1_REJECTED_CHECKSUM,
	PILOT_R2_CHECKSUM,
	PILOT_TARGET,
	PILOT_TIER_QUOTA,
} from './constants'
import { arrangePilotCampaign } from './campaignSim'
import { buildContactSheetHtml } from './contactSheet'
import {
	findDuplicateTitles,
	findExactDuplicateIds,
	findTransformDuplicatePairs,
	topNearDuplicatePairs,
} from './duplicates'
import { checksumManifest } from './hash'
import { contentPaths } from './paths'
import { buildRawCandidatePool } from './pool'
import { selectWithDiversity } from './selectQuota'
import type {
	CandidateAuditRecord,
	PilotManifest,
	PilotManifestPuzzle,
	RejectReason,
} from './types'
import {
	DIFFICULTY_MODEL_VERSION,
	validateRawCandidate,
} from './validateCandidate'
import { parseAscii } from './bitmap'

interface RejectionEntry {
	readonly solutionHash?: string | null
	readonly id?: string | null
}

function loadRejections(filePath: string): {
	readonly ids: ReadonlySet<string>
	readonly hashes: ReadonlySet<string>
} {
	if (!fs.existsSync(filePath)) {
		return { ids: new Set(), hashes: new Set() }
	}
	const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as RejectionEntry[]
	const ids = new Set<string>()
	const hashes = new Set<string>()
	for (const entry of raw) {
		if (typeof entry.id === 'string' && entry.id.trim()) {
			ids.add(entry.id)
		}
		if (typeof entry.solutionHash === 'string' && entry.solutionHash.trim()) {
			hashes.add(entry.solutionHash)
		}
	}
	return { ids, hashes }
}

function ensureDir(dir: string): void {
	fs.mkdirSync(dir, { recursive: true })
}

function countRejects(
	rows: readonly CandidateAuditRecord[],
): Record<string, number> {
	const bag: Record<string, number> = {}
	for (const row of rows) {
		if (row.rejectReason === null) {
			continue
		}
		bag[row.rejectReason] = (bag[row.rejectReason] ?? 0) + 1
	}
	return bag
}

function buildManifestPuzzle(row: CandidateAuditRecord): PilotManifestPuzzle {
	const matrix = parseAscii(row.ascii.split('\n'))
	const grid = gridFromMatrix(matrix as readonly (readonly number[])[])
	return {
		id: row.id,
		titleRu: row.titleRu,
		collectionId: row.collectionId,
		conceptId: row.conceptId,
		compositionId: row.compositionId,
		family: row.family,
		variant: row.variant,
		kind: row.kind,
		sourceKind: row.sourceKind,
		contentRole: row.contentRole,
		width: row.width,
		height: row.height,
		ascii: row.ascii,
		solutionHash: row.solutionHash,
		canonicalHash: row.canonicalHash,
		tier: row.tier === 'UNRATED' ? 'BEGINNER' : row.tier,
		score: row.score ?? 0,
		difficultyModelVersion: DIFFICULTY_MODEL_VERSION,
		dailyEligible: row.dailyEligible,
		reviewStatus: 'candidate',
		seed: row.seed,
		warnings: row.warnings,
		rowClues: generateRowClues(grid),
		columnClues: generateColumnClues(grid),
	}
}

function stableManifestChecksum(puzzles: readonly PilotManifestPuzzle[]): string {
	const normalized = puzzles.map((p) => ({
		id: p.id,
		conceptId: p.conceptId,
		compositionId: p.compositionId,
		solutionHash: p.solutionHash,
		canonicalHash: p.canonicalHash,
		titleRu: p.titleRu,
		collectionId: p.collectionId,
		width: p.width,
		height: p.height,
		tier: p.tier,
		score: p.score,
		ascii: p.ascii,
		rowClues: p.rowClues,
		columnClues: p.columnClues,
		family: p.family,
		kind: p.kind,
		sourceKind: p.sourceKind,
		seed: p.seed,
		dailyEligible: p.dailyEligible,
	}))
	normalized.sort((a, b) => a.id.localeCompare(b.id))
	return checksumManifest(
		JSON.stringify({
			catalogVersion: CONTENT_CATALOG_VERSION,
			generatorVersion: CONTENT_GENERATOR_VERSION,
			puzzles: normalized,
		}),
	)
}

function conceptStats(selected: readonly CandidateAuditRecord[]) {
	const map = new Map<
		string,
		{ count: number; compositions: string[]; titles: string[]; ids: string[] }
	>()
	for (const row of selected) {
		const cur = map.get(row.conceptId) ?? {
			count: 0,
			compositions: [],
			titles: [],
			ids: [],
		}
		cur.count += 1
		cur.compositions.push(row.compositionId)
		cur.titles.push(row.titleRu)
		cur.ids.push(row.id)
		map.set(row.conceptId, cur)
	}
	return map
}

export interface GeneratePilotResult {
	readonly ok: boolean
	readonly checksum: string
	readonly selectedCount: number
	readonly attempts: number
	readonly shortage: readonly string[]
	readonly gateFailures: readonly string[]
	readonly rejectCounts: Record<string, number>
	readonly manifestPath: string
	readonly contactSheetPath: string
}

export function generatePilot(): GeneratePilotResult {
	const started = performance.now()
	const paths = contentPaths()
	ensureDir(paths.generatedPilotDir)
	ensureDir(paths.reviewPilotDir)

	const rejections = loadRejections(paths.rejectionsPath)
	const pool = buildRawCandidatePool()
	if (pool.length > MAX_CANDIDATE_ATTEMPTS) {
		throw new Error(
			`Candidate pool ${pool.length} exceeds MAX_CANDIDATE_ATTEMPTS ${MAX_CANDIDATE_ATTEMPTS}`,
		)
	}

	const knownExact = new Set<string>([...rejections.hashes])
	const knownCanon = new Set<string>()
	const knownIds = new Set<string>([...rejections.ids])
	const validated: CandidateAuditRecord[] = []
	const bitmaps = new Map<string, (typeof pool)[number]['bitmap']>()
	const rejectRows: CandidateAuditRecord[] = []

	const validationStarted = performance.now()
	for (const raw of pool) {
		if (rejections.ids.has(raw.id)) {
			const skipped = validateRawCandidate(raw)
			rejectRows.push({
				...skipped,
				rejectReason: 'human_rejected' as RejectReason,
				productionReady: false,
			})
			continue
		}
		const row = validateRawCandidate(raw, {
			knownExactHashes: knownExact,
			knownCanonicalHashes: knownCanon,
			knownIds,
		})
		bitmaps.set(raw.id, raw.bitmap)
		if (
			row.rejectReason === null &&
			row.productionReady &&
			row.hintChainSolved &&
			row.tier !== 'UNRATED'
		) {
			knownExact.add(row.solutionHash)
			knownCanon.add(row.canonicalHash)
			knownIds.add(row.id)
			validated.push(row)
		} else {
			rejectRows.push(row)
			if (row.solutionHash) {
				knownExact.add(row.solutionHash)
			}
			if (row.canonicalHash) {
				knownCanon.add(row.canonicalHash)
			}
			knownIds.add(row.id)
		}
	}
	const validationMs = performance.now() - validationStarted

	const selection = selectWithDiversity(validated)
	const selected = selection.selected
	const concepts = conceptStats(selected)
	const near = topNearDuplicatePairs(selected, bitmaps, 50)
	const exactDupes = findExactDuplicateIds(selected)
	const transformDupes = findTransformDuplicatePairs(selected)
	const titleDupes = findDuplicateTitles(selected)
	const rejectCounts = countRejects(rejectRows)

	const repeatedConcepts = [...concepts.entries()]
		.filter(([, v]) => v.count > 1)
		.map(([conceptId, v]) => ({
			conceptId,
			ids: v.ids,
			compositions: v.compositions,
			titles: v.titles,
		}))
		.sort((a, b) => a.conceptId.localeCompare(b.conceptId))

	const gateFailures = [...selection.gateFailures]
	if (exactDupes.length > 0) {
		gateFailures.push('exact_duplicates')
	}
	if (transformDupes.length > 0) {
		gateFailures.push('transform_duplicates')
	}
	if (Object.keys(titleDupes).length > 0) {
		gateFailures.push(`duplicate_titles=${Object.keys(titleDupes).length}`)
	}
	const nearDuplicateWarning =
		near.length > NEAR_DUPLICATE_PAIR_TARGET
			? `near_duplicate_pairs=${near.length}>target_${NEAR_DUPLICATE_PAIR_TARGET}`
			: null
	if (nearDuplicateWarning) {
		gateFailures.push(`WARNING:${nearDuplicateWarning}`)
	}

	const hardGateFailures = gateFailures.filter((g) => !g.startsWith('WARNING:'))
	const ok =
		selected.length === PILOT_TARGET &&
		selection.shortage.length === 0 &&
		selection.distinctConcepts >= MIN_DISTINCT_CONCEPTS &&
		selection.maxConceptFrequency <= 2 &&
		selection.patternCount <= MAX_PATTERN_COUNT &&
		selection.expertPatternCount <= MAX_EXPERT_PATTERN_COUNT &&
		exactDupes.length === 0 &&
		transformDupes.length === 0 &&
		Object.keys(titleDupes).length === 0 &&
		hardGateFailures.length === 0 &&
		selected.every(
			(r) =>
				r.contentRole === 'production' &&
				r.rewardQualityStructuralPass &&
				r.productionReady &&
				r.unique &&
				r.logicallySolvable &&
				r.hintChainSolved,
		)

	const manifestPuzzles = selected.map(buildManifestPuzzle)
	const checksum = stableManifestChecksum(manifestPuzzles)
	if (checksum === PILOT_R1_REJECTED_CHECKSUM) {
		gateFailures.push('checksum_equals_rejected_r1')
	}

	const manifest: PilotManifest = {
		catalogVersion: CONTENT_CATALOG_VERSION,
		generatorVersion: CONTENT_GENERATOR_VERSION,
		reportVersion: 2,
		reviewStatus: 'candidate',
		puzzleCount: manifestPuzzles.length,
		checksum,
		puzzles: manifestPuzzles,
	}

	const bySize: Record<string, number> = {}
	const byCollection: Record<string, number> = {}
	const byFamily: Record<string, number> = {}
	const byTier: Record<string, number> = {
		BEGINNER: 0,
		EASY: 0,
		MEDIUM: 0,
		HARD: 0,
		EXPERT: 0,
	}
	for (const row of selected) {
		bySize[row.sizeKey] = (bySize[row.sizeKey] ?? 0) + 1
		byCollection[row.collectionId] =
			(byCollection[row.collectionId] ?? 0) + 1
		byFamily[row.family] = (byFamily[row.family] ?? 0) + 1
		byTier[String(row.tier)] = (byTier[String(row.tier)] ?? 0) + 1
	}

	const patterns = selected.filter(
		(r) => r.kind === 'pattern' || r.collectionId === 'patterns',
	)
	const experts = selected.filter((r) => r.tier === 'EXPERT')
	const size5 = selected.filter((r) => r.width === 5 && r.height === 5)
	const simpleHigh = selected.filter((r) =>
		r.warnings.includes('simple_high_tier'),
	)
	const largeEasy = selected.filter((r) =>
		r.warnings.includes('large_easy_tier'),
	)

	const campaign = arrangePilotCampaign(selected)
	const generationMs = performance.now() - started

	const r1 = fs.existsSync(paths.r1BaselineReport)
		? (JSON.parse(fs.readFileSync(paths.r1BaselineReport, 'utf8')) as {
				readonly counts?: { readonly poolSize?: number }
				readonly distributions?: {
					readonly patternShare?: number
					readonly byCollection?: Record<string, number>
				}
				readonly quality?: {
					readonly nearDuplicates?: unknown[]
					readonly duplicateTitles?: Record<string, unknown>
				}
				readonly performance?: {
					readonly generationMs?: number
					readonly validationMs?: number
				}
				readonly hintReasons?: { readonly total?: Record<string, number> }
			})
		: null

	const r2 = fs.existsSync(paths.r2BaselineReport)
		? (JSON.parse(fs.readFileSync(paths.r2BaselineReport, 'utf8')) as {
				readonly diversity?: {
					readonly distinctConcepts?: number
					readonly maxConceptFrequency?: number
					readonly patternCount?: number
					readonly patternShare?: number
					readonly expertPatternCount?: number
				}
				readonly distributions?: {
					readonly byCollection?: Record<string, number>
				}
				readonly quality?: {
					readonly nearDuplicates?: unknown[]
					readonly duplicateTitles?: Record<string, unknown>
				}
				readonly logic?: {
					readonly logical?: number
					readonly hintChain?: number
				}
			})
		: null

	const allAudited = [...validated, ...rejectRows]
	const rewardFlagStats = (
		flag: string,
	): { generated: number; rejected: number; selected: number } => {
		const generated = allAudited.filter((r) =>
			r.rewardQualityFlags.includes(flag),
		).length
		const rejected = rejectRows.filter(
			(r) =>
				r.rejectReason === 'reward_quality' &&
				r.rewardQualityFlags.includes(flag),
		).length
		const selectedCount = selected.filter((r) =>
			r.rewardQualityFlags.includes(flag),
		).length
		return { generated, rejected, selected: selectedCount }
	}

	const PRIMITIVE_REGRESSION = [
		{ id: 'beg-bar', titleRu: 'Планка' },
		{ id: 'beg-corner', titleRu: 'Угол' },
		{ id: 'beg-dash', titleRu: 'Тире' },
		{ id: 'beg-ledge', titleRu: 'Уступ' },
		{ id: 'beg-line-h', titleRu: 'Линия' },
		{ id: 'beg-line-v', titleRu: 'Столбик' },
	] as const

	const primitiveFate = PRIMITIVE_REGRESSION.map((p) => {
		const inSelected = selected.some((r) => r.id === p.id)
		const inPool = pool.some((r) => r.id === p.id)
		const audited = allAudited.find((r) => r.id === p.id)
		return {
			id: p.id,
			titleRu: p.titleRu,
			sourceRetained: true,
			role: 'tutorial' as const,
			productionSelected: inSelected,
			inProductionPool: inPool,
			rejectReason: audited?.rejectReason ?? null,
			reason: inSelected
				? 'FAIL — must not enter production 250'
				: 'excluded from production pool (tutorial role)',
		}
	})

	const goodSimpleExamples = selected
		.filter(
			(r) =>
				r.kind === 'symbol' &&
				['heart', 'star', 'bold-arrow', 'quarter-note', 'slim-crescent'].includes(
					r.conceptId,
				),
		)
		.map((r) => ({
			id: r.id,
			titleRu: r.titleRu,
			conceptId: r.conceptId,
			sizeKey: r.sizeKey,
			tier: r.tier,
		}))

	const roleCounts = {
		production: selected.filter((r) => r.contentRole === 'production').length,
		tutorial: selected.filter((r) => r.contentRole === 'tutorial').length,
		dev: selected.filter((r) => r.contentRole === 'dev').length,
	}

	/** Deterministic mulberry32 for review samples. */
	function mulberry32(seed: number): () => number {
		let t = seed >>> 0
		return () => {
			t += 0x6d2b79f5
			let r = Math.imul(t ^ (t >>> 15), 1 | t)
			r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
			return ((r ^ (r >>> 14)) >>> 0) / 4294967296
		}
	}

	function pickUnique(
		candidates: readonly CandidateAuditRecord[],
		n: number,
		used: Set<string>,
	): CandidateAuditRecord[] {
		const out: CandidateAuditRecord[] = []
		for (const row of candidates) {
			if (out.length >= n) {
				break
			}
			if (used.has(row.id) || used.has(row.conceptId)) {
				continue
			}
			used.add(row.id)
			used.add(row.conceptId)
			out.push(row)
		}
		return out
	}

	const shortlistUsed = new Set<string>()
	const blindShortlist = [
		...pickUnique(
			selected.filter((r) => r.collectionId === 'animals'),
			5,
			shortlistUsed,
		),
		...pickUnique(
			selected.filter((r) => r.collectionId === 'objects'),
			5,
			shortlistUsed,
		),
		...pickUnique(
			selected.filter(
				(r) => r.collectionId === 'food' || r.collectionId === 'drinks',
			),
			5,
			shortlistUsed,
		),
		...pickUnique(
			selected.filter(
				(r) => r.collectionId === 'transport' || r.collectionId === 'city',
			),
			5,
			shortlistUsed,
		),
		...pickUnique(
			selected.filter(
				(r) => r.collectionId === 'nature' || r.collectionId === 'plants',
			),
			5,
			shortlistUsed,
		),
		...pickUnique(
			selected.filter((r) => r.kind === 'scene'),
			5,
			shortlistUsed,
		),
		...pickUnique(
			selected.filter((r) => r.tier === 'EXPERT'),
			5,
			shortlistUsed,
		),
		...pickUnique(
			selected.filter(
				(r) =>
					r.kind === 'symbol' ||
					(r.width <= 5 && r.height <= 5),
			),
			5,
			shortlistUsed,
		),
	].map((r) => r.id)

	const rng = mulberry32(0x8b250001)
	const shuffled = [...selected].sort((a, b) => {
		const ra = rng()
		const rb = rng()
		return ra < rb ? -1 : ra > rb ? 1 : a.id.localeCompare(b.id)
	})
	const randomSample30 = shuffled.slice(0, 30).map((r) => r.id)

	const worstCase20 = [...selected]
		.map((r) => {
			let risk = r.warnings.length * 10
			if (r.rewardQualityFlags.length > 0) {
				risk += r.rewardQualityFlags.length * 15
			}
			if (r.componentCount >= 6) {
				risk += 8
			}
			if (r.bboxCoverage < 0.2) {
				risk += 6
			}
			if (r.warnings.includes('simple_high_tier')) {
				risk += 20
			}
			const nearHit = near.some(
				(p) => p.idA === r.id || p.idB === r.id,
			)
			if (nearHit) {
				risk += 25
			}
			return { id: r.id, risk }
		})
		.sort((a, b) => b.risk - a.risk || a.id.localeCompare(b.id))
		.slice(0, 20)
		.map((x) => x.id)

	const report = {
		reportVersion: 2 as const,
		status: ok
			? 'PHASE_8B_B250_READY_FOR_HUMAN_REVIEW'
			: selection.shortage.length > 0 ||
				  selection.distinctConcepts < MIN_DISTINCT_CONCEPTS
				? 'BLOCKED_CONTENT_QUOTA_SHORTAGE'
				: 'FAIL',
		reviewStatus: 'candidate',
		catalogVersion: CONTENT_CATALOG_VERSION,
		generatorVersion: CONTENT_GENERATOR_VERSION,
		checksum,
		r1Baseline: {
			checksum: PILOT_R1_REJECTED_CHECKSUM,
			humanStatus: PILOT_R1_HUMAN_STATUS,
			patternShare: r1?.distributions?.patternShare ?? 0.22,
			collections: Object.keys(r1?.distributions?.byCollection ?? {}).length || 13,
			nearDuplicates: r1?.quality?.nearDuplicates?.length ?? 20,
			duplicateTitleGroups: Object.keys(r1?.quality?.duplicateTitles ?? {}).length || 19,
			poolSize: r1?.counts?.poolSize ?? 351,
			generationMs: r1?.performance?.generationMs ?? null,
			validationMs: r1?.performance?.validationMs ?? null,
			hintReasons: r1?.hintReasons?.total ?? null,
		},
		r2Baseline: {
			checksum: PILOT_R2_CHECKSUM,
			distinctConcepts: r2?.diversity?.distinctConcepts ?? 100,
			maxConceptFrequency: r2?.diversity?.maxConceptFrequency ?? 1,
			collections: Object.keys(r2?.distributions?.byCollection ?? {}).length || 17,
			patterns: r2?.diversity?.patternCount ?? 6,
			patternShare: r2?.diversity?.patternShare ?? 0.06,
			nearDuplicates: r2?.quality?.nearDuplicates?.length ?? 8,
			duplicateTitleGroups: Object.keys(r2?.quality?.duplicateTitles ?? {}).length || 0,
			logical: r2?.logic?.logical ?? 100,
			hintChain: r2?.logic?.hintChain ?? 100,
		},
		counts: {
			poolSize: pool.length,
			attempts: pool.length,
			acceptedValidated: validated.length,
			selected: selected.length,
			target: PILOT_TARGET,
			rejected: rejectRows.length,
			rejectCounts,
			notSelected: selection.notSelected.length,
		},
		quota: {
			target: PILOT_TIER_QUOTA,
			actual: selection.quotaActual,
			shortage: selection.shortage,
		},
		diversity: {
			distinctConcepts: selection.distinctConcepts,
			conceptsOnce: [...concepts.values()].filter((v) => v.count === 1).length,
			conceptsTwice: [...concepts.values()].filter((v) => v.count === 2).length,
			maxConceptFrequency: selection.maxConceptFrequency,
			patternCount: selection.patternCount,
			patternShare: selection.patternShare,
			expertPatternCount: selection.expertPatternCount,
			maxFamilyShare: selection.maxFamilyShare,
			maxCollectionShare: selection.maxCollectionShare,
			repeatedConcepts,
			gateFailures,
		},
		distributions: {
			byTier,
			bySize,
			byCollection,
			byFamily,
			patternShare: selection.patternShare,
		},
		roles: roleCounts,
		rewardQuality: {
			line_like: rewardFlagStats('line_like'),
			tiny_trivial: rewardFlagStats('tiny_trivial'),
			noise_like: rewardFlagStats('noise_like'),
			extreme_density: rewardFlagStats('extreme_density'),
			component_outlier: rewardFlagStats('component_outlier'),
			simple_high_tier: rewardFlagStats('simple_high_tier'),
			hardRejectSelected: selected.filter((r) => !r.rewardQualityStructuralPass)
				.length,
			primitiveRegression: primitiveFate,
			goodSimpleExamples,
		},
		quality: {
			exactDuplicates: exactDupes,
			transformDuplicates: transformDupes,
			nearDuplicates: near,
			duplicateTitles: titleDupes,
			suspiciousFillRatios: selected.filter(
				(r) => r.fillRatio < 0.05 || r.fillRatio > 0.9,
			),
			componentOutliers: selected.filter(
				(r) => r.singletons >= 5 || r.componentCount >= 8,
			),
			bboxOutliers: selected.filter((r) => r.bboxCoverage < 0.15),
			simpleHighTier: simpleHigh.map((r) => r.id),
			largeEasyTier: largeEasy.map((r) => r.id),
		},
		logic: {
			productionReady: selected.filter((r) => r.productionReady).length,
			unique: selected.filter((r) => r.unique).length,
			logical: selected.filter((r) => r.logicallySolvable).length,
			hintChain: selected.filter((r) => r.hintChainSolved).length,
		},
		lists: {
			patterns: patterns.map((r) => ({
				id: r.id,
				titleRu: r.titleRu,
				sizeKey: r.sizeKey,
				tier: r.tier,
				conceptId: r.conceptId,
			})),
			size5x5: size5.map((r) => ({
				id: r.id,
				titleRu: r.titleRu,
				collectionId: r.collectionId,
				tier: r.tier,
				conceptId: r.conceptId,
			})),
			experts: experts.map((r) => ({
				id: r.id,
				titleRu: r.titleRu,
				sizeKey: r.sizeKey,
				collectionId: r.collectionId,
				conceptId: r.conceptId,
				family: r.family,
				score: r.score,
				pattern: r.kind === 'pattern' || r.collectionId === 'patterns',
				warnings: r.warnings,
			})),
		},
		reviewSamples: {
			blindShortlist,
			randomSample30,
			worstCase20,
			expertIds: experts.map((r) => r.id),
			smallGridIds: size5.map((r) => r.id),
		},
		performance: {
			generationMs,
			validationMs,
			slowestComplete: [...selected].sort(
				(a, b) => b.completeMs - a.completeMs,
			)[0] ?? null,
			slowestLogical: [...selected].sort(
				(a, b) => b.logicalMs - a.logicalMs,
			)[0] ?? null,
			slowestHint: [...selected].sort((a, b) => b.hintMs - a.hintMs)[0] ?? null,
			size20: selected.filter((r) => r.width === 20 || r.height === 20),
			size25: selected.filter((r) => r.width === 25 || r.height === 25),
		},
		hintReasons: (() => {
			const total: Record<string, number> = {}
			const byTierHints: Record<string, Record<string, number>> = {}
			for (const row of selected) {
				const tierKey = String(row.tier)
				byTierHints[tierKey] = byTierHints[tierKey] ?? {}
				for (const [reason, count] of Object.entries(row.hintReasons)) {
					total[reason] = (total[reason] ?? 0) + count
					byTierHints[tierKey]![reason] =
						(byTierHints[tierKey]![reason] ?? 0) + count
				}
			}
			return { total, byTier: byTierHints }
		})(),
		campaignSimulation: campaign,
		comparison: {
			selected: { r1: 100, r2: 100, b250: selected.length },
			distinctConcepts: {
				r1: null,
				r2: r2?.diversity?.distinctConcepts ?? 100,
				b250: selection.distinctConcepts,
			},
			maxConceptFrequency: {
				r1: 'high',
				r2: r2?.diversity?.maxConceptFrequency ?? 1,
				b250: selection.maxConceptFrequency,
			},
			collections: {
				r1: 13,
				r2: Object.keys(r2?.distributions?.byCollection ?? {}).length || 17,
				b250: Object.keys(byCollection).length,
			},
			patterns: {
				r1: 22,
				r2: r2?.diversity?.patternCount ?? 6,
				b250: selection.patternCount,
			},
			patternShare: {
				r1: 0.22,
				r2: r2?.diversity?.patternShare ?? 0.06,
				b250: selection.patternShare,
			},
			nearDuplicates: {
				r1: 20,
				r2: r2?.quality?.nearDuplicates?.length ?? 8,
				b250: near.length,
			},
			duplicateTitleGroups: {
				r1: 19,
				r2: Object.keys(r2?.quality?.duplicateTitles ?? {}).length || 0,
				b250: Object.keys(titleDupes).length,
			},
			exactTransformDup: {
				r1: '0 / 0',
				r2: '0 / 0',
				b250: `${exactDupes.length} / ${transformDupes.length}`,
			},
			logicalPass: {
				r1: 100,
				r2: r2?.logic?.logical ?? 100,
				b250: selected.filter((r) => r.logicallySolvable).length,
			},
			hintChainPass: {
				r1: 100,
				r2: r2?.logic?.hintChain ?? 100,
				b250: selected.filter((r) => r.hintChainSolved).length,
			},
			structuralRewardQualityPass: {
				r1: null,
				r2: null,
				b250: selected.filter((r) => r.rewardQualityStructuralPass).length,
			},
		},
		achievementSticky: {
			schemaVersion: 4,
			unlockedAchievementIdsPersisted: true,
			note:
				'Sticky achievements (schema v4) land before Gallery taxonomy swap. B250 is candidate-only.',
		},
		runtimeIsolation: {
			campaignUntouched: true,
			galleryUntouched: true,
			dailyUntouched: true,
			schemaVersion: 4,
			candidateNotImported: true,
		},
		puzzles: selected,
		notSelectedSample: selection.notSelected.slice(0, 50),
		artifactSize: {
			manifestBytes: 0,
			estimated1000Bytes: 0,
			contactSheetBytes: 0,
		},
	}

	const contactHtml = buildContactSheetHtml(selected, {
		catalogVersion: CONTENT_CATALOG_VERSION,
		generatorVersion: CONTENT_GENERATOR_VERSION,
		checksum,
		nearDuplicates: near,
		repeatedConcepts,
		blindShortlist,
		randomSample30,
		worstCase20,
		distinctConcepts: selection.distinctConcepts,
		patternShare: selection.patternShare,
	})
	report.artifactSize = {
		manifestBytes: Buffer.byteLength(JSON.stringify(manifest), 'utf8'),
		estimated1000Bytes:
			Buffer.byteLength(JSON.stringify(manifest), 'utf8') * 10,
		contactSheetBytes: Buffer.byteLength(contactHtml, 'utf8'),
	}

	fs.writeFileSync(paths.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
	fs.writeFileSync(paths.checksumPath, `${checksum}\n`)
	fs.writeFileSync(paths.reportJsonPath, `${JSON.stringify(report, null, 2)}\n`)
	fs.writeFileSync(paths.contactSheetPath, contactHtml)

	const md = [
		'# Phase 8B Production Batch 250 — CANDIDATE',
		'',
		`STATUS: **${report.status}**`,
		'',
		`- catalog: ${CONTENT_CATALOG_VERSION}`,
		`- generator: ${CONTENT_GENERATOR_VERSION}`,
		`- checksum: \`${checksum}\``,
		`- R1 rejected: \`${PILOT_R1_REJECTED_CHECKSUM}\``,
		`- R2 baseline: \`${PILOT_R2_CHECKSUM}\``,
		`- selected: ${selected.length}`,
		`- distinctConcepts: ${selection.distinctConcepts}`,
		`- maxConceptFrequency: ${selection.maxConceptFrequency}`,
		`- patterns: ${selection.patternCount} (${(selection.patternShare * 100).toFixed(1)}%)`,
		`- expertPatterns: ${selection.expertPatternCount}`,
		`- nearDuplicates: ${near.length}`,
		`- duplicateTitles: ${Object.keys(titleDupes).length}`,
		`- gateFailures: ${gateFailures.join('; ') || 'none'}`,
		'',
		'## R1 / R2 / B250',
		'',
		'| Metric | Pilot R1 | Pilot R2 | Batch 250 |',
		'| --- | ---: | ---: | ---: |',
		`| Selected | 100 | 100 | ${selected.length} |`,
		`| Distinct concepts | n/a | ${r2?.diversity?.distinctConcepts ?? 100} | ${selection.distinctConcepts} |`,
		`| Max concept frequency | high | ${r2?.diversity?.maxConceptFrequency ?? 1} | ${selection.maxConceptFrequency} |`,
		`| Collections | 13 | ${Object.keys(r2?.distributions?.byCollection ?? {}).length || 17} | ${Object.keys(byCollection).length} |`,
		`| Patterns | 22 | ${r2?.diversity?.patternCount ?? 6} | ${selection.patternCount} |`,
		`| Pattern share | 22% | ${(((r2?.diversity?.patternShare ?? 0.06) * 100)).toFixed(0)}% | ${(selection.patternShare * 100).toFixed(1)}% |`,
		`| Near dup ≥0.92 | 20 | ${r2?.quality?.nearDuplicates?.length ?? 8} | ${near.length} |`,
		`| Duplicate title groups | 19 | ${Object.keys(r2?.quality?.duplicateTitles ?? {}).length || 0} | ${Object.keys(titleDupes).length} |`,
		`| Exact / transform dup | 0 / 0 | 0 / 0 | ${exactDupes.length} / ${transformDupes.length} |`,
		`| Logical PASS | 100 | ${r2?.logic?.logical ?? 100} | ${selected.filter((r) => r.logicallySolvable).length} |`,
		`| Hint-chain PASS | 100 | ${r2?.logic?.hintChain ?? 100} | ${selected.filter((r) => r.hintChainSolved).length} |`,
		`| Structural reward-quality PASS | n/a | n/a | ${selected.filter((r) => r.rewardQualityStructuralPass).length} |`,
		'',
		'## STOP',
		'',
		'READY FOR HUMAN B250 CONTACT-SHEET REVIEW',
		'',
		'Do not generate 251–1000. Do not integrate into runtime.',
		'',
		`Contact: \`${paths.contactSheetPath}\``,
		'',
	].join('\n')
	fs.writeFileSync(paths.reportMdPath, md)
	fs.writeFileSync(
		path.join(paths.generatedPilotDir, 'pilot-report.md'),
		md,
	)

	if (!ok) {
		console.error(
			`B250 BLOCKED/FAIL selected=${selected.length} shortage=${selection.shortage.join(',') || 'none'} concepts=${selection.distinctConcepts} gates=${gateFailures.join('|')}`,
		)
	} else {
		console.log(`B250 OK: ${selected.length} candidates checksum=${checksum}`)
	}
	console.log(`manifest: ${paths.manifestPath}`)
	console.log(`contact:  ${paths.contactSheetPath}`)

	return {
		ok,
		checksum,
		selectedCount: selected.length,
		attempts: pool.length,
		shortage: selection.shortage,
		gateFailures,
		rejectCounts,
		manifestPath: paths.manifestPath,
		contactSheetPath: paths.contactSheetPath,
	}
}

if (require.main === module) {
	const result = generatePilot()
	process.exitCode = result.ok ? 0 : 1
}
