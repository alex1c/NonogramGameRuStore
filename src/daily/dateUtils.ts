/**
 * Local calendar day utilities — never use timestamp + 86400000 for day math.
 * All operations work on YYYY-MM-DD calendar keys in the device local timezone.
 */

export type DayKey = string // YYYY-MM-DD
export type MonthKey = string // YYYY-MM

/** System Daily era start — constant, not install date. */
export const DAILY_EPOCH_DAY: DayKey = '2026-09-28'

const DAY_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export function isValidDayKey(value: string): value is DayKey {
	const match = DAY_KEY_RE.exec(value)
	if (match === null) {
		return false
	}
	const year = Number(match[1])
	const month = Number(match[2])
	const day = Number(match[3])
	if (month < 1 || month > 12 || day < 1 || day > 31) {
		return false
	}
	const date = new Date(year, month - 1, day)
	return (
		date.getFullYear() === year &&
		date.getMonth() === month - 1 &&
		date.getDate() === day
	)
}

/** Local calendar day key for an instant. */
export function localDayKey(date: Date = new Date()): DayKey {
	const y = date.getFullYear()
	const m = String(date.getMonth() + 1).padStart(2, '0')
	const d = String(date.getDate()).padStart(2, '0')
	return `${y}-${m}-${d}`
}

export function localMonthKey(dayKey: DayKey): MonthKey {
	return dayKey.slice(0, 7)
}

export function parseDayKey(dayKey: DayKey): {
	readonly year: number
	readonly month: number
	readonly day: number
} {
	if (!isValidDayKey(dayKey)) {
		throw new Error(`Invalid dayKey: ${dayKey}`)
	}
	const [y, m, d] = dayKey.split('-').map(Number)
	return { year: y!, month: m!, day: d! }
}

export function dayKeyFromParts(
	year: number,
	month: number,
	day: number,
): DayKey {
	const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
	if (!isValidDayKey(key)) {
		throw new Error(`Invalid calendar date: ${key}`)
	}
	return key
}

/** Next local calendar day (DST-safe). */
export function nextDayKey(dayKey: DayKey): DayKey {
	const { year, month, day } = parseDayKey(dayKey)
	const date = new Date(year, month - 1, day + 1)
	return localDayKey(date)
}

export function previousDayKey(dayKey: DayKey): DayKey {
	const { year, month, day } = parseDayKey(dayKey)
	const date = new Date(year, month - 1, day - 1)
	return localDayKey(date)
}

/** Signed difference in calendar days: a - b (a later → positive). */
export function calendarDayDiff(a: DayKey, b: DayKey): number {
	const pa = parseDayKey(a)
	const pb = parseDayKey(b)
	const da = Date.UTC(pa.year, pa.month - 1, pa.day)
	const db = Date.UTC(pb.year, pb.month - 1, pb.day)
	return Math.round((da - db) / 86_400_000)
}

export function compareDayKeys(a: DayKey, b: DayKey): number {
	return a < b ? -1 : a > b ? 1 : 0
}

export function isBeforeDay(a: DayKey, b: DayKey): boolean {
	return compareDayKeys(a, b) < 0
}

export function isAfterDay(a: DayKey, b: DayKey): boolean {
	return compareDayKeys(a, b) > 0
}

export function daysInMonth(year: number, month: number): number {
	return new Date(year, month, 0).getDate()
}

/**
 * Monday-first weekday: Mon=0 … Sun=6.
 * JS getDay(): Sun=0 … Sat=6.
 */
export function mondayFirstWeekday(year: number, month: number, day: number): number {
	const js = new Date(year, month - 1, day).getDay()
	return (js + 6) % 7
}

export interface CalendarCellSpec {
	readonly dayNumber: number | null
	readonly dayKey: DayKey | null
}

/** Build a Monday-first month grid (5–6 weeks). Leading/trailing nulls for padding. */
export function buildMonthGrid(
	year: number,
	month: number,
): readonly CalendarCellSpec[] {
	const total = daysInMonth(year, month)
	const startWeekday = mondayFirstWeekday(year, month, 1)
	const cells: CalendarCellSpec[] = []
	for (let i = 0; i < startWeekday; i += 1) {
		cells.push({ dayNumber: null, dayKey: null })
	}
	for (let day = 1; day <= total; day += 1) {
		cells.push({
			dayNumber: day,
			dayKey: dayKeyFromParts(year, month, day),
		})
	}
	while (cells.length % 7 !== 0) {
		cells.push({ dayNumber: null, dayKey: null })
	}
	return cells
}

const MONTHS_RU = [
	'Январь',
	'Февраль',
	'Март',
	'Апрель',
	'Май',
	'Июнь',
	'Июль',
	'Август',
	'Сентябрь',
	'Октябрь',
	'Ноябрь',
	'Декабрь',
] as const

export function formatMonthTitleRu(year: number, month: number): string {
	return `${MONTHS_RU[month - 1]} ${year}`
}

const MONTHS_GENITIVE_RU = [
	'января',
	'февраля',
	'марта',
	'апреля',
	'мая',
	'июня',
	'июля',
	'августа',
	'сентября',
	'октября',
	'ноября',
	'декабря',
] as const

/** 28 сентября or 28 сентября 2027 when year differs from reference. */
export function formatDayTitleRu(
	dayKey: DayKey,
	referenceYear?: number,
): string {
	const { year, month, day } = parseDayKey(dayKey)
	const base = `${day} ${MONTHS_GENITIVE_RU[month - 1]}`
	if (referenceYear !== undefined && referenceYear !== year) {
		return `${base} ${year}`
	}
	return base
}

export const WEEKDAY_LABELS_RU = [
	'Пн',
	'Вт',
	'Ср',
	'Чт',
	'Пт',
	'Сб',
	'Вс',
] as const
