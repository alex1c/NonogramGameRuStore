/**
 * Deterministic pilot generation entrypoint.
 * npm run content:generate-pilot
 *
 * Produces candidate artifact under generated/content-pilot/
 * and review HTML under review-artifacts/ (gitignored).
 * Does NOT modify runtime Campaign / Gallery / Daily.
 */

import fs from 'node:fs'
import path from 'node:path'
import { generateRowClues, generateColumnClues } from '../../src/domain/nonogram/clues'
import { gridFromMatrix } from '../../src/domain/nonogram/clues'
import {
	CONTENT_CATALOG_VERSION,
	CONTENT_GENERATOR_VERSION,
	MAX_CANDIDATE_ATTEMPTS,
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
import { selectByTierQuota } from './selectQuota'
import type {
	CandidateAuditRecord,
	PilotManifest,
	PilotManifestPuzzle,
	RawCandidate,
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
	readonly reason?: string
	readonly note?: string
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

function buildManifestPuzzle(
	row: CandidateAuditRecord,
): PilotManifestPuzzle {
	const matrix = parseAscii(row.ascii.split('\n'))
	const grid = gridFromMatrix(matrix as readonly (readonly number[])[])
	return {
		id: row.id,
		titleRu: row.titleRu,
		collectionId: row.collectionId,
		family: row.family,
		variant: row.variant,
		kind: row.kind,
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
		rowClues: generateRowClues(grid),
		columnClues: generateColumnClues(grid),
	}
}

function stableManifestChecksum(puzzles: readonly PilotManifestPuzzle[]): string {
	const normalized = puzzles.map((p) => ({
		id: p.id,
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
		variant: p.variant,
		kind: p.kind,
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

function pickRepresentatives(selected: readonly CandidateAuditRecord[]) {
	const byTier = new Map<string, CandidateAuditRecord[]>()
	for (const row of selected) {
		const list = byTier.get(String(row.tier)) ?? []
		list.push(row)
		byTier.set(String(row.tier), list)
	}
	for (const list of byTier.values()) {
		list.sort((a, b) => (a.score ?? 0) - (b.score ?? 0) || a.id.localeCompare(b.id))
	}
	const playlist: string[] = []
	for (const tier of ['BEGINNER', 'EASY', 'MEDIUM', 'HARD', 'EXPERT']) {
		const list = byTier.get(tier) ?? []
		if (list.length === 0) {
			continue
		}
		const mid = Math.floor(list.length / 2)
		const picks = [list[0], list[mid], list[list.length - 1]].filter(
			Boolean,
		) as CandidateAuditRecord[]
		const uniq = new Map<string, CandidateAuditRecord>()
		for (const p of picks) {
			uniq.set(p.id, p)
		}
		// Prefer diverse collections / sizes for the 3 slots.
		const chosen: CandidateAuditRecord[] = []
		for (const p of [...uniq.values()].sort((a, b) =>
			a.id.localeCompare(b.id),
		)) {
			if (chosen.length >= 3) {
				break
			}
			chosen.push(p)
		}
		while (chosen.length < 3 && list.length > chosen.length) {
			const next = list.find((r) => !chosen.some((c) => c.id === r.id))
			if (!next) {
				break
			}
			chosen.push(next)
		}
		playlist.push(...chosen.slice(0, 3).map((r) => r.id))
	}

	const largest = [...selected].sort(
		(a, b) => b.width * b.height - a.width * a.height || a.id.localeCompare(b.id),
	)[0]
	const hardest = [...selected].sort(
		(a, b) => (b.score ?? 0) - (a.score ?? 0) || a.id.localeCompare(b.id),
	)[0]
	const easiest = [...selected].sort(
		(a, b) => (a.score ?? 0) - (b.score ?? 0) || a.id.localeCompare(b.id),
	)[0]
	const slowestSolver = [...selected].sort(
		(a, b) => b.completeMs - a.completeMs || a.id.localeCompare(b.id),
	)[0]
	const slowestHint = [...selected].sort(
		(a, b) => b.hintMs - a.hintMs || a.id.localeCompare(b.id),
	)[0]
	const mostComponents = [...selected].sort(
		(a, b) =>
			b.componentCount - a.componentCount || a.id.localeCompare(b.id),
	)[0]
	const sample20 = selected.filter((r) => r.width === 20 && r.height === 20)
	const sample25 = selected.filter((r) => r.width === 25 && r.height === 25)

	return {
		playlist,
		edge: {
			hardest: hardest?.id ?? null,
			easiest: easiest?.id ?? null,
			largest: largest?.id ?? null,
			slowestSolver: slowestSolver?.id ?? null,
			slowestHint: slowestHint?.id ?? null,
			mostComponents: mostComponents?.id ?? null,
			rep20: sample20[0]?.id ?? null,
			rep25: sample25[0]?.id ?? null,
		},
	}
}

function aggregateHintReasons(selected: readonly CandidateAuditRecord[]) {
	const total: Record<string, number> = {}
	const byTier: Record<string, Record<string, number>> = {}
	for (const row of selected) {
		const tierKey = String(row.tier)
		byTier[tierKey] = byTier[tierKey] ?? {}
		for (const [reason, count] of Object.entries(row.hintReasons)) {
			total[reason] = (total[reason] ?? 0) + count
			byTier[tierKey]![reason] =
				(byTier[tierKey]![reason] ?? 0) + count
		}
	}
	return { total, byTier }
}

export interface GeneratePilotResult {
	readonly ok: boolean
	readonly checksum: string
	readonly selectedCount: number
	readonly attempts: number
	readonly shortage: readonly string[]
	readonly rejectCounts: Record<string, number>
	readonly manifestPath: string
	readonly contactSheetPath: string
	readonly reportJsonPath: string
	readonly reportMdPath: string
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
	const bitmaps = new Map<string, RawCandidate['bitmap']>()
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
			// Still reserve exact hash if computed to avoid later exact dups in pool
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

	const selection = selectByTierQuota(validated)
	const selected = selection.selected
	const okCount =
		selected.length === PILOT_TARGET && selection.shortage.length === 0

	const manifestPuzzles = selected.map(buildManifestPuzzle)
	const checksum = stableManifestChecksum(manifestPuzzles)
	const manifest: PilotManifest = {
		catalogVersion: CONTENT_CATALOG_VERSION,
		generatorVersion: CONTENT_GENERATOR_VERSION,
		reportVersion: 1,
		reviewStatus: 'candidate',
		puzzleCount: manifestPuzzles.length,
		checksum,
		puzzles: manifestPuzzles,
	}

	const campaign = arrangePilotCampaign(selected)
	const exactDupes = findExactDuplicateIds(selected)
	const transformDupes = findTransformDuplicatePairs(selected)
	const near = topNearDuplicatePairs(selected, bitmaps, 20)
	const titleDupes = findDuplicateTitles(selected)
	const reps = pickRepresentatives(selected)
	const hintReasons = aggregateHintReasons(selected)
	const rejectCounts = countRejects(rejectRows)

	const bySize: Record<string, number> = {}
	const byCollection: Record<string, number> = {}
	const byFamily: Record<string, { pass: number; tiers: Record<string, number> }> =
		{}
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
		byTier[String(row.tier)] = (byTier[String(row.tier)] ?? 0) + 1
		const fam = byFamily[row.family] ?? { pass: 0, tiers: {} }
		fam.pass += 1
		fam.tiers[String(row.tier)] = (fam.tiers[String(row.tier)] ?? 0) + 1
		byFamily[row.family] = fam
	}

	const suspiciousFill = selected.filter(
		(r) => r.fillRatio < 0.05 || r.fillRatio > 0.9,
	)
	const componentOutliers = selected.filter(
		(r) => r.singletons >= 5 || r.componentCount >= 8,
	)
	const bboxOutliers = selected.filter((r) => r.bboxCoverage < 0.15)

	const artifactBytes = Buffer.byteLength(JSON.stringify(manifest), 'utf8')
	const contactHtml = buildContactSheetHtml(selected, {
		catalogVersion: CONTENT_CATALOG_VERSION,
		generatorVersion: CONTENT_GENERATOR_VERSION,
		checksum,
	})
	const contactStarted = performance.now()
	fs.writeFileSync(paths.contactSheetPath, contactHtml, 'utf8')
	const contactMs = performance.now() - contactStarted

	const generationMs = performance.now() - started
	const report = {
		reportVersion: 1 as const,
		status: okCount
			? 'PHASE_8A_PILOT_100_READY_FOR_REVIEW'
			: 'BLOCKED',
		reviewStatus: 'candidate',
		catalogVersion: CONTENT_CATALOG_VERSION,
		generatorVersion: CONTENT_GENERATOR_VERSION,
		checksum,
		counts: {
			poolSize: pool.length,
			attempts: pool.length,
			acceptedValidated: validated.length,
			selected: selected.length,
			target: PILOT_TARGET,
			rejected: rejectRows.length,
			rejectCounts,
		},
		quota: {
			target: PILOT_TIER_QUOTA,
			actual: selection.quotaActual,
			shortage: selection.shortage,
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
			suspiciousFillRatios: suspiciousFill.map((r) => ({
				id: r.id,
				fillRatio: r.fillRatio,
			})),
			componentOutliers: componentOutliers.map((r) => ({
				id: r.id,
				components: r.componentCount,
				singletons: r.singletons,
			})),
			bboxOutliers: bboxOutliers.map((r) => ({
				id: r.id,
				bboxCoverage: r.bboxCoverage,
			})),
		},
		logic: {
			productionReady: selected.filter((r) => r.productionReady).length,
			unique: selected.filter((r) => r.unique).length,
			logical: selected.filter((r) => r.logicallySolvable).length,
			hintChain: selected.filter((r) => r.hintChainSolved).length,
		},
		performance: {
			generationMs,
			validationMs,
			contactMs,
			slowestComplete: [...selected].sort(
				(a, b) => b.completeMs - a.completeMs,
			)[0] ?? null,
			slowestLogical: [...selected].sort(
				(a, b) => b.logicalMs - a.logicalMs,
			)[0] ?? null,
			slowestHint: [...selected].sort((a, b) => b.hintMs - a.hintMs)[0] ??
				null,
			size20: selected.filter((r) => r.width === 20 || r.height === 20),
			size25: selected.filter((r) => r.width === 25 || r.height === 25),
		},
		hintReasons,
		campaignSimulation: campaign,
		representatives: reps,
		artifactSize: {
			manifestBytes: artifactBytes,
			estimated1000Bytes: artifactBytes * 10,
			contactSheetBytes: Buffer.byteLength(contactHtml, 'utf8'),
		},
		puzzles: selected,
		achievementRisk: {
			firstCollectionSticky: false,
			note:
				'Achievements are derived from GALLERY_ITEMS. Replacing gallery taxonomy can remove first_collection if previously completed small collections disappear. REQUIRES DESIGN FIX BEFORE RUNTIME INTEGRATION.',
		},
		runtimeIsolation: {
			campaignUntouched: true,
			galleryUntouched: true,
			dailyUntouched: true,
			schemaVersion: 3,
		},
	}

	fs.writeFileSync(paths.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
	fs.writeFileSync(paths.checksumPath, `${checksum}\n`, 'utf8')
	fs.writeFileSync(paths.reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

	const md = renderPilotMarkdown(report as Record<string, unknown>, paths)
	fs.writeFileSync(paths.reportMdPath, md, 'utf8')
	// Also copy compact report next to manifest for committed summary.
	fs.writeFileSync(
		path.join(paths.generatedPilotDir, 'pilot-report.md'),
		md,
		'utf8',
	)

	if (!okCount) {
		console.error(
			`PILOT BLOCKED: selected=${selected.length} shortage=${selection.shortage.join(',') || 'none'} validated=${validated.length}`,
		)
	} else {
		console.log(
			`PILOT OK: 100 candidates checksum=${checksum}`,
		)
	}
	console.log(`manifest: ${paths.manifestPath}`)
	console.log(`contact:  ${paths.contactSheetPath}`)

	return {
		ok: okCount,
		checksum,
		selectedCount: selected.length,
		attempts: pool.length,
		shortage: selection.shortage,
		rejectCounts,
		manifestPath: paths.manifestPath,
		contactSheetPath: paths.contactSheetPath,
		reportJsonPath: paths.reportJsonPath,
		reportMdPath: paths.reportMdPath,
	}
}

function renderPilotMarkdown(
	report: Record<string, unknown>,
	paths: ReturnType<typeof contentPaths>,
): string {
	const counts = report.counts as {
		poolSize: number
		selected: number
		rejected: number
		rejectCounts: Record<string, number>
	}
	const quota = report.quota as {
		target: Record<string, number>
		actual: Record<string, number>
		shortage: string[]
	}
	const distributions = report.distributions as {
		byCollection: Record<string, number>
		patternShare: number
	}
	const quality = report.quality as {
		nearDuplicates: Array<{
			idA: string
			titleA: string
			idB: string
			titleB: string
			sizeKey: string
			similarity: number
		}>
	}
	const representatives = report.representatives as {
		playlist: string[]
		edge: Record<string, string | null>
	}
	const artifactSize = report.artifactSize as {
		manifestBytes: number
		estimated1000Bytes: number
	}
	const achievementRisk = report.achievementRisk as { note: string }
	const logic = report.logic as Record<string, number>

	const lines: string[] = []
	lines.push('# Phase 8A Pilot Report')
	lines.push('')
	lines.push(`STATUS: **${String(report.status)}**`)
	lines.push('')
	lines.push(`- catalog: ${String(report.catalogVersion)}`)
	lines.push(`- generator: ${String(report.generatorVersion)}`)
	lines.push(`- checksum: \`${String(report.checksum)}\``)
	lines.push(`- pool: ${counts.poolSize}`)
	lines.push(`- selected: ${counts.selected}`)
	lines.push(`- rejected: ${counts.rejected}`)
	lines.push('')
	lines.push('## Tier quota')
	lines.push('')
	lines.push('| Tier | Target | Actual |')
	lines.push('| --- | ---: | ---: |')
	for (const tier of ['BEGINNER', 'EASY', 'MEDIUM', 'HARD', 'EXPERT']) {
		lines.push(
			`| ${tier} | ${quota.target[tier] ?? 0} | ${quota.actual[tier] ?? 0} |`,
		)
	}
	if (quota.shortage.length > 0) {
		lines.push('')
		lines.push(`Shortage: ${quota.shortage.join(', ')}`)
	}
	lines.push('')
	lines.push('## Reject reasons')
	lines.push('')
	for (const [reason, count] of Object.entries(counts.rejectCounts).sort()) {
		lines.push(`- ${reason}: ${count}`)
	}
	lines.push('')
	lines.push('## Collections')
	lines.push('')
	for (const [id, count] of Object.entries(distributions.byCollection).sort()) {
		lines.push(`- ${id}: ${count}`)
	}
	lines.push('')
	lines.push(
		`Pattern share: ${(distributions.patternShare * 100).toFixed(1)}%`,
	)
	lines.push('')
	lines.push('## Logic')
	lines.push('')
	lines.push(JSON.stringify(logic))
	lines.push('')
	lines.push('## Top near-duplicates')
	lines.push('')
	for (const pair of quality.nearDuplicates) {
		lines.push(
			`- ${pair.idA} (${pair.titleA}) ↔ ${pair.idB} (${pair.titleB}) ${pair.sizeKey} sim=${pair.similarity.toFixed(4)}`,
		)
	}
	lines.push('')
	lines.push('## Representatives')
	lines.push('')
	lines.push(`Playlist: ${representatives.playlist.join(', ')}`)
	lines.push(`Edge: ${JSON.stringify(representatives.edge)}`)
	lines.push('')
	lines.push('## Artifacts')
	lines.push('')
	lines.push(`- manifest: \`${paths.manifestPath}\``)
	lines.push(`- contact sheet: \`${paths.contactSheetPath}\``)
	lines.push(
		`- manifest bytes: ${artifactSize.manifestBytes} (×10 est ${artifactSize.estimated1000Bytes})`,
	)
	lines.push('')
	lines.push('## Achievement risk')
	lines.push('')
	lines.push(achievementRisk.note)
	lines.push('')
	lines.push('## STOP')
	lines.push('')
	lines.push('READY FOR HUMAN PILOT CONTACT-SHEET REVIEW')
	lines.push('')
	lines.push('Do not scale to 1000 without explicit approval.')
	lines.push('')
	return `${lines.join('\n')}`
}

if (require.main === module) {
	const result = generatePilot()
	process.exitCode = result.ok ? 0 : 1
}
