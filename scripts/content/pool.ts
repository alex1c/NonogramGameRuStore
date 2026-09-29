/**
 * Build the full raw candidate pool (authored + procedural).
 */

import { materializeTemplate, AUTHORED_TEMPLATES } from './families/authoredTemplates'
import { allProceduralCandidates } from './families/procedural'
import {
	generateBeginnerPack,
	generateHardExpertPack,
} from './families/quotaPacks'
import { generateExpertScatterFamily } from './families/expertPack'
import type { RawCandidate } from './types'

export function buildRawCandidatePool(): RawCandidate[] {
	const authored: RawCandidate[] = AUTHORED_TEMPLATES.map((template, index) => {
		const { bitmap } = materializeTemplate(template)
		return {
			id: template.id,
			titleRu: template.titleRu,
			collectionId: template.collectionId,
			family: template.family,
			variant: 'authored',
			kind: template.kind === 'pattern' ? 'pattern' : 'object',
			bitmap,
			seed: 100_000 + index,
		}
	})
	const merged = [
		...authored,
		...allProceduralCandidates(),
		...generateBeginnerPack(),
		...generateHardExpertPack(),
		...generateExpertScatterFamily(),
	]
	merged.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
	return merged
}
