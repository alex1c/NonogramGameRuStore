/**
 * Campaign presentation projection — Sets + level cards.
 * Uses precomputed runtime tiers — no analyzer on list render.
 */

import type { DifficultyRating } from '../domain/difficulty/tiers'
import type { SaveRoot } from '../persistence/schema'
import { difficultyLabelRu } from '../presentation/difficultyLabels'
import {
	determinedProgressPercent,
	formatMarkedPercent,
} from '../presentation/progressPercent'
import { formatBestTime } from '../presentation/timeFormat'
import {
	CAMPAIGN_ENTRIES,
	CAMPAIGN_SETS,
	getCampaignPuzzleSize,
	getCampaignPuzzleTier,
	getCampaignSetById,
	getCampaignTotal,
	SET_UNLOCK_AFTER_COMPLETIONS,
	type CampaignSetDef,
} from './definition'
import {
	buildUnlockContext,
	countCompletedInSet,
	getLevelAccessState,
	isSetUnlocked,
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

export interface CampaignSetCardViewModel {
	readonly setId: string
	readonly titleRu: string
	readonly displayOrder: number
	readonly completed: number
	readonly total: number
	readonly progressLabel: string
	readonly unlocked: boolean
	readonly locked: boolean
	readonly difficultyRangeLabel: string
	readonly unlockHint: string | null
}

const ACCESS_LABEL_RU: Readonly<Record<LevelAccessState, string>> =
	Object.freeze({
		LOCKED: 'Закрыт',
		AVAILABLE: 'Новый',
		IN_PROGRESS: 'В процессе',
		COMPLETED: 'Пройден',
	})

export function buildLevelCardViewModel(
	order: number,
	save: SaveRoot,
): LevelCardViewModel | null {
	const entry = CAMPAIGN_ENTRIES.find((item) => item.order === order)
	if (entry === undefined) {
		return null
	}
	const size = getCampaignPuzzleSize(entry.puzzleId)
	if (size === null) {
		return null
	}

	const ctx = buildUnlockContext(
		save.completedPuzzleIds,
		save.activeGame?.puzzleId ?? null,
	)
	const access = getLevelAccessState(order, ctx)
	const tier = getCampaignPuzzleTier(entry.puzzleId)

	let markedPercent: number | null = null
	let markedLabel: string | null = null
	if (
		access === 'IN_PROGRESS' &&
		save.activeGame !== null &&
		save.activeGame.puzzleId === entry.puzzleId
	) {
		markedPercent = determinedProgressPercent(save.activeGame.player.cells)
		markedLabel = formatMarkedPercent(markedPercent)
	}

	const best = save.bestTimes.find((item) => item.puzzleId === entry.puzzleId)
	const bestTimeLabel =
		access === 'COMPLETED' && best !== undefined
			? formatBestTime(best.bestActiveTimeMs)
			: null

	return {
		order,
		puzzleId: entry.puzzleId,
		width: size.width,
		height: size.height,
		sizeLabel: `${size.width}×${size.height}`,
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
	setId?: string,
): readonly LevelCardViewModel[] {
	const cards: LevelCardViewModel[] = []
	const entries =
		setId === undefined
			? CAMPAIGN_ENTRIES
			: CAMPAIGN_ENTRIES.filter((e) => e.setId === setId)
	for (const entry of entries) {
		const card = buildLevelCardViewModel(entry.order, save)
		if (card !== null) {
			cards.push(card)
		}
	}
	return cards
}

export function buildCampaignSetCards(
	save: SaveRoot,
): readonly CampaignSetCardViewModel[] {
	const ctx = buildUnlockContext(
		save.completedPuzzleIds,
		save.activeGame?.puzzleId ?? null,
	)
	return CAMPAIGN_SETS.map((set) => {
		const completed = countCompletedInSet(set, ctx)
		const unlocked = isSetUnlocked(set.displayOrder, ctx)
		const tiers = set.puzzleIds.map((id) => getCampaignPuzzleTier(id))
		const ranked = ['BEGINNER', 'EASY', 'MEDIUM', 'HARD', 'EXPERT'] as const
		let minI = ranked.length - 1
		let maxI = 0
		for (const t of tiers) {
			const i = ranked.indexOf(t as (typeof ranked)[number])
			if (i >= 0) {
				minI = Math.min(minI, i)
				maxI = Math.max(maxI, i)
			}
		}
		const difficultyRangeLabel =
			minI <= maxI
				? minI === maxI
					? difficultyLabelRu(ranked[minI]!)
					: `${difficultyLabelRu(ranked[minI]!)}–${difficultyLabelRu(ranked[maxI]!)}`
				: '—'
		const unlockHint =
			!unlocked && set.displayOrder > 1
				? `Откроется после ${SET_UNLOCK_AFTER_COMPLETIONS} из 50 в «${CAMPAIGN_SETS.find((s) => s.displayOrder === set.displayOrder - 1)?.titleRu ?? 'предыдущем'}»`
				: null
		return {
			setId: set.setId,
			titleRu: set.titleRu,
			displayOrder: set.displayOrder,
			completed,
			total: set.puzzleIds.length,
			progressLabel: `${completed} / ${set.puzzleIds.length}`,
			unlocked,
			locked: !unlocked,
			difficultyRangeLabel,
			unlockHint,
		}
	})
}

export function countCompletedInCampaign(save: SaveRoot): number {
	const campaignIds = new Set(CAMPAIGN_ENTRIES.map((entry) => entry.puzzleId))
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

export function getSetProgressSummary(
	save: SaveRoot,
	setId: string,
): {
	readonly set: CampaignSetDef
	readonly completed: number
	readonly total: number
	readonly unlocked: boolean
} | null {
	const set = getCampaignSetById(setId)
	if (set === null) {
		return null
	}
	const ctx = buildUnlockContext(
		save.completedPuzzleIds,
		save.activeGame?.puzzleId ?? null,
	)
	return {
		set,
		completed: countCompletedInSet(set, ctx),
		total: set.puzzleIds.length,
		unlocked: isSetUnlocked(set.displayOrder, ctx),
	}
}
