/**
 * Phase 9 — schema v4 → v5 migration preserves sticky + progress.
 */

import { createDefaultSave } from '../createDefaultSave'
import { migrateSave } from '../migrate'
import { CURRENT_SAVE_SCHEMA_VERSION } from '../schema'

describe('schema v5 tutorial migration', () => {
	it('default save is v5 with tutorial fields', () => {
		const save = createDefaultSave()
		expect(save.schemaVersion).toBe(5)
		expect(save.tutorialVersionCompleted).toBeNull()
		expect(save.tutorialOfferDismissed).toBe(false)
	})

	it('v4 → v5 keeps sticky achievements and progress', () => {
		const result = migrateSave({
			schemaVersion: 4,
			activeGame: null,
			activeDailyGame: null,
			completedPuzzleIds: ['p1'],
			solvedPuzzleIds: ['p1'],
			startedPuzzleIds: ['p1'],
			bestTimes: [{ puzzleId: 'p1', bestActiveTimeMs: 1200 }],
			statistics: createDefaultSave().statistics,
			dailyCompletionRecords: [],
			restoredDailyDays: [],
			dailyStartedDay: null,
			unlockedAchievementIds: ['first_picture', 'first_collection'],
		})
		expect(result.kind).toBe('ok')
		expect(result.save.schemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION)
		expect(result.save.completedPuzzleIds).toEqual(['p1'])
		expect(result.save.solvedPuzzleIds).toEqual(['p1'])
		expect(result.save.unlockedAchievementIds).toEqual([
			'first_picture',
			'first_collection',
		])
		expect(result.save.bestTimes[0]?.bestActiveTimeMs).toBe(1200)
		expect(result.save.tutorialVersionCompleted).toBeNull()
		expect(result.save.tutorialOfferDismissed).toBe(false)
	})
})
