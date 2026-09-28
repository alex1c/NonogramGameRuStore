/**
 * Save schema / migration / validation tests.
 */

import { PaintTool } from '../../gameplay/tools'
import { createDefaultSave } from '../createDefaultSave'
import { migrateSave, migrateSaveJson } from '../migrate'
import { CURRENT_SAVE_SCHEMA_VERSION } from '../schema'
import { parseAndValidateSave } from '../validate'

describe('createDefaultSave', () => {
	it('returns deterministic empty schema v2', () => {
		const a = createDefaultSave()
		const b = createDefaultSave()
		expect(a).toEqual(b)
		expect(a.schemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION)
		expect(a.activeGame).toBeNull()
		expect(a.activeDailyGame).toBeNull()
		expect(a.completedPuzzleIds).toEqual([])
		expect(a.solvedPuzzleIds).toEqual([])
		expect(a.statistics.totalCompletions).toBe(0)
	})
})

describe('migrateSave', () => {
	it('no save → default', () => {
		const result = migrateSave(null)
		expect(result.kind).toBe('empty')
		expect(result.save.activeGame).toBeNull()
	})

	it('valid v2 save → restore', () => {
		const save = createDefaultSave()
		const result = migrateSave(save)
		expect(result.kind).toBe('ok')
		expect(result.save.schemaVersion).toBe(2)
	})

	it('valid v1 save → migrate to v2', () => {
		const result = migrateSave({
			schemaVersion: 1,
			activeGame: null,
			completedPuzzleIds: ['a'],
			startedPuzzleIds: ['a'],
			bestTimes: [],
			statistics: createDefaultSave().statistics,
		})
		expect(result.kind).toBe('ok')
		expect(result.save.schemaVersion).toBe(2)
		expect(result.save.solvedPuzzleIds).toEqual(['a'])
		expect(result.save.dailyStartedDay).toBeNull()
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
			schemaVersion: 2,
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
		})
		expect(result.kind).toBe('recovered')
	})

	it('duplicate completed IDs normalized on parse', () => {
		const result = parseAndValidateSave({
			schemaVersion: 2,
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
		})
		expect(result.ok).toBe(true)
		if (result.ok) {
			expect(result.save.completedPuzzleIds).toEqual(['a', 'b'])
		}
	})
})
