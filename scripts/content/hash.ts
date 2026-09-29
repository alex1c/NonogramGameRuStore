/**
 * Deterministic content hashing (Node crypto, build-time only).
 */

import { createHash } from 'node:crypto'
import type { Bitmap } from './bitmap'
import {
	mirrorHorizontal,
	mirrorVertical,
	rotate180,
	toAscii,
} from './bitmap'

export function solutionHash(bitmap: Bitmap): string {
	const payload = `${bitmap[0]?.length ?? 0}x${bitmap.length}\n${toAscii(bitmap)}`
	return createHash('sha256').update(payload, 'utf8').digest('hex')
}

/**
 * Min hash among exact / H-mirror / V-mirror / 180° (same dimensions).
 * Detects simple transformation duplicates.
 */
export function canonicalTransformationHash(bitmap: Bitmap): string {
	const variants = [
		bitmap,
		mirrorHorizontal(bitmap),
		mirrorVertical(bitmap),
		rotate180(bitmap),
	]
	const hashes = variants.map((v) => solutionHash(v))
	hashes.sort()
	return hashes[0]!
}

export function checksumManifest(payload: string): string {
	return createHash('sha256').update(payload, 'utf8').digest('hex')
}
