/**
 * Phase 9C H4 — a legacy v3 active Campaign / Daily party must still open
 * in GameScreen after migration.
 *
 * GameScreen resolves RESUME launches through resolvePlayablePuzzleById
 * (production first, then legacy) and keeps NEW selections on
 * getProductionPuzzleById. This fixture proves the resume path works for
 * `mini-beginner-bar` and that the sticky seed no longer needs analysis.
 */

import {
	getProductionPuzzleById,
	resolvePlayablePuzzleById,
} from '../../content/playable'
import { getLegacyPuzzleById } from '../../content/legacyCatalog'
import { serializePlayerState, createEmptyPlayerState } from '../../domain/nonogram/playerState'
import { buildPuzzleContentFingerprint } from '../fingerprint'
import { migrateSave } from '../migrate'
import { sanitizeSaveAgainstCatalog } from '../sanitize'
import { createFakeClock } from '../clock'
import { createGameProgressService } from '../progressService'
import { createSaveRepository } from '../repository'
import { createMemoryStorage } from '../../storage'
import { SAVE_STORAGE_KEY } from '../../storage/keys'
import { seedStickyAchievementIdsFromLegacyV3 } from '../../achievements/legacyV3Seed'
import {
	LEGACY_V3_PUZZLE_METADATA,
	getLegacyV3PuzzleMetadata,
} from '../../achievements/legacyV3Metadata'
import { LEGACY_V3_GALLERY_ITEMS } from '../../achievements/legacyV3Gallery'
import { analyzeDifficulty } from '../../domain/difficulty/analyzer'

const LEGACY_ID = 'mini-beginner-bar'

/** Build a schema-v3 document with an unfinished Campaign party on LEGACY_ID. */
function buildV3FixtureWithActiveLegacy() {
	const puzzle = getLegacyPuzzleById(LEGACY_ID)!
	const player = createEmptyPlayerState(puzzle.width, puzzle.height)
	return {
		schemaVersion: 3,
		activeGame: {
			puzzleId: LEGACY_ID,
			contentFingerprint: buildPuzzleContentFingerprint(puzzle),
			player: serializePlayerState(player),
			accumulatedActiveMs: 4321,
			startedAtMs: 1000,
			savedAtMs: 2000,
			tool: 'FILLED',
			restartCountThisRun: 0,
			hintsUsedThisRun: 0,
		},
		activeDailyGame: null,
		completedPuzzleIds: [],
		solvedPuzzleIds: [],
		startedPuzzleIds: [LEGACY_ID],
		bestTimes: [],
		statistics: {
			totalCompletions: 0,
			totalActiveSolveTimeMs: 0,
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
	}
}

describe('Phase 9C — legacy active game opens in Game (H4)', () => {
	it('legacy id is NOT production-resolvable but IS playable', () => {
		// Root cause of H4: GameScreen used the production-only lookup.
		expect(getProductionPuzzleById(LEGACY_ID)).toBeNull()
		expect(resolvePlayablePuzzleById(LEGACY_ID)).not.toBeNull()
	})

	it('v3 save with mini-beginner-bar active → migrate → resolvePlayable succeeds', () => {
		const migrated = migrateSave(buildV3FixtureWithActiveLegacy())
		expect(migrated.kind).toBe('ok')
		expect(migrated.save.activeGame?.puzzleId).toBe(LEGACY_ID)

		const sanitized = sanitizeSaveAgainstCatalog(
			migrated.save,
			createFakeClock(Date.parse('2026-10-02T12:00:00')),
		)
		// Active legacy party survives hydration sanitising.
		expect(sanitized.clearedActiveGame).toBe(false)
		const activeId = sanitized.save.activeGame!.puzzleId
		const puzzle = resolvePlayablePuzzleById(activeId)
		expect(puzzle).not.toBeNull()
		expect(puzzle!.id).toBe(LEGACY_ID)
	})

	it('hydrated service resumes the legacy party (what GameScreen resume does)', async () => {
		const storage = createMemoryStorage({
			[SAVE_STORAGE_KEY]: JSON.stringify(buildV3FixtureWithActiveLegacy()),
		})
		const service = createGameProgressService(
			createSaveRepository(storage),
			createFakeClock(Date.parse('2026-10-02T12:00:00')),
		)
		const hydrated = await service.hydrate()
		expect(hydrated.save.activeGame?.puzzleId).toBe(LEGACY_ID)

		const resumed = service.resumeActivePuzzle()
		expect(resumed).not.toBeNull()
		expect(resumed!.puzzle.id).toBe(LEGACY_ID)
		expect(resumed!.accumulatedActiveMs).toBe(4321)
		// Same lookup GameScreen uses for launch === 'resume'.
		expect(resolvePlayablePuzzleById(hydrated.save.activeGame!.puzzleId)).toBe(
			resumed!.puzzle,
		)
	})
})

describe('Phase 9C — legacy v3 seed uses frozen metadata (H4)', () => {
	it('frozen table covers exactly the 21 legacy gallery ids', () => {
		const frozenIds = Object.keys(LEGACY_V3_PUZZLE_METADATA).sort()
		const galleryIds = LEGACY_V3_GALLERY_ITEMS.map((i) => i.puzzleId).sort()
		expect(frozenIds).toEqual(galleryIds)
	})

	it('frozen grid size + tier match the legacy puzzles (drift guard)', () => {
		for (const id of Object.keys(LEGACY_V3_PUZZLE_METADATA)) {
			const puzzle = getLegacyPuzzleById(id)!
			const frozen = getLegacyV3PuzzleMetadata(id)!
			expect(frozen.width).toBe(puzzle.width)
			expect(frozen.height).toBe(puzzle.height)
			// Test-only analysis (21 tiny puzzles) — runtime never does this.
			expect(frozen.tier).toBe(analyzeDifficulty(puzzle).tier)
		}
	})

	it('seed counts large-grid + difficulty achievements for legacy solves', () => {
		const ids = [
			'mini-hard-frame-cross', // 15x15 HARD
			'mini-medium-maze', // 15x15 (frozen EASY)
		]
		const seeded = seedStickyAchievementIdsFromLegacyV3(
			{
				solvedPuzzleIds: ids,
				statistics: { totalCompletions: ids.length },
				dailyCompletionRecords: [],
				restoredDailyDays: [],
				dailyStartedDay: null,
			},
			'2026-10-02',
		)
		expect(seeded).toContain('first_picture')
		// 15×15 legacy puzzles must register (previously skipped because the
		// production-only lookup returned null for legacy ids).
		expect(seeded).toContain('large_grid')
	})
})
