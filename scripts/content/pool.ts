/**
 * Build B250 raw candidate pool — authored concept library only.
 * Tutorial/dev roles remain in the source library but are excluded from
 * production selection (filtered here for the active batch).
 */

import {
	materializeConcept,
	R2_CONCEPT_LIBRARY,
	type ConceptTemplate,
} from './families/r2ConceptLibrary'
import type { ContentRole, RawCandidate } from './types'

/** Human-review R2 primitives — retain as tutorial, never production. */
const TUTORIAL_IDS = new Set([
	'beg-bar',
	'beg-corner',
	'beg-dash',
	'beg-ledge',
	'beg-line-h',
	'beg-line-v',
	'beg-two-dots',
	'beg-ridge',
	'beg-hook',
	'beg-pillars',
	'beg-arch',
	'beg-seat',
	'beg-gate',
	'beg-block',
	'beg-colon',
])

function roleFor(template: ConceptTemplate): ContentRole {
	if (template.contentRole) {
		return template.contentRole
	}
	if (TUTORIAL_IDS.has(template.id)) {
		return 'tutorial'
	}
	return 'production'
}

export function buildRawCandidatePool(
	opts: { readonly includeNonProduction?: boolean } = {},
): RawCandidate[] {
	const authored: RawCandidate[] = []
	R2_CONCEPT_LIBRARY.forEach((template, index) => {
		const contentRole = roleFor(template)
		if (!opts.includeNonProduction && contentRole !== 'production') {
			return
		}
		const { bitmap } = materializeConcept(template)
		authored.push({
			id: template.id,
			titleRu: template.titleRu,
			collectionId: template.collectionId,
			conceptId: template.conceptId,
			compositionId: template.compositionId,
			family: template.family,
			variant: template.compositionId,
			kind: template.kind,
			sourceKind: template.sourceKind,
			contentRole,
			bitmap,
			seed: 200_000 + index,
		})
	})
	authored.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
	return authored
}
