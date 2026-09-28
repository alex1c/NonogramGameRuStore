/**
 * Statistics screen selectors (pure).
 */

import { PHASE4_CAMPAIGN_ENTRIES, resolveCampaignPuzzle } from '../campaign'
import { analyzeDifficulty } from '../domain/difficulty/analyzer'
import {
	DIFFICULTY_TIERS,
	type DifficultyTier,
} from '../domain/difficulty/tiers'
import type { SaveRoot } from '../persistence/schema'
import { difficultyLabelRu } from './difficultyLabels'
import { formatTotalActiveTime } from './timeFormat'

export interface DifficultyStatRow {
	readonly tier: DifficultyTier
	readonly label: string
	readonly completed: number
	readonly available: number
}

export interface StatisticsViewModel {
	readonly completedUnique: number
	readonly campaignTotal: number
	readonly startedUnique: number
	readonly totalCompletions: number
	readonly totalActiveTimeLabel: string
	readonly totalRestarts: number
	readonly totalUndoActions: number
	readonly totalRedoActions: number
	readonly byDifficulty: readonly DifficultyStatRow[]
}

function campaignIdsByTier(): Map<DifficultyTier, string[]> {
	const map = new Map<DifficultyTier, string[]>()
	for (const tier of DIFFICULTY_TIERS) {
		map.set(tier, [])
	}
	for (const entry of PHASE4_CAMPAIGN_ENTRIES) {
		const puzzle = resolveCampaignPuzzle(entry.puzzleId)
		if (puzzle === null) {
			continue
		}
		const tier = analyzeDifficulty(puzzle).tier
		if (tier === 'UNRATED') {
			continue
		}
		map.get(tier)?.push(puzzle.id)
	}
	return map
}

let cachedByTier: Map<DifficultyTier, string[]> | null = null

function getByTier(): Map<DifficultyTier, string[]> {
	if (cachedByTier === null) {
		cachedByTier = campaignIdsByTier()
	}
	return cachedByTier
}

export function buildStatisticsViewModel(save: SaveRoot): StatisticsViewModel {
	const campaignIdSet = new Set(
		PHASE4_CAMPAIGN_ENTRIES.map((entry) => entry.puzzleId),
	)
	let completedUnique = 0
	for (const id of save.completedPuzzleIds) {
		if (campaignIdSet.has(id)) {
			completedUnique += 1
		}
	}

	const startedInCampaign = save.startedPuzzleIds.filter((id) =>
		campaignIdSet.has(id),
	).length

	const completedSet = new Set(save.completedPuzzleIds)
	const byDifficulty: DifficultyStatRow[] = DIFFICULTY_TIERS.map((tier) => {
		const ids = getByTier().get(tier) ?? []
		let completed = 0
		for (const id of ids) {
			if (completedSet.has(id)) {
				completed += 1
			}
		}
		return {
			tier,
			label: difficultyLabelRu(tier),
			completed,
			available: ids.length,
		}
	})

	return {
		completedUnique,
		campaignTotal: PHASE4_CAMPAIGN_ENTRIES.length,
		startedUnique: startedInCampaign,
		totalCompletions: save.statistics.totalCompletions,
		totalActiveTimeLabel: formatTotalActiveTime(
			save.statistics.totalActiveSolveTimeMs,
		),
		totalRestarts: save.statistics.totalRestarts,
		totalUndoActions: save.statistics.totalUndoActions,
		totalRedoActions: save.statistics.totalRedoActions,
		byDifficulty,
	}
}
