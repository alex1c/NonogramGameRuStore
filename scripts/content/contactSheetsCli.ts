/**
 * Contact sheet CLI — regenerates HTML from existing pilot report/manifest.
 * npm run content:contact-sheets
 */

import fs from 'node:fs'
import { buildContactSheetHtml } from './contactSheet'
import { contentPaths } from './paths'
import type { CandidateAuditRecord, PilotManifest } from './types'

function main(): void {
	const paths = contentPaths()
	if (!fs.existsSync(paths.reportJsonPath) || !fs.existsSync(paths.manifestPath)) {
		console.error('Missing pilot artifacts. Run npm run content:generate-pilot first.')
		process.exitCode = 1
		return
	}
	const report = JSON.parse(
		fs.readFileSync(paths.reportJsonPath, 'utf8'),
	) as {
		readonly puzzles: CandidateAuditRecord[]
		readonly catalogVersion: string
		readonly generatorVersion: string
		readonly checksum: string
	}
	const manifest = JSON.parse(
		fs.readFileSync(paths.manifestPath, 'utf8'),
	) as PilotManifest

	fs.mkdirSync(paths.reviewPilotDir, { recursive: true })
	const html = buildContactSheetHtml(report.puzzles, {
		catalogVersion: report.catalogVersion,
		generatorVersion: report.generatorVersion,
		checksum: manifest.checksum,
	})
	fs.writeFileSync(paths.contactSheetPath, html, 'utf8')
	console.log(`Wrote ${paths.contactSheetPath} (${report.puzzles.length} items)`)
}

main()
