/**
 * Production content audit — Phase 8B Batch 250.
 * npm run audit:production-content
 */

import fs from 'node:fs'
import {
	CONTENT_GENERATOR_VERSION,
	MAX_CONCEPT_FREQUENCY,
	MAX_EXPERT_PATTERN_COUNT,
	MAX_PATTERN_COUNT,
	MIN_DISTINCT_CONCEPTS,
	NEAR_DUPLICATE_PAIR_TARGET,
	PILOT_R1_REJECTED_CHECKSUM,
	PILOT_TARGET,
} from './content/constants'
import { contentPaths } from './content/paths'
import type { PilotManifest } from './content/types'
import { checksumManifest } from './content/hash'

function main(): void {
	const paths = contentPaths()
	if (!fs.existsSync(paths.manifestPath)) {
		console.error(`Missing B250 manifest: ${paths.manifestPath}`)
		console.error('Run: npm run content:generate-b250')
		process.exitCode = 1
		return
	}
	if (!fs.existsSync(paths.reportJsonPath)) {
		console.error(`Missing B250 report: ${paths.reportJsonPath}`)
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
			readonly duplicateTitles: Record<string, unknown>
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
			readonly maxFamilyShare: number
			readonly maxCollectionShare: number
			readonly gateFailures: readonly string[]
		}
		readonly roles?: {
			readonly production: number
			readonly tutorial: number
			readonly dev: number
		}
		readonly rewardQuality?: {
			readonly hardRejectSelected: number
			readonly line_like: { readonly selected: number }
			readonly tiny_trivial: { readonly selected: number }
			readonly noise_like: { readonly selected: number }
			readonly primitiveRegression?: readonly {
				readonly productionSelected: boolean
			}[]
		}
		readonly checksum: string
	}

	console.log('Production content audit (Phase 8B Batch 250)')
	console.log(`generator=${CONTENT_GENERATOR_VERSION}`)
	console.log(`catalogVersion=${manifest.catalogVersion}`)
	console.log(`puzzleCount=${manifest.puzzleCount}`)
	console.log(`checksum=${manifest.checksum}`)
	console.log(`status=${report.status}`)
	console.log(
		`logic productionReady=${report.logic.productionReady} unique=${report.logic.unique} logical=${report.logic.logical} hintChain=${report.logic.hintChain}`,
	)
	console.log(
		`diversity concepts=${report.diversity.distinctConcepts} maxConceptFreq=${report.diversity.maxConceptFrequency} patterns=${report.diversity.patternCount}/${(report.diversity.patternShare * 100).toFixed(1)}% expertPatterns=${report.diversity.expertPatternCount} maxFamilyShare=${(report.diversity.maxFamilyShare * 100).toFixed(1)}%`,
	)
	console.log(
		`duplicates exact=${report.quality.exactDuplicates.length} transform=${report.quality.transformDuplicates.length} near=${report.quality.nearDuplicates.length} titles=${Object.keys(report.quality.duplicateTitles).length}`,
	)
	console.log(`roles=${JSON.stringify(report.roles ?? null)}`)
	console.log(`tierActual=${JSON.stringify(report.quota.actual)}`)
	console.log(`contactSheetExists=${fs.existsSync(paths.contactSheetPath)}`)

	const issues: string[] = []
	if (manifest.puzzleCount !== PILOT_TARGET) {
		issues.push(`expected ${PILOT_TARGET} puzzles, got ${manifest.puzzleCount}`)
	}
	if (report.logic.productionReady !== PILOT_TARGET) {
		issues.push('not all selected are productionReady')
	}
	if (report.logic.unique !== PILOT_TARGET) {
		issues.push('not all selected unique')
	}
	if (report.logic.logical !== PILOT_TARGET) {
		issues.push('not all selected logically solvable')
	}
	if (report.logic.hintChain !== PILOT_TARGET) {
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
	if (report.diversity.distinctConcepts < MIN_DISTINCT_CONCEPTS) {
		issues.push(
			`distinctConcepts ${report.diversity.distinctConcepts} < ${MIN_DISTINCT_CONCEPTS}`,
		)
	}
	if (report.diversity.maxConceptFrequency > MAX_CONCEPT_FREQUENCY) {
		issues.push(
			`maxConceptFrequency ${report.diversity.maxConceptFrequency} > ${MAX_CONCEPT_FREQUENCY}`,
		)
	}
	if (report.diversity.patternCount > MAX_PATTERN_COUNT) {
		issues.push(`patterns ${report.diversity.patternCount} > ${MAX_PATTERN_COUNT}`)
	}
	if (report.diversity.expertPatternCount > MAX_EXPERT_PATTERN_COUNT) {
		issues.push(
			`expertPatterns ${report.diversity.expertPatternCount} > ${MAX_EXPERT_PATTERN_COUNT}`,
		)
	}
	if (Object.keys(report.quality.duplicateTitles).length > 0) {
		issues.push('duplicate titles present')
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
	if (report.roles && report.roles.production !== PILOT_TARGET) {
		issues.push('selected must be PRODUCTION only')
	}
	if (report.roles && (report.roles.tutorial > 0 || report.roles.dev > 0)) {
		issues.push('tutorial/dev leaked into B250 selection')
	}
	if (report.rewardQuality && report.rewardQuality.hardRejectSelected > 0) {
		issues.push('selected contains reward-quality hard rejects')
	}
	if (report.rewardQuality) {
		for (const flag of ['line_like', 'tiny_trivial', 'noise_like'] as const) {
			const selected = report.rewardQuality[flag]?.selected ?? 0
			if (selected > 0) {
				issues.push(`selected has ${flag}=${selected} (hard zero required)`)
			}
		}
		for (const row of report.rewardQuality.primitiveRegression ?? []) {
			if (row.productionSelected) {
				issues.push('primitive regression entered production selection')
			}
		}
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
			puzzles: normalized,
		}),
	)
	if (recomputed !== manifest.checksum) {
		issues.push('manifest checksum recompute mismatch')
	}

	const ids = new Set<string>()
	for (const puzzle of manifest.puzzles) {
		if (ids.has(puzzle.id)) {
			issues.push(`duplicate id ${puzzle.id}`)
		}
		ids.add(puzzle.id)
	}

	if (issues.length > 0) {
		console.error('')
		console.error('FAIL')
		for (const issue of issues) {
			console.error(`- ${issue}`)
		}
		process.exitCode = 1
		return
	}

	console.log('PASS')
	if (report.quality.nearDuplicates.length > NEAR_DUPLICATE_PAIR_TARGET) {
		console.log(
			`WARNING nearDuplicates=${report.quality.nearDuplicates.length} (target ≤${NEAR_DUPLICATE_PAIR_TARGET})`,
		)
	}
}

main()
