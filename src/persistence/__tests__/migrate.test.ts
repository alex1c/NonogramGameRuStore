/**
 * Save schema / migration / validation tests.
 */

import { PaintTool } from '../../gameplay/tools'
import { createDefaultSave } from '../createDefaultSave'
import { migrateSave, migrateSaveJson } from '../migrate'
import { CURRENT_SAVE_SCHEMA_VERSION } from '../schema'
import { parseAndValidateSave } from '../validate'

describe('createDefaultSave', () => {
	it('returns deterministic empty schema v6', () => {
		const a = createDefaultSave()
		const b = createDefaultSave()
		expect(a).toEqual(b)
		expect(a.schemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION)
		expect(a.activeGame).toBeNull()
		expect(a.activeDailyGame).toBeNull()
		expect(a.completedPuzzleIds).toEqual([])
		expect(a.solvedPuzzleIds).toEqual([])
		expect(a.unlockedAchievementIds).toEqual([])
		expect(a.statistics.totalCompletions).toBe(0)
		expect(a.statistics.hintRequests).toBe(0)
	})
})

describe('migrateSave', () => {
	it('no save → default', () => {
		const result = migrateSave(null)
		expect(result.kind).toBe('empty')
		expect(result.save.activeGame).toBeNull()
	})

	it('valid v6 save → restore', () => {
		const save = createDefaultSave()
		const result = migrateSave(save)
		expect(result.kind).toBe('ok')
		expect(result.save.schemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION)
	})

	it('valid v1 save → migrate to v6', () => {
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
		expect(result.save.schemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION)
		expect(result.save.solvedPuzzleIds).toEqual(['a'])
		expect(result.save.dailyStartedDay).toBeNull()
		expect(result.save.statistics.hintsApplied).toBe(0)
		expect(Array.isArray(result.save.unlockedAchievementIds)).toBe(true)
	})

	it('valid v2 save → migrate to v6', () => {
		const result = migrateSave({
			schemaVersion: 2,
			activeGame: null,
			activeDailyGame: null,
			completedPuzzleIds: ['a'],
			solvedPuzzleIds: ['a'],
			startedPuzzleIds: [],
			bestTimes: [],
			statistics: {
				totalCompletions: 1,
				totalActiveSolveTimeMs: 10,
				totalRestarts: 0,
				totalUndoActions: 0,
				totalRedoActions: 0,
			},
			dailyCompletionRecords: [],
			restoredDailyDays: [],
			dailyStartedDay: null,
		})
		expect(result.kind).toBe('ok')
		expect(result.save.schemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION)
		expect(result.save.statistics.hintRequests).toBe(0)
		expect(result.save.unlockedAchievementIds).toContain('first_picture')
	})

	it('valid v3 save → migrate to v6 with sticky seed', () => {
		const result = migrateSave({
			schemaVersion: 3,
			activeGame: null,
			activeDailyGame: null,
			completedPuzzleIds: ['mini-beginner-bar'],
			solvedPuzzleIds: ['mini-beginner-bar'],
			startedPuzzleIds: [],
			bestTimes: [],
			statistics: {
				totalCompletions: 1,
				totalActiveSolveTimeMs: 10,
				totalRestarts: 0,
				totalUndoActions: 0,
				totalRedoActions: 0,
				hintRequests: 0,
				hintsApplied: 0,
				teachMeViews: 0,
			},
			dailyCompletionRecords: [],
			restoredDailyDays: [],
			dailyStartedDay: null,
		})
		expect(result.kind).toBe('ok')
		expect(result.save.schemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION)
		expect(result.save.unlockedAchievementIds).toContain('first_picture')
		expect(result.save.tutorialVersionCompleted).toBeNull()
	})

	it('valid v4 save → migrate to v6', () => {
		const result = migrateSave({
			schemaVersion: 4,
			activeGame: null,
			activeDailyGame: null,
			completedPuzzleIds: [],
			solvedPuzzleIds: [],
			startedPuzzleIds: [],
			bestTimes: [],
			statistics: createDefaultSave().statistics,
			dailyCompletionRecords: [],
			restoredDailyDays: [],
			dailyStartedDay: null,
			unlockedAchievementIds: [],
		})
		expect(result.kind).toBe('ok')
		expect(result.save.schemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION)
		expect(result.save.tutorialOfferDismissed).toBe(false)
		expect(result.save.freeHintsUsedToday).toBe(0)
	})

	it('valid v5 save → migrate to v6', () => {
		const result = migrateSave({
			schemaVersion: 5,
			activeGame: null,
			activeDailyGame: null,
			completedPuzzleIds: [],
			solvedPuzzleIds: [],
			startedPuzzleIds: [],
			bestTimes: [],
			statistics: createDefaultSave().statistics,
			dailyCompletionRecords: [],
			restoredDailyDays: [],
			dailyStartedDay: null,
			unlockedAchievementIds: [],
			tutorialVersionCompleted: null,
			tutorialOfferDismissed: false,
		})
		expect(result.kind).toBe('ok')
		expect(result.save.schemaVersion).toBe(7)
		expect(result.save.freeHintsUsedToday).toBe(0)
		expect(result.save.freeTeachMeUsedToday).toBe(0)
	})

	it('valid v6 save → migrate to v7 with tutorialFirstRunSkipped=false', () => {
		const result = migrateSave({
			schemaVersion: 6,
			activeGame: null,
			activeDailyGame: null,
			completedPuzzleIds: ['p1'],
			solvedPuzzleIds: ['p1'],
			startedPuzzleIds: ['p1'],
			bestTimes: [],
			statistics: createDefaultSave().statistics,
			dailyCompletionRecords: [],
			restoredDailyDays: [],
			dailyStartedDay: null,
			unlockedAchievementIds: [],
			tutorialVersionCompleted: 1,
			tutorialOfferDismissed: true,
			helpAllowanceDay: '2026-10-01',
			freeHintsUsedToday: 2,
			freeTeachMeUsedToday: 1,
			pendingRewardedHints: 1,
			pendingRewardedTeachMe: 0,
		})
		expect(result.kind).toBe('ok')
		expect(result.save.schemaVersion).toBe(7)
		expect(result.save.tutorialFirstRunSkipped).toBe(false)
		// v6 data is preserved verbatim.
		expect(result.save.tutorialVersionCompleted).toBe(1)
		expect(result.save.tutorialOfferDismissed).toBe(true)
		expect(result.save.freeHintsUsedToday).toBe(2)
		expect(result.save.pendingRewardedHints).toBe(1)
		expect(result.save.completedPuzzleIds).toEqual(['p1'])
	})

	it('invalid tutorialFirstRunSkipped type → recovered', () => {
		const result = migrateSave({
			...createDefaultSave(),
			tutorialFirstRunSkipped: 'yes',
		})
		expect(result.kind).toBe('recovered')
	})

	it('malformed JSON → recover', () => {
		const result = migrateSaveJson('{not-json')
		expect(result.kind).toBe('recovered')
		expect(result.save).toEqual(createDefaultSave())
	})

	it('future schema → fail safely', () => {
		const result = migrateSave({ schemaVersion: 99 })
		expect(result.kind).toBe('unsupported')
		expect(result.save.activeGame).toBeNull()
	})

	it('invalid cell enum → recover', () => {
		const result = migrateSave({
			schemaVersion: 5,
			activeGame: {
				puzzleId: 'mini-beginner-bar',
				contentFingerprint: 'x',
				player: {
					version: 1,
					width: 5,
					height: 3,
					cells: Array.from({ length: 15 }, () => 'NOPE'),
				},
				accumulatedActiveMs: 0,
				startedAtMs: 0,
				savedAtMs: 0,
				tool: PaintTool.FILLED,
				restartCountThisRun: 0,
				hintsUsedThisRun: 0,
			},
			activeDailyGame: null,
			completedPuzzleIds: [],
			solvedPuzzleIds: [],
			startedPuzzleIds: [],
			bestTimes: [],
			statistics: createDefaultSave().statistics,
			dailyCompletionRecords: [],
			restoredDailyDays: [],
			dailyStartedDay: null,
			unlockedAchievementIds: [],
			tutorialVersionCompleted: null,
			tutorialOfferDismissed: false,
		})
		expect(result.kind).toBe('recovered')
	})

	it('duplicate completed IDs normalized on parse', () => {
		const result = parseAndValidateSave({
			schemaVersion: 7,
			activeGame: null,
			activeDailyGame: null,
			completedPuzzleIds: ['a', 'a', 'b'],
			solvedPuzzleIds: ['a', 'b'],
			startedPuzzleIds: [],
			bestTimes: [],
			statistics: createDefaultSave().statistics,
			dailyCompletionRecords: [],
			restoredDailyDays: [],
			dailyStartedDay: null,
			unlockedAchievementIds: ['first_picture', 'first_picture'],
			tutorialVersionCompleted: null,
			tutorialOfferDismissed: false,
			helpAllowanceDay: '2026-10-01',
			freeHintsUsedToday: 0,
			freeTeachMeUsedToday: 0,
			pendingRewardedHints: 0,
			pendingRewardedTeachMe: 0,
		})
		expect(result.ok).toBe(true)
		if (result.ok) {
			expect(result.save.completedPuzzleIds).toEqual(['a', 'b'])
			expect(result.save.unlockedAchievementIds).toEqual(['first_picture'])
		}
	})
})
