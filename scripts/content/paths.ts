/**
 * Repo-relative path helpers (Windows-safe, no hardcoded drive letters).
 * Active generation target: Phase 8C Batch 1000-R1 candidate.
 * Historical B250-R2 / B500 / B750 remain for ancestry comparison.
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
		/** B250-R2 accepted additive ancestor. */
		generatedB250R2Dir: path.join(root, 'generated', 'content-b250-r2'),
		/** Active B1000-R1 candidate output. */
		generatedPilotDir: path.join(root, 'generated', 'content-b1000'),
		manifestPath: path.join(
			root,
			'generated',
			'content-b1000',
			'manifest.json',
		),
		reportJsonPath: path.join(
			root,
			'generated',
			'content-b1000',
			'report.json',
		),
		checksumPath: path.join(
			root,
			'generated',
			'content-b1000',
			'checksum.txt',
		),
		rejectionsPath: path.join(root, 'content-src', 'rejections.json'),
		reviewPilotDir: path.join(
			root,
			'review-artifacts',
			'production-content',
			'b1000-r1',
		),
		contactSheetPath: path.join(
			root,
			'review-artifacts',
			'production-content',
			'b1000-r1',
			'contact-sheet.html',
		),
		reportMdPath: path.join(
			root,
			'review-artifacts',
			'production-content',
			'b1000-r1',
			'report.md',
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
		b250R2Manifest: path.join(
			root,
			'generated',
			'content-b250-r2',
			'manifest.json',
		),
	}
}
