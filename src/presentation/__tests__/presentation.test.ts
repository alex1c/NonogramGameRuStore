/**
 * Presentation helpers — time, progress percent, home/statistics VMs.
 */

import { PlayerCell } from '../../domain/nonogram/types'
import { createDefaultSave } from '../../persistence/createDefaultSave'
import { completePuzzle } from '../../persistence/progressReducers'
import { buildHomeViewModel } from '../homeViewModel'
import {
	determinedProgressPercent,
	formatMarkedPercent,
} from '../progressPercent'
import { buildStatisticsViewModel } from '../statisticsViewModel'
import {
	formatBestTime,
	formatGameElapsed,
	formatTotalActiveTime,
} from '../timeFormat'
import { difficultyLabelRu } from '../difficultyLabels'
import { CAMPAIGN_ENTRIES } from '../../campaign/definition'

describe('progress percent', () => {
	it('counts FILLED + CROSSED only', () => {
		const cells = [
			PlayerCell.FILLED,
			PlayerCell.CROSSED,
			PlayerCell.UNKNOWN,
			PlayerCell.UNKNOWN,
		]
		expect(determinedProgressPercent(cells)).toBe(50)
		expect(formatMarkedPercent(50)).toBe('Отмечено 50%')
	})
})

describe('time formatters', () => {
	it('formats best / game elapsed', () => {
		expect(formatBestTime(3 * 60_000 + 42_000)).toBe('03:42')
		expect(formatGameElapsed(3_600_000 + 3 * 60_000 + 42_000)).toBe(
			'1:03:42',
		)
	})

	it('formats total active time for statistics', () => {
		expect(formatTotalActiveTime(37_000)).toBe('37 сек')
		expect(formatTotalActiveTime(37 * 60_000)).toBe('37 мин')
		expect(formatTotalActiveTime(2 * 3_600_000 + 18 * 60_000)).toBe(
			'2 ч 18 мин',
		)
	})
})

describe('difficulty labels', () => {
	it('maps tiers to Russian', () => {
		expect(difficultyLabelRu('BEGINNER')).toBe('Новичок')
		expect(difficultyLabelRu('HARD')).toBe('Сложно')
		expect(difficultyLabelRu('UNRATED')).toBe('—')
	})
})

describe('home / statistics view models', () => {
	it('home without active game uses Играть CTA', () => {
		const home = buildHomeViewModel(createDefaultSave())
		expect(home.primaryCta).toBe('play')
		expect(home.primaryLabel).toBe('Играть')
		expect(home.continueCard).toBeNull()
	})

	it('statistics unique completed from campaign IDs', () => {
		const campaignId = CAMPAIGN_ENTRIES[0]!.puzzleId
		let save = createDefaultSave()
		save = completePuzzle(save, {
			puzzleId: campaignId,
			activeTimeMs: 1000,
		})
		save = completePuzzle(save, {
			puzzleId: campaignId,
			activeTimeMs: 900,
		})
		const stats = buildStatisticsViewModel(save)
		expect(stats.completedUnique).toBe(1)
		expect(stats.totalCompletions).toBe(2)
		expect(stats.campaignTotal).toBe(1000)
	})
})
