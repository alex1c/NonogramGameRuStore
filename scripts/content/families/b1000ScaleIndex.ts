/**
 * Phase 8C scale authored packs — barrel + RawCandidate materializer.
 * Not wired into pool.ts / r2ConceptLibrary.ts yet.
 */

import { parseAscii } from '../bitmap'
import type { RawCandidate } from '../types'
import { B1000_SCALE_AUTHORED_A } from './b1000ScaleAuthoredA'
import { B1000_SCALE_AUTHORED_B } from './b1000ScaleAuthoredB'
import { B1000_SCALE_AUTHORED_C } from './b1000ScaleAuthoredC'
import { B1000_SCALE_AUTHORED_HARD } from './b1000ScaleAuthoredHard'
import {
	B1000_SCALE_BEGINNER_FILL,
	B1000_SCALE_EXPERT_FILL,
} from './b1000ScaleQuotaFill'
import { B1000_SCALE_TRUE_BEGINNER } from './b1000ScaleTrueBeginner'
import type { ExpansionTemplate } from './b1000ScaleAuthoredA'

export { B1000_SCALE_AUTHORED_A } from './b1000ScaleAuthoredA'
export { B1000_SCALE_AUTHORED_B } from './b1000ScaleAuthoredB'
export { B1000_SCALE_AUTHORED_C } from './b1000ScaleAuthoredC'
export { B1000_SCALE_AUTHORED_HARD } from './b1000ScaleAuthoredHard'
export type { ExpansionTemplate }

/** Combined frozen scale authored library. */
export const B1000_SCALE_AUTHORED: readonly ExpansionTemplate[] = Object.freeze([
	...B1000_SCALE_AUTHORED_A,
	...B1000_SCALE_AUTHORED_B,
	...B1000_SCALE_AUTHORED_C,
	...B1000_SCALE_AUTHORED_HARD,
	...B1000_SCALE_BEGINNER_FILL,
	...B1000_SCALE_EXPERT_FILL,
	...B1000_SCALE_TRUE_BEGINNER,
])

/**
 * Materialize scale authored templates into RawCandidate[] (pool.ts shape).
 * Seeds start at 800_000 so they do not collide with R2 (200_000+) seeds.
 */
export function scaleAuthoredToRawCandidates(): RawCandidate[] {
	const out: RawCandidate[] = []
	B1000_SCALE_AUTHORED.forEach((template, index) => {
		const bitmap = parseAscii(template.ascii)
		out.push({
			id: template.id,
			titleRu: template.titleRu,
			collectionId: template.collectionId,
			conceptId: template.conceptId,
			compositionId: template.compositionId,
			family: template.family,
			variant: template.compositionId,
			kind: template.kind,
			sourceKind: template.sourceKind,
			contentRole: 'production',
			bitmap,
			seed: 800_000 + index,
		})
	})
	return out
}
