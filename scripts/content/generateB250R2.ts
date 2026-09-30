/**
 * Phase 8B.1 — rebuild B250-R2 by preserving good R1 candidates and
 * replacing hard-reject / high-risk tail with new concepts.
 *
 * npm run content:generate-b250-r2
 *
 * Does NOT overwrite generated/content-b250 (R1 baseline).
 * Does NOT modify runtime Campaign / Gallery / Daily / schema.
 */

import fs from 'node:fs'
import path from 'node:path'
import {
	generateColumnClues,
	generateRowClues,
	gridFromMatrix,
} from '../../src/domain/nonogram/clues'
import {
	B250_R1_CHECKSUM,
	B250_TARGET,
	B250_TIER_QUOTA,
	CONTENT_CATALOG_VERSION,
	CONTENT_GENERATOR_VERSION,
	MAX_EXPERT_PATTERN_COUNT,
	MAX_PATTERN_COUNT,
	MIN_DISTINCT_CONCEPTS,
	NEAR_DUPLICATE_PAIR_TARGET,
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
import {
	analyzeRewardQuality,
	compareRiskDesc,
} from './rewardQuality'
import { selectWithDiversity } from './selectQuota'
import type {
	CandidateAuditRecord,
	ContentKind,
	PilotManifest,
	PilotManifestPuzzle,
	RejectReason,
} from './types'
import {
	DIFFICULTY_MODEL_VERSION,
	validateRawCandidate,
} from './validateCandidate'
import { parseAscii } from './bitmap'
import type { DifficultyTier } from '../../src/domain/difficulty/tiers'

/** Human-reviewed good IDs — never soft-remove even if mid risk. */
const HUMAN_GOOD_PRESERVE = new Set([
	'ani-bear',
	'ani-hedgehog',
	'b250-lightning',
	'b250-peace',
	'hx2-harp',
	'hx2-kraken',
	'sea-octopus',
	'b250hf-clocktower',
	'hx4-palm-hut',
	'b250-bowling',
	'b250-axe',
	'b250-balloon',
	'b250-beetle',
	'b250-chisel',
	'tbeg-note',
	'b250-hoop',
])

const B250_R1_PIN = B250_R1_CHECKSUM

const SOFT_RISK_REMOVE = 0.5
const MAX_SOFT_REMOVALS = 25
const MAX_TOTAL_REMOVAL_SHARE = 0.3

function ensureDir(dir: string): void {
	fs.mkdirSync(dir, { recursive: true })
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

function stableManifestChecksum(
	puzzles: readonly PilotManifestPuzzle[],
	catalogVersion: string,
	generatorVersion: string,
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

export function generateB250R2(): {
	readonly ok: boolean
	readonly checksum: string
	readonly preserved: number
	readonly removed: number
	readonly added: number
} {
	const started = performance.now()
	const paths = contentPaths()
	const r1ManifestPath = paths.b250R1Manifest
	if (!fs.existsSync(r1ManifestPath)) {
		throw new Error(`Missing B250-R1 manifest at ${r1ManifestPath}`)
	}

	const r1 = JSON.parse(
		fs.readFileSync(r1ManifestPath, 'utf8'),
	) as PilotManifest
	if (r1.checksum !== B250_R1_PIN) {
		console.warn(
			`WARNING: R1 checksum ${r1.checksum} != pinned ${B250_R1_PIN}`,
		)
	}

	const rescored = r1.puzzles.map(auditFromManifestPuzzle)
	const ranked = [...rescored].sort((a, b) =>
		compareRiskDesc(
			{ riskScore: a.rewardQualityRiskScore, id: a.id },
			{ riskScore: b.rewardQualityRiskScore, id: b.id },
		),
	)

	const hardRemoved = ranked.filter((r) => !r.rewardQualityStructuralPass)

	const softCandidates = ranked.filter(
		(r) =>
			r.rewardQualityStructuralPass &&
			r.rewardQualityRiskScore >= SOFT_RISK_REMOVE &&
			!HUMAN_GOOD_PRESERVE.has(r.id),
	)
	// Prefer removing EASY/MEDIUM soft-risk before BEGINNER to protect quota fill.
	softCandidates.sort((a, b) => {
		const tierRank = (t: string) =>
			t === 'BEGINNER' ? 2 : t === 'EXPERT' || t === 'HARD' ? 0 : 1
		const tr = tierRank(String(a.tier)) - tierRank(String(b.tier))
		if (tr !== 0) {
			return tr
		}
		return b.rewardQualityRiskScore - a.rewardQualityRiskScore
	})
	const softRemoved = softCandidates.slice(0, MAX_SOFT_REMOVALS)

	const removeIds = new Set([
		...hardRemoved.map((r) => r.id),
		...softRemoved.map((r) => r.id),
	])

	if (removeIds.size / r1.puzzles.length > MAX_TOTAL_REMOVAL_SHARE) {
		console.error(
			`BLOCKED analyzer overreach: removing ${removeIds.size}/${r1.puzzles.length}`,
		)
		return {
			ok: false,
			checksum: '',
			preserved: 0,
			removed: removeIds.size,
			added: 0,
		}
	}

	const preserved = rescored.filter((r) => !removeIds.has(r.id))
	const removedRows = rescored.filter((r) => removeIds.has(r.id))

	const neededByTier: Record<DifficultyTier, number> = {
		BEGINNER: B250_TIER_QUOTA.BEGINNER,
		EASY: B250_TIER_QUOTA.EASY,
		MEDIUM: B250_TIER_QUOTA.MEDIUM,
		HARD: B250_TIER_QUOTA.HARD,
		EXPERT: B250_TIER_QUOTA.EXPERT,
	}
	for (const row of preserved) {
		if (row.tier !== 'UNRATED') {
			neededByTier[row.tier] -= 1
		}
	}

	const usedConcepts = new Set(preserved.map((r) => r.conceptId))
	const usedIds = new Set(preserved.map((r) => r.id))
	const usedExact = new Set(preserved.map((r) => r.solutionHash))
	const usedCanon = new Set(preserved.map((r) => r.canonicalHash))
	const usedTitles = new Set(preserved.map((r) => r.titleRu))

	const pool = buildRawCandidatePool()
	const replacementPool = pool.filter(
		(raw) =>
			!usedIds.has(raw.id) &&
			!usedConcepts.has(raw.conceptId) &&
			raw.contentRole === 'production',
	)

	const validatedReplacements: CandidateAuditRecord[] = []
	const validationStarted = performance.now()
	for (const raw of replacementPool) {
		const row = validateRawCandidate(raw, {
			knownExactHashes: usedExact,
			knownCanonicalHashes: usedCanon,
			knownIds: usedIds,
		})
		if (
			row.rejectReason === null &&
			row.productionReady &&
			row.hintChainSolved &&
			row.tier !== 'UNRATED' &&
			row.rewardQualityStructuralPass &&
			row.rewardQualityRiskScore < SOFT_RISK_REMOVE &&
			!usedTitles.has(row.titleRu)
		) {
			validatedReplacements.push(row)
		} else if (row.solutionHash) {
			usedExact.add(row.solutionHash)
		}
		if (row.canonicalHash) {
			usedCanon.add(row.canonicalHash)
		}
		usedIds.add(row.id)
	}
	const validationMs = performance.now() - validationStarted

	const added: CandidateAuditRecord[] = []
	const tiers = Object.keys(neededByTier) as DifficultyTier[]
	for (const tier of tiers) {
		let need = neededByTier[tier]
		if (need <= 0) {
			continue
		}
		const candidates = validatedReplacements
			.filter(
				(r) =>
					r.tier === tier &&
					!added.some((a) => a.id === r.id) &&
					!usedConcepts.has(r.conceptId),
			)
			.sort((a, b) => {
				if (a.rewardQualityRiskScore !== b.rewardQualityRiskScore) {
					return a.rewardQualityRiskScore - b.rewardQualityRiskScore
				}
				const ca = preserved.filter((p) => p.collectionId === a.collectionId)
					.length
				const cb = preserved.filter((p) => p.collectionId === b.collectionId)
					.length
				if (ca !== cb) {
					return ca - cb
				}
				return a.id.localeCompare(b.id)
			})
		for (const row of candidates) {
			if (need <= 0) {
				break
			}
			if (usedConcepts.has(row.conceptId)) {
				continue
			}
			if (usedTitles.has(row.titleRu)) {
				continue
			}
			added.push(row)
			usedConcepts.add(row.conceptId)
			usedTitles.add(row.titleRu)
			need -= 1
		}
		neededByTier[tier] = need
	}

	const shortage = tiers.filter((t) => neededByTier[t] > 0)
	const selected = [...preserved, ...added].sort((a, b) =>
		a.id.localeCompare(b.id),
	)

	const bitmaps = new Map(
		selected.map((r) => [r.id, parseAscii(r.ascii.split('\n'))] as const),
	)
	const near = topNearDuplicatePairs(selected, bitmaps, 80)
	const exactDupes = findExactDuplicateIds(selected)
	const transformDupes = findTransformDuplicatePairs(selected)
	const titleDupes = findDuplicateTitles(selected)

	const concepts = new Set(selected.map((r) => r.conceptId))
	const patterns = selected.filter(
		(r) => r.kind === 'pattern' || r.collectionId === 'patterns',
	)
	const expertPatterns = patterns.filter((r) => r.tier === 'EXPERT')

	const gateFailures: string[] = []
	if (selected.length !== B250_TARGET) {
		gateFailures.push(`selected=${selected.length}`)
	}
	if (shortage.length > 0) {
		gateFailures.push(`tier_shortage=${shortage.join(',')}`)
	}
	if (concepts.size < MIN_DISTINCT_CONCEPTS) {
		gateFailures.push(`concepts=${concepts.size}`)
	}
	if (patterns.length > MAX_PATTERN_COUNT) {
		gateFailures.push(`patterns=${patterns.length}`)
	}
	if (expertPatterns.length > MAX_EXPERT_PATTERN_COUNT) {
		gateFailures.push(`expertPatterns=${expertPatterns.length}`)
	}
	if (exactDupes.length > 0) {
		gateFailures.push('exact_dup')
	}
	if (transformDupes.length > 0) {
		gateFailures.push('transform_dup')
	}
	if (Object.keys(titleDupes).length > 0) {
		gateFailures.push('title_dup')
	}
	if (
		selected.some(
			(r) =>
				!r.rewardQualityStructuralPass ||
				r.contentRole !== 'production',
		)
	) {
		gateFailures.push('quality_or_role')
	}

	const ok =
		gateFailures.length === 0 &&
		selected.every(
			(r) =>
				r.productionReady &&
				r.unique &&
				r.logicallySolvable &&
				r.hintChainSolved,
		)

	const catalogVersion = CONTENT_CATALOG_VERSION
	const generatorVersion = CONTENT_GENERATOR_VERSION
	const manifestPuzzles = selected.map(buildManifestPuzzle)
	const checksum = stableManifestChecksum(
		manifestPuzzles,
		catalogVersion,
		generatorVersion,
	)

	const outDir = path.join(paths.root, 'generated', 'content-b250-r2')
	const reviewDir = path.join(
		paths.root,
		'review-artifacts',
		'production-content',
		'b250-r2',
	)
	ensureDir(outDir)
	ensureDir(reviewDir)

	const byTier: Record<string, number> = {
		BEGINNER: 0,
		EASY: 0,
		MEDIUM: 0,
		HARD: 0,
		EXPERT: 0,
	}
	const bySize: Record<string, number> = {}
	const byCollection: Record<string, number> = {}
	for (const row of selected) {
		byTier[String(row.tier)] = (byTier[String(row.tier)] ?? 0) + 1
		bySize[row.sizeKey] = (bySize[row.sizeKey] ?? 0) + 1
		byCollection[row.collectionId] =
			(byCollection[row.collectionId] ?? 0) + 1
	}

	const risks = selected
		.map((r) => r.rewardQualityRiskScore)
		.sort((a, b) => a - b)
	const pct = (p: number) =>
		risks[Math.min(risks.length - 1, Math.floor((p / 100) * risks.length))] ??
		0

	const worst20 = [...selected]
		.sort((a, b) =>
			compareRiskDesc(
				{ riskScore: a.rewardQualityRiskScore, id: a.id },
				{ riskScore: b.rewardQualityRiskScore, id: b.id },
			),
		)
		.slice(0, 20)

	function mulberry32(seed: number): () => number {
		let t = seed >>> 0
		return () => {
			t += 0x6d2b79f5
			let r = Math.imul(t ^ (t >>> 15), 1 | t)
			r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
			return ((r ^ (r >>> 14)) >>> 0) / 4294967296
		}
	}
	const rng = mulberry32(0x8b250002)
	const random30 = [...selected]
		.sort((a, b) => {
			const ra = rng()
			const rb = rng()
			return ra < rb ? -1 : ra > rb ? 1 : a.id.localeCompare(b.id)
		})
		.slice(0, 30)

	const sameSizePairsPossible = (() => {
		const by = new Map<string, number>()
		for (const r of selected) {
			by.set(r.sizeKey, (by.get(r.sizeKey) ?? 0) + 1)
		}
		let n = 0
		for (const c of by.values()) {
			n += (c * (c - 1)) / 2
		}
		return n
	})()

	const campaign = arrangePilotCampaign(selected)
	const generationMs = performance.now() - started

	const manifest: PilotManifest = {
		catalogVersion,
		generatorVersion,
		reportVersion: 2,
		reviewStatus: 'candidate',
		puzzleCount: manifestPuzzles.length,
		checksum,
		puzzles: manifestPuzzles,
	}

	const report = {
		reportVersion: 2 as const,
		status: ok
			? 'PHASE_8B_1_B250_R2_READY_FOR_TAIL_HUMAN_REVIEW'
			: shortage.length > 0
				? 'BLOCKED_CONTENT_QUOTA_SHORTAGE'
				: 'FAIL',
		catalogVersion,
		generatorVersion,
		checksum,
		b250r1Checksum: B250_R1_PIN,
		preservation: {
			preserved: preserved.length,
			removed: removedRows.length,
			added: added.length,
			preservationPct: preserved.length / r1.puzzles.length,
			hardQualityRemoved: hardRemoved.length,
			softRiskRemoved: softRemoved.length,
		},
		removals: removedRows.map((r) => ({
			id: r.id,
			titleRu: r.titleRu,
			tier: r.tier,
			kind: r.kind,
			risk: r.rewardQualityRiskScore,
			reasons: r.rewardQualityFlags,
			hard: !r.rewardQualityStructuralPass,
		})),
		additions: added.map((r) => ({
			id: r.id,
			titleRu: r.titleRu,
			tier: r.tier,
			collectionId: r.collectionId,
			kind: r.kind,
			risk: r.rewardQualityRiskScore,
			family: r.family,
			sourceKind: r.sourceKind,
			conceptId: r.conceptId,
		})),
		quota: {
			target: B250_TIER_QUOTA,
			actual: byTier,
			shortage,
		},
		diversity: {
			distinctConcepts: concepts.size,
			maxConceptFrequency: Math.max(
				0,
				...[...concepts].map(
					(c) => selected.filter((s) => s.conceptId === c).length,
				),
			),
			patternCount: patterns.length,
			patternShare: patterns.length / selected.length,
			expertPatternCount: expertPatterns.length,
		},
		quality: {
			exactDuplicates: exactDupes,
			transformDuplicates: transformDupes,
			nearDuplicates: near,
			nearDuplicateAbsolute: near.length,
			nearDuplicateNormalized:
				sameSizePairsPossible === 0
					? 0
					: near.length / sameSizePairsPossible,
			duplicateTitles: titleDupes,
			hardQualitySelected: selected.filter(
				(r) => !r.rewardQualityStructuralPass,
			).length,
		},
		riskDistribution: {
			min: risks[0] ?? 0,
			median: pct(50),
			p75: pct(75),
			p90: pct(90),
			p95: pct(95),
			max: risks[risks.length - 1] ?? 0,
		},
		logic: {
			productionReady: selected.filter((r) => r.productionReady).length,
			unique: selected.filter((r) => r.unique).length,
			logical: selected.filter((r) => r.logicallySolvable).length,
			hintChain: selected.filter((r) => r.hintChainSolved).length,
		},
		distributions: { byTier, bySize, byCollection },
		reviewSamples: {
			worst20: worst20.map((r) => ({
				id: r.id,
				titleRu: r.titleRu,
				risk: r.rewardQualityRiskScore,
				reasons: r.rewardQualityFlags,
				tier: r.tier,
				kind: r.kind,
				sizeKey: r.sizeKey,
			})),
			randomSample30: random30.map((r) => r.id),
			removedIds: removedRows.map((r) => r.id),
			addedIds: added.map((r) => r.id),
		},
		comparisonR1: {
			nearDuplicates: { r1: 50, r2: near.length },
			patterns: { r1: 12, r2: patterns.length },
			concepts: { r1: 250, r2: concepts.size },
		},
		performance: {
			generationMs,
			validationMs,
			rescoringMs: null,
		},
		campaignSimulation: campaign,
		runtimeIsolation: {
			campaignUntouched: true,
			galleryUntouched: true,
			dailyUntouched: true,
			schemaVersion: 4,
			candidateNotImported: true,
		},
		gateFailures,
		artifactSize: { manifestBytes: 0, contactSheetBytes: 0 },
	}

	const contactHtml = buildContactSheetHtml([...selected, ...removedRows], {
		catalogVersion,
		generatorVersion,
		checksum,
		nearDuplicates: near,
		repeatedConcepts: [],
		blindShortlist: worst20.map((r) => r.id),
		randomSample30: random30.map((r) => r.id),
		worstCase20: worst20.map((r) => r.id),
		distinctConcepts: concepts.size,
		patternShare: patterns.length / Math.max(1, selected.length),
		removedIds: removedRows.map((r) => r.id),
		addedIds: added.map((r) => r.id),
		title: 'Phase 8B.1 Production 250-R2 — CANDIDATE',
	})

	report.artifactSize = {
		manifestBytes: Buffer.byteLength(JSON.stringify(manifest), 'utf8'),
		contactSheetBytes: Buffer.byteLength(contactHtml, 'utf8'),
	}

	const diffMd = [
		'# B250-R1 vs B250-R2',
		'',
		`R1 checksum: \`${B250_R1_PIN}\``,
		`R2 checksum: \`${checksum}\``,
		`Preserved: ${preserved.length} (${((preserved.length / 250) * 100).toFixed(1)}%)`,
		`Removed: ${removedRows.length}`,
		`Added: ${added.length}`,
		'',
		'## Removed',
		'',
		'| ID | Title | Tier | Reasons |',
		'| --- | --- | --- | --- |',
		...removedRows.map(
			(r) =>
				`| ${r.id} | ${r.titleRu} | ${r.tier} | ${r.rewardQualityFlags.join(', ') || (r.rewardQualityStructuralPass ? 'soft-risk' : 'hard')} |`,
		),
		'',
		'## Added',
		'',
		'| ID | Title | Tier | Collection | Risk |',
		'| --- | --- | --- | --- | ---: |',
		...added.map(
			(r) =>
				`| ${r.id} | ${r.titleRu} | ${r.tier} | ${r.collectionId} | ${r.rewardQualityRiskScore.toFixed(2)} |`,
		),
		'',
	].join('\n')

	fs.writeFileSync(
		path.join(outDir, 'manifest.json'),
		`${JSON.stringify(manifest, null, 2)}\n`,
	)
	fs.writeFileSync(path.join(outDir, 'checksum.txt'), `${checksum}\n`)
	fs.writeFileSync(
		path.join(outDir, 'report.json'),
		`${JSON.stringify(report, null, 2)}\n`,
	)
	fs.writeFileSync(path.join(outDir, 'b250-r1-vs-r2.md'), diffMd)
	fs.writeFileSync(path.join(reviewDir, 'contact-sheet.html'), contactHtml)
	fs.writeFileSync(path.join(reviewDir, 'b250-r1-vs-r2.md'), diffMd)

	if (!ok) {
		console.error(
			`B250-R2 BLOCKED/FAIL selected=${selected.length} shortage=${shortage.join(',') || 'none'} gates=${gateFailures.join('|')}`,
		)
	} else {
		console.log(
			`B250-R2 OK: preserved=${preserved.length} removed=${removedRows.length} added=${added.length} checksum=${checksum}`,
		)
	}
	console.log(`manifest: ${path.join(outDir, 'manifest.json')}`)
	console.log(`contact:  ${path.join(reviewDir, 'contact-sheet.html')}`)

	return {
		ok,
		checksum,
		preserved: preserved.length,
		removed: removedRows.length,
		added: added.length,
	}
}

if (require.main === module) {
	const result = generateB250R2()
	process.exitCode = result.ok ? 0 : 1
}
