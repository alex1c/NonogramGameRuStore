/**
 * Phase 6 date / selector / streak / calendar tests.
 */

import {
	buildMonthGrid,
	calendarDayDiff,
	DAILY_EPOCH_DAY,
	dayKeyFromParts,
	formatMonthTitleRu,
	isValidDayKey,
	localDayKey,
	mondayFirstWeekday,
	nextDayKey,
	previousDayKey,
} from '../dateUtils'
import {
	DAILY_KNOWN_VECTORS,
	buildDailyPoolIndex,
	getDailyPoolIndex,
	selectDailyPuzzle,
	stableHash32,
} from '../selector'
import {
	computeCurrentStreak,
	computeLongestStreak,
	getRestoreEligibility,
	type DailyCompletionRecord,
} from '../streak'
import { projectCalendarMonth } from '../calendar'

describe('dateUtils', () => {
	it('formats local day keys', () => {
		expect(localDayKey(new Date(2026, 8, 28))).toBe('2026-09-28')
		expect(isValidDayKey('2026-09-28')).toBe(true)
		expect(isValidDayKey('2026-02-30')).toBe(false)
	})

	it('next/previous day across year and month boundaries', () => {
		expect(nextDayKey('2026-12-31')).toBe('2027-01-01')
		expect(previousDayKey('2027-01-01')).toBe('2026-12-31')
		expect(nextDayKey('2026-01-31')).toBe('2026-02-01')
	})

	it('supports leap day 2028-02-29', () => {
		expect(isValidDayKey('2028-02-29')).toBe(true)
		expect(nextDayKey('2028-02-28')).toBe('2028-02-29')
		expect(nextDayKey('2028-02-29')).toBe('2028-03-01')
		expect(isValidDayKey('2027-02-29')).toBe(false)
	})

	it('calendar day diff ignores DST duration', () => {
		expect(calendarDayDiff('2026-03-30', '2026-03-29')).toBe(1)
		expect(calendarDayDiff('2026-10-26', '2026-10-25')).toBe(1)
	})

	it('builds Monday-first month grids', () => {
		// 2026-09-01 is Tuesday → one leading pad (Mon)
		const sep = buildMonthGrid(2026, 9)
		expect(sep[0]?.dayNumber).toBeNull()
		expect(sep[1]?.dayKey).toBe('2026-09-01')
		expect(mondayFirstWeekday(2026, 9, 1)).toBe(1)
		// Month starting on Monday
		const jun = buildMonthGrid(2026, 6)
		expect(jun[0]?.dayKey).toBe('2026-06-01')
	})

	it('formats all 12 Russian month titles', () => {
		const titles = Array.from({ length: 12 }, (_, i) =>
			formatMonthTitleRu(2026, i + 1),
		)
		expect(titles).toEqual([
			'Январь 2026',
			'Февраль 2026',
			'Март 2026',
			'Апрель 2026',
			'Май 2026',
			'Июнь 2026',
			'Июль 2026',
			'Август 2026',
			'Сентябрь 2026',
			'Октябрь 2026',
			'Ноябрь 2026',
			'Декабрь 2026',
		])
	})

	it('epoch constant is locked', () => {
		expect(DAILY_EPOCH_DAY).toBe('2026-09-28')
		expect(dayKeyFromParts(2026, 9, 28)).toBe(DAILY_EPOCH_DAY)
	})
})

describe('daily selector', () => {
	it('is deterministic and matches known vectors', () => {
		const index = getDailyPoolIndex()
		for (const vector of DAILY_KNOWN_VECTORS) {
			const a = selectDailyPuzzle(vector.dayKey, index)
			const b = selectDailyPuzzle(vector.dayKey, index)
			expect(a.puzzleId).toBe(vector.puzzleId)
			expect(b.puzzleId).toBe(a.puzzleId)
		}
	})

	it('stableHash32 is stable', () => {
		expect(stableHash32('daily-v1|2026-09-28')).toBe(
			stableHash32('daily-v1|2026-09-28'),
		)
	})

	it('avoids immediate repeats when pool > 1', () => {
		const index = getDailyPoolIndex()
		let day = DAILY_EPOCH_DAY
		let prev: string | null = null
		for (let i = 0; i < 60; i += 1) {
			const sel = selectDailyPuzzle(day, index)
			if (prev !== null) {
				expect(sel.puzzleId).not.toBe(prev)
			}
			prev = sel.puzzleId
			day = nextDayKey(day)
		}
	})

	it('falls back deterministically when desired tier missing', () => {
		const index = buildDailyPoolIndex([
			{
				puzzleId: 'only-easy',
				tier: 'EASY',
				width: 5,
				height: 5,
			},
			{
				puzzleId: 'only-easy-2',
				tier: 'EASY',
				width: 5,
				height: 5,
			},
		])
		// Sunday desires EXPERT → fallback to EASY
		const sunday = '2026-10-04'
		const sel = selectDailyPuzzle(sunday, index)
		expect(sel.puzzleId.startsWith('only-easy')).toBe(true)
		expect(sel.actualTier).toBe('EASY')
	})
})

describe('streak', () => {
	const rec = (
		dayKey: string,
		puzzleId = 'p',
	): DailyCompletionRecord => ({
		dayKey,
		puzzleId,
		selectionVersion: 'daily-v1',
		activeTimeMs: 1000,
	})

	it('covers streak matrix', () => {
		expect(
			computeCurrentStreak({
				today: '2026-09-28',
				completions: [],
				restoredDays: [],
				dailyStartedDay: '2026-09-28',
			}),
		).toBe(0)

		expect(
			computeCurrentStreak({
				today: '2026-09-28',
				completions: [rec('2026-09-28')],
				restoredDays: [],
				dailyStartedDay: '2026-09-28',
			}),
		).toBe(1)

		expect(
			computeCurrentStreak({
				today: '2026-09-29',
				completions: [rec('2026-09-28')],
				restoredDays: [],
				dailyStartedDay: '2026-09-28',
			}),
		).toBe(1)

		expect(
			computeCurrentStreak({
				today: '2026-09-29',
				completions: [rec('2026-09-28'), rec('2026-09-29')],
				restoredDays: [],
				dailyStartedDay: '2026-09-28',
			}),
		).toBe(2)

		expect(
			computeCurrentStreak({
				today: '2026-09-30',
				completions: [
					rec('2026-09-28'),
					rec('2026-09-29'),
					rec('2026-09-30'),
				],
				restoredDays: [],
				dailyStartedDay: '2026-09-28',
			}),
		).toBe(3)

		expect(
			computeCurrentStreak({
				today: '2026-09-30',
				completions: [rec('2026-09-28')],
				restoredDays: [],
				dailyStartedDay: '2026-09-28',
			}),
		).toBe(0)
	})

	it('restore bridges one-day gap', () => {
		const completions = [rec('2026-09-28'), rec('2026-09-30')]
		expect(
			computeCurrentStreak({
				today: '2026-09-30',
				completions,
				restoredDays: ['2026-09-29'],
				dailyStartedDay: '2026-09-28',
			}),
		).toBe(3)
		expect(
			computeLongestStreak({
				completions,
				restoredDays: ['2026-09-29'],
				dailyStartedDay: '2026-09-28',
			}),
		).toBe(3)
	})

	it('restore eligibility rules', () => {
		const base = {
			today: '2026-09-30',
			completions: [rec('2026-09-28'), rec('2026-09-30')],
			restoredDays: [] as string[],
			dailyStartedDay: '2026-09-28' as const,
		}
		expect(getRestoreEligibility(base).eligible).toBe(true)
		expect(getRestoreEligibility(base).missingDayKey).toBe('2026-09-29')

		expect(
			getRestoreEligibility({
				...base,
				completions: [rec('2026-09-30')],
			}).reason,
		).toBe('MULTI_GAP')

		expect(
			getRestoreEligibility({
				...base,
				restoredDays: ['2026-09-29'],
			}).reason,
		).toBe('NO_GAP')

		expect(
			getRestoreEligibility({
				today: '2026-09-30',
				completions: [rec('2026-09-28'), rec('2026-09-30')],
				restoredDays: ['2026-09-15'],
				dailyStartedDay: '2026-09-01',
			}).reason,
		).toBe('MONTH_RESTORE_USED')

		expect(
			getRestoreEligibility({
				today: '2026-10-01',
				completions: [rec('2026-09-29'), rec('2026-10-01')],
				restoredDays: [],
				dailyStartedDay: '2026-09-28',
			}).reason,
		).toBe('GAP_NOT_CURRENT_MONTH')
	})
})

describe('calendar projection', () => {
	it('marks today / future / before epoch', () => {
		const view = projectCalendarMonth({
			year: 2026,
			month: 9,
			today: '2026-09-28',
			completions: [],
			restoredDays: [],
			dailyStartedDay: '2026-09-28',
			activeDailyDayKey: null,
		})
		const today = view.cells.find((c) => c.dayKey === '2026-09-28')
		expect(today?.state).toBe('TODAY_AVAILABLE')
		const future = view.cells.find((c) => c.dayKey === '2026-09-29')
		expect(future?.state).toBe('FUTURE')
		expect(future?.tappable).toBe(false)
		const before = view.cells.find((c) => c.dayKey === '2026-09-27')
		expect(before?.state).toBe('BEFORE_EPOCH')
	})
})
