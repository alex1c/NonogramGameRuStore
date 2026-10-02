/**
 * Daily across midnight — service rejects stale-day mutations (fake clock).
 */

import { getProductionPuzzleById } from '../../content/playable'
import { createEmptyPlayerState } from '../../domain/nonogram/playerState'
import { PaintTool } from '../../gameplay/tools'
import { createFakeClock } from '../../persistence/clock'
import { createGameProgressService } from '../../persistence/progressService'
import { createSaveRepository } from '../../persistence/repository'
import { createMemoryStorage } from '../../storage'
import {
	DailyRolloverError,
	isDailyRolloverError,
	isDailySessionStale,
} from '../rollover'

/** Local noon on a Daily-eligible day. */
const DAY_ONE_NOON = new Date(2026, 8, 28, 12, 0, 0).getTime()
/** Local 00:05 the next day. */
const DAY_TWO_AFTER_MIDNIGHT = new Date(2026, 8, 29, 0, 5, 0).getTime()

async function createStartedDaily() {
	const clock = createFakeClock(DAY_ONE_NOON)
	const service = createGameProgressService(
		createSaveRepository(createMemoryStorage()),
		clock,
	)
	await service.hydrate()
	const dayOne = service.todayDayKey()
	const started = await service.startOrResumeDaily(dayOne)
	if (started.kind !== 'started') {
		throw new Error(`expected started Daily, got ${started.kind}`)
	}
	const puzzle = getProductionPuzzleById(started.puzzleId)
	if (puzzle === null) {
		throw new Error('Daily puzzle missing')
	}
	const selectionVersion =
		service.getSave().activeDailyGame?.selectionVersion ?? 'daily-v1'
	return { clock, service, dayOne, puzzle, selectionVersion }
}

describe('isDailySessionStale', () => {
	it('compares session day with today', () => {
		expect(isDailySessionStale('2026-09-28', '2026-09-28')).toBe(false)
		expect(isDailySessionStale('2026-09-28', '2026-09-29')).toBe(true)
	})

	it('error type guard recognises service rejections', () => {
		expect(isDailyRolloverError(new DailyRolloverError('a', 'b'))).toBe(true)
		expect(isDailyRolloverError(new Error('x'))).toBe(false)
	})
})

describe('Daily service across midnight', () => {
	it('allows persist / restart / complete on the same day', async () => {
		const { service, dayOne, puzzle, selectionVersion } =
			await createStartedDaily()
		await expect(
			service.persistDailyState({
				dayKey: dayOne,
				selectionVersion,
				puzzle,
				player: createEmptyPlayerState(puzzle.width, puzzle.height),
				accumulatedActiveMs: 1000,
				tool: PaintTool.FILLED,
				restartCountThisRun: 0,
			}),
		).resolves.toBeDefined()
		await expect(
			service.restartDaily({ dayKey: dayOne, puzzle, selectionVersion }),
		).resolves.toBeDefined()
		const done = await service.completeDailyPuzzle({
			dayKey: dayOne,
			puzzleId: puzzle.id,
			selectionVersion,
			activeTimeMs: 5000,
		})
		expect(done.event.mode).toBe('DAILY')
	})

	it('rejects persistDailyState after the day rolls over', async () => {
		const { clock, service, dayOne, puzzle, selectionVersion } =
			await createStartedDaily()
		const before = service.getSave()
		clock.set(DAY_TWO_AFTER_MIDNIGHT)
		await expect(
			service.persistDailyState({
				dayKey: dayOne,
				selectionVersion,
				puzzle,
				player: createEmptyPlayerState(puzzle.width, puzzle.height),
				accumulatedActiveMs: 1000,
				tool: PaintTool.FILLED,
				restartCountThisRun: 0,
			}),
		).rejects.toBeInstanceOf(DailyRolloverError)
		expect(service.getSave()).toBe(before)
	})

	it('rejects restartDaily after the day rolls over', async () => {
		const { clock, service, dayOne, puzzle, selectionVersion } =
			await createStartedDaily()
		const before = service.getSave()
		clock.set(DAY_TWO_AFTER_MIDNIGHT)
		await expect(
			service.restartDaily({ dayKey: dayOne, puzzle, selectionVersion }),
		).rejects.toBeInstanceOf(DailyRolloverError)
		expect(service.getSave()).toBe(before)
	})

	it('rejects completeDailyPuzzle after the day rolls over', async () => {
		const { clock, service, dayOne, puzzle, selectionVersion } =
			await createStartedDaily()
		clock.set(DAY_TWO_AFTER_MIDNIGHT)
		await expect(
			service.completeDailyPuzzle({
				dayKey: dayOne,
				puzzleId: puzzle.id,
				selectionVersion,
				activeTimeMs: 5000,
			}),
		).rejects.toBeInstanceOf(DailyRolloverError)
		expect(service.getSave().dailyCompletionRecords).toHaveLength(0)
	})

	it('stale active Daily is discarded and today starts fresh', async () => {
		const { clock, service } = await createStartedDaily()
		clock.set(DAY_TWO_AFTER_MIDNIGHT)
		await service.discardStaleDailyIfNeeded()
		expect(service.getSave().activeDailyGame).toBeNull()
		const dayTwo = service.todayDayKey()
		const next = await service.startOrResumeDaily(dayTwo)
		expect(next.kind).toBe('started')
	})
})
