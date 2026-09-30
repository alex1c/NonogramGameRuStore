/**
 * Repo-relative path helpers (Windows-safe, no hardcoded drive letters).
 * Active generation target: Phase 8B.1 Batch 250-R2.
 * Historical R1 / Pilot R2 / B250-R1 remain for comparison.
 */

import path from 'node:path'

export function repoRoot(): string {
	return path.resolve(__dirname, '..', '..')
}

export function contentPaths() {
	const root = repoRoot()
	return {
		root,
		generatedPilotR1Dir: path.join(root, 'generated', 'content-pilot'),
		generatedPilotR2Dir: path.join(root, 'generated', 'content-pilot-r2'),
		/** B250-R1 baseline (Phase 8B) — do not overwrite. */
		generatedB250R1Dir: path.join(root, 'generated', 'content-b250'),
		/** Active B250-R2 candidate output. */
		generatedPilotDir: path.join(root, 'generated', 'content-b250-r2'),
		manifestPath: path.join(
			root,
			'generated',
			'content-b250-r2',
			'manifest.json',
		),
		reportJsonPath: path.join(
			root,
			'generated',
			'content-b250-r2',
			'report.json',
		),
		checksumPath: path.join(
			root,
			'generated',
			'content-b250-r2',
			'checksum.txt',
		),
		rejectionsPath: path.join(root, 'content-src', 'rejections.json'),
		reviewPilotDir: path.join(
			root,
			'review-artifacts',
			'production-content',
			'b250-r2',
		),
		contactSheetPath: path.join(
			root,
			'review-artifacts',
			'production-content',
			'b250-r2',
			'contact-sheet.html',
		),
		reportMdPath: path.join(
			root,
			'review-artifacts',
			'production-content',
			'b250-r2',
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
		b250R1Manifest: path.join(
			root,
			'generated',
			'content-b250',
			'manifest.json',
		),
	}
}
