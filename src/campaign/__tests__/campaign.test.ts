/**
 * Campaign unit tests — Phase 8D B1000 sets / unlock.
 */

import { createDefaultSave } from '../../persistence/createDefaultSave'
import { freezeSave } from '../../persistence/validate'
import {
	CAMPAIGN_ENTRIES,
	CAMPAIGN_SETS,
	getCampaignTotal,
	INITIAL_UNLOCKED_COUNT,
	SET_UNLOCK_AFTER_COMPLETIONS,
} from '../definition'
import {
	buildUnlockContext,
	countCompletedInSet,
	isLevelUnlocked,
	isSetUnlocked,
} from '../unlock'
import { countCompletedInCampaign, getCampaignProgressSummary } from '../view'

describe('Phase 8D campaign', () => {
	it('has 20×50 = 1000 unique IDs', () => {
		expect(CAMPAIGN_SETS).toHaveLength(20)
		expect(CAMPAIGN_ENTRIES).toHaveLength(1000)
		expect(getCampaignTotal()).toBe(1000)
		expect(SET_UNLOCK_AFTER_COMPLETIONS).toBe(35)
		const ids = CAMPAIGN_ENTRIES.map((e) => e.puzzleId)
		expect(new Set(ids).size).toBe(1000)
		for (const set of CAMPAIGN_SETS) {
			expect(set.puzzleIds).toHaveLength(50)
		}
	})

	it('Set 1 unlocked; Set 2 locked until 35 completions in Set 1', () => {
		const empty = buildUnlockContext([], null)
		expect(isSetUnlocked(1, empty)).toBe(true)
		expect(isSetUnlocked(2, empty)).toBe(false)

		const set1 = CAMPAIGN_SETS[0]!
		const completed = set1.puzzleIds.slice(0, 35)
		const ctx = buildUnlockContext(completed, null)
		expect(countCompletedInSet(set1, ctx)).toBe(35)
		expect(isSetUnlocked(2, ctx)).toBe(true)
		expect(isSetUnlocked(3, ctx)).toBe(false)
	})

	it('opens first INITIAL_UNLOCKED_COUNT of Set 1', () => {
		const ctx = buildUnlockContext([], null)
		for (let order = 1; order <= INITIAL_UNLOCKED_COUNT; order += 1) {
			expect(isLevelUnlocked(order, ctx)).toBe(true)
		}
		expect(isLevelUnlocked(INITIAL_UNLOCKED_COUNT + 1, ctx)).toBe(false)
	})

	it('production progress ignores legacy-only completed IDs', () => {
		const save = freezeSave({
			...createDefaultSave(),
			completedPuzzleIds: Object.freeze([
				'mini-beginner-bar',
				'mini-easy-block',
				CAMPAIGN_ENTRIES[0]!.puzzleId,
			]),
		})
		expect(countCompletedInCampaign(save)).toBe(1)
		expect(getCampaignProgressSummary(save).label).toBe('Пройдено 1 из 1000')
	})

	it('global display numbers are 1…1000 contiguous', () => {
		expect(CAMPAIGN_ENTRIES[0]?.order).toBe(1)
		expect(CAMPAIGN_ENTRIES[999]?.order).toBe(1000)
		expect(CAMPAIGN_SETS[2]?.firstOrder).toBe(101)
		expect(CAMPAIGN_SETS[2]?.lastOrder).toBe(150)
	})
})
