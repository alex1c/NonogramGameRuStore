/**
 * Schema v3 — Hint counters + hintsUsedThisRun migration matrix.
 */

import { PaintTool } from '../../gameplay/tools'
import { createDefaultSave } from '../createDefaultSave'
import { migrateSave } from '../migrate'
import { CURRENT_SAVE_SCHEMA_VERSION } from '../schema'
import {
	parseAndValidateSave,
	parseAndValidateSaveV2,
} from '../validate'
import {
	createEmptyPlayerState,
	serializePlayerState,
} from '../../domain/nonogram/playerState'
import { getProductionPuzzleById } from '../../content/playable'
import { CAMPAIGN_ENTRIES } from '../../campaign/definition'
import {
	recordHintApplied,
	recordHintRequest,
	recordTeachMeView,
} from '../progressReducers'

const PRODUCTION_CAMPAIGN_FIRST = CAMPAIGN_ENTRIES[0]!.puzzleId

const phase6V2Fixture = {
	schemaVersion: 2,
	activeGame: {
		puzzleId: 'mini-beginner-bar',
		contentFingerprint: 'fp-campaign',
		player: {
			version: 1 as const,
			width: 5,
			height: 5,
			cells: Array.from({ length: 25 }, () => 'UNKNOWN'),
		},
		accumulatedActiveMs: 4000,
		startedAtMs: 100,
		savedAtMs: 200,
		tool: PaintTool.FILLED,
		restartCountThisRun: 1,
	},
	activeDailyGame: {
		dayKey: '2026-09-29',
		puzzleId: 'mini-easy-block',
		selectionVersion: 'daily-v1',
		contentFingerprint: 'fp-daily',
		player: {
			version: 1 as const,
			width: 5,
			height: 5,
			cells: Array.from({ length: 25 }, () => 'UNKNOWN'),
		},
		accumulatedActiveMs: 1500,
		startedAtMs: 50,
		savedAtMs: 90,
		tool: PaintTool.CROSSED,
		restartCountThisRun: 0,
	},
	completedPuzzleIds: ['mini-beginner-bar'],
	solvedPuzzleIds: ['mini-beginner-bar', 'mini-beginner-full'],
	startedPuzzleIds: ['mini-beginner-bar'],
	bestTimes: [{ puzzleId: 'mini-beginner-bar', bestActiveTimeMs: 9000 }],
	statistics: {
		totalCompletions: 3,
		totalActiveSolveTimeMs: 40000,
		totalRestarts: 2,
		totalUndoActions: 5,
		totalRedoActions: 1,
	},
	dailyCompletionRecords: [
		{
			dayKey: '2026-09-28',
			puzzleId: 'mini-easy-stairs',
			selectionVersion: 'daily-v1',
			activeTimeMs: 8000,
		},
	],
	restoredDailyDays: [],
	dailyStartedDay: '2026-09-28',
}

const phase5V1Fixture = {
	schemaVersion: 1,
	activeGame: null,
	completedPuzzleIds: ['mini-beginner-bar', 'mini-beginner-full'],
	startedPuzzleIds: ['mini-beginner-bar'],
	bestTimes: [{ puzzleId: 'mini-beginner-bar', bestActiveTimeMs: 12000 }],
	statistics: {
		totalCompletions: 2,
		totalActiveSolveTimeMs: 20000,
		totalRestarts: 0,
		totalUndoActions: 1,
		totalRedoActions: 0,
	},
}

describe('schema v4 migration (via v3 hints)', () => {
	it('fresh default is v4 with zero hint counters and empty sticky', () => {
		const save = createDefaultSave()
		expect(save.schemaVersion).toBe(4)
		expect(save.statistics.hintRequests).toBe(0)
		expect(save.statistics.hintsApplied).toBe(0)
		expect(save.statistics.teachMeViews).toBe(0)
		expect(save.unlockedAchievementIds).toEqual([])
	})

	it('migrates v2 → v4 preserving Daily + Campaign + streak', () => {
		const result = migrateSave(phase6V2Fixture)
		expect(result.kind).toBe('ok')
		expect(result.save.schemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION)
		expect(result.save.activeGame?.puzzleId).toBe('mini-beginner-bar')
		expect(result.save.activeGame?.hintsUsedThisRun).toBe(0)
		expect(result.save.activeDailyGame?.dayKey).toBe('2026-09-29')
		expect(result.save.activeDailyGame?.hintsUsedThisRun).toBe(0)
		expect(result.save.dailyCompletionRecords).toHaveLength(1)
		expect(result.save.dailyCompletionRecords[0]?.dayKey).toBe('2026-09-28')
		expect(result.save.dailyStartedDay).toBe('2026-09-28')
		expect(result.save.solvedPuzzleIds).toEqual([
			'mini-beginner-bar',
			'mini-beginner-full',
		])
		expect(result.save.statistics.totalCompletions).toBe(3)
		expect(result.save.statistics.hintRequests).toBe(0)
		expect(result.save.statistics.hintsApplied).toBe(0)
		expect(result.save.statistics.teachMeViews).toBe(0)
		expect(result.save.unlockedAchievementIds.length).toBeGreaterThan(0)
	})

	it('migrates v1 → v4 chain', () => {
		const result = migrateSave(phase5V1Fixture)
		expect(result.kind).toBe('ok')
		expect(result.save.schemaVersion).toBe(4)
		expect(result.save.solvedPuzzleIds).toEqual([
			'mini-beginner-bar',
			'mini-beginner-full',
		])
		expect(result.save.statistics.hintRequests).toBe(0)
		expect(result.save.activeDailyGame).toBeNull()
	})

	it('restores valid v4 hint counters', () => {
		const puzzle = getProductionPuzzleById(PRODUCTION_CAMPAIGN_FIRST)!
		const player = serializePlayerState(
			createEmptyPlayerState(puzzle.width, puzzle.height),
		)
		const raw = {
			...createDefaultSave(),
			activeGame: {
				puzzleId: puzzle.id,
				contentFingerprint: 'fp',
				player,
				accumulatedActiveMs: 10,
				startedAtMs: 1,
				savedAtMs: 2,
				tool: PaintTool.FILLED,
				restartCountThisRun: 0,
				hintsUsedThisRun: 4,
			},
			statistics: {
				...createDefaultSave().statistics,
				hintRequests: 7,
				hintsApplied: 3,
				teachMeViews: 2,
			},
		}
		const parsed = parseAndValidateSave(raw)
		expect(parsed.ok).toBe(true)
		if (parsed.ok) {
			expect(parsed.save.activeGame?.hintsUsedThisRun).toBe(4)
			expect(parsed.save.statistics.hintsApplied).toBe(3)
		}
	})

	it('rejects negative hint counters', () => {
		const raw = {
			...createDefaultSave(),
			statistics: {
				...createDefaultSave().statistics,
				hintsApplied: -1,
			},
		}
		const parsed = parseAndValidateSave(raw)
		expect(parsed.ok).toBe(false)
	})

	it('parseAndValidateSaveV2 still reads Phase 6 documents', () => {
		const v2 = parseAndValidateSaveV2(phase6V2Fixture)
		expect(v2.ok).toBe(true)
	})

	it('hint reducers bump counters atomically', () => {
		let save = createDefaultSave()
		const puzzle = getProductionPuzzleById(PRODUCTION_CAMPAIGN_FIRST)!
		save = {
			...save,
			activeGame: {
				puzzleId: puzzle.id,
				contentFingerprint: 'fp',
				player: serializePlayerState(
					createEmptyPlayerState(puzzle.width, puzzle.height),
				),
				accumulatedActiveMs: 0,
				startedAtMs: 0,
				savedAtMs: 0,
				tool: PaintTool.FILLED,
				restartCountThisRun: 0,
				hintsUsedThisRun: 0,
			},
		}
		save = recordHintRequest(save)
		save = recordTeachMeView(save)
		save = recordHintApplied(save, 'campaign')
		expect(save.statistics.hintRequests).toBe(1)
		expect(save.statistics.teachMeViews).toBe(1)
		expect(save.statistics.hintsApplied).toBe(1)
		expect(save.activeGame?.hintsUsedThisRun).toBe(1)
	})
})
