/**
 * Home screen view-model selectors (pure).
 */

import {
	getCampaignProgressSummary,
	resolveCampaignPuzzle,
} from '../campaign'
import { analyzeDifficulty } from '../domain/difficulty/analyzer'
import type { SaveRoot } from '../persistence/schema'
import { difficultyLabelRu } from './difficultyLabels'
import {
	determinedProgressPercent,
	formatMarkedPercent,
} from './progressPercent'
import { formatGameElapsed } from './timeFormat'

export interface HomeContinueCard {
	readonly puzzleId: string
	readonly sizeLabel: string
	readonly difficultyLabel: string
	readonly markedLabel: string
	readonly elapsedLabel: string
}

export interface HomeViewModel {
	readonly hasActiveGame: boolean
	readonly primaryCta: 'continue' | 'play'
	readonly primaryLabel: string
	readonly progressLabel: string
	readonly continueCard: HomeContinueCard | null
}

export function buildHomeViewModel(save: SaveRoot): HomeViewModel {
	const progress = getCampaignProgressSummary(save)
	const active = save.activeGame
	if (active === null) {
		return {
			hasActiveGame: false,
			primaryCta: 'play',
			primaryLabel: 'Играть',
			progressLabel: progress.label,
			continueCard: null,
		}
	}

	const puzzle = resolveCampaignPuzzle(active.puzzleId)
	const sizeLabel =
		puzzle !== null
			? `${puzzle.width}×${puzzle.height}`
			: `${active.player.width}×${active.player.height}`
	const difficultyLabel =
		puzzle !== null
			? difficultyLabelRu(analyzeDifficulty(puzzle).tier)
			: '—'
	const marked = determinedProgressPercent(active.player.cells)

	return {
		hasActiveGame: true,
		primaryCta: 'continue',
		primaryLabel: 'Продолжить',
		progressLabel: progress.label,
		continueCard: {
			puzzleId: active.puzzleId,
			sizeLabel,
			difficultyLabel,
			markedLabel: formatMarkedPercent(marked),
			elapsedLabel: formatGameElapsed(active.accumulatedActiveMs),
		},
	}
}
