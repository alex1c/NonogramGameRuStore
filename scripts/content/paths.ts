/**
 * Repo-relative path helpers (Windows-safe, no hardcoded drive letters).
 */

import path from 'node:path'

export function repoRoot(): string {
	// scripts/content → repo root
	return path.resolve(__dirname, '..', '..')
}

export function contentPaths() {
	const root = repoRoot()
	return {
		root,
		generatedPilotDir: path.join(root, 'generated', 'content-pilot'),
		manifestPath: path.join(
			root,
			'generated',
			'content-pilot',
			'manifest.json',
		),
		reportJsonPath: path.join(
			root,
			'generated',
			'content-pilot',
			'report.json',
		),
		checksumPath: path.join(
			root,
			'generated',
			'content-pilot',
			'checksum.txt',
		),
		rejectionsPath: path.join(
			root,
			'content-src',
			'rejections.json',
		),
		reviewPilotDir: path.join(
			root,
			'review-artifacts',
			'production-content',
			'pilot',
		),
		contactSheetPath: path.join(
			root,
			'review-artifacts',
			'production-content',
			'pilot',
			'contact-sheet.html',
		),
		reportMdPath: path.join(
			root,
			'review-artifacts',
			'production-content',
			'pilot',
			'pilot-report.md',
		),
	}
}
