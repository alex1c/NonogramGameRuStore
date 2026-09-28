/**
 * Deterministic Daily puzzle selector (offline).
 * Bump DAILY_SELECTION_VERSION when pool order / rhythm / hash changes mapping.
 */

import type { DifficultyTier } from '../domain/difficulty/tiers'
import { GALLERY_ITEMS } from '../gallery/definitions'
import { getProductionPuzzleById } from '../content/playable'
import { analyzeDifficulty } from '../domain/difficulty/analyzer'
import {
	DAILY_EPOCH_DAY,
	isValidDayKey,
	previousDayKey,
	type DayKey,
} from './dateUtils'

export const DAILY_SELECTION_VERSION = 'daily-v1' as const

/** Frozen canonical pool order — Gallery item order (stable IDs). */
export const DAILY_POOL_ORDER: readonly string[] = Object.freeze(
	GALLERY_ITEMS.map((item) => item.puzzleId),
)

/**
 * Weekly difficulty rhythm (Monday-first):
 * Mon EASY, Tue MEDIUM, Wed EASY, Thu HARD, Fri MEDIUM, Sat HARD, Sun EXPERT
 */
const WEEKDAY_TIER: readonly DifficultyTier[] = Object.freeze([
	'EASY',
	'MEDIUM',
	'EASY',
	'HARD',
	'MEDIUM',
	'HARD',
	'EXPERT',
])

const FALLBACK_CHAIN: Readonly<
	Record<DifficultyTier, readonly DifficultyTier[]>
> = Object.freeze({
	BEGINNER: ['EASY', 'MEDIUM', 'HARD', 'EXPERT'],
	EASY: ['MEDIUM', 'BEGINNER', 'HARD', 'EXPERT'],
	MEDIUM: ['EASY', 'HARD', 'BEGINNER', 'EXPERT'],
	HARD: ['MEDIUM', 'EXPERT', 'EASY', 'BEGINNER'],
	EXPERT: ['HARD', 'MEDIUM', 'EASY', 'BEGINNER'],
})

export interface DailyPoolEntry {
	readonly puzzleId: string
	readonly tier: DifficultyTier
	readonly width: number
	readonly height: number
}

export interface DailyPoolIndex {
	readonly version: typeof DAILY_SELECTION_VERSION
	readonly entries: readonly DailyPoolEntry[]
	readonly byTier: ReadonlyMap<DifficultyTier, readonly string[]>
}

let cachedIndex: DailyPoolIndex | null = null

/** Test helper — reset analyzer-backed cache between suites. */
export function resetDailyPoolIndexCache(): void {
	cachedIndex = null
}

export function getDailyPoolIndex(): DailyPoolIndex {
	if (cachedIndex !== null) {
		return cachedIndex
	}
	const entries: DailyPoolEntry[] = []
	const byTier = new Map<DifficultyTier, string[]>()
	for (const tier of [
		'BEGINNER',
		'EASY',
		'MEDIUM',
		'HARD',
		'EXPERT',
	] as const) {
		byTier.set(tier, [])
	}
	for (const puzzleId of DAILY_POOL_ORDER) {
		const puzzle = getProductionPuzzleById(puzzleId)
		if (puzzle === null) {
			continue
		}
		const analysis = analyzeDifficulty(puzzle)
		if (analysis.tier === 'UNRATED') {
			continue
		}
		entries.push({
			puzzleId,
			tier: analysis.tier,
			width: puzzle.width,
			height: puzzle.height,
		})
		byTier.get(analysis.tier)!.push(puzzleId)
	}
	cachedIndex = {
		version: DAILY_SELECTION_VERSION,
		entries: Object.freeze(entries),
		byTier: byTier as ReadonlyMap<DifficultyTier, readonly string[]>,
	}
	return cachedIndex
}

/** Build an index from an artificial pool (tests / fallback audit). */
export function buildDailyPoolIndex(
	entries: readonly DailyPoolEntry[],
): DailyPoolIndex {
	const byTier = new Map<DifficultyTier, string[]>()
	for (const tier of [
		'BEGINNER',
		'EASY',
		'MEDIUM',
		'HARD',
		'EXPERT',
	] as const) {
		byTier.set(tier, [])
	}
	for (const entry of entries) {
		byTier.get(entry.tier)!.push(entry.puzzleId)
	}
	return {
		version: DAILY_SELECTION_VERSION,
		entries: Object.freeze([...entries]),
		byTier: byTier as ReadonlyMap<DifficultyTier, readonly string[]>,
	}
}

/** FNV-1a 32-bit — stable across JS engines. */
export function stableHash32(input: string): number {
	let hash = 0x811c9dc5
	for (let i = 0; i < input.length; i += 1) {
		hash ^= input.charCodeAt(i)
		hash = Math.imul(hash, 0x01000193)
	}
	return hash >>> 0
}

function weekdayMon0(dayKey: DayKey): number {
	const [y, m, d] = dayKey.split('-').map(Number)
	const js = new Date(y!, m! - 1, d!).getDay()
	return (js + 6) % 7
}

export function desiredTierForDay(dayKey: DayKey): DifficultyTier {
	return WEEKDAY_TIER[weekdayMon0(dayKey)]!
}

export interface DailySelection {
	readonly dayKey: DayKey
	readonly puzzleId: string
	readonly selectionVersion: typeof DAILY_SELECTION_VERSION
	readonly desiredTier: DifficultyTier
	readonly actualTier: DifficultyTier
}

function candidatesForTier(
	index: DailyPoolIndex,
	desired: DifficultyTier,
): { readonly ids: readonly string[]; readonly actual: DifficultyTier } {
	const primary = index.byTier.get(desired) ?? []
	if (primary.length > 0) {
		return { ids: primary, actual: desired }
	}
	for (const tier of FALLBACK_CHAIN[desired]) {
		const list = index.byTier.get(tier) ?? []
		if (list.length > 0) {
			return { ids: list, actual: tier }
		}
	}
	return {
		ids: index.entries.map((e) => e.puzzleId),
		actual: desired,
	}
}

/**
 * Select Daily puzzle for a day key.
 * Hard rule: avoid yesterday's puzzle when the candidate pool has >1 id.
 * Soft rule: prefer avoiding last 7 days when alternatives remain.
 */
export function selectDailyPuzzle(
	dayKey: DayKey,
	index: DailyPoolIndex = getDailyPoolIndex(),
	memo: Map<string, DailySelection> = new Map(),
): DailySelection {
	const cached = memo.get(dayKey)
	if (cached !== undefined) {
		return cached
	}
	if (!isValidDayKey(dayKey)) {
		throw new Error(`Invalid dayKey for selector: ${dayKey}`)
	}
	if (dayKey < DAILY_EPOCH_DAY) {
		throw new Error(`Day before Daily epoch: ${dayKey}`)
	}
	const desired = desiredTierForDay(dayKey)
	const { ids, actual } = candidatesForTier(index, desired)
	if (ids.length === 0) {
		throw new Error('Daily pool is empty')
	}

	const recent = new Set<string>()
	let cursor = dayKey
	for (let i = 0; i < 7; i += 1) {
		cursor = previousDayKey(cursor)
		if (cursor < DAILY_EPOCH_DAY) {
			break
		}
		recent.add(selectDailyPuzzle(cursor, index, memo).puzzleId)
	}

	const yesterdayKey = previousDayKey(dayKey)
	const yesterdayId =
		yesterdayKey >= DAILY_EPOCH_DAY
			? selectDailyPuzzle(yesterdayKey, index, memo).puzzleId
			: null

	let pool = [...ids]
	if (yesterdayId !== null && pool.length > 1) {
		pool = pool.filter((id) => id !== yesterdayId)
	}
	const soft = pool.filter((id) => !recent.has(id))
	if (soft.length > 0) {
		pool = soft
	}
	if (pool.length === 0) {
		pool = [...ids]
		if (yesterdayId !== null && pool.length > 1) {
			pool = pool.filter((id) => id !== yesterdayId)
		}
	}

	const hash = stableHash32(
		`${DAILY_SELECTION_VERSION}|${dayKey}|${actual}|${pool.join(',')}`,
	)
	const result: DailySelection = {
		dayKey,
		puzzleId: pool[hash % pool.length]!,
		selectionVersion: DAILY_SELECTION_VERSION,
		desiredTier: desired,
		actualTier: actual,
	}
	memo.set(dayKey, result)
	return result
}

/**
 * Known-vector fixtures for audit — filled after first selector lock.
 * Updated by scripts/audit-daily.ts when regenerating baselines intentionally.
 */
export const DAILY_KNOWN_VECTORS: readonly {
	readonly dayKey: DayKey
	readonly puzzleId: string
}[] = Object.freeze([
	// Locked daily-v1 vectors — bump version if these must change.
	{ dayKey: '2026-09-28', puzzleId: 'mini-easy-block' },
	{ dayKey: '2026-09-29', puzzleId: 'mini-medium-diamond' },
	{ dayKey: '2026-10-04', puzzleId: 'mini-expert-lattice' },
])
