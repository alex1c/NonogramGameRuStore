/**
 * User-facing difficulty presentation.
 * Internal tier enums stay English; Russian copy lives only here.
 */

import {
	DIFFICULTY_LABEL_RU,
	type DifficultyRating,
} from '../domain/difficulty/tiers'

/**
 * Map an internal difficulty rating to Russian UI copy.
 * UNRATED should not appear for productionReady puzzles — show an em dash.
 */
export function difficultyLabelRu(tier: DifficultyRating): string {
	if (tier === 'UNRATED') {
		return '—'
	}
	return DIFFICULTY_LABEL_RU[tier]
}
