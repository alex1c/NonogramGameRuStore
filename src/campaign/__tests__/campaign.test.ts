/**
 * Campaign audit + unlock policy tests.
 */

import {
	auditCampaign,
	buildUnlockContext,
	getLevelAccessState,
	INITIAL_UNLOCKED_COUNT,
	isLevelUnlocked,
	PHASE4_CAMPAIGN_ENTRIES,
} from '../index'

describe('campaign audit', () => {
	it('accounts for 21 productionReady unique ordered entries', () => {
		expect(PHASE4_CAMPAIGN_ENTRIES).toHaveLength(21)
		const summary = auditCampaign()
		expect(summary.total).toBe(21)
		expect(summary.pass).toBe(21)
		expect(summary.fail).toBe(0)
		expect(summary.duplicateIds).toBe(0)
		expect(summary.duplicateOrders).toBe(0)
		expect(summary.missing).toBe(0)
		expect(summary.notProductionReady).toBe(0)
	})
})

describe('unlock policy', () => {
	it('fresh save unlocks 1–5 and locks 6', () => {
		const ctx = buildUnlockContext([], null)
		for (let order = 1; order <= INITIAL_UNLOCKED_COUNT; order += 1) {
			expect(isLevelUnlocked(order, ctx)).toBe(true)
			expect(getLevelAccessState(order, ctx)).toBe('AVAILABLE')
		}
		expect(isLevelUnlocked(6, ctx)).toBe(false)
		expect(getLevelAccessState(6, ctx)).toBe('LOCKED')
	})

	it('completing 5 unlocks 6', () => {
		const fifth = PHASE4_CAMPAIGN_ENTRIES[4]
		expect(fifth).toBeDefined()
		const ctx = buildUnlockContext([fifth!.puzzleId], null)
		expect(isLevelUnlocked(6, ctx)).toBe(true)
		expect(getLevelAccessState(5, ctx)).toBe('COMPLETED')
	})

	it('completed puzzle stays unlocked / COMPLETED', () => {
		const first = PHASE4_CAMPAIGN_ENTRIES[0]!
		const ctx = buildUnlockContext([first.puzzleId], null)
		expect(getLevelAccessState(1, ctx)).toBe('COMPLETED')
		expect(isLevelUnlocked(1, ctx)).toBe(true)
	})

	it('in-progress puzzle accessible even if would be locked', () => {
		const sixth = PHASE4_CAMPAIGN_ENTRIES[5]!
		const ctx = buildUnlockContext([], sixth.puzzleId)
		expect(getLevelAccessState(6, ctx)).toBe('IN_PROGRESS')
		expect(isLevelUnlocked(6, ctx)).toBe(true)
	})

	it('unknown completed ID does not break unlock', () => {
		const ctx = buildUnlockContext(['unknown-old-id'], null)
		expect(getLevelAccessState(1, ctx)).toBe('AVAILABLE')
		expect(getLevelAccessState(6, ctx)).toBe('LOCKED')
	})

	it('locked tap blocked by access state', () => {
		const ctx = buildUnlockContext([], null)
		expect(getLevelAccessState(10, ctx)).toBe('LOCKED')
	})
})
