/**
 * Schema v6 — daily help allowance migration + progress service wiring.
 */

import { FREE_HINTS_PER_DAY, FREE_TEACH_ME_PER_DAY } from '../../help'
import { createMemoryStorage } from '../../storage'
import { createFakeClock } from '../clock'
import { createDefaultSave } from '../createDefaultSave'
import { migrateSave } from '../migrate'
import {
	consumeHintApplyAllowance,
	consumeTeachMeRevealAllowance,
	ensureHelpAllowanceDay,
	grantRewardedHintAllowance,
	grantRewardedTeachMeAllowance,
} from '../progressReducers'
import { createGameProgressService } from '../progressService'
import { createSaveRepository } from '../repository'
import { CURRENT_SAVE_SCHEMA_VERSION, type SaveRoot } from '../schema'
import type { DayKey } from '../../daily/dateUtils'

describe('schema v6 help allowance migration', () => {
	it('createDefaultSave is schema v6 with zero free uses', () => {
		const save = createDefaultSave()
		expect(save.schemaVersion).toBe(6)
		expect(CURRENT_SAVE_SCHEMA_VERSION).toBe(6)
		expect(save.freeHintsUsedToday).toBe(0)
		expect(save.freeTeachMeUsedToday).toBe(0)
		expect(save.pendingRewardedHints).toBe(0)
		expect(save.pendingRewardedTeachMe).toBe(0)
	})

	it('v5 → v6 starts at 0/5 + 0/5 for migration day', () => {
		const result = migrateSave({
			schemaVersion: 5,
			activeGame: null,
			activeDailyGame: null,
			completedPuzzleIds: ['mini-beginner-bar'],
			solvedPuzzleIds: ['mini-beginner-bar'],
			startedPuzzleIds: [],
			bestTimes: [],
			statistics: createDefaultSave().statistics,
			dailyCompletionRecords: [],
			restoredDailyDays: [],
			dailyStartedDay: null,
			unlockedAchievementIds: ['first_picture'],
			tutorialVersionCompleted: 1,
			tutorialOfferDismissed: true,
		})
		expect(result.kind).toBe('ok')
		expect(result.save.schemaVersion).toBe(6)
		expect(result.save.freeHintsUsedToday).toBe(0)
		expect(result.save.freeTeachMeUsedToday).toBe(0)
		expect(result.save.completedPuzzleIds).toEqual(['mini-beginner-bar'])
		expect(result.save.unlockedAchievementIds).toContain('first_picture')
		expect(result.save.tutorialVersionCompleted).toBe(1)
		expect(result.save.tutorialOfferDismissed).toBe(true)
	})

	it('v4 → v5 → v6 preserves sticky achievements and tutorial defaults', () => {
		const result = migrateSave({
			schemaVersion: 4,
			activeGame: null,
			activeDailyGame: null,
			completedPuzzleIds: ['mini-beginner-bar'],
			solvedPuzzleIds: ['mini-beginner-bar'],
			startedPuzzleIds: [],
			bestTimes: [],
			statistics: createDefaultSave().statistics,
			dailyCompletionRecords: [],
			restoredDailyDays: [],
			dailyStartedDay: null,
			unlockedAchievementIds: ['first_picture'],
		})
		expect(result.kind).toBe('ok')
		expect(result.save.schemaVersion).toBe(6)
		expect(result.save.unlockedAchievementIds).toContain('first_picture')
		expect(result.save.tutorialVersionCompleted).toBeNull()
		expect(result.save.tutorialOfferDismissed).toBe(false)
		expect(result.save.freeHintsUsedToday).toBe(0)
	})

	it('v1 → v6 chain lands on schema 6', () => {
		const result = migrateSave({
			schemaVersion: 1,
			activeGame: null,
			completedPuzzleIds: ['a'],
			startedPuzzleIds: ['a'],
			bestTimes: [],
			statistics: {
				totalCompletions: 0,
				totalActiveSolveTimeMs: 0,
				totalRestarts: 0,
				totalUndoActions: 0,
				totalRedoActions: 0,
			},
		})
		expect(result.kind).toBe('ok')
		expect(result.save.schemaVersion).toBe(6)
		expect(result.save.solvedPuzzleIds).toEqual(['a'])
		expect(result.save.freeHintsUsedToday).toBe(0)
		expect(result.save.freeTeachMeUsedToday).toBe(0)
	})
})

describe('help allowance reducers', () => {
	const day: DayKey = '2026-10-01'

	it('consumes free Hint Apply then requires rewarded', () => {
		let save: SaveRoot = {
			...createDefaultSave(),
			helpAllowanceDay: day,
			freeHintsUsedToday: 0,
			freeTeachMeUsedToday: 0,
		}
		for (let i = 0; i < FREE_HINTS_PER_DAY; i += 1) {
			const next = consumeHintApplyAllowance(save, day)
			expect(next).not.toBeNull()
			save = next!
		}
		expect(consumeHintApplyAllowance(save, day)).toBeNull()
		save = grantRewardedHintAllowance(save, day)
		expect(save.pendingRewardedHints).toBe(1)
		save = consumeHintApplyAllowance(save, day)!
		expect(save.pendingRewardedHints).toBe(0)
		expect(consumeHintApplyAllowance(save, day)).toBeNull()
	})

	it('consumes free Teach Me separately from Hint', () => {
		let save: SaveRoot = {
			...createDefaultSave(),
			helpAllowanceDay: day,
			freeHintsUsedToday: FREE_HINTS_PER_DAY,
			freeTeachMeUsedToday: 0,
		}
		for (let i = 0; i < FREE_TEACH_ME_PER_DAY; i += 1) {
			save = consumeTeachMeRevealAllowance(save, day)!
		}
		expect(consumeTeachMeRevealAllowance(save, day)).toBeNull()
		save = grantRewardedTeachMeAllowance(save, day)
		save = consumeTeachMeRevealAllowance(save, day)!
		expect(save.pendingRewardedTeachMe).toBe(0)
	})

	it('rolls to next day without requiring restart', () => {
		const save = {
			...createDefaultSave(),
			helpAllowanceDay: '2026-10-01' as DayKey,
			freeHintsUsedToday: 5,
			freeTeachMeUsedToday: 4,
			pendingRewardedHints: 1,
		}
		const rolled = ensureHelpAllowanceDay(save, '2026-10-02')
		expect(rolled.helpAllowanceDay).toBe('2026-10-02')
		expect(rolled.freeHintsUsedToday).toBe(0)
		expect(rolled.freeTeachMeUsedToday).toBe(0)
		expect(rolled.pendingRewardedHints).toBe(1)
		expect(ensureHelpAllowanceDay(rolled, '2026-10-02')).toBe(rolled)
	})
})

describe('help allowance service persistence', () => {
	it('survives relaunch on same local day', async () => {
		const storage = createMemoryStorage()
		const repo = createSaveRepository(storage)
		const clock = createFakeClock(Date.parse('2026-10-01T12:00:00'))
		const service = createGameProgressService(repo, clock)
		await service.hydrate()
		for (let i = 0; i < 3; i += 1) {
			await service.consumeHintApplyAllowance()
		}
		await service.consumeTeachMeRevealAllowance()

		const service2 = createGameProgressService(repo, clock)
		const hydrated = await service2.hydrate()
		expect(hydrated.save.freeHintsUsedToday).toBe(3)
		expect(hydrated.save.freeTeachMeUsedToday).toBe(1)
		expect(hydrated.save.helpAllowanceDay).toBe('2026-10-01')
	})

	it('next local day resets free counters on hydrate', async () => {
		const storage = createMemoryStorage()
		const repo = createSaveRepository(storage)
		const clock1 = createFakeClock(Date.parse('2026-10-01T12:00:00'))
		const day1 = createGameProgressService(repo, clock1)
		await day1.hydrate()
		for (let i = 0; i < FREE_HINTS_PER_DAY; i += 1) {
			await day1.consumeHintApplyAllowance()
		}
		await day1.grantRewardedHintAllowance()

		const clock2 = createFakeClock(Date.parse('2026-10-02T00:05:00'))
		const day2 = createGameProgressService(repo, clock2)
		const hydrated = await day2.hydrate()
		expect(hydrated.save.helpAllowanceDay).toBe('2026-10-02')
		expect(hydrated.save.freeHintsUsedToday).toBe(0)
		expect(hydrated.save.pendingRewardedHints).toBe(1)
	})
})
