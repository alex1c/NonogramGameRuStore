/**
 * Phase 9C H5 / H6 — Replay must never destroy Campaign; completion is
 * idempotent.
 *
 * Matrices:
 *  A. Unfinished Campaign X + Replay of solved Y completes
 *       → activeGame X intact, Y not newly Campaign-completed, no Campaign advance.
 *  B. Replay of a Campaign-completed Y with an existing best time
 *       → best time only improves; completion counters do not move.
 *  C. Replay of the SAME puzzle id as the active Campaign party
 *       → activeGame is still not cleared / replaced.
 *  D. Duplicate / concurrent completePuzzle (deferred storage)
 *       → exactly one completion is counted; Replay after Campaign is a noop.
 */

import { createEmptyPlayerState } from '../../domain/nonogram/playerState'
import { getRuntimePuzzleById, getRuntimePuzzleIds } from '../../content/runtime'
import { PaintTool } from '../../gameplay/tools'
import {
	createControllableMemoryStorage,
	createMemoryStorage,
} from '../../storage'
import { createFakeClock } from '../clock'
import { createGameProgressService } from '../progressService'
import { completePuzzle } from '../progressReducers'
import { createDefaultSave } from '../createDefaultSave'
import { createSaveRepository } from '../repository'
import type { KeyValueStorage } from '../../storage'

const RUNTIME_IDS = getRuntimePuzzleIds()
// Three distinct production puzzles (asserted non-empty below).
const PUZZLE_X: string = RUNTIME_IDS[0] ?? 'missing-x'
const PUZZLE_Y: string = RUNTIME_IDS[1] ?? 'missing-y'
const PUZZLE_Z: string = RUNTIME_IDS[2] ?? 'missing-z'

async function createService(storage: KeyValueStorage = createMemoryStorage()) {
	const repo = createSaveRepository(storage)
	const clock = createFakeClock(Date.parse('2026-10-02T12:00:00'))
	const service = createGameProgressService(repo, clock)
	await service.hydrate()
	return service
}

/** Persist an unfinished Campaign party for `puzzleId`. */
async function startCampaign(
	service: Awaited<ReturnType<typeof createService>>,
	puzzleId: string,
) {
	await service.startPuzzle(puzzleId)
	const puzzle = getRuntimePuzzleById(puzzleId)!
	const player = createEmptyPlayerState(puzzle.width, puzzle.height)
	await service.persistGameState({
		puzzle,
		player,
		accumulatedActiveMs: 1234,
		tool: PaintTool.FILLED,
		restartCountThisRun: 0,
	})
}

describe('Phase 9C — Replay does not destroy Campaign (H5)', () => {
	it('fixture sanity: three distinct production puzzles', () => {
		expect(new Set([PUZZLE_X, PUZZLE_Y, PUZZLE_Z]).size).toBe(3)
		expect(getRuntimePuzzleById(PUZZLE_X)).not.toBeNull()
	})

	it('A: replay completion keeps unfinished Campaign party X', async () => {
		const service = await createService()
		// Y solved earlier through Campaign.
		await startCampaign(service, PUZZLE_Y)
		await service.completePuzzle({ puzzleId: PUZZLE_Y, activeTimeMs: 5000 })
		// X is the unfinished Campaign party.
		await startCampaign(service, PUZZLE_X)
		const before = service.getSave()
		expect(before.activeGame?.puzzleId).toBe(PUZZLE_X)
		const completedBefore = before.completedPuzzleIds
		const totalBefore = before.statistics.totalCompletions

		const { event, save } = await service.completePuzzle({
			puzzleId: PUZZLE_Y,
			activeTimeMs: 4000,
			isReplay: true,
		})

		expect(save.activeGame).toEqual(before.activeGame)
		expect(save.activeGame?.puzzleId).toBe(PUZZLE_X)
		expect(save.completedPuzzleIds).toEqual(completedBefore)
		expect(save.statistics.totalCompletions).toBe(totalBefore)
		expect(save.startedPuzzleIds).toEqual(before.startedPuzzleIds)
		expect(event.mode).toBe('REPLAY')
		expect(event.firstCompletion).toBe(false)
		// Replay must never advance Campaign.
		expect(event.nextCampaignPuzzleId).toBeNull()
	})

	it('A: replay never adds a Campaign completion for a Daily-only solve', async () => {
		const service = await createService()
		// Solved (e.g. via Daily) but never Campaign-completed.
		const solvedOnly = {
			...service.getSave(),
			solvedPuzzleIds: Object.freeze([PUZZLE_Z]),
		}
		const reduced = completePuzzle(solvedOnly, {
			puzzleId: PUZZLE_Z,
			activeTimeMs: 100,
			isReplay: true,
		})
		expect(reduced.completedPuzzleIds).not.toContain(PUZZLE_Z)
		expect(reduced.solvedPuzzleIds).toEqual([PUZZLE_Z])
		expect(reduced.bestTimes).toEqual([])
		expect(reduced.statistics.totalCompletions).toBe(0)
	})

	it('B: replay only improves an existing best time', async () => {
		const service = await createService()
		await startCampaign(service, PUZZLE_Y)
		await service.completePuzzle({ puzzleId: PUZZLE_Y, activeTimeMs: 5000 })

		const slower = await service.completePuzzle({
			puzzleId: PUZZLE_Y,
			activeTimeMs: 9000,
			isReplay: true,
		})
		expect(slower.event.bestTimeImproved).toBe(false)
		expect(
			slower.save.bestTimes.find((b) => b.puzzleId === PUZZLE_Y)
				?.bestActiveTimeMs,
		).toBe(5000)

		const faster = await service.completePuzzle({
			puzzleId: PUZZLE_Y,
			activeTimeMs: 3000,
			isReplay: true,
		})
		expect(faster.event.bestTimeImproved).toBe(true)
		expect(
			faster.save.bestTimes.find((b) => b.puzzleId === PUZZLE_Y)
				?.bestActiveTimeMs,
		).toBe(3000)
		expect(faster.save.statistics.totalCompletions).toBe(1)
		expect(faster.save.completedPuzzleIds).toEqual([PUZZLE_Y])
	})

	it('C: replay of the same id as the active party does not clear it', async () => {
		const service = await createService()
		await startCampaign(service, PUZZLE_Y)
		const active = service.getSave().activeGame
		expect(active).not.toBeNull()

		const { save } = await service.completePuzzle({
			puzzleId: PUZZLE_Y,
			activeTimeMs: 777,
			isReplay: true,
		})
		expect(save.activeGame).toEqual(active)
		expect(save.completedPuzzleIds).not.toContain(PUZZLE_Y)
	})

	it('C: replace-free replay open leaves activeGame untouched (no service call)', async () => {
		const service = await createService()
		await startCampaign(service, PUZZLE_X)
		const before = service.getSave()
		// RootNavigation / GameScreen perform NO persistence for REPLAY;
		// the save reference must be identical when nothing was called.
		expect(service.getSave()).toBe(before)
		expect(service.getSave().activeGame?.puzzleId).toBe(PUZZLE_X)
	})
})

describe('Phase 9C — completion idempotence (H6 / matrix D)', () => {
	it('D: double Campaign completePuzzle counts once', async () => {
		const service = await createService()
		await startCampaign(service, PUZZLE_X)

		const first = await service.completePuzzle({
			puzzleId: PUZZLE_X,
			activeTimeMs: 4200,
		})
		const second = await service.completePuzzle({
			puzzleId: PUZZLE_X,
			activeTimeMs: 4300,
		})

		expect(first.event.firstCompletion).toBe(true)
		expect(second.event.firstCompletion).toBe(false)
		expect(second.save.statistics.totalCompletions).toBe(1)
		expect(second.save.completedPuzzleIds).toEqual([PUZZLE_X])
		expect(second.save.statistics.totalActiveSolveTimeMs).toBe(4200)
		expect(second.save.activeGame).toBeNull()
	})

	it('D: concurrent completePuzzle with deferred storage counts once', async () => {
		const ctrl = createControllableMemoryStorage()
		const service = await createService(ctrl.storage)
		await startCampaign(service, PUZZLE_X)

		// Slow storage = the first persist is still "in flight" while the
		// second detection fires (deferred-promise scenario).
		ctrl.setWriteDelayMs(30)
		const inFlight = service.completePuzzle({
			puzzleId: PUZZLE_X,
			activeTimeMs: 1000,
		})
		const duplicate = service.completePuzzle({
			puzzleId: PUZZLE_X,
			activeTimeMs: 1000,
		})
		const [a, b] = await Promise.all([inFlight, duplicate])

		expect(a.event.firstCompletion).toBe(true)
		expect(b.event.firstCompletion).toBe(false)
		expect(service.getSave().statistics.totalCompletions).toBe(1)
		expect(service.getSave().completedPuzzleIds).toEqual([PUZZLE_X])
	})

	it('D: duplicate completion still clears a stale party for the same puzzle', () => {
		const base = createDefaultSave()
		const completed = {
			...base,
			completedPuzzleIds: Object.freeze([PUZZLE_X]),
			solvedPuzzleIds: Object.freeze([PUZZLE_X]),
			activeGame: {
				puzzleId: PUZZLE_X,
			} as unknown as NonNullable<typeof base.activeGame>,
		}
		const next = completePuzzle(completed, {
			puzzleId: PUZZLE_X,
			activeTimeMs: 10,
		})
		expect(next.activeGame).toBeNull()
		expect(next.statistics.totalCompletions).toBe(0)
	})

	it('D: Campaign still advances normally after a replay', async () => {
		const service = await createService()
		await startCampaign(service, PUZZLE_Y)
		await service.completePuzzle({ puzzleId: PUZZLE_Y, activeTimeMs: 5000 })
		await service.completePuzzle({
			puzzleId: PUZZLE_Y,
			activeTimeMs: 4000,
			isReplay: true,
		})

		await startCampaign(service, PUZZLE_X)
		const done = await service.completePuzzle({
			puzzleId: PUZZLE_X,
			activeTimeMs: 6000,
		})
		expect(done.event.mode).toBe('CAMPAIGN')
		expect(done.event.firstCompletion).toBe(true)
		expect(done.save.completedPuzzleIds).toEqual([PUZZLE_Y, PUZZLE_X])
		expect(done.save.statistics.totalCompletions).toBe(2)
	})
})
