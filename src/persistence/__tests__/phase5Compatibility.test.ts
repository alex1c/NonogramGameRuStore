/**
 * Completion event result + Phase 4 save compatibility + fingerprint metadata.
 */

import { createEmptyPlayerState } from '../../domain/nonogram/playerState'
import { getProductionPuzzleById } from '../../content/playable'
import { PaintTool } from '../../gameplay/tools'
import { createMemoryStorage } from '../../storage'
import { buildPuzzleContentFingerprint } from '../fingerprint'
import { createFakeClock } from '../clock'
import { createDefaultSave } from '../createDefaultSave'
import { createGameProgressService } from '../progressService'
import { createSaveRepository } from '../repository'
import { CURRENT_SAVE_SCHEMA_VERSION } from '../schema'
import { migrateSave } from '../migrate'
import { buildGalleryScreenView } from '../../gallery/viewModel'
import { evaluateAchievements, contextFromSave } from '../../achievements/evaluate'
import { CAMPAIGN_ENTRIES } from '../../campaign/definition'

const PRODUCTION_CAMPAIGN_FIRST = CAMPAIGN_ENTRIES[0]!.puzzleId
const PRODUCTION_CAMPAIGN_SECOND = CAMPAIGN_ENTRIES[1]!.puzzleId

function requirePuzzle(id: string) {
	const puzzle = getProductionPuzzleById(id)
	if (puzzle === null) {
		throw new Error(id)
	}
	return puzzle
}

describe('completion event result', () => {
	it('first completion vs replay messages and achievements', async () => {
		const service = createGameProgressService(
			createSaveRepository(createMemoryStorage()),
			createFakeClock(0),
		)
		await service.hydrate()
		const puzzle = requirePuzzle(PRODUCTION_CAMPAIGN_FIRST)
		await service.startPuzzle(puzzle.id)
		const first = await service.completePuzzle({
			puzzleId: puzzle.id,
			activeTimeMs: 500,
		})
		expect(first.event.firstCompletion).toBe(true)
		expect(first.event.galleryIncluded).toBe(true)
		expect(first.event.bestTimeImproved).toBe(true)
		expect(first.event.newlyUnlockedAchievements.length).toBeGreaterThan(0)
		expect(first.event.nextCampaignPuzzleId).toBe(PRODUCTION_CAMPAIGN_SECOND)

		await service.startPuzzle(puzzle.id)
		const replay = await service.completePuzzle({
			puzzleId: puzzle.id,
			activeTimeMs: 800,
		})
		expect(replay.event.firstCompletion).toBe(false)
		expect(replay.event.bestTimeImproved).toBe(false)
		expect(replay.event.newBestTimeMs).toBe(500)
	})

	it('better replay updates best time', async () => {
		const service = createGameProgressService(
			createSaveRepository(createMemoryStorage()),
			createFakeClock(0),
		)
		await service.hydrate()
		const puzzle = requirePuzzle(PRODUCTION_CAMPAIGN_SECOND)
		await service.completePuzzle({
			puzzleId: puzzle.id,
			activeTimeMs: 900,
		})
		const better = await service.completePuzzle({
			puzzleId: puzzle.id,
			activeTimeMs: 400,
		})
		expect(better.event.bestTimeImproved).toBe(true)
		expect(better.event.newBestTimeMs).toBe(400)
	})
})

describe('Phase 4/5 save compatibility', () => {
	it('loads Phase 5 schema v1 fixture without data loss (migrates to v2)', async () => {
		const puzzle = requirePuzzle(CAMPAIGN_ENTRIES[2]!.puzzleId)
		const player = createEmptyPlayerState(puzzle.width, puzzle.height)
		const phase4Save = {
			schemaVersion: 1,
			activeGame: {
				puzzleId: puzzle.id,
				contentFingerprint: buildPuzzleContentFingerprint(puzzle),
				player: {
					version: 1 as const,
					width: puzzle.width,
					height: puzzle.height,
					cells: Array.from(player.cells),
				},
				accumulatedActiveMs: 12345,
				startedAtMs: 10,
				savedAtMs: 20,
				tool: PaintTool.CROSSED,
				restartCountThisRun: 1,
			},
			completedPuzzleIds: ['mini-beginner-bar', 'mini-beginner-full'],
			startedPuzzleIds: [
				'mini-beginner-bar',
				'mini-beginner-full',
				'mini-easy-stairs',
			],
			bestTimes: [
				{ puzzleId: 'mini-beginner-bar', bestActiveTimeMs: 111 },
				{ puzzleId: 'mini-beginner-full', bestActiveTimeMs: 222 },
			],
			statistics: {
				totalCompletions: 2,
				totalActiveSolveTimeMs: 333,
				totalRestarts: 1,
				totalUndoActions: 4,
				totalRedoActions: 2,
			},
		}

		const migrated = migrateSave(phase4Save)
		expect(migrated.kind).toBe('ok')
		expect(migrated.save.schemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION)
		expect(migrated.save.activeGame?.puzzleId).toBe(puzzle.id)
		expect(migrated.save.activeGame?.accumulatedActiveMs).toBe(12345)
		expect(migrated.save.completedPuzzleIds).toEqual([
			'mini-beginner-bar',
			'mini-beginner-full',
		])
		expect(migrated.save.solvedPuzzleIds).toEqual([
			'mini-beginner-bar',
			'mini-beginner-full',
		])
		expect(migrated.save.statistics.totalUndoActions).toBe(4)
		expect(migrated.save.dailyStartedDay).toBeNull()

		const storage = createMemoryStorage({
			'nonogram.save.v1': JSON.stringify(phase4Save),
		})
		const service = createGameProgressService(
			createSaveRepository(storage),
			createFakeClock(100),
		)
		const hydrated = await service.hydrate()
		expect(hydrated.save.activeGame?.puzzleId).toBe(puzzle.id)
		const gallery = buildGalleryScreenView(hydrated.save)
		// Legacy mini IDs remain in save but do not unlock B1000 gallery items.
		expect(gallery.unlockedCount).toBe(0)
		const achievements = evaluateAchievements(contextFromSave(hydrated.save))
		expect(
			achievements.find((item) => item.id === 'collection_start')?.access,
		).toBe('LOCKED')
		expect(
			achievements.find((item) => item.id === 'first_picture')?.access,
		).toBe('UNLOCKED')
	})
})

describe('fingerprint metadata invariance', () => {
	it('title/collection metadata changes do not alter fingerprint', () => {
		const puzzle = requirePuzzle(CAMPAIGN_ENTRIES[10]!.puzzleId)
		const base = buildPuzzleContentFingerprint(puzzle)
		const retitled = {
			...puzzle,
			metadata: {
				...puzzle.metadata,
				title: 'Совершенно новое название',
				collection: 'other-collection',
			},
		}
		expect(buildPuzzleContentFingerprint(retitled)).toBe(base)
	})

	it('clue/dimension changes alter fingerprint', () => {
		const puzzle = requirePuzzle(CAMPAIGN_ENTRIES[10]!.puzzleId)
		const base = buildPuzzleContentFingerprint(puzzle)
		const taller = {
			...puzzle,
			height: puzzle.height + 1,
			rowClues: [...puzzle.rowClues, []],
		}
		expect(buildPuzzleContentFingerprint(taller)).not.toBe(base)
	})
})

describe('default save schema v4', () => {
	it('createDefaultSave schema is 4', () => {
		expect(createDefaultSave().schemaVersion).toBe(5)
		expect(CURRENT_SAVE_SCHEMA_VERSION).toBe(5)
		expect(createDefaultSave().unlockedAchievementIds).toEqual([])
	})
})
