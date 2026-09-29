/**
 * Repo-relative path helpers (Windows-safe, no hardcoded drive letters).
 * Pilot R2 is the active generation target; R1 remains historical baseline.
 */

import path from 'node:path'

export function repoRoot(): string {
	return path.resolve(__dirname, '..', '..')
}

export function contentPaths() {
	const root = repoRoot()
	return {
		root,
		/** Historical R1 (rejected human review) — do not overwrite. */
		generatedPilotR1Dir: path.join(root, 'generated', 'content-pilot'),
		generatedPilotDir: path.join(root, 'generated', 'content-pilot-r2'),
		manifestPath: path.join(
			root,
			'generated',
			'content-pilot-r2',
			'manifest.json',
		),
		reportJsonPath: path.join(
			root,
			'generated',
			'content-pilot-r2',
			'report.json',
		),
		checksumPath: path.join(
			root,
			'generated',
			'content-pilot-r2',
			'checksum.txt',
		),
		rejectionsPath: path.join(root, 'content-src', 'rejections.json'),
		reviewPilotDir: path.join(
			root,
			'review-artifacts',
			'production-content',
			'pilot-r2',
		),
		contactSheetPath: path.join(
			root,
			'review-artifacts',
			'production-content',
			'pilot-r2',
			'contact-sheet.html',
		),
		reportMdPath: path.join(
			root,
			'review-artifacts',
			'production-content',
			'pilot-r2',
			'pilot-report.md',
		),
		r1BaselineReport: path.join(
			root,
			'generated',
			'content-pilot',
			'report.json',
		),
	}
}
