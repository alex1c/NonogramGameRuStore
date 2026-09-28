/**
 * Progress reducers + service integration (completion atomicity, best time).
 */

import { createEmptyPlayerState } from '../../domain/nonogram/playerState'
import { PlayerCell } from '../../domain/nonogram/types'
import { getProductionPuzzleById } from '../../content/playable'
import { PaintTool } from '../../gameplay/tools'
import { createMemoryStorage } from '../../storage'
import { buildPuzzleContentFingerprint } from '../fingerprint'
import { createFakeClock } from '../clock'
import { createDefaultSave } from '../createDefaultSave'
import {
	completePuzzle,
	createActiveGameSave,
	persistActivePlayerState,
	recordRedoAction,
	recordRestart,
	recordUndoAction,
	setActiveGame,
} from '../progressReducers'
import { createGameProgressService } from '../progressService'
import { createSaveRepository } from '../repository'
import { sanitizeSaveAgainstCatalog } from '../sanitize'
import type { SaveRoot } from '../schema'

function requirePuzzle(id: string) {
	const puzzle = getProductionPuzzleById(id)
	if (puzzle === null) {
		throw new Error(`missing ${id}`)
	}
	return puzzle
}

describe('progress reducers', () => {
	it('completion is atomic: completed + stats + cleared active', () => {
		const puzzle = requirePuzzle('mini-beginner-bar')
		let save = createDefaultSave()
		const player = createEmptyPlayerState(puzzle.width, puzzle.height)
		const active = createActiveGameSave({
			puzzle,
			player,
			accumulatedActiveMs: 5000,
			startedAtMs: 1,
			savedAtMs: 2,
			tool: PaintTool.FILLED,
			restartCountThisRun: 0,
		})
		save = setActiveGame(save, active)
		save = completePuzzle(save, {
			puzzleId: puzzle.id,
			activeTimeMs: 5000,
		})
		expect(save.activeGame).toBeNull()
		expect(save.completedPuzzleIds).toEqual([puzzle.id])
		expect(save.solvedPuzzleIds).toEqual([puzzle.id])
		expect(save.statistics.totalCompletions).toBe(1)
		expect(save.bestTimes[0]?.bestActiveTimeMs).toBe(5000)
	})

	it('replay increments totalCompletions but not unique IDs', () => {
		const id = 'mini-beginner-bar'
		let save = completePuzzle(createDefaultSave(), {
			puzzleId: id,
			activeTimeMs: 9000,
		})
		save = completePuzzle(save, { puzzleId: id, activeTimeMs: 8000 })
		expect(save.completedPuzzleIds).toEqual([id])
		expect(save.statistics.totalCompletions).toBe(2)
		expect(save.bestTimes[0]?.bestActiveTimeMs).toBe(8000)
	})

	it('worse replay time does not replace best', () => {
		const id = 'mini-beginner-full'
		let save = completePuzzle(createDefaultSave(), {
			puzzleId: id,
			activeTimeMs: 3000,
		})
		save = completePuzzle(save, { puzzleId: id, activeTimeMs: 9000 })
		expect(save.bestTimes[0]?.bestActiveTimeMs).toBe(3000)
	})

	it('undo/redo/restart counters increment by transaction', () => {
		let save = createDefaultSave()
		save = recordUndoAction(save)
		save = recordRedoAction(save)
		save = recordRestart(save)
		expect(save.statistics.totalUndoActions).toBe(1)
		expect(save.statistics.totalRedoActions).toBe(1)
		expect(save.statistics.totalRestarts).toBe(1)
	})
})

describe('sanitizeSaveAgainstCatalog', () => {
	it('missing puzzle clears active game but keeps completed IDs', () => {
		const save: SaveRoot = {
			...createDefaultSave(),
			completedPuzzleIds: Object.freeze(['ghost', 'mini-beginner-bar']),
			activeGame: Object.freeze({
				puzzleId: 'does-not-exist',
				contentFingerprint: 'x',
				player: Object.freeze({
					version: 1 as const,
					width: 3,
					height: 3,
					cells: Object.freeze(
						Array.from({ length: 9 }, () => PlayerCell.UNKNOWN),
					),
				}),
				accumulatedActiveMs: 0,
				startedAtMs: 0,
				savedAtMs: 0,
				tool: PaintTool.FILLED,
				restartCountThisRun: 0,
			}),
		}
		const result = sanitizeSaveAgainstCatalog(save)
		expect(result.clearedActiveGame).toBe(true)
		expect(result.save.activeGame).toBeNull()
		expect(result.save.completedPuzzleIds).toContain('ghost')
	})

	it('fingerprint mismatch clears active game', () => {
		const puzzle = requirePuzzle('mini-beginner-bar')
		const save: SaveRoot = {
			...createDefaultSave(),
			activeGame: Object.freeze({
				puzzleId: puzzle.id,
				contentFingerprint: 'stale-fingerprint',
				player: Object.freeze({
					version: 1 as const,
					width: puzzle.width,
					height: puzzle.height,
					cells: Object.freeze(
						Array.from(
							{ length: puzzle.width * puzzle.height },
							() => PlayerCell.UNKNOWN,
						),
					),
				}),
				accumulatedActiveMs: 10,
				startedAtMs: 1,
				savedAtMs: 2,
				tool: PaintTool.FILLED,
				restartCountThisRun: 0,
			}),
		}
		const result = sanitizeSaveAgainstCatalog(save)
		expect(result.clearedActiveGame).toBe(true)
		expect(buildPuzzleContentFingerprint(puzzle)).not.toBe('stale-fingerprint')
	})

	it('wrong cell count clears active game', () => {
		const puzzle = requirePuzzle('mini-beginner-bar')
		const save: SaveRoot = {
			...createDefaultSave(),
			activeGame: Object.freeze({
				puzzleId: puzzle.id,
				contentFingerprint: buildPuzzleContentFingerprint(puzzle),
				player: Object.freeze({
					version: 1 as const,
					width: puzzle.width,
					height: puzzle.height,
					cells: Object.freeze([PlayerCell.UNKNOWN]),
				}),
				accumulatedActiveMs: 0,
				startedAtMs: 0,
				savedAtMs: 0,
				tool: PaintTool.FILLED,
				restartCountThisRun: 0,
			}),
		}
		// parse would reject this; sanitize checks dimensions vs catalog
		const result = sanitizeSaveAgainstCatalog({
			...save,
			activeGame: {
				...save.activeGame!,
				player: {
					version: 1,
					width: puzzle.width,
					height: puzzle.height,
					cells: Object.freeze(
						Array.from({ length: 2 }, () => PlayerCell.UNKNOWN),
					),
				},
			},
		})
		expect(result.clearedActiveGame).toBe(true)
	})
})

describe('GameProgressService completion kill-before-done', () => {
	it('after completion persistence, relaunch has completed and no active', async () => {
		const storage = createMemoryStorage()
		const clock = createFakeClock(1000)
		const repo = createSaveRepository(storage)
		const service = createGameProgressService(repo, clock)
		await service.hydrate()
		const puzzle = requirePuzzle('mini-beginner-full')
		await service.startPuzzle(puzzle.id)
		const player = createEmptyPlayerState(puzzle.width, puzzle.height)
		await service.persistGameState({
			puzzle,
			player,
			accumulatedActiveMs: 1200,
			tool: PaintTool.FILLED,
			restartCountThisRun: 0,
		})
		await service.completePuzzle({
			puzzleId: puzzle.id,
			activeTimeMs: 1200,
		})

		// Simulate kill before overlay "Готово": new service + hydrate
		const service2 = createGameProgressService(repo, clock)
		const hydrated = await service2.hydrate()
		expect(hydrated.save.activeGame).toBeNull()
		expect(hydrated.save.completedPuzzleIds).toContain(puzzle.id)
		expect(hydrated.save.statistics.totalCompletions).toBe(1)
	})

	it('rapid persist then complete keeps newest completed state', async () => {
		const storage = createMemoryStorage()
		const service = createGameProgressService(
			createSaveRepository(storage),
			createFakeClock(0),
		)
		await service.hydrate()
		const puzzle = requirePuzzle('mini-beginner-bar')
		await service.startPuzzle(puzzle.id)
		const player = createEmptyPlayerState(puzzle.width, puzzle.height)
		const p1 = service.persistGameState({
			puzzle,
			player,
			accumulatedActiveMs: 100,
			tool: PaintTool.FILLED,
			restartCountThisRun: 0,
		})
		const p2 = service.completePuzzle({
			puzzleId: puzzle.id,
			activeTimeMs: 100,
		})
		await Promise.all([p1, p2])
		const save = service.getSave()
		expect(save.activeGame).toBeNull()
		expect(save.completedPuzzleIds).toContain(puzzle.id)
	})
})

describe('persistActivePlayerState', () => {
	it('keeps startedAt from existing active game', () => {
		const puzzle = requirePuzzle('mini-beginner-bar')
		let save = createDefaultSave()
		const player = createEmptyPlayerState(puzzle.width, puzzle.height)
		save = persistActivePlayerState(save, {
			puzzle,
			player,
			accumulatedActiveMs: 0,
			tool: PaintTool.FILLED,
			savedAtMs: 50,
			restartCountThisRun: 0,
		})
		expect(save.activeGame?.startedAtMs).toBe(50)
		save = persistActivePlayerState(save, {
			puzzle,
			player,
			accumulatedActiveMs: 200,
			tool: PaintTool.CROSSED,
			savedAtMs: 99,
			restartCountThisRun: 0,
		})
		expect(save.activeGame?.startedAtMs).toBe(50)
		expect(save.activeGame?.tool).toBe(PaintTool.CROSSED)
	})
})
