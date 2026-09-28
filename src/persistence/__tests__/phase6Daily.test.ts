/**
 * Schema v2 migration + Daily persist isolation tests.
 */

import { PaintTool } from '../../gameplay/tools'
import { createDefaultSave } from '../createDefaultSave'
import { migrateSave, migrateSaveJson } from '../migrate'
import { CURRENT_SAVE_SCHEMA_VERSION } from '../schema'
import { parseAndValidateSave, parseAndValidateSaveV1 } from '../validate'
import {
	completeDaily,
	completePuzzle,
	createActiveDailyGameSave,
	createActiveGameSave,
	ensureDailyStartedDay,
	persistActiveDailyPlayerState,
	persistActivePlayerState,
	setActiveDailyGame,
	setActiveGame,
} from '../progressReducers'
import { createEmptyPlayerState } from '../../domain/nonogram/playerState'
import { getProductionPuzzleById } from '../../content/playable'
import { buildGalleryScreenView } from '../../gallery/viewModel'
import { createFakeClock } from '../clock'
import { createMemoryStorage } from '../../storage'
import { createSaveRepository } from '../repository'
import { createGameProgressService } from '../progressService'

const phase5Fixture = {
	schemaVersion: 1,
	activeGame: null,
	completedPuzzleIds: ['mini-beginner-bar', 'mini-beginner-full'],
	startedPuzzleIds: ['mini-beginner-bar', 'mini-beginner-full'],
	bestTimes: [
		{ puzzleId: 'mini-beginner-bar', bestActiveTimeMs: 12000 },
		{ puzzleId: 'mini-beginner-full', bestActiveTimeMs: 15000 },
	],
	statistics: {
		totalCompletions: 2,
		totalActiveSolveTimeMs: 27000,
		totalRestarts: 0,
		totalUndoActions: 1,
		totalRedoActions: 0,
	},
}

describe('schema v2 migration', () => {
	it('fresh default is v2 with empty Daily', () => {
		const save = createDefaultSave()
		expect(save.schemaVersion).toBe(2)
		expect(save.solvedPuzzleIds).toEqual([])
		expect(save.activeDailyGame).toBeNull()
		expect(save.dailyCompletionRecords).toEqual([])
		expect(save.dailyStartedDay).toBeNull()
	})

	it('migrates v1 → v2 preserving Phase 4/5 data', () => {
		const result = migrateSave(phase5Fixture)
		expect(result.kind).toBe('ok')
		expect(result.save.schemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION)
		expect(result.save.completedPuzzleIds).toEqual([
			'mini-beginner-bar',
			'mini-beginner-full',
		])
		expect(result.save.solvedPuzzleIds).toEqual([
			'mini-beginner-bar',
			'mini-beginner-full',
		])
		expect(result.save.bestTimes).toHaveLength(2)
		expect(result.save.statistics.totalCompletions).toBe(2)
		expect(result.save.dailyStartedDay).toBeNull()
		expect(result.save.activeDailyGame).toBeNull()
		expect(result.save.dailyCompletionRecords).toEqual([])
	})

	it('Gallery survives through solvedPuzzleIds migration', () => {
		const migrated = migrateSave(phase5Fixture)
		const gallery = buildGalleryScreenView(migrated.save)
		expect(gallery.unlockedCount).toBe(2)
	})

	it('does not set dailyStartedDay on hydration', async () => {
		const storage = createMemoryStorage({
			'nonogram.save.v1': JSON.stringify(phase5Fixture),
		})
		const repo = createSaveRepository(storage)
		const service = createGameProgressService(
			repo,
			createFakeClock(Date.parse('2026-09-28T12:00:00')),
		)
		const hydrated = await service.hydrate()
		expect(hydrated.save.dailyStartedDay).toBeNull()
		expect(hydrated.save.schemaVersion).toBe(2)
	})

	it('parse v1 fixture still works as migration source', () => {
		const v1 = parseAndValidateSaveV1(phase5Fixture)
		expect(v1.ok).toBe(true)
	})

	it('future schema fails safely', () => {
		const result = migrateSave({ schemaVersion: 99 })
		expect(result.kind).toBe('unsupported')
	})

	it('malformed JSON recovers', () => {
		const result = migrateSaveJson('{not-json')
		expect(result.kind).toBe('recovered')
		expect(result.save.schemaVersion).toBe(2)
	})
})

describe('dual active Campaign + Daily', () => {
	const campaignPuzzle = getProductionPuzzleById('mini-beginner-bar')!
	const dailyPuzzle = getProductionPuzzleById('mini-easy-block')!

	it('Campaign and Daily active coexist without overwrite', () => {
		let save = createDefaultSave()
		const campaignPlayer = createEmptyPlayerState(
			campaignPuzzle.width,
			campaignPuzzle.height,
		)
		const dailyPlayer = createEmptyPlayerState(
			dailyPuzzle.width,
			dailyPuzzle.height,
		)
		save = setActiveGame(
			save,
			createActiveGameSave({
				puzzle: campaignPuzzle,
				player: campaignPlayer,
				accumulatedActiveMs: 1000,
				startedAtMs: 1,
				savedAtMs: 1,
				tool: PaintTool.FILLED,
				restartCountThisRun: 0,
			}),
		)
		save = setActiveDailyGame(
			save,
			createActiveDailyGameSave({
				dayKey: '2026-09-28',
				puzzle: dailyPuzzle,
				selectionVersion: 'daily-v1',
				player: dailyPlayer,
				accumulatedActiveMs: 500,
				startedAtMs: 2,
				savedAtMs: 2,
				tool: PaintTool.CROSSED,
				restartCountThisRun: 0,
			}),
		)
		expect(save.activeGame?.puzzleId).toBe('mini-beginner-bar')
		expect(save.activeDailyGame?.puzzleId).toBe('mini-easy-block')

		save = persistActiveDailyPlayerState(save, {
			dayKey: '2026-09-28',
			puzzle: dailyPuzzle,
			selectionVersion: 'daily-v1',
			player: dailyPlayer,
			accumulatedActiveMs: 900,
			tool: PaintTool.CROSSED,
			savedAtMs: 3,
			restartCountThisRun: 0,
		})
		expect(save.activeGame?.accumulatedActiveMs).toBe(1000)
		expect(save.activeDailyGame?.accumulatedActiveMs).toBe(900)

		save = persistActivePlayerState(save, {
			puzzle: campaignPuzzle,
			player: campaignPlayer,
			accumulatedActiveMs: 2000,
			tool: PaintTool.FILLED,
			savedAtMs: 4,
			restartCountThisRun: 0,
		})
		expect(save.activeDailyGame?.accumulatedActiveMs).toBe(900)
		expect(save.activeGame?.accumulatedActiveMs).toBe(2000)
	})

	it('Daily completion does not alter Campaign', () => {
		let save = createDefaultSave()
		save = completeDaily(save, {
			dayKey: '2026-09-28',
			puzzleId: 'mini-easy-block',
			selectionVersion: 'daily-v1',
			activeTimeMs: 8000,
		})
		expect(save.solvedPuzzleIds).toContain('mini-easy-block')
		expect(save.completedPuzzleIds).not.toContain('mini-easy-block')
		expect(save.bestTimes).toEqual([])
		expect(save.statistics.totalCompletions).toBe(1)
		expect(save.activeDailyGame).toBeNull()

		const gallery = buildGalleryScreenView(save)
		expect(
			gallery.collections
				.flatMap((c) => c.items)
				.some(
					(i) =>
						i.puzzleId === 'mini-easy-block' && i.access === 'UNLOCKED',
				),
		).toBe(true)
	})

	it('idempotent Daily completion', () => {
		let save = createDefaultSave()
		save = completeDaily(save, {
			dayKey: '2026-09-28',
			puzzleId: 'mini-easy-block',
			selectionVersion: 'daily-v1',
			activeTimeMs: 1000,
		})
		save = completeDaily(save, {
			dayKey: '2026-09-28',
			puzzleId: 'mini-easy-block',
			selectionVersion: 'daily-v1',
			activeTimeMs: 9999,
		})
		expect(save.dailyCompletionRecords).toHaveLength(1)
		expect(save.statistics.totalCompletions).toBe(1)
	})

	it('Campaign after Daily adds campaign completion without duplicate gallery unlock semantics', () => {
		let save = createDefaultSave()
		save = completeDaily(save, {
			dayKey: '2026-09-28',
			puzzleId: 'mini-beginner-bar',
			selectionVersion: 'daily-v1',
			activeTimeMs: 1000,
		})
		const solvedBefore = save.solvedPuzzleIds.length
		save = completePuzzle(save, {
			puzzleId: 'mini-beginner-bar',
			activeTimeMs: 2000,
		})
		expect(save.completedPuzzleIds).toContain('mini-beginner-bar')
		expect(save.solvedPuzzleIds).toHaveLength(solvedBefore)
		expect(save.statistics.totalCompletions).toBe(2)
		expect(save.bestTimes[0]?.bestActiveTimeMs).toBe(2000)
	})

	it('ensureDailyStartedDay only once', () => {
		let save = createDefaultSave()
		save = ensureDailyStartedDay(save, '2026-09-28')
		expect(save.dailyStartedDay).toBe('2026-09-28')
		save = ensureDailyStartedDay(save, '2026-09-29')
		expect(save.dailyStartedDay).toBe('2026-09-28')
	})

	it('rejects future / duplicate day records on parse', () => {
		const result = parseAndValidateSave(
			{
				...createDefaultSave(),
				dailyCompletionRecords: [
					{
						dayKey: '2099-01-01',
						puzzleId: 'x',
						selectionVersion: 'daily-v1',
						activeTimeMs: 1,
					},
					{
						dayKey: '2026-09-28',
						puzzleId: 'mini-easy-block',
						selectionVersion: 'daily-v1',
						activeTimeMs: 1,
					},
					{
						dayKey: '2026-09-28',
						puzzleId: 'other',
						selectionVersion: 'daily-v1',
						activeTimeMs: 2,
					},
				],
			},
			'2026-09-28',
		)
		expect(result.ok).toBe(true)
		if (result.ok) {
			expect(result.save.dailyCompletionRecords).toHaveLength(1)
			expect(result.save.dailyCompletionRecords[0]?.puzzleId).toBe(
				'mini-easy-block',
			)
		}
	})
})
