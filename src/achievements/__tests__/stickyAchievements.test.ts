/**
 * Phase 8B sticky achievement + schema v4 migration tests.
 */

import { createDefaultSave } from '../../persistence/createDefaultSave'
import { migrateSave } from '../../persistence/migrate'
import { CURRENT_SAVE_SCHEMA_VERSION } from '../../persistence/schema'
import { migrateV3DocumentToV4, freezeSave } from '../../persistence/validate'
import { completePuzzle } from '../../persistence/progressReducers'
import {
	contextFromSave,
	evaluateAchievements,
	getNewlyUnlockedAchievements,
	listDerivedUnlockedIds,
	materializeStickyAchievementIds,
} from '../evaluate'
import { seedStickyAchievementIdsFromLegacyV3 } from '../legacyV3Seed'
import { LEGACY_V3_GALLERY_ITEMS } from '../legacyV3Gallery'
import { mergeStickyAchievementIds } from '../sticky'
import { GALLERY_ITEMS } from '../../gallery/definitions'

const SHAPES = LEGACY_V3_GALLERY_ITEMS.filter(
	(item) => item.collectionId === 'shapes',
).map((item) => item.puzzleId)

function v3FixtureWithShapesComplete() {
	return Object.freeze({
		schemaVersion: 3 as const,
		activeGame: null,
		activeDailyGame: null,
		completedPuzzleIds: Object.freeze([...SHAPES]),
		solvedPuzzleIds: Object.freeze([...SHAPES]),
		startedPuzzleIds: Object.freeze([...SHAPES]),
		bestTimes: Object.freeze([]),
		statistics: Object.freeze({
			totalCompletions: SHAPES.length,
			totalActiveSolveTimeMs: 1000,
			totalRestarts: 0,
			totalUndoActions: 0,
			totalRedoActions: 0,
			hintRequests: 0,
			hintsApplied: 0,
			teachMeViews: 0,
		}),
		dailyCompletionRecords: Object.freeze([
			Object.freeze({
				dayKey: '2026-09-28',
				puzzleId: SHAPES[0]!,
				selectionVersion: 'daily-v1',
				activeTimeMs: 100,
			}),
		]),
		restoredDailyDays: Object.freeze([] as string[]),
		dailyStartedDay: '2026-09-28',
	})
}

describe('Phase 8B sticky achievements / schema v4', () => {
	it('defaults to schema v4 with empty sticky ids', () => {
		const save = createDefaultSave()
		expect(save.schemaVersion).toBe(4)
		expect(CURRENT_SAVE_SCHEMA_VERSION).toBe(4)
		expect(save.unlockedAchievementIds).toEqual([])
	})

	it('v3→v4 seeds sticky IDs from legacy gallery (first_collection)', () => {
		const v3 = v3FixtureWithShapesComplete()
		const seeded = seedStickyAchievementIdsFromLegacyV3(v3, '2026-09-28')
		expect(seeded).toContain('first_picture')
		expect(seeded).toContain('five_pictures')
		expect(seeded).toContain('first_collection')
		expect(seeded).toContain('daily_first')

		const v4 = migrateV3DocumentToV4(v3, '2026-09-28')
		expect(v4.schemaVersion).toBe(4)
		expect(v4.unlockedAchievementIds).toEqual(seeded)
		expect(v4.statistics.totalCompletions).toBe(v3.statistics.totalCompletions)
	})

	it('migration is deterministic for the same v3 fixture', () => {
		const v3 = v3FixtureWithShapesComplete()
		const a = migrateV3DocumentToV4(v3, '2026-09-28')
		const b = migrateV3DocumentToV4(v3, '2026-09-28')
		expect(a.unlockedAchievementIds).toEqual(b.unlockedAchievementIds)
	})

	it('full migrateSave chain v1→v4 succeeds', () => {
		const v1 = {
			schemaVersion: 1,
			activeGame: null,
			completedPuzzleIds: ['mini-beginner-bar'],
			startedPuzzleIds: ['mini-beginner-bar'],
			bestTimes: [],
			statistics: {
				totalCompletions: 1,
				totalActiveSolveTimeMs: 10,
				totalRestarts: 0,
				totalUndoActions: 0,
				totalRedoActions: 0,
			},
		}
		const result = migrateSave(v1)
		expect(result.kind).toBe('ok')
		if (result.kind !== 'ok') {
			return
		}
		expect(result.save.schemaVersion).toBe(4)
		expect(result.save.unlockedAchievementIds).toContain('first_picture')
	})

	it('sticky keeps first_collection after taxonomy change', () => {
		const v3 = v3FixtureWithShapesComplete()
		const v4 = migrateV3DocumentToV4(v3, '2026-09-28')
		expect(v4.unlockedAchievementIds).toContain('first_collection')

		// Simulate incomplete new taxonomy (no complete collection).
		const afterSwap = freezeSave({
			...v4,
			solvedPuzzleIds: Object.freeze(['mini-beginner-bar']),
		})
		const states = evaluateAchievements(contextFromSave(afterSwap))
		const firstCollection = states.find((s) => s.id === 'first_collection')
		expect(firstCollection?.access).toBe('UNLOCKED')
		expect(firstCollection?.stickyOnly).toBe(true)
		expect(firstCollection?.progressLabel).toBe('Получено')
	})

	it('sticky keeps unlock when target increases', () => {
		const save = freezeSave({
			...createDefaultSave(),
			unlockedAchievementIds: Object.freeze(['five_pictures']),
			solvedPuzzleIds: Object.freeze(['a', 'b', 'c']),
		})
		const states = evaluateAchievements(contextFromSave(save))
		const five = states.find((s) => s.id === 'five_pictures')
		expect(five?.access).toBe('UNLOCKED')
		expect(five?.stickyOnly).toBe(true)
	})

	it('unknown sticky IDs do not crash and are preserved', () => {
		const save = freezeSave({
			...createDefaultSave(),
			unlockedAchievementIds: Object.freeze([
				'first_picture',
				'removed_legacy_id',
			]),
			solvedPuzzleIds: Object.freeze(['mini-beginner-bar']),
		})
		const states = evaluateAchievements(contextFromSave(save))
		expect(states.every((s) => typeof s.id === 'string')).toBe(true)
		expect(save.unlockedAchievementIds).toContain('removed_legacy_id')
		expect(states.find((s) => s.id === 'removed_legacy_id')).toBeUndefined()
	})

	it('new unlock persists into sticky and does not re-celebrate', () => {
		let save = createDefaultSave()
		const before = evaluateAchievements(contextFromSave(save))
		save = completePuzzle(save, {
			puzzleId: 'mini-beginner-bar',
			activeTimeMs: 100,
		})
		const afterDerived = evaluateAchievements(
			contextFromSave({
				...save,
				unlockedAchievementIds: save.unlockedAchievementIds,
			}),
		)
		const newly = getNewlyUnlockedAchievements(before, afterDerived)
		expect(newly.map((s) => s.id)).toContain('first_picture')

		const sticky = mergeStickyAchievementIds(
			materializeStickyAchievementIds(contextFromSave(save)),
			newly.map((s) => s.id),
		)
		save = freezeSave({ ...save, unlockedAchievementIds: sticky })

		const againBefore = evaluateAchievements(contextFromSave(save))
		const againAfter = evaluateAchievements(contextFromSave(save))
		expect(getNewlyUnlockedAchievements(againBefore, againAfter)).toEqual([])
		expect(save.unlockedAchievementIds).toContain('first_picture')
	})

	it('malformed sticky array recovers safely', () => {
		const ids = mergeStickyAchievementIds(
			[' first_picture ', 'first_picture', '', 1 as unknown as string],
			['five_pictures'],
		)
		expect(ids).toEqual(['first_picture', 'five_pictures'])
	})

	it('legacy v3 gallery snapshot stays frozen after B1000 taxonomy swap', () => {
		// Live Gallery is production B1000; legacy snapshot is migration-only.
		expect(LEGACY_V3_GALLERY_ITEMS.length).toBe(21)
		expect(GALLERY_ITEMS.length).toBe(1000)
		for (const item of LEGACY_V3_GALLERY_ITEMS) {
			expect(item.puzzleId.startsWith('mini-')).toBe(true)
		}
	})

	it('sticky first_collection survives Gallery taxonomy swap to B1000', () => {
		const save = freezeSave({
			...createDefaultSave(),
			unlockedAchievementIds: Object.freeze(['first_collection']),
			solvedPuzzleIds: Object.freeze([]),
		})
		const evaluated = evaluateAchievements(contextFromSave(save))
		const firstCollection = evaluated.find((a) => a.id === 'first_collection')
		expect(firstCollection?.access).toBe('UNLOCKED')
		expect(firstCollection?.stickyOnly).toBe(true)
	})

	it('listDerivedUnlockedIds ignores sticky-only history', () => {
		const save = freezeSave({
			...createDefaultSave(),
			unlockedAchievementIds: Object.freeze(['first_collection']),
		})
		const derived = listDerivedUnlockedIds(contextFromSave(save))
		expect(derived).not.toContain('first_collection')
	})
})
