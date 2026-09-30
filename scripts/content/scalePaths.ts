/**
 * Phase 8C path helpers — checkpoint artifacts for B500 / B750 / B1000.
 * B250-R2 remains the immutable additive ancestor.
 */

import path from 'node:path'
import { contentPaths as baseContentPaths } from './paths'

export type ScaleCheckpoint = 'b500' | 'b750' | 'b1000'

export function scalePaths(checkpoint: ScaleCheckpoint) {
	const root = baseContentPaths().root
	const dirName =
		checkpoint === 'b500'
			? 'content-b500'
			: checkpoint === 'b750'
				? 'content-b750'
				: 'content-b1000'
	const reviewName =
		checkpoint === 'b500'
			? 'b500-r1'
			: checkpoint === 'b750'
				? 'b750-r1'
				: 'b1000-r1'
	const generatedDir = path.join(root, 'generated', dirName)
	const reviewDir = path.join(
		root,
		'review-artifacts',
		'production-content',
		reviewName,
	)
	return {
		root,
		generatedDir,
		manifestPath: path.join(generatedDir, 'manifest.json'),
		reportJsonPath: path.join(generatedDir, 'report.json'),
		reportMdPath: path.join(generatedDir, 'report.md'),
		checksumPath: path.join(generatedDir, 'checksum.txt'),
		reviewDir,
		contactSheetPath: path.join(reviewDir, 'contact-sheet.html'),
		b250R2Manifest: path.join(
			root,
			'generated',
			'content-b250-r2',
			'manifest.json',
		),
		b500Manifest: path.join(root, 'generated', 'content-b500', 'manifest.json'),
		b750Manifest: path.join(root, 'generated', 'content-b750', 'manifest.json'),
	}
}

/** Re-export base content paths for callers that still import paths.ts. */
export { contentPaths, repoRoot } from './paths'
