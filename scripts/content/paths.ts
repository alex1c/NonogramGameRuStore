/**
 * Repo-relative path helpers (Windows-safe, no hardcoded drive letters).
 * Active generation target: Phase 8B Batch 250.
 * Historical R1 / R2 artifacts remain for comparison reports.
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
		/** Historical R2 (100) — retained for comparison. */
		generatedPilotR2Dir: path.join(root, 'generated', 'content-pilot-r2'),
		/** Active B250 candidate output. */
		generatedPilotDir: path.join(root, 'generated', 'content-b250'),
		manifestPath: path.join(root, 'generated', 'content-b250', 'manifest.json'),
		reportJsonPath: path.join(root, 'generated', 'content-b250', 'report.json'),
		checksumPath: path.join(root, 'generated', 'content-b250', 'checksum.txt'),
		rejectionsPath: path.join(root, 'content-src', 'rejections.json'),
		reviewPilotDir: path.join(
			root,
			'review-artifacts',
			'production-content',
			'b250-r1',
		),
		contactSheetPath: path.join(
			root,
			'review-artifacts',
			'production-content',
			'b250-r1',
			'contact-sheet.html',
		),
		reportMdPath: path.join(
			root,
			'review-artifacts',
			'production-content',
			'b250-r1',
			'pilot-report.md',
		),
		r1BaselineReport: path.join(
			root,
			'generated',
			'content-pilot',
			'report.json',
		),
		r2BaselineReport: path.join(
			root,
			'generated',
			'content-pilot-r2',
			'report.json',
		),
	}
}
