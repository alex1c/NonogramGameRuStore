/**
 * Campaign presentation projection — immutable view models for UI.
 */

import { analyzeDifficulty } from '../domain/difficulty/analyzer'
import type { DifficultyRating } from '../domain/difficulty/tiers'
import type { SaveRoot } from '../persistence/schema'
import { difficultyLabelRu } from '../presentation/difficultyLabels'
import {
	determinedProgressPercent,
	formatMarkedPercent,
} from '../presentation/progressPercent'
import { formatBestTime } from '../presentation/timeFormat'
import {
	getCampaignTotal,
	PHASE4_CAMPAIGN_ENTRIES,
	resolveCampaignPuzzle,
} from './definition'
import {
	buildUnlockContext,
	getLevelAccessState,
	type LevelAccessState,
} from './unlock'

export interface LevelCardViewModel {
	readonly order: number
	readonly puzzleId: string
	readonly width: number
	readonly height: number
	readonly sizeLabel: string
	readonly difficultyTier: DifficultyRating
	readonly difficultyLabel: string
	readonly access: LevelAccessState
	readonly accessLabel: string
	readonly markedPercent: number | null
	readonly markedLabel: string | null
	readonly bestTimeLabel: string | null
	readonly locked: boolean
}

const ACCESS_LABEL_RU: Readonly<Record<LevelAccessState, string>> =
	Object.freeze({
		LOCKED: 'Закрыт',
		AVAILABLE: 'Новый',
		IN_PROGRESS: 'В процессе',
		COMPLETED: 'Пройден',
	})

/** Cache difficulty analysis — avoid re-running solvers on every render. */
const difficultyCache = new Map<string, DifficultyRating>()

function cachedDifficulty(puzzleId: string, analyze: () => DifficultyRating): DifficultyRating {
	const hit = difficultyCache.get(puzzleId)
	if (hit !== undefined) {
		return hit
	}
	const tier = analyze()
	difficultyCache.set(puzzleId, tier)
	return tier
}

export function buildLevelCardViewModel(
	order: number,
	save: SaveRoot,
): LevelCardViewModel | null {
	const entry = PHASE4_CAMPAIGN_ENTRIES.find((item) => item.order === order)
	if (entry === undefined) {
		return null
	}
	const puzzle = resolveCampaignPuzzle(entry.puzzleId)
	if (puzzle === null) {
		return null
	}

	const ctx = buildUnlockContext(
		save.completedPuzzleIds,
		save.activeGame?.puzzleId ?? null,
	)
	const access = getLevelAccessState(order, ctx)
	const tier = cachedDifficulty(puzzle.id, () => analyzeDifficulty(puzzle).tier)

	let markedPercent: number | null = null
	let markedLabel: string | null = null
	if (
		access === 'IN_PROGRESS' &&
		save.activeGame !== null &&
		save.activeGame.puzzleId === puzzle.id
	) {
		markedPercent = determinedProgressPercent(save.activeGame.player.cells)
		markedLabel = formatMarkedPercent(markedPercent)
	}

	const best = save.bestTimes.find((item) => item.puzzleId === puzzle.id)
	const bestTimeLabel =
		access === 'COMPLETED' && best !== undefined
			? formatBestTime(best.bestActiveTimeMs)
			: null

	return {
		order,
		puzzleId: puzzle.id,
		width: puzzle.width,
		height: puzzle.height,
		sizeLabel: `${puzzle.width}×${puzzle.height}`,
		difficultyTier: tier,
		difficultyLabel: difficultyLabelRu(tier),
		access,
		accessLabel: ACCESS_LABEL_RU[access],
		markedPercent,
		markedLabel,
		bestTimeLabel,
		locked: access === 'LOCKED',
	}
}

export function buildCampaignLevelCards(
	save: SaveRoot,
): readonly LevelCardViewModel[] {
	const cards: LevelCardViewModel[] = []
	for (const entry of PHASE4_CAMPAIGN_ENTRIES) {
		const card = buildLevelCardViewModel(entry.order, save)
		if (card !== null) {
			cards.push(card)
		}
	}
	return cards
}

export function countCompletedInCampaign(save: SaveRoot): number {
	const campaignIds = new Set(
		PHASE4_CAMPAIGN_ENTRIES.map((entry) => entry.puzzleId),
	)
	let count = 0
	for (const id of save.completedPuzzleIds) {
		if (campaignIds.has(id)) {
			count += 1
		}
	}
	return count
}

export function getCampaignProgressSummary(save: SaveRoot): {
	readonly completed: number
	readonly total: number
	readonly label: string
} {
	const completed = countCompletedInCampaign(save)
	const total = getCampaignTotal()
	return {
		completed,
		total,
		label: `Пройдено ${completed} из ${total}`,
	}
}
