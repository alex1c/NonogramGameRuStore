/**
 * Home screen view-model selectors (pure).
 */

import { getCampaignProgressSummary } from '../campaign'
import { resolvePlayablePuzzleById } from '../content/playable'
import { getRuntimePuzzleEntry } from '../content/runtime'
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

	const puzzle = resolvePlayablePuzzleById(active.puzzleId)
	if (puzzle === null) {
		return {
			hasActiveGame: false,
			primaryCta: 'play',
			primaryLabel: 'Играть',
			progressLabel: progress.label,
			continueCard: null,
		}
	}
	const runtime = getRuntimePuzzleEntry(active.puzzleId)
	const sizeLabel = `${puzzle.width}×${puzzle.height}`
	const difficultyLabel = difficultyLabelRu(
		runtime?.tier ?? puzzle.assignedDifficulty ?? 'UNRATED',
	)
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
