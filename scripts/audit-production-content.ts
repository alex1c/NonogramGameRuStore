/**
 * Production content audit — Phase 8C Batch 1000.
 * npm run audit:production-content
 */

import fs from 'node:fs'
import {
	B1000_TARGET,
	B1000_TIER_QUOTA,
	CONTENT_GENERATOR_VERSION,
	MAX_CONCEPT_FREQUENCY,
	MAX_EXPERT_PATTERN_COUNT_B1000,
	MAX_PATTERN_COUNT_B1000,
	MIN_DISTINCT_CONCEPTS_B1000,
	PILOT_R1_REJECTED_CHECKSUM,
} from './content/constants'
import { contentPaths } from './content/paths'
import type { PilotManifest } from './content/types'
import { checksumManifest } from './content/hash'

function main(): void {
	const paths = contentPaths()
	if (!fs.existsSync(paths.manifestPath)) {
		console.error(`Missing B1000 manifest: ${paths.manifestPath}`)
		console.error('Run: npm run content:generate-b1000')
		process.exitCode = 1
		return
	}
	if (!fs.existsSync(paths.reportJsonPath)) {
		console.error(`Missing B1000 report: ${paths.reportJsonPath}`)
		process.exitCode = 1
		return
	}

	const manifest = JSON.parse(
		fs.readFileSync(paths.manifestPath, 'utf8'),
	) as PilotManifest
	const report = JSON.parse(
		fs.readFileSync(paths.reportJsonPath, 'utf8'),
	) as {
		readonly status: string
		readonly logic: {
			readonly productionReady: number
			readonly unique: number
			readonly logical: number
			readonly hintChain: number
		}
		readonly quality: {
			readonly exactDuplicates: readonly string[]
			readonly transformDuplicates: readonly unknown[]
			readonly nearDuplicates: readonly unknown[]
			readonly nearDuplicateAbsolute?: number
			readonly nearDuplicateNormalized?: number
			readonly duplicateTitles: Record<string, unknown>
			readonly hardQualitySelected?: number
		}
		readonly quota: {
			readonly shortage: readonly string[]
			readonly actual: Record<string, number>
		}
		readonly diversity: {
			readonly distinctConcepts: number
			readonly maxConceptFrequency: number
			readonly patternCount: number
			readonly patternShare: number
			readonly expertPatternCount: number
		}
		readonly checksum: string
	}

	console.log('Production content audit (Phase 8C Batch 1000)')
	console.log(`generator=${CONTENT_GENERATOR_VERSION}`)
	console.log(`catalogVersion=${manifest.catalogVersion}`)
	console.log(`puzzleCount=${manifest.puzzleCount}`)
	console.log(`parentChecksum=${manifest.parentChecksum ?? 'none'}`)
	console.log(`checksum=${manifest.checksum}`)
	console.log(`status=${report.status}`)
	console.log(
		`logic productionReady=${report.logic.productionReady} unique=${report.logic.unique} logical=${report.logic.logical} hintChain=${report.logic.hintChain}`,
	)
	console.log(
		`diversity concepts=${report.diversity.distinctConcepts} maxConceptFreq=${report.diversity.maxConceptFrequency} patterns=${report.diversity.patternCount}/${(report.diversity.patternShare * 100).toFixed(1)}% expertPatterns=${report.diversity.expertPatternCount}`,
	)
	const nearAbs =
		report.quality.nearDuplicateAbsolute ??
		report.quality.nearDuplicates.length
	console.log(
		`duplicates exact=${report.quality.exactDuplicates.length} transform=${report.quality.transformDuplicates.length} nearAbs=${nearAbs} nearNorm=${report.quality.nearDuplicateNormalized ?? 'n/a'} titles=${Object.keys(report.quality.duplicateTitles).length}`,
	)
	console.log(`tierActual=${JSON.stringify(report.quota.actual)}`)
	console.log(`contactSheetExists=${fs.existsSync(paths.contactSheetPath)}`)

	const issues: string[] = []
	if (manifest.puzzleCount !== B1000_TARGET) {
		issues.push(`expected ${B1000_TARGET} puzzles, got ${manifest.puzzleCount}`)
	}
	if (report.logic.productionReady !== B1000_TARGET) {
		issues.push('not all selected are productionReady')
	}
	if (report.logic.unique !== B1000_TARGET) {
		issues.push('not all selected unique')
	}
	if (report.logic.logical !== B1000_TARGET) {
		issues.push('not all selected logically solvable')
	}
	if (report.logic.hintChain !== B1000_TARGET) {
		issues.push('not all selected hint-chain solvable')
	}
	if (report.quality.exactDuplicates.length > 0) {
		issues.push('exact duplicates present')
	}
	if (report.quality.transformDuplicates.length > 0) {
		issues.push('transform duplicates present')
	}
	if (report.quota.shortage.length > 0) {
		issues.push(`tier shortage: ${report.quota.shortage.join(',')}`)
	}
	for (const [tier, n] of Object.entries(B1000_TIER_QUOTA)) {
		if ((report.quota.actual[tier] ?? 0) !== n) {
			issues.push(
				`tier ${tier} actual=${report.quota.actual[tier]} expected=${n}`,
			)
		}
	}
	if (report.diversity.distinctConcepts < MIN_DISTINCT_CONCEPTS_B1000) {
		issues.push(
			`distinctConcepts ${report.diversity.distinctConcepts} < ${MIN_DISTINCT_CONCEPTS_B1000}`,
		)
	}
	if (report.diversity.maxConceptFrequency > MAX_CONCEPT_FREQUENCY) {
		issues.push(
			`maxConceptFrequency ${report.diversity.maxConceptFrequency} > ${MAX_CONCEPT_FREQUENCY}`,
		)
	}
	if (report.diversity.patternCount > MAX_PATTERN_COUNT_B1000) {
		issues.push(
			`patterns ${report.diversity.patternCount} > ${MAX_PATTERN_COUNT_B1000}`,
		)
	}
	if (report.diversity.patternShare > 0.1 + 1e-9) {
		issues.push(`patternShare ${report.diversity.patternShare} > 0.1`)
	}
	if (report.diversity.expertPatternCount > MAX_EXPERT_PATTERN_COUNT_B1000) {
		issues.push(
			`expertPatterns ${report.diversity.expertPatternCount} > ${MAX_EXPERT_PATTERN_COUNT_B1000}`,
		)
	}
	if (Object.keys(report.quality.duplicateTitles).length > 0) {
		issues.push('duplicate titles present')
	}
	if ((report.quality.hardQualitySelected ?? 0) > 0) {
		issues.push('selected contains reward-quality hard rejects')
	}
	if (manifest.checksum === PILOT_R1_REJECTED_CHECKSUM) {
		issues.push('checksum matches rejected R1 baseline')
	}
	if (manifest.checksum !== report.checksum) {
		issues.push('manifest/report checksum mismatch')
	}
	if (!fs.existsSync(paths.contactSheetPath)) {
		issues.push('contact sheet missing')
	}
	for (const puzzle of manifest.puzzles) {
		if (puzzle.contentRole && puzzle.contentRole !== 'production') {
			issues.push(`non-production role in manifest: ${puzzle.id}`)
		}
	}

	const normalized = [...manifest.puzzles]
		.map((p) => ({
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
		.sort((a, b) => a.id.localeCompare(b.id))
	const recomputed = checksumManifest(
		JSON.stringify({
			catalogVersion: manifest.catalogVersion,
			generatorVersion: manifest.generatorVersion,
			parentChecksum: manifest.parentChecksum ?? '',
			puzzles: normalized,
		}),
	)
	if (recomputed !== manifest.checksum) {
		issues.push('checksum recomputation mismatch')
	}

	if (issues.length > 0) {
		console.error('FAIL')
		for (const issue of issues) {
			console.error(` - ${issue}`)
		}
		process.exitCode = 1
		return
	}
	console.log('PASS')
	if (
		report.quality.nearDuplicateNormalized !== undefined &&
		report.quality.nearDuplicateNormalized > 0.02
	) {
		console.log(
			`WARNING nearDuplicateNormalized=${report.quality.nearDuplicateNormalized.toFixed(6)} (review near-pair view)`,
		)
	}
}

main()
