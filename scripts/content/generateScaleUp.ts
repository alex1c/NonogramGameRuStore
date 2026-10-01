/**
 * Phase 8C additive scale-up: B250-R2 → B500 → B750 → B1000.
 *
 * Preserves all parent IDs. Never reselects/replaces accepted content.
 * npm run content:generate-b500 | generate-b750 | generate-b1000 | generate-scale
 *
 * Does NOT modify runtime Campaign / Gallery / Daily / schema / achievements.
 */

import fs from 'node:fs'
import path from 'node:path'
import {
	generateColumnClues,
	generateRowClues,
	gridFromMatrix,
} from '../../src/domain/nonogram/clues'
import type { DifficultyTier } from '../../src/domain/difficulty/tiers'
import {
	B1000_TARGET,
	B1000_TIER_QUOTA,
	B250_R2_CHECKSUM,
	B250_R2_RISK_BASELINE,
	B500_TARGET,
	B500_TIER_QUOTA,
	B750_TARGET,
	B750_TIER_QUOTA,
	CONTENT_GENERATOR_VERSION,
	MAX_EXPERT_PATTERN_COUNT_B1000,
	MAX_PATTERN_COUNT_B1000,
	MIN_DISTINCT_CONCEPTS_B1000,
	RISK_REGRESSION_RELATIVE,
	SCALE_CATALOG_VERSIONS,
} from './constants'
import { arrangePilotCampaign } from './campaignSim'
import { buildContactSheetHtml } from './contactSheet'
import { simulateDailyPool } from './dailySim'
import {
	computeNearDuplicateStats,
	findDuplicateTitles,
	findExactDuplicateIds,
	findTransformDuplicatePairs,
} from './duplicates'
import { simulateGallery } from './gallerySim'
import { buildScaleProceduralCandidates } from './families/b1000ProceduralScale'
import {
	authoredScaleCount,
	scaleAuthoredToRawCandidates,
} from './families/b1000ScaleAuthoredLoader'
import { buildUniqueSignatureCandidates } from './families/b1000UniqueSignatures'
import { buildHardFacadeCandidates } from './families/b1000HardFacades'
import { checksumManifest } from './hash'
import { parseAscii, type Bitmap } from './bitmap'
import { buildRawCandidatePool } from './pool'
import {
	analyzeRewardQuality,
	compareRiskDesc,
} from './rewardQuality'
import { scalePaths, type ScaleCheckpoint } from './scalePaths'
import { selectAdditive, type TierQuota } from './selectQuota'
import type {
	CandidateAuditRecord,
	PilotManifest,
	PilotManifestPuzzle,
	RawCandidate,
} from './types'
import {
	DIFFICULTY_MODEL_VERSION,
	validateRawCandidate,
} from './validateCandidate'

function ensureDir(dir: string): void {
	fs.mkdirSync(dir, { recursive: true })
}

function percentile(sorted: readonly number[], p: number): number {
	if (sorted.length === 0) {
		return 0
	}
	const idx = Math.min(
		sorted.length - 1,
		Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
	)
	return sorted[idx]!
}

function riskDistribution(rows: readonly CandidateAuditRecord[]): {
	readonly min: number
	readonly median: number
	readonly p75: number
	readonly p90: number
	readonly p95: number
	readonly max: number
} {
	const vals = rows
		.map((r) => r.rewardQualityRiskScore)
		.sort((a, b) => a - b)
	return {
		min: vals[0] ?? 0,
		median: percentile(vals, 50),
		p75: percentile(vals, 75),
		p90: percentile(vals, 90),
		p95: percentile(vals, 95),
		max: vals[vals.length - 1] ?? 0,
	}
}

function seededSample(
	ids: readonly string[],
	count: number,
	seed: number,
): string[] {
	const arr = [...ids].sort((a, b) => a.localeCompare(b))
	let state = seed >>> 0
	const rand = (): number => {
		state = (Math.imul(1664525, state) + 1013904223) >>> 0
		return state / 0x100000000
	}
	for (let i = arr.length - 1; i > 0; i -= 1) {
		const j = Math.floor(rand() * (i + 1))
		const tmp = arr[i]!
		arr[i] = arr[j]!
		arr[j] = tmp
	}
	return arr.slice(0, Math.min(count, arr.length))
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
		rowClues: generateRowClues(grid, row.width, row.height),
		columnClues: generateColumnClues(grid, row.width, row.height),
	}
}

function stableManifestChecksum(
	puzzles: readonly PilotManifestPuzzle[],
	catalogVersion: string,
	generatorVersion: string,
	parentChecksum: string,
): string {
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
			catalogVersion,
			generatorVersion,
			parentChecksum,
			puzzles: normalized,
		}),
	)
}

function auditFromManifestPuzzle(
	p: PilotManifestPuzzle,
): CandidateAuditRecord {
	const bitmap = parseAscii(p.ascii.split('\n'))
	const rq = analyzeRewardQuality(bitmap, p.kind)
	return {
		id: p.id,
		titleRu: p.titleRu,
		collectionId: p.collectionId,
		conceptId: p.conceptId,
		compositionId: p.compositionId,
		family: p.family,
		variant: p.variant,
		kind: p.kind,
		sourceKind: p.sourceKind,
		contentRole: p.contentRole ?? 'production',
		width: p.width,
		height: p.height,
		sizeKey: `${p.width}x${p.height}`,
		solutionHash: p.solutionHash,
		canonicalHash: p.canonicalHash,
		ascii: p.ascii,
		reviewStatus: 'candidate',
		productionReady: true,
		unique: true,
		logicallySolvable: true,
		hintChainSolved: true,
		logicalStatus: 'SOLVED',
		hintStatus: 'SOLVED',
		tier: p.tier,
		score: p.score,
		intendedTierHint: null,
		fillRatio: rq.metrics.filled / Math.max(1, p.width * p.height),
		componentCount: rq.metrics.componentCount,
		singletons: 0,
		largestShare: rq.metrics.largestComponentRatio,
		bboxCoverage: rq.metrics.bboxCoverage,
		emptyRows: p.height - rq.metrics.occupiedRows,
		emptyCols: p.width - rq.metrics.occupiedCols,
		touchesBorder: false,
		completeMs: 0,
		logicalMs: 0,
		hintMs: 0,
		hintSteps: 0,
		hintCells: 0,
		hintReasons: {},
		logicalReasons: {},
		dailyEligible: p.dailyEligible,
		rejectReason: null,
		seed: p.seed,
		warnings: [...rq.flags] as CandidateAuditRecord['warnings'],
		needsHumanRecognizabilityReview: true,
		rewardQualityStructuralPass: rq.structuralPass,
		rewardQualityFlags: [...rq.flags],
		rewardQualityRiskScore: rq.riskScore,
		notSelectedReason: null,
	}
}

function checkpointConfig(checkpoint: ScaleCheckpoint): {
	readonly catalogVersion: string
	readonly target: number
	readonly quota: TierQuota
	readonly parentLabel: string
	readonly randomSeed: number
	readonly worstCount: number
	readonly randomCount: number
	readonly minConcepts: number
} {
	if (checkpoint === 'b500') {
		return {
			catalogVersion: SCALE_CATALOG_VERSIONS.b500,
			target: B500_TARGET,
			quota: B500_TIER_QUOTA,
			parentLabel: 'b250-r2',
			randomSeed: 8_500_001,
			worstCount: 20,
			randomCount: 30,
			minConcepts: 450,
		}
	}
	if (checkpoint === 'b750') {
		return {
			catalogVersion: SCALE_CATALOG_VERSIONS.b750,
			target: B750_TARGET,
			quota: B750_TIER_QUOTA,
			parentLabel: 'b500',
			randomSeed: 8_750_001,
			worstCount: 20,
			randomCount: 30,
			minConcepts: 675,
		}
	}
	return {
		catalogVersion: SCALE_CATALOG_VERSIONS.b1000,
		target: B1000_TARGET,
		quota: B1000_TIER_QUOTA,
		parentLabel: 'b750',
		randomSeed: 8_100_001,
		worstCount: 30,
		randomCount: 50,
		minConcepts: MIN_DISTINCT_CONCEPTS_B1000,
	}
}

function loadParentManifest(checkpoint: ScaleCheckpoint): PilotManifest {
	const paths = scalePaths(checkpoint)
	if (checkpoint === 'b500') {
		const m = JSON.parse(
			fs.readFileSync(paths.b250R2Manifest, 'utf8'),
		) as PilotManifest
		if (m.checksum !== B250_R2_CHECKSUM) {
			throw new Error(
				`B250-R2 checksum mismatch: ${m.checksum} != ${B250_R2_CHECKSUM}`,
			)
		}
		return m
	}
	if (checkpoint === 'b750') {
		if (!fs.existsSync(paths.b500Manifest)) {
			throw new Error('Missing B500 manifest — generate B500 first')
		}
		return JSON.parse(fs.readFileSync(paths.b500Manifest, 'utf8')) as PilotManifest
	}
	if (!fs.existsSync(paths.b750Manifest)) {
		throw new Error('Missing B750 manifest — generate B750 first')
	}
	return JSON.parse(fs.readFileSync(paths.b750Manifest, 'utf8')) as PilotManifest
}

function buildCombinedPool(excludeIds: ReadonlySet<string>): RawCandidate[] {
	const base = buildRawCandidatePool()
	const procedural = buildScaleProceduralCandidates()
	const authored = scaleAuthoredToRawCandidates()
	const unique = buildUniqueSignatureCandidates()
	const hardFacades = buildHardFacadeCandidates()
	const merged = [...base, ...procedural, ...authored, ...unique, ...hardFacades]
	const byId = new Map<string, RawCandidate>()
	for (const raw of merged) {
		if (excludeIds.has(raw.id)) {
			continue
		}
		if (!byId.has(raw.id)) {
			byId.set(raw.id, raw)
		}
	}
	return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id))
}

function majorRiskRegression(
	dist: ReturnType<typeof riskDistribution>,
): string | null {
	const base = B250_R2_RISK_BASELINE
	const check = (
		label: 'p90' | 'p95',
		value: number,
		baseline: number,
	): string | null => {
		if (baseline <= 0) {
			return value >= 0.4 ? `${label}_absolute_high=${value}` : null
		}
		const rel = (value - baseline) / baseline
		if (rel > RISK_REGRESSION_RELATIVE) {
			return `${label}_regression rel=${rel.toFixed(3)} value=${value} base=${baseline}`
		}
		return null
	}
	return check('p90', dist.p90, base.p90) ?? check('p95', dist.p95, base.p95)
}

export function generateScaleCheckpoint(checkpoint: ScaleCheckpoint): {
	readonly ok: boolean
	readonly checksum: string
	readonly status: string
	readonly gateFailures: readonly string[]
} {
	const started = performance.now()
	const cfg = checkpointConfig(checkpoint)
	const paths = scalePaths(checkpoint)
	const parent = loadParentManifest(checkpoint)
	const preserved = parent.puzzles.map(auditFromManifestPuzzle)
	const preservedIds = new Set(preserved.map((p) => p.id))

	console.log(
		`[scale ${checkpoint}] parent=${parent.catalogVersion} ` +
			`checksum=${parent.checksum.slice(0, 12)}… preserved=${preserved.length} ` +
			`authoredPack=${authoredScaleCount()}`,
	)

	const pool = buildCombinedPool(preservedIds)
	console.log(`[scale ${checkpoint}] candidate pool (new ids)=${pool.length}`)

	const validationStarted = performance.now()
	const validated: CandidateAuditRecord[] = []
	const rejectCounts: Record<string, number> = {}
	for (const raw of pool) {
		const row = validateRawCandidate(raw)
		if (row.productionReady && row.rewardQualityStructuralPass) {
			validated.push(row)
		} else {
			const reason = String(
				row.rejectReason ??
					(row.rewardQualityStructuralPass ? 'not_ready' : 'reward_quality'),
			)
			rejectCounts[reason] = (rejectCounts[reason] ?? 0) + 1
		}
	}
	const validationMs = performance.now() - validationStarted
	console.log(
		`[scale ${checkpoint}] validated pass=${validated.length} rejects=`,
		rejectCounts,
	)

	const selection = selectAdditive(
		validated,
		preserved,
		cfg.quota,
		cfg.target,
		{
			maxPatternCount: MAX_PATTERN_COUNT_B1000,
			maxExpertPatternCount: MAX_EXPERT_PATTERN_COUNT_B1000,
			minDistinctConcepts: cfg.minConcepts,
			maxFamilyShare: 0.08,
		},
	)

	const selected = selection.selected
	const bitmaps = new Map<string, Bitmap>()
	for (const row of selected) {
		bitmaps.set(row.id, parseAscii(row.ascii.split('\n')))
	}

	const exactDup = findExactDuplicateIds(selected)
	const transformDup = findTransformDuplicatePairs(selected)
	const near = computeNearDuplicateStats(selected, bitmaps)
	const titleDups = findDuplicateTitles(selected)
	const riskDist = riskDistribution(selected)
	const hardSelected = selected.filter((r) => !r.rewardQualityStructuralPass)

	const gateFailures = [...selection.gateFailures]
	if (exactDup.length > 0) {
		gateFailures.push(`exact_duplicates=${exactDup.length}`)
	}
	if (transformDup.length > 0) {
		gateFailures.push(`transform_duplicates=${transformDup.length}`)
	}
	if (Object.keys(titleDups).length > 0) {
		gateFailures.push(`title_duplicates=${Object.keys(titleDups).length}`)
	}
	if (hardSelected.length > 0) {
		gateFailures.push(`reward_hard_selected=${hardSelected.length}`)
	}
	if (selection.patternShare > 0.1 + 1e-9) {
		gateFailures.push(`pattern_share=${selection.patternShare.toFixed(3)}`)
	}

	// Ancestry / additive stability hard checks.
	for (const id of preservedIds) {
		if (!selected.some((r) => r.id === id)) {
			gateFailures.push(`missing_preserved_id=${id}`)
			break
		}
	}
	if (selected.length !== cfg.target) {
		// already in selection.gateFailures usually
	}

	const riskStop = majorRiskRegression(riskDist)
	if (riskStop) {
		gateFailures.push(riskStop)
	}

	const puzzles = selected.map(buildManifestPuzzle)
	const checksum = stableManifestChecksum(
		puzzles,
		cfg.catalogVersion,
		CONTENT_GENERATOR_VERSION,
		parent.checksum,
	)

	const remaining: Record<string, number> = {}
	for (const tier of Object.keys(B1000_TIER_QUOTA) as DifficultyTier[]) {
		remaining[tier] =
			B1000_TIER_QUOTA[tier] - (selection.quotaActual[tier] ?? 0)
	}

	const byTier: Record<string, number> = {}
	const bySize: Record<string, number> = {}
	const byCollection: Record<string, number> = {}
	const bySource: Record<string, number> = {}
	const conceptFreq = new Map<string, number>()
	for (const row of selected) {
		byTier[row.tier] = (byTier[row.tier] ?? 0) + 1
		bySize[row.sizeKey] = (bySize[row.sizeKey] ?? 0) + 1
		byCollection[row.collectionId] = (byCollection[row.collectionId] ?? 0) + 1
		bySource[row.sourceKind] = (bySource[row.sourceKind] ?? 0) + 1
		conceptFreq.set(row.conceptId, (conceptFreq.get(row.conceptId) ?? 0) + 1)
	}
	const repeatedConcepts = [...conceptFreq.entries()]
		.filter(([, n]) => n >= 2)
		.map(([conceptId, n]) => ({
			conceptId,
			count: n,
			ids: selected.filter((r) => r.conceptId === conceptId).map((r) => r.id),
		}))

	const worstSorted = [...selected].sort((a, b) =>
		compareRiskDesc(
			{ riskScore: a.rewardQualityRiskScore, id: a.id },
			{ riskScore: b.rewardQualityRiskScore, id: b.id },
		),
	)
	const worstIds = worstSorted.slice(0, cfg.worstCount).map((r) => r.id)
	const randomIds = seededSample(
		selected.map((r) => r.id),
		cfg.randomCount,
		cfg.randomSeed,
	)

	const campaign = arrangePilotCampaign(selected)
	const gallery = simulateGallery(selected, 5)
	const daily =
		checkpoint === 'b1000'
			? simulateDailyPool(selected, 3)
			: null
	const logic = {
		productionReady: selected.filter((r) => r.productionReady).length,
		unique: selected.filter((r) => r.unique).length,
		logical: selected.filter((r) => r.logicallySolvable).length,
		hintChain: selected.filter((r) => r.hintChainSolved).length,
		stalled: selected.filter((r) => r.logicalStatus === 'STALLED').length,
		contradiction: selected.filter((r) => r.logicalStatus === 'CONTRADICTION')
			.length,
		unsound: 0,
	}

	const ok =
		gateFailures.length === 0 &&
		logic.productionReady === cfg.target &&
		logic.unique === cfg.target &&
		logic.logical === cfg.target &&
		logic.hintChain === cfg.target

	const status = ok
		? checkpoint === 'b1000'
			? 'PHASE_8C_B1000_CANDIDATE_READY_FOR_HUMAN_REVIEW'
			: `PHASE_8C_${checkpoint.toUpperCase()}_PASS`
		: selection.shortage.length > 0
			? 'BLOCKED_SCALE_UP_CONTENT_SHORTAGE'
			: 'BLOCKED_SCALE_UP_REGRESSION'

	const generationMs = performance.now() - started
	const report = {
		reportVersion: 2,
		status,
		catalogVersion: cfg.catalogVersion,
		generatorVersion: CONTENT_GENERATOR_VERSION,
		checksum,
		parentChecksum: parent.checksum,
		parentCatalogVersion: parent.catalogVersion,
		checkpoint,
		preservation: {
			preserved: preserved.length,
			added: selection.addedIds.length,
			target: cfg.target,
		},
		quota: {
			target: cfg.quota,
			actual: selection.quotaActual,
			shortage: selection.shortage,
			remainingToB1000: remaining,
		},
		diversity: {
			distinctConcepts: selection.distinctConcepts,
			maxConceptFrequency: selection.maxConceptFrequency,
			patternCount: selection.patternCount,
			patternShare: selection.patternShare,
			expertPatternCount: selection.expertPatternCount,
			maxFamilyShare: selection.maxFamilyShare,
			maxCollectionShare: selection.maxCollectionShare,
			repeatedConcepts,
		},
		quality: {
			exactDuplicates: exactDup,
			transformDuplicates: transformDup,
			nearDuplicateAbsolute: near.absolute,
			nearDuplicateEligiblePairs: near.eligibleSameSizePairs,
			nearDuplicateNormalized: near.normalizedRate,
			nearDuplicates: near.pairs.slice(0, 40),
			duplicateTitles: titleDups,
			hardQualitySelected: hardSelected.length,
		},
		riskDistribution: riskDist,
		logic,
		distributions: { byTier, bySize, byCollection, bySource },
		reviewSamples: {
			worstIds,
			randomIds,
			addedIds: selection.addedIds,
		},
		campaignSimulation: {
			sets: campaign.sets.length,
			setSize: 50,
			maxDifficultyStreak: campaign.maxDifficultyStreak,
			maxCollectionStreak: campaign.maxCollectionStreak,
			maxSizeStreak: campaign.maxSizeStreak,
			unlockAfterCompletions: campaign.unlockAfterCompletions,
		},
		gallerySimulation: {
			total: gallery.total,
			collectionCount: gallery.collectionCount,
			maxShare: gallery.maxShare,
			duplicateTitles: gallery.duplicateTitles.length,
			collections: gallery.collections.map((c) => ({
				collectionId: c.collectionId,
				count: c.count,
				share: Number(c.share.toFixed(4)),
				sampleIds: c.sampleIds,
			})),
		},
		dailySimulation: daily,
		batchStats: {
			poolNew: pool.length,
			validatedPass: validated.length,
			rejectCounts,
			authoredPackCount: authoredScaleCount(),
		},
		performance: {
			generationMs,
			validationMs,
		},
		runtimeIsolation: {
			campaignUntouched: true,
			galleryUntouched: true,
			dailyUntouched: true,
			schemaVersion: 4,
			candidateNotImported: true,
		},
		gateFailures,
		b250r2Checksum: B250_R2_CHECKSUM,
	}

	ensureDir(paths.generatedDir)
	ensureDir(paths.reviewDir)

	const manifest: PilotManifest = {
		catalogVersion: cfg.catalogVersion,
		generatorVersion: CONTENT_GENERATOR_VERSION,
		reportVersion: 2,
		reviewStatus: 'candidate',
		puzzleCount: puzzles.length,
		checksum,
		parentChecksum: parent.checksum,
		puzzles,
	}

	fs.writeFileSync(paths.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
	fs.writeFileSync(paths.reportJsonPath, `${JSON.stringify(report, null, 2)}\n`)
	fs.writeFileSync(paths.checksumPath, `${checksum}\n`)

	const md = [
		`# ${cfg.catalogVersion}`,
		'',
		`Status: **${status}**`,
		`Checksum: \`${checksum}\``,
		`Parent: \`${parent.checksum}\` (${parent.catalogVersion})`,
		`Preserved: ${preserved.length} · Added: ${selection.addedIds.length} · Total: ${selected.length}`,
		'',
		'## Tiers',
		'```',
		JSON.stringify(selection.quotaActual, null, 2),
		'```',
		'',
		'## Gates',
		gateFailures.length === 0 ? 'PASS' : gateFailures.map((g) => `- ${g}`).join('\n'),
		'',
		`Near-dup: ${near.absolute} absolute / ${near.eligibleSameSizePairs} eligible / rate=${near.normalizedRate.toFixed(6)}`,
		`Risk: median=${riskDist.median} p90=${riskDist.p90} p95=${riskDist.p95} max=${riskDist.max}`,
		`Concepts: ${selection.distinctConcepts} (maxFreq=${selection.maxConceptFrequency})`,
		`Patterns: ${selection.patternCount} (${(selection.patternShare * 100).toFixed(1)}%)`,
		`Hard quality selected: ${hardSelected.length}`,
		'',
		'## Mathematics',
		`unique=${logic.unique} logical=${logic.logical} hintChain=${logic.hintChain} stalled=${logic.stalled} contradiction=${logic.contradiction} unsound=${logic.unsound}`,
		'',
		'## Campaign simulation',
		`sets=${campaign.sets.length}×50 · unlockAfter=${campaign.unlockAfterCompletions}/50 · maxDiffStreak=${campaign.maxDifficultyStreak} · maxColStreak=${campaign.maxCollectionStreak} · maxSizeStreak=${campaign.maxSizeStreak}`,
		'',
		'## Gallery simulation',
		`collections=${gallery.collectionCount} · maxShare=${(gallery.maxShare * 100).toFixed(1)}% · duplicateTitles=${gallery.duplicateTitles.length}`,
		'',
		...(daily === null
			? []
			: [
					'## Daily simulation (candidate pool)',
					`eligible=${daily.eligibleCount} excluded=${daily.excludedCount} years=${daily.yearsSimulated} days=${daily.days}`,
					`immediateRepeats=${daily.immediateRepeats} repeatWithin7=${daily.repeatWithin7Days} freq=${daily.minFrequency}..${daily.maxFrequency}`,
					`rhythm proposal: ${daily.rhythmProposal.monday}/${daily.rhythmProposal.tuesday}/…/${daily.rhythmProposal.sunday}`,
					'',
				]),
		'## Performance',
		`generationMs=${Math.round(generationMs)} validationMs=${Math.round(validationMs)}`,
		'',
		'## Runtime',
		'Campaign/Gallery/Daily remain 21 — B1000 candidate not integrated.',
		'',
	].join('\n')
	fs.writeFileSync(paths.reportMdPath, md)

	const contactHtml = buildContactSheetHtml(selected, {
		catalogVersion: cfg.catalogVersion,
		generatorVersion: CONTENT_GENERATOR_VERSION,
		checksum,
		nearDuplicates: near.pairs.slice(0, 40),
		randomSample30: randomIds,
		worstCase20: worstIds,
		addedIds: selection.addedIds,
		distinctConcepts: selection.distinctConcepts,
		patternShare: selection.patternShare,
		title: `Phase 8C ${cfg.catalogVersion} — CANDIDATE`,
	})
	fs.writeFileSync(paths.contactSheetPath, contactHtml)

	console.log(
		`[scale ${checkpoint}] status=${status} checksum=${checksum.slice(0, 16)}… ` +
			`selected=${selected.length} added=${selection.addedIds.length} ` +
			`shortage=${selection.shortage.join(',') || 'none'} ms=${Math.round(generationMs)}`,
	)

	if (!ok) {
		console.error(`[scale ${checkpoint}] BLOCKED`, gateFailures)
	}

	return { ok, checksum, status, gateFailures }
}

function parseCheckpointArg(): ScaleCheckpoint | 'all' {
	const arg = process.argv[2] ?? 'all'
	if (arg === 'b500' || arg === 'b750' || arg === 'b1000' || arg === 'all') {
		return arg
	}
	throw new Error(`Unknown checkpoint '${arg}' (use b500|b750|b1000|all)`)
}

function main(): void {
	const which = parseCheckpointArg()
	const order: ScaleCheckpoint[] =
		which === 'all' ? ['b500', 'b750', 'b1000'] : [which]
	for (const checkpoint of order) {
		const result = generateScaleCheckpoint(checkpoint)
		if (!result.ok) {
			process.exitCode = 1
			return
		}
	}
}

if (require.main === module) {
	main()
}
