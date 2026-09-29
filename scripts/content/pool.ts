/**
 * Build R2 raw candidate pool — authored concept library only.
 * Procedural size/mutation families are intentionally excluded from R2.
 */

import {
	materializeConcept,
	R2_CONCEPT_LIBRARY,
} from './families/r2ConceptLibrary'
import type { RawCandidate } from './types'

export function buildRawCandidatePool(): RawCandidate[] {
	const authored: RawCandidate[] = R2_CONCEPT_LIBRARY.map((template, index) => {
		const { bitmap } = materializeConcept(template)
		return {
			id: template.id,
			titleRu: template.titleRu,
			collectionId: template.collectionId,
			conceptId: template.conceptId,
			compositionId: template.compositionId,
			family: template.family,
			variant: template.compositionId,
			kind: template.kind,
			sourceKind: template.sourceKind,
			bitmap,
			seed: 200_000 + index,
		}
	})
	authored.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
	return authored
}
