/**
 * Deterministic Daily puzzle selector (offline).
 * daily-v1 — frozen development pool (historical records / known vectors).
 * daily-v2 — production B1000 eligible pool (new selections).
 */

import type { DifficultyTier } from '../domain/difficulty/tiers'
import {
	getRuntimeDailyEligibleIds,
	getRuntimePuzzleEntry,
} from '../content/runtime'
import { getLegacyPuzzleById } from '../content/legacyCatalog'
import { analyzeDifficulty } from '../domain/difficulty/analyzer'
import {
	DAILY_EPOCH_DAY,
	isValidDayKey,
	previousDayKey,
	type DayKey,
} from './dateUtils'

/** Current production selection version — new Daily uses this. */
export const DAILY_SELECTION_VERSION = 'daily-v2' as const
/** Frozen historical version — do not mutate pool/rhythm semantics. */
export const DAILY_V1_SELECTION_VERSION = 'daily-v1' as const

export type DailySelectionVersion =
	| typeof DAILY_SELECTION_VERSION
	| typeof DAILY_V1_SELECTION_VERSION

/**
 * Weekly difficulty rhythm (Monday-first) — shared by v1/v2:
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

/** Frozen daily-v1 pool order (development Gallery order at freeze time). */
export const DAILY_V1_POOL_ORDER: readonly string[] = Object.freeze([
	'mini-beginner-bar',
	'mini-beginner-full',
	'mini-beginner-frame',
	'mini-easy-block',
	'mini-easy-stairs',
	'mini-easy-plus',
	'mini-medium-heart',
	'mini-medium-letter-h',
	'mini-medium-diamond',
	'mini-medium-boat',
	'mini-hard-tree',
	'mini-hard-bridge',
	'mini-hard-arrows',
	'mini-hard-window',
	'mini-easy-checker',
	'mini-easy-weave',
	'mini-medium-spiral',
	'mini-hard-frame-cross',
	'mini-medium-maze',
	'mini-expert-scatter',
	'mini-expert-lattice',
])

/** @deprecated Alias — prefer DAILY_V1_POOL_ORDER; kept for older imports. */
export const DAILY_POOL_ORDER = DAILY_V1_POOL_ORDER

export interface DailyPoolEntry {
	readonly puzzleId: string
	readonly tier: DifficultyTier
	readonly width: number
	readonly height: number
}

export interface DailyPoolIndex {
	readonly version: DailySelectionVersion
	readonly entries: readonly DailyPoolEntry[]
	readonly byTier: ReadonlyMap<DifficultyTier, readonly string[]>
}

let cachedV2: DailyPoolIndex | null = null
let cachedV1: DailyPoolIndex | null = null

/** Test helper — reset analyzer-backed cache between suites. */
export function resetDailyPoolIndexCache(): void {
	cachedV2 = null
	cachedV1 = null
}

function buildIndex(
	version: DailySelectionVersion,
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
		version,
		entries: Object.freeze([...entries]),
		byTier: byTier as ReadonlyMap<DifficultyTier, readonly string[]>,
	}
}

export function getDailyV1PoolIndex(): DailyPoolIndex {
	if (cachedV1 !== null) {
		return cachedV1
	}
	const entries: DailyPoolEntry[] = []
	for (const puzzleId of DAILY_V1_POOL_ORDER) {
		const puzzle = getLegacyPuzzleById(puzzleId)
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
	}
	cachedV1 = buildIndex(DAILY_V1_SELECTION_VERSION, entries)
	return cachedV1
}

/** Production daily-v2 pool — precomputed tiers, no analyzer at index build. */
export function getDailyPoolIndex(): DailyPoolIndex {
	if (cachedV2 !== null) {
		return cachedV2
	}
	const entries: DailyPoolEntry[] = []
	for (const puzzleId of getRuntimeDailyEligibleIds()) {
		const entry = getRuntimePuzzleEntry(puzzleId)
		if (entry === null) {
			continue
		}
		entries.push({
			puzzleId,
			tier: entry.tier,
			width: entry.width,
			height: entry.height,
		})
	}
	cachedV2 = buildIndex(DAILY_SELECTION_VERSION, entries)
	return cachedV2
}

/** Build an index from an artificial pool (tests / fallback audit). */
export function buildDailyPoolIndex(
	entries: readonly DailyPoolEntry[],
	version: DailySelectionVersion = DAILY_SELECTION_VERSION,
): DailyPoolIndex {
	return buildIndex(version, entries)
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
	readonly selectionVersion: DailySelectionVersion
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
 * Select Daily puzzle for a day key against the given index/version.
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
		`${index.version}|${dayKey}|${actual}|${pool.join(',')}`,
	)
	const result: DailySelection = {
		dayKey,
		puzzleId: pool[hash % pool.length]!,
		selectionVersion: index.version,
		desiredTier: desired,
		actualTier: actual,
	}
	memo.set(dayKey, result)
	return result
}

/** Locked daily-v1 vectors — never change. */
export const DAILY_V1_KNOWN_VECTORS: readonly {
	readonly dayKey: DayKey
	readonly puzzleId: string
}[] = Object.freeze([
	{ dayKey: '2026-09-28', puzzleId: 'mini-easy-block' },
	{ dayKey: '2026-09-29', puzzleId: 'mini-medium-diamond' },
	{ dayKey: '2026-10-04', puzzleId: 'mini-expert-lattice' },
])

/**
 * Locked daily-v2 vectors — filled after first production lock.
 * Regenerated intentionally via audit:daily when mapping must change.
 */
export const DAILY_KNOWN_VECTORS: readonly {
	readonly dayKey: DayKey
	readonly puzzleId: string
}[] = Object.freeze([
	{ dayKey: '2026-09-28', puzzleId: 's8c-b-truffle-fungus' },
	{ dayKey: '2026-09-29', puzzleId: 's8c-b-sneakers-side' },
	{ dayKey: '2026-10-04', puzzleId: 's8c-hdtram-119' },
])
