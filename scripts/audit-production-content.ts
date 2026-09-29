/**
 * Production content audit — npm run audit:production-content
 * Audits the Phase 8A pilot candidate manifest (not runtime 21).
 */

import fs from 'node:fs'
import { CONTENT_GENERATOR_VERSION, PILOT_TARGET } from './content/constants'
import { contentPaths } from './content/paths'
import type { PilotManifest } from './content/types'
import { checksumManifest } from './content/hash'

function main(): void {
	const paths = contentPaths()
	if (!fs.existsSync(paths.manifestPath)) {
		console.error(`Missing pilot manifest: ${paths.manifestPath}`)
		console.error('Run: npm run content:generate-pilot')
		process.exitCode = 1
		return
	}
	if (!fs.existsSync(paths.reportJsonPath)) {
		console.error(`Missing pilot report: ${paths.reportJsonPath}`)
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
		}
		readonly quota: {
			readonly shortage: readonly string[]
			readonly actual: Record<string, number>
		}
		readonly checksum: string
	}

	console.log('Production content audit (Phase 8A pilot candidates)')
	console.log(`generator=${CONTENT_GENERATOR_VERSION}`)
	console.log(`catalogVersion=${manifest.catalogVersion}`)
	console.log(`puzzleCount=${manifest.puzzleCount}`)
	console.log(`checksum=${manifest.checksum}`)
	console.log(`status=${report.status}`)
	console.log(
		`logic productionReady=${report.logic.productionReady} unique=${report.logic.unique} logical=${report.logic.logical} hintChain=${report.logic.hintChain}`,
	)
	console.log(
		`duplicates exact=${report.quality.exactDuplicates.length} transform=${report.quality.transformDuplicates.length}`,
	)
	console.log(`tierActual=${JSON.stringify(report.quota.actual)}`)
	console.log(
		`contactSheetExists=${fs.existsSync(paths.contactSheetPath)}`,
	)

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
	if (manifest.checksum !== report.checksum) {
		issues.push('manifest/report checksum mismatch')
	}
	if (!fs.existsSync(paths.contactSheetPath)) {
		issues.push('contact sheet missing')
	}

	// Recompute checksum from committed puzzle fields.
	const normalized = [...manifest.puzzles]
		.map((p) => ({
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
}

main()
