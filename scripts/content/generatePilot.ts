/**
 * Deterministic Pilot R2 generation (Phase 8A.1).
 * npm run content:generate-pilot
 *
 * Writes generated/content-pilot-r2/ + review-artifacts/.../pilot-r2/
 * Does NOT modify runtime Campaign / Gallery / Daily.
 * Does NOT overwrite rejected R1 baseline under generated/content-pilot/.
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
	MAX_PATTERN_COUNT,
	MIN_DISTINCT_CONCEPTS,
	NEAR_DUPLICATE_PAIR_TARGET,
	PILOT_R1_HUMAN_STATUS,
	PILOT_R1_REJECTED_CHECKSUM,
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
		selection.expertPatternCount <= 3 &&
		exactDupes.length === 0 &&
		transformDupes.length === 0 &&
		Object.keys(titleDupes).length === 0 &&
		hardGateFailures.length === 0 &&
		selected.every(
			(r) =>
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

	const report = {
		reportVersion: 2 as const,
		status: ok
			? 'PHASE_8A_1_PILOT_R2_100_READY_FOR_HUMAN_REVIEW'
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
			selected: { r1: 100, r2: selected.length, target: 100 },
			distinctConcepts: {
				r1: null,
				r2: selection.distinctConcepts,
				target: '>=80',
			},
			maxConceptFrequency: {
				r1: null,
				r2: selection.maxConceptFrequency,
				target: '<=2',
			},
			collections: {
				r1: 13,
				r2: Object.keys(byCollection).length,
				target: '>=12',
			},
			patterns: {
				r1: 22,
				r2: selection.patternCount,
				target: '<=10',
			},
			patternShare: {
				r1: 0.22,
				r2: selection.patternShare,
				target: '<=0.10',
			},
			expertPatterns: {
				r1: null,
				r2: selection.expertPatternCount,
				target: '<=3',
			},
			nearDuplicates: {
				r1: 20,
				r2: near.length,
				target: '<=5',
			},
			duplicateTitleGroups: {
				r1: 19,
				r2: Object.keys(titleDupes).length,
				target: 0,
			},
			maxFamilyShare: {
				r1: null,
				r2: selection.maxFamilyShare,
				target: '<=0.05',
			},
		},
		achievementRisk: {
			firstCollectionSticky: false,
			note:
				'REQUIRES DESIGN FIX BEFORE RUNTIME INTEGRATION — first_collection is derived from GALLERY_ITEMS.',
		},
		runtimeIsolation: {
			campaignUntouched: true,
			galleryUntouched: true,
			dailyUntouched: true,
			schemaVersion: 3,
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
		'# Phase 8A.1 Pilot R2 Report',
		'',
		`STATUS: **${report.status}**`,
		'',
		`- catalog: ${CONTENT_CATALOG_VERSION}`,
		`- generator: ${CONTENT_GENERATOR_VERSION}`,
		`- checksum: \`${checksum}\``,
		`- R1 rejected baseline: \`${PILOT_R1_REJECTED_CHECKSUM}\``,
		`- R1 human: ${PILOT_R1_HUMAN_STATUS}`,
		`- selected: ${selected.length}`,
		`- distinctConcepts: ${selection.distinctConcepts}`,
		`- maxConceptFrequency: ${selection.maxConceptFrequency}`,
		`- patterns: ${selection.patternCount} (${(selection.patternShare * 100).toFixed(1)}%)`,
		`- expertPatterns: ${selection.expertPatternCount}`,
		`- nearDuplicates: ${near.length}`,
		`- duplicateTitles: ${Object.keys(titleDupes).length}`,
		`- gateFailures: ${gateFailures.join('; ') || 'none'}`,
		'',
		'## R1 vs R2',
		'',
		'| Metric | R1 | R2 | Target |',
		'| --- | ---: | ---: | --- |',
		`| Selected | 100 | ${selected.length} | 100 |`,
		`| Distinct concepts | n/a (no conceptId) | ${selection.distinctConcepts} | ≥80 |`,
		`| Max concept frequency | high (semantic) | ${selection.maxConceptFrequency} | ≤2 |`,
		`| Collections | 13 | ${Object.keys(byCollection).length} | ≥12 |`,
		`| Patterns | 22 | ${selection.patternCount} | ≤10 |`,
		`| Pattern share | 22% | ${(selection.patternShare * 100).toFixed(1)}% | ≤10% |`,
		`| Expert patterns | ~8+ mosaics | ${selection.expertPatternCount} | ≤3 |`,
		`| Near dup ≥0.92 | 20 | ${near.length} | ≤5 |`,
		`| Duplicate title groups | 19 | ${Object.keys(titleDupes).length} | 0 |`,
		`| Max family share | n/a | ${(selection.maxFamilyShare * 100).toFixed(1)}% | ≤5% |`,
		'',
		'## STOP',
		'',
		'READY FOR HUMAN R2 CONTACT-SHEET REVIEW',
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
			`PILOT R2 BLOCKED/FAIL selected=${selected.length} shortage=${selection.shortage.join(',') || 'none'} concepts=${selection.distinctConcepts} gates=${gateFailures.join('|')}`,
		)
	} else {
		console.log(`PILOT R2 OK: 100 candidates checksum=${checksum}`)
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
