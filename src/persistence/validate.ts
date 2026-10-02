/**
 * Save validation — never trust JSON.parse output blindly.
 * Supports schema v1 (migration source) and schema v2 (current).
 */

import { PlayerCell } from '../domain/nonogram/types'
import { deserializePlayerState } from '../domain/nonogram/playerState'
import { PaintTool } from '../gameplay/tools'
import { isValidDayKey, type DayKey } from '../daily/dateUtils'
import { DAILY_EPOCH_DAY } from '../daily/dateUtils'
import {
	CURRENT_SAVE_SCHEMA_VERSION,
	type ActiveDailyGameSave,
	type ActiveGameSave,
	type DailyCompletionRecordSave,
	type SaveRoot,
} from './schema'
import { createDefaultSave } from './createDefaultSave'
import { seedStickyAchievementIdsFromLegacyV3 } from '../achievements/legacyV3Seed'
import { normalizeStickyAchievementIds } from '../achievements/sticky'

const PAINT_TOOLS: ReadonlySet<string> = new Set(Object.values(PaintTool))
const PLAYER_CELLS: ReadonlySet<string> = new Set(Object.values(PlayerCell))

export type SaveParseOutcome =
	| { readonly ok: true; readonly save: SaveRoot }
	| { readonly ok: false; readonly reason: string }

/** Intermediate v1 document used only during migration. */
export interface SaveRootV1 {
	readonly schemaVersion: 1
	readonly activeGame: ActiveGameSave | null
	readonly completedPuzzleIds: readonly string[]
	readonly startedPuzzleIds: readonly string[]
	readonly bestTimes: SaveRoot['bestTimes']
	readonly statistics: SaveRoot['statistics']
}

export type SaveParseOutcomeV1 =
	| { readonly ok: true; readonly save: SaveRootV1 }
	| { readonly ok: false; readonly reason: string }

function isNonNegativeInt(value: unknown): value is number {
	return (
		typeof value === 'number' &&
		Number.isFinite(value) &&
		Number.isInteger(value) &&
		value >= 0
	)
}

/** Non-negative int capped at maxInclusive; null if invalid. */
function parseNonNegIntCap(
	value: unknown,
	maxInclusive: number,
): number | null {
	if (!isNonNegativeInt(value) || value > maxInclusive) {
		return null
	}
	return value
}

function normalizeUniqueIds(raw: unknown): string[] | null {
	if (!Array.isArray(raw)) {
		return null
	}
	const out: string[] = []
	const seen = new Set<string>()
	for (const item of raw) {
		if (typeof item !== 'string' || item.length === 0) {
			return null
		}
		if (!seen.has(item)) {
			seen.add(item)
			out.push(item)
		}
	}
	return out
}

function parseStatistics(
	raw: unknown,
	options: { readonly requireHintCounters: boolean } = {
		requireHintCounters: true,
	},
): SaveRoot['statistics'] | null {
	if (raw === null || typeof raw !== 'object') {
		return null
	}
	const record = raw as Record<string, unknown>
	const keys = [
		'totalCompletions',
		'totalActiveSolveTimeMs',
		'totalRestarts',
		'totalUndoActions',
		'totalRedoActions',
	] as const
	const stats: {
		totalCompletions: number
		totalActiveSolveTimeMs: number
		totalRestarts: number
		totalUndoActions: number
		totalRedoActions: number
		hintRequests: number
		hintsApplied: number
		teachMeViews: number
	} = {
		totalCompletions: 0,
		totalActiveSolveTimeMs: 0,
		totalRestarts: 0,
		totalUndoActions: 0,
		totalRedoActions: 0,
		hintRequests: 0,
		hintsApplied: 0,
		teachMeViews: 0,
	}
	for (const key of keys) {
		const value = record[key]
		if (!isNonNegativeInt(value)) {
			return null
		}
		stats[key] = value
	}
	const hintKeys = ['hintRequests', 'hintsApplied', 'teachMeViews'] as const
	for (const key of hintKeys) {
		const value = record[key]
		if (value === undefined) {
			if (options.requireHintCounters) {
				return null
			}
			stats[key] = 0
			continue
		}
		if (!isNonNegativeInt(value)) {
			return null
		}
		stats[key] = value
	}
	return Object.freeze({
		totalCompletions: stats.totalCompletions,
		totalActiveSolveTimeMs: stats.totalActiveSolveTimeMs,
		totalRestarts: stats.totalRestarts,
		totalUndoActions: stats.totalUndoActions,
		totalRedoActions: stats.totalRedoActions,
		hintRequests: stats.hintRequests,
		hintsApplied: stats.hintsApplied,
		teachMeViews: stats.teachMeViews,
	})
}

function parseBestTimes(raw: unknown): SaveRoot['bestTimes'] | null {
	if (!Array.isArray(raw)) {
		return null
	}
	const out: SaveRoot['bestTimes'][number][] = []
	const seen = new Set<string>()
	for (const item of raw) {
		if (item === null || typeof item !== 'object') {
			return null
		}
		const record = item as Record<string, unknown>
		if (typeof record.puzzleId !== 'string' || record.puzzleId.length === 0) {
			return null
		}
		if (!isNonNegativeInt(record.bestActiveTimeMs)) {
			return null
		}
		if (seen.has(record.puzzleId)) {
			continue
		}
		seen.add(record.puzzleId)
		out.push(
			Object.freeze({
				puzzleId: record.puzzleId,
				bestActiveTimeMs: record.bestActiveTimeMs,
			}),
		)
	}
	return Object.freeze(out)
}

function parseActiveGameShared(
	raw: unknown,
): ActiveGameSave | null | false {
	if (raw === null) {
		return null
	}
	if (typeof raw !== 'object') {
		return false
	}
	const record = raw as Record<string, unknown>
	if (typeof record.puzzleId !== 'string' || record.puzzleId.length === 0) {
		return false
	}
	if (
		typeof record.contentFingerprint !== 'string' ||
		record.contentFingerprint.length === 0
	) {
		return false
	}
	if (!isNonNegativeInt(record.accumulatedActiveMs)) {
		return false
	}
	if (!isNonNegativeInt(record.startedAtMs)) {
		return false
	}
	if (!isNonNegativeInt(record.savedAtMs)) {
		return false
	}
	if (typeof record.tool !== 'string' || !PAINT_TOOLS.has(record.tool)) {
		return false
	}
	if (!isNonNegativeInt(record.restartCountThisRun)) {
		return false
	}
	const hintsUsedThisRun =
		record.hintsUsedThisRun === undefined
			? 0
			: isNonNegativeInt(record.hintsUsedThisRun)
				? record.hintsUsedThisRun
				: null
	if (hintsUsedThisRun === null) {
		return false
	}

	try {
		const player = deserializePlayerState(record.player)
		for (const cell of player.cells) {
			if (!PLAYER_CELLS.has(cell)) {
				return false
			}
		}
		return Object.freeze({
			puzzleId: record.puzzleId,
			contentFingerprint: record.contentFingerprint,
			player: Object.freeze({
				version: 1 as const,
				width: player.width,
				height: player.height,
				cells: Object.freeze(Array.from(player.cells)),
			}),
			accumulatedActiveMs: record.accumulatedActiveMs,
			startedAtMs: record.startedAtMs,
			savedAtMs: record.savedAtMs,
			tool: record.tool as PaintTool,
			restartCountThisRun: record.restartCountThisRun,
			hintsUsedThisRun,
		})
	} catch {
		return false
	}
}

function parseActiveDailyGame(
	raw: unknown,
): ActiveDailyGameSave | null | false {
	if (raw === null || raw === undefined) {
		return null
	}
	if (typeof raw !== 'object') {
		return false
	}
	const record = raw as Record<string, unknown>
	if (typeof record.dayKey !== 'string' || !isValidDayKey(record.dayKey)) {
		return false
	}
	if (
		typeof record.selectionVersion !== 'string' ||
		record.selectionVersion.length === 0
	) {
		return false
	}
	const base = parseActiveGameShared({
		puzzleId: record.puzzleId,
		contentFingerprint: record.contentFingerprint,
		player: record.player,
		accumulatedActiveMs: record.accumulatedActiveMs,
		startedAtMs: record.startedAtMs,
		savedAtMs: record.savedAtMs,
		tool: record.tool,
		restartCountThisRun: record.restartCountThisRun,
		hintsUsedThisRun: record.hintsUsedThisRun,
	})
	if (base === false || base === null) {
		return false
	}
	return Object.freeze({
		dayKey: record.dayKey,
		puzzleId: base.puzzleId,
		selectionVersion: record.selectionVersion,
		contentFingerprint: base.contentFingerprint,
		player: base.player,
		accumulatedActiveMs: base.accumulatedActiveMs,
		startedAtMs: base.startedAtMs,
		savedAtMs: base.savedAtMs,
		tool: base.tool,
		restartCountThisRun: base.restartCountThisRun,
		hintsUsedThisRun: base.hintsUsedThisRun,
	})
}

/**
 * Normalize Daily completion records:
 * - valid dayKey >= epoch
 * - unique dayKey (first wins)
 * - reject future relative to optional today (caller may pass null)
 */
function parseDailyCompletionRecords(
	raw: unknown,
	today: DayKey | null,
): readonly DailyCompletionRecordSave[] | null {
	if (raw === undefined) {
		return Object.freeze([])
	}
	if (!Array.isArray(raw)) {
		return null
	}
	const out: DailyCompletionRecordSave[] = []
	const seen = new Set<string>()
	for (const item of raw) {
		if (item === null || typeof item !== 'object') {
			continue // skip malformed entries (safe recovery)
		}
		const record = item as Record<string, unknown>
		if (typeof record.dayKey !== 'string' || !isValidDayKey(record.dayKey)) {
			continue
		}
		if (record.dayKey < DAILY_EPOCH_DAY) {
			continue
		}
		if (today !== null && record.dayKey > today) {
			continue // future completion corruption
		}
		if (typeof record.puzzleId !== 'string' || record.puzzleId.length === 0) {
			continue
		}
		if (
			typeof record.selectionVersion !== 'string' ||
			record.selectionVersion.length === 0
		) {
			continue
		}
		if (!isNonNegativeInt(record.activeTimeMs)) {
			continue
		}
		if (seen.has(record.dayKey)) {
			continue
		}
		seen.add(record.dayKey)
		out.push(
			Object.freeze({
				dayKey: record.dayKey,
				puzzleId: record.puzzleId,
				selectionVersion: record.selectionVersion,
				activeTimeMs: record.activeTimeMs,
			}),
		)
	}
	return Object.freeze(out)
}

function parseRestoredDays(
	raw: unknown,
	today: DayKey | null,
	completedKeys: ReadonlySet<string>,
): readonly DayKey[] {
	if (raw === undefined || raw === null) {
		return Object.freeze([])
	}
	if (!Array.isArray(raw)) {
		return Object.freeze([])
	}
	const out: DayKey[] = []
	const seen = new Set<string>()
	for (const item of raw) {
		if (typeof item !== 'string' || !isValidDayKey(item)) {
			continue
		}
		if (item < DAILY_EPOCH_DAY) {
			continue
		}
		if (today !== null && item > today) {
			continue
		}
		if (completedKeys.has(item)) {
			continue
		}
		if (seen.has(item)) {
			continue
		}
		seen.add(item)
		out.push(item)
	}
	return Object.freeze(out)
}

function parseDailyStartedDay(raw: unknown): DayKey | null | false {
	if (raw === null || raw === undefined) {
		return null
	}
	if (typeof raw !== 'string' || !isValidDayKey(raw)) {
		return false
	}
	return raw
}

/** Validate Phase 5 / schema v1 document (migration source only). */
export function parseAndValidateSaveV1(raw: unknown): SaveParseOutcomeV1 {
	if (raw === null || typeof raw !== 'object') {
		return { ok: false, reason: 'Save root must be an object' }
	}
	const record = raw as Record<string, unknown>
	if (record.schemaVersion !== 1) {
		return {
			ok: false,
			reason: `Expected schemaVersion 1, got ${String(record.schemaVersion)}`,
		}
	}
	const completedPuzzleIds = normalizeUniqueIds(record.completedPuzzleIds)
	if (completedPuzzleIds === null) {
		return { ok: false, reason: 'Invalid completedPuzzleIds' }
	}
	const startedPuzzleIds = normalizeUniqueIds(record.startedPuzzleIds)
	if (startedPuzzleIds === null) {
		return { ok: false, reason: 'Invalid startedPuzzleIds' }
	}
	const statistics = parseStatistics(record.statistics, {
		requireHintCounters: false,
	})
	if (statistics === null) {
		return { ok: false, reason: 'Invalid statistics' }
	}
	const bestTimes = parseBestTimes(record.bestTimes)
	if (bestTimes === null) {
		return { ok: false, reason: 'Invalid bestTimes' }
	}
	const activeGame = parseActiveGameShared(record.activeGame)
	if (activeGame === false) {
		return { ok: false, reason: 'Invalid activeGame' }
	}
	return {
		ok: true,
		save: Object.freeze({
			schemaVersion: 1 as const,
			activeGame,
			completedPuzzleIds: Object.freeze(completedPuzzleIds),
			startedPuzzleIds: Object.freeze(startedPuzzleIds),
			bestTimes,
			statistics,
		}),
	}
}

function withHintDefaultsOnActive(
	active: ActiveGameSave | null,
): ActiveGameSave | null {
	if (active === null) {
		return null
	}
	return Object.freeze({
		...active,
		hintsUsedThisRun: active.hintsUsedThisRun ?? 0,
	})
}

function withHintDefaultsOnDaily(
	active: ActiveDailyGameSave | null,
): ActiveDailyGameSave | null {
	if (active === null) {
		return null
	}
	return Object.freeze({
		...active,
		hintsUsedThisRun: active.hintsUsedThisRun ?? 0,
	})
}

/**
 * Migrate a validated v1 document to current (via v2→v3→v4→v5→v6→v7).
 * solvedPuzzleIds = completedPuzzleIds; dailyStartedDay = null; hint counters = 0.
 */
export function migrateV1DocumentToV2(
	v1: SaveRootV1,
	today: DayKey = DAILY_EPOCH_DAY,
): SaveRoot {
	return migrateV6DocumentToV7(
		migrateV5DocumentToV6(
			migrateV4DocumentToV5(
				migrateV3DocumentToV4(
					migrateV2DocumentToV3({
						schemaVersion: 2,
						activeGame: withHintDefaultsOnActive(v1.activeGame),
						activeDailyGame: null,
						completedPuzzleIds: Object.freeze([
							...v1.completedPuzzleIds,
						]),
						solvedPuzzleIds: Object.freeze([
							...v1.completedPuzzleIds,
						]),
						startedPuzzleIds: Object.freeze([...v1.startedPuzzleIds]),
						bestTimes: v1.bestTimes,
						statistics: Object.freeze({
							...v1.statistics,
							hintRequests: 0,
							hintsApplied: 0,
							teachMeViews: 0,
						}),
						dailyCompletionRecords: Object.freeze(
							[] as DailyCompletionRecordSave[],
						),
						restoredDailyDays: Object.freeze([] as DayKey[]),
						dailyStartedDay: null,
					}),
				),
			),
			today,
		),
	)
}

/** Intermediate v2 shape used only during migration. */
export interface SaveRootV2 {
	readonly schemaVersion: 2
	readonly activeGame: ActiveGameSave | null
	readonly activeDailyGame: ActiveDailyGameSave | null
	readonly completedPuzzleIds: readonly string[]
	readonly solvedPuzzleIds: readonly string[]
	readonly startedPuzzleIds: readonly string[]
	readonly bestTimes: SaveRoot['bestTimes']
	readonly statistics: SaveRoot['statistics']
	readonly dailyCompletionRecords: readonly DailyCompletionRecordSave[]
	readonly restoredDailyDays: readonly DayKey[]
	readonly dailyStartedDay: DayKey | null
}

export type SaveParseOutcomeV2 =
	| { readonly ok: true; readonly save: SaveRootV2 }
	| { readonly ok: false; readonly reason: string }

/** Validate Phase 6 / schema v2 document (migration source). */
export function parseAndValidateSaveV2(raw: unknown): SaveParseOutcomeV2 {
	if (raw === null || typeof raw !== 'object') {
		return { ok: false, reason: 'Save root must be an object' }
	}
	const record = raw as Record<string, unknown>
	if (record.schemaVersion !== 2) {
		return {
			ok: false,
			reason: `Expected schemaVersion 2, got ${String(record.schemaVersion)}`,
		}
	}
	const completedPuzzleIds = normalizeUniqueIds(record.completedPuzzleIds)
	if (completedPuzzleIds === null) {
		return { ok: false, reason: 'Invalid completedPuzzleIds' }
	}
	const startedPuzzleIds = normalizeUniqueIds(record.startedPuzzleIds)
	if (startedPuzzleIds === null) {
		return { ok: false, reason: 'Invalid startedPuzzleIds' }
	}
	let solvedPuzzleIds = normalizeUniqueIds(
		record.solvedPuzzleIds ?? record.completedPuzzleIds,
	)
	if (solvedPuzzleIds === null) {
		return { ok: false, reason: 'Invalid solvedPuzzleIds' }
	}
	const solvedSet = new Set(solvedPuzzleIds)
	for (const id of completedPuzzleIds) {
		if (!solvedSet.has(id)) {
			solvedPuzzleIds = [...solvedPuzzleIds, id]
			solvedSet.add(id)
		}
	}
	const statistics = parseStatistics(record.statistics, {
		requireHintCounters: false,
	})
	if (statistics === null) {
		return { ok: false, reason: 'Invalid statistics' }
	}
	const bestTimes = parseBestTimes(record.bestTimes)
	if (bestTimes === null) {
		return { ok: false, reason: 'Invalid bestTimes' }
	}
	const activeGame = parseActiveGameShared(record.activeGame)
	if (activeGame === false) {
		return { ok: false, reason: 'Invalid activeGame' }
	}
	const activeDailyGame = parseActiveDailyGame(record.activeDailyGame)
	if (activeDailyGame === false) {
		return { ok: false, reason: 'Invalid activeDailyGame' }
	}
	const dailyCompletionRecords = parseDailyCompletionRecords(
		record.dailyCompletionRecords,
		null,
	)
	if (dailyCompletionRecords === null) {
		return { ok: false, reason: 'Invalid dailyCompletionRecords' }
	}
	const completedDailyKeys = new Set(
		dailyCompletionRecords.map((r) => r.dayKey),
	)
	const restoredDailyDays = parseRestoredDays(
		record.restoredDailyDays,
		null,
		completedDailyKeys,
	)
	const dailyStartedDay = parseDailyStartedDay(record.dailyStartedDay)
	if (dailyStartedDay === false) {
		return { ok: false, reason: 'Invalid dailyStartedDay' }
	}
	return {
		ok: true,
		save: Object.freeze({
			schemaVersion: 2 as const,
			activeGame,
			activeDailyGame,
			completedPuzzleIds: Object.freeze(completedPuzzleIds),
			solvedPuzzleIds: Object.freeze(solvedPuzzleIds),
			startedPuzzleIds: Object.freeze(startedPuzzleIds),
			bestTimes,
			statistics,
			dailyCompletionRecords,
			restoredDailyDays,
			dailyStartedDay,
		}),
	}
}

/** Intermediate v3 shape used only during migration (pre-sticky). */
export interface SaveRootV3 {
	readonly schemaVersion: 3
	readonly activeGame: ActiveGameSave | null
	readonly activeDailyGame: ActiveDailyGameSave | null
	readonly completedPuzzleIds: readonly string[]
	readonly solvedPuzzleIds: readonly string[]
	readonly startedPuzzleIds: readonly string[]
	readonly bestTimes: SaveRoot['bestTimes']
	readonly statistics: SaveRoot['statistics']
	readonly dailyCompletionRecords: readonly DailyCompletionRecordSave[]
	readonly restoredDailyDays: readonly DayKey[]
	readonly dailyStartedDay: DayKey | null
}

export type SaveParseOutcomeV3 =
	| { readonly ok: true; readonly save: SaveRootV3 }
	| { readonly ok: false; readonly reason: string }

/** Migrate validated v2 → v3: hint counters default 0; hintsUsedThisRun on actives. */
export function migrateV2DocumentToV3(v2: SaveRootV2): SaveRootV3 {
	return Object.freeze({
		schemaVersion: 3,
		activeGame: withHintDefaultsOnActive(v2.activeGame),
		activeDailyGame: withHintDefaultsOnDaily(v2.activeDailyGame),
		completedPuzzleIds: Object.freeze([...v2.completedPuzzleIds]),
		solvedPuzzleIds: Object.freeze([...v2.solvedPuzzleIds]),
		startedPuzzleIds: Object.freeze([...v2.startedPuzzleIds]),
		bestTimes: v2.bestTimes,
		statistics: Object.freeze({
			totalCompletions: v2.statistics.totalCompletions,
			totalActiveSolveTimeMs: v2.statistics.totalActiveSolveTimeMs,
			totalRestarts: v2.statistics.totalRestarts,
			totalUndoActions: v2.statistics.totalUndoActions,
			totalRedoActions: v2.statistics.totalRedoActions,
			hintRequests: v2.statistics.hintRequests ?? 0,
			hintsApplied: v2.statistics.hintsApplied ?? 0,
			teachMeViews: v2.statistics.teachMeViews ?? 0,
		}),
		dailyCompletionRecords: Object.freeze(
			v2.dailyCompletionRecords.map((item) => Object.freeze({ ...item })),
		),
		restoredDailyDays: Object.freeze([...v2.restoredDailyDays]),
		dailyStartedDay: v2.dailyStartedDay,
	})
}

/** Intermediate v4 shape used only during migration to v5. */
export interface SaveRootV4 {
	readonly schemaVersion: 4
	readonly activeGame: ActiveGameSave | null
	readonly activeDailyGame: ActiveDailyGameSave | null
	readonly completedPuzzleIds: readonly string[]
	readonly solvedPuzzleIds: readonly string[]
	readonly startedPuzzleIds: readonly string[]
	readonly bestTimes: SaveRoot['bestTimes']
	readonly statistics: SaveRoot['statistics']
	readonly dailyCompletionRecords: readonly DailyCompletionRecordSave[]
	readonly restoredDailyDays: readonly DayKey[]
	readonly dailyStartedDay: DayKey | null
	readonly unlockedAchievementIds: readonly string[]
}

export type SaveParseOutcomeV4 =
	| { readonly ok: true; readonly save: SaveRootV4 }
	| { readonly ok: false; readonly reason: string }

/**
 * Migrate validated v3 → v4: seed sticky unlockedAchievementIds from legacy
 * Gallery membership. Does not celebrate; does not alter counters.
 */
export function migrateV3DocumentToV4(
	v3: SaveRootV3,
	today: DayKey | null = null,
): SaveRootV4 {
	const sticky = seedStickyAchievementIdsFromLegacyV3(
		v3,
		today ?? '2026-09-28',
	)
	return Object.freeze({
		schemaVersion: 4 as const,
		activeGame: v3.activeGame,
		activeDailyGame: v3.activeDailyGame,
		completedPuzzleIds: Object.freeze([...v3.completedPuzzleIds]),
		solvedPuzzleIds: Object.freeze([...v3.solvedPuzzleIds]),
		startedPuzzleIds: Object.freeze([...v3.startedPuzzleIds]),
		bestTimes: v3.bestTimes,
		statistics: v3.statistics,
		dailyCompletionRecords: v3.dailyCompletionRecords,
		restoredDailyDays: Object.freeze([...v3.restoredDailyDays]),
		dailyStartedDay: v3.dailyStartedDay,
		unlockedAchievementIds: sticky,
	})
}

/**
 * Migrate validated v4 → v5: add tutorial fields.
 * Existing users are NOT force-blocked into tutorial (null + offer not dismissed).
 */
export function migrateV4DocumentToV5(v4: SaveRootV4): SaveRootV5 {
	return Object.freeze({
		schemaVersion: 5 as const,
		activeGame: v4.activeGame,
		activeDailyGame: v4.activeDailyGame,
		completedPuzzleIds: Object.freeze([...v4.completedPuzzleIds]),
		solvedPuzzleIds: Object.freeze([...v4.solvedPuzzleIds]),
		startedPuzzleIds: Object.freeze([...v4.startedPuzzleIds]),
		bestTimes: v4.bestTimes,
		statistics: v4.statistics,
		dailyCompletionRecords: v4.dailyCompletionRecords,
		restoredDailyDays: Object.freeze([...v4.restoredDailyDays]),
		dailyStartedDay: v4.dailyStartedDay,
		unlockedAchievementIds: Object.freeze([...v4.unlockedAchievementIds]),
		tutorialVersionCompleted: null,
		tutorialOfferDismissed: false,
	})
}

/** Intermediate v5 shape used only during migration to v6. */
export interface SaveRootV5 {
	readonly schemaVersion: 5
	readonly activeGame: ActiveGameSave | null
	readonly activeDailyGame: ActiveDailyGameSave | null
	readonly completedPuzzleIds: readonly string[]
	readonly solvedPuzzleIds: readonly string[]
	readonly startedPuzzleIds: readonly string[]
	readonly bestTimes: SaveRoot['bestTimes']
	readonly statistics: SaveRoot['statistics']
	readonly dailyCompletionRecords: readonly DailyCompletionRecordSave[]
	readonly restoredDailyDays: readonly DayKey[]
	readonly dailyStartedDay: DayKey | null
	readonly unlockedAchievementIds: readonly string[]
	readonly tutorialVersionCompleted: number | null
	readonly tutorialOfferDismissed: boolean
}

export type SaveParseOutcomeV5 =
	| { readonly ok: true; readonly save: SaveRootV5 }
	| { readonly ok: false; readonly reason: string }

/**
 * Intermediate v6 shape used only during migration to v7.
 * Identical to the current root minus the v7 `tutorialFirstRunSkipped` field.
 */
export type SaveRootV6 = Omit<
	SaveRoot,
	'schemaVersion' | 'tutorialFirstRunSkipped'
> & { readonly schemaVersion: 6 }

export type SaveParseOutcomeV6 =
	| { readonly ok: true; readonly save: SaveRootV6 }
	| { readonly ok: false; readonly reason: string }

/**
 * Migrate validated v6 → v7: add `tutorialFirstRunSkipped` (default false).
 * Existing users keep their prior first-run behaviour (offer only when the
 * save has no progress), so no forced tutorial is introduced.
 */
export function migrateV6DocumentToV7(v6: SaveRootV6): SaveRoot {
	return freezeSave({
		...v6,
		schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
		tutorialFirstRunSkipped: false,
	})
}

/** Validate schema v6 document (migration source for v7). */
export function parseAndValidateSaveV6(raw: unknown): SaveParseOutcomeV6 {
	if (raw === null || typeof raw !== 'object') {
		return { ok: false, reason: 'Save root must be an object' }
	}
	const record = raw as Record<string, unknown>
	if (record.schemaVersion !== 6) {
		return {
			ok: false,
			reason: `Expected schemaVersion 6, got ${String(record.schemaVersion)}`,
		}
	}
	// Reuse the current-shape validator with the v7 field defaulted.
	const asCurrent = parseAndValidateSave({
		...record,
		schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
		tutorialFirstRunSkipped: false,
	})
	if (!asCurrent.ok) {
		return asCurrent
	}
	// Strip the v7-only field to obtain the v6 shape.
	const { tutorialFirstRunSkipped, ...rest } = asCurrent.save
	void tutorialFirstRunSkipped
	return {
		ok: true,
		save: Object.freeze({ ...rest, schemaVersion: 6 as const }),
	}
}

/**
 * Migrate validated v5 → v6: daily free Hint/Teach Me allowances.
 * Starts at 0 used for current local day — no retroactive charges.
 */
export function migrateV5DocumentToV6(
	v5: SaveRootV5,
	today: DayKey = '2026-09-28',
): SaveRootV6 {
	return Object.freeze({
		schemaVersion: 6 as const,
		activeGame: v5.activeGame,
		activeDailyGame: v5.activeDailyGame,
		completedPuzzleIds: Object.freeze([...v5.completedPuzzleIds]),
		solvedPuzzleIds: Object.freeze([...v5.solvedPuzzleIds]),
		startedPuzzleIds: Object.freeze([...v5.startedPuzzleIds]),
		bestTimes: v5.bestTimes,
		statistics: v5.statistics,
		dailyCompletionRecords: v5.dailyCompletionRecords,
		restoredDailyDays: Object.freeze([...v5.restoredDailyDays]),
		dailyStartedDay: v5.dailyStartedDay,
		unlockedAchievementIds: Object.freeze([...v5.unlockedAchievementIds]),
		tutorialVersionCompleted: v5.tutorialVersionCompleted,
		tutorialOfferDismissed: v5.tutorialOfferDismissed,
		helpAllowanceDay: today,
		freeHintsUsedToday: 0,
		freeTeachMeUsedToday: 0,
		pendingRewardedHints: 0,
		pendingRewardedTeachMe: 0,
	})
}

/** Validate Phase 9 / schema v5 document (migration source). */
export function parseAndValidateSaveV5(raw: unknown): SaveParseOutcomeV5 {
	if (raw === null || typeof raw !== 'object') {
		return { ok: false, reason: 'Save root must be an object' }
	}
	const record = raw as Record<string, unknown>
	if (record.schemaVersion !== 5) {
		return {
			ok: false,
			reason: `Expected schemaVersion 5, got ${String(record.schemaVersion)}`,
		}
	}
	const asCurrent = parseAndValidateSave({
		...record,
		schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
		helpAllowanceDay: '2026-09-28',
		freeHintsUsedToday: 0,
		freeTeachMeUsedToday: 0,
		pendingRewardedHints: 0,
		pendingRewardedTeachMe: 0,
	})
	if (!asCurrent.ok) {
		return asCurrent
	}
	return {
		ok: true,
		save: Object.freeze({
			schemaVersion: 5 as const,
			activeGame: asCurrent.save.activeGame,
			activeDailyGame: asCurrent.save.activeDailyGame,
			completedPuzzleIds: asCurrent.save.completedPuzzleIds,
			solvedPuzzleIds: asCurrent.save.solvedPuzzleIds,
			startedPuzzleIds: asCurrent.save.startedPuzzleIds,
			bestTimes: asCurrent.save.bestTimes,
			statistics: asCurrent.save.statistics,
			dailyCompletionRecords: asCurrent.save.dailyCompletionRecords,
			restoredDailyDays: asCurrent.save.restoredDailyDays,
			dailyStartedDay: asCurrent.save.dailyStartedDay,
			unlockedAchievementIds: asCurrent.save.unlockedAchievementIds,
			tutorialVersionCompleted: asCurrent.save.tutorialVersionCompleted,
			tutorialOfferDismissed: asCurrent.save.tutorialOfferDismissed,
		}),
	}
}

/** Validate Phase 8B / schema v4 document (migration source). */
export function parseAndValidateSaveV4(raw: unknown): SaveParseOutcomeV4 {
	if (raw === null || typeof raw !== 'object') {
		return { ok: false, reason: 'Save root must be an object' }
	}
	const record = raw as Record<string, unknown>
	if (record.schemaVersion !== 4) {
		return {
			ok: false,
			reason: `Expected schemaVersion 4, got ${String(record.schemaVersion)}`,
		}
	}
	const asCurrent = parseAndValidateSave({
		...record,
		schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
		tutorialVersionCompleted: null,
		tutorialOfferDismissed: false,
		helpAllowanceDay: '2026-09-28',
		freeHintsUsedToday: 0,
		freeTeachMeUsedToday: 0,
		pendingRewardedHints: 0,
		pendingRewardedTeachMe: 0,
	})
	if (!asCurrent.ok) {
		return asCurrent
	}
	return {
		ok: true,
		save: Object.freeze({
			schemaVersion: 4 as const,
			activeGame: asCurrent.save.activeGame,
			activeDailyGame: asCurrent.save.activeDailyGame,
			completedPuzzleIds: asCurrent.save.completedPuzzleIds,
			solvedPuzzleIds: asCurrent.save.solvedPuzzleIds,
			startedPuzzleIds: asCurrent.save.startedPuzzleIds,
			bestTimes: asCurrent.save.bestTimes,
			statistics: asCurrent.save.statistics,
			dailyCompletionRecords: asCurrent.save.dailyCompletionRecords,
			restoredDailyDays: asCurrent.save.restoredDailyDays,
			dailyStartedDay: asCurrent.save.dailyStartedDay,
			unlockedAchievementIds: asCurrent.save.unlockedAchievementIds,
		}),
	}
}

/** Validate Phase 7 / schema v3 document (migration source). */
export function parseAndValidateSaveV3(raw: unknown): SaveParseOutcomeV3 {
	if (raw === null || typeof raw !== 'object') {
		return { ok: false, reason: 'Save root must be an object' }
	}
	const record = raw as Record<string, unknown>
	if (record.schemaVersion !== 3) {
		return {
			ok: false,
			reason: `Expected schemaVersion 3, got ${String(record.schemaVersion)}`,
		}
	}
	// Reuse v2 field validators by temporarily treating as v2-shaped.
	const asV2 = parseAndValidateSaveV2({ ...record, schemaVersion: 2 })
	if (!asV2.ok) {
		return asV2
	}
	return {
		ok: true,
		save: Object.freeze({
			...asV2.save,
			schemaVersion: 3 as const,
			activeGame: withHintDefaultsOnActive(asV2.save.activeGame),
			activeDailyGame: withHintDefaultsOnDaily(asV2.save.activeDailyGame),
		}),
	}
}

/**
 * Validate an unknown object into a frozen SaveRoot (schema v3).
 * Optional today rejects future Daily corruption; pass null to skip.
 */
export function parseAndValidateSave(
	raw: unknown,
	today: DayKey | null = null,
): SaveParseOutcome {
	if (raw === null || typeof raw !== 'object') {
		return { ok: false, reason: 'Save root must be an object' }
	}
	const record = raw as Record<string, unknown>

	if (record.schemaVersion !== CURRENT_SAVE_SCHEMA_VERSION) {
		return {
			ok: false,
			reason: `Unsupported schemaVersion: ${String(record.schemaVersion)}`,
		}
	}

	const completedPuzzleIds = normalizeUniqueIds(record.completedPuzzleIds)
	if (completedPuzzleIds === null) {
		return { ok: false, reason: 'Invalid completedPuzzleIds' }
	}
	const startedPuzzleIds = normalizeUniqueIds(record.startedPuzzleIds)
	if (startedPuzzleIds === null) {
		return { ok: false, reason: 'Invalid startedPuzzleIds' }
	}
	// solvedPuzzleIds may be missing on half-migrated payloads → default to completed
	let solvedPuzzleIds = normalizeUniqueIds(
		record.solvedPuzzleIds ?? record.completedPuzzleIds,
	)
	if (solvedPuzzleIds === null) {
		return { ok: false, reason: 'Invalid solvedPuzzleIds' }
	}
	// Ensure campaign completions are subset of solved (normalize)
	const solvedSet = new Set(solvedPuzzleIds)
	for (const id of completedPuzzleIds) {
		if (!solvedSet.has(id)) {
			solvedPuzzleIds = [...solvedPuzzleIds, id]
			solvedSet.add(id)
		}
	}

	const statistics = parseStatistics(record.statistics)
	if (statistics === null) {
		return { ok: false, reason: 'Invalid statistics' }
	}
	const bestTimes = parseBestTimes(record.bestTimes)
	if (bestTimes === null) {
		return { ok: false, reason: 'Invalid bestTimes' }
	}
	const activeGame = parseActiveGameShared(record.activeGame)
	if (activeGame === false) {
		return { ok: false, reason: 'Invalid activeGame' }
	}
	const activeDailyGame = parseActiveDailyGame(record.activeDailyGame)
	if (activeDailyGame === false) {
		return { ok: false, reason: 'Invalid activeDailyGame' }
	}
	const dailyCompletionRecords = parseDailyCompletionRecords(
		record.dailyCompletionRecords,
		today,
	)
	if (dailyCompletionRecords === null) {
		return { ok: false, reason: 'Invalid dailyCompletionRecords' }
	}
	const completedDailyKeys = new Set(
		dailyCompletionRecords.map((r) => r.dayKey),
	)
	const restoredDailyDays = parseRestoredDays(
		record.restoredDailyDays,
		today,
		completedDailyKeys,
	)
	const dailyStartedDay = parseDailyStartedDay(record.dailyStartedDay)
	if (dailyStartedDay === false) {
		return { ok: false, reason: 'Invalid dailyStartedDay' }
	}

	const unlockedAchievementIds = normalizeStickyAchievementIds(
		record.unlockedAchievementIds,
	)

	// Tutorial fields (v5): accept missing → null/false for forward-compat parses.
	let tutorialVersionCompleted: number | null = null
	if (
		record.tutorialVersionCompleted !== undefined &&
		record.tutorialVersionCompleted !== null
	) {
		if (
			typeof record.tutorialVersionCompleted !== 'number' ||
			!Number.isInteger(record.tutorialVersionCompleted) ||
			record.tutorialVersionCompleted < 1
		) {
			return { ok: false, reason: 'Invalid tutorialVersionCompleted' }
		}
		tutorialVersionCompleted = record.tutorialVersionCompleted
	}
	const tutorialOfferDismissed =
		record.tutorialOfferDismissed === undefined
			? false
			: record.tutorialOfferDismissed === true
	if (
		record.tutorialOfferDismissed !== undefined &&
		typeof record.tutorialOfferDismissed !== 'boolean'
	) {
		return { ok: false, reason: 'Invalid tutorialOfferDismissed' }
	}
	// v7: missing → false for forward-compat parses of older documents.
	if (
		record.tutorialFirstRunSkipped !== undefined &&
		typeof record.tutorialFirstRunSkipped !== 'boolean'
	) {
		return { ok: false, reason: 'Invalid tutorialFirstRunSkipped' }
	}
	const tutorialFirstRunSkipped = record.tutorialFirstRunSkipped === true

	const helpAllowanceDayRaw = record.helpAllowanceDay
	if (
		typeof helpAllowanceDayRaw !== 'string' ||
		!isValidDayKey(helpAllowanceDayRaw)
	) {
		return { ok: false, reason: 'Invalid helpAllowanceDay' }
	}
	const helpAllowanceDay = helpAllowanceDayRaw
	const freeHintsUsedToday = parseNonNegIntCap(
		record.freeHintsUsedToday,
		10_000,
	)
	const freeTeachMeUsedToday = parseNonNegIntCap(
		record.freeTeachMeUsedToday,
		10_000,
	)
	const pendingRewardedHints = parseNonNegIntCap(
		record.pendingRewardedHints,
		1,
	)
	const pendingRewardedTeachMe = parseNonNegIntCap(
		record.pendingRewardedTeachMe,
		1,
	)
	if (
		freeHintsUsedToday === null ||
		freeTeachMeUsedToday === null ||
		pendingRewardedHints === null ||
		pendingRewardedTeachMe === null
	) {
		return { ok: false, reason: 'Invalid help allowance counters' }
	}

	// Stale activeDaily that matches a completed day → clear
	let normalizedDaily = activeDailyGame
	if (
		normalizedDaily !== null &&
		completedDailyKeys.has(normalizedDaily.dayKey)
	) {
		normalizedDaily = null
	}
	// Future activeDaily → clear
	if (
		normalizedDaily !== null &&
		today !== null &&
		normalizedDaily.dayKey > today
	) {
		normalizedDaily = null
	}

	return {
		ok: true,
		save: Object.freeze({
			schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
			activeGame,
			activeDailyGame: normalizedDaily,
			completedPuzzleIds: Object.freeze(completedPuzzleIds),
			solvedPuzzleIds: Object.freeze(solvedPuzzleIds),
			startedPuzzleIds: Object.freeze(startedPuzzleIds),
			bestTimes,
			statistics,
			dailyCompletionRecords,
			restoredDailyDays,
			dailyStartedDay,
			unlockedAchievementIds,
			tutorialVersionCompleted,
			tutorialOfferDismissed,
			tutorialFirstRunSkipped,
			helpAllowanceDay,
			freeHintsUsedToday,
			freeTeachMeUsedToday,
			pendingRewardedHints,
			pendingRewardedTeachMe,
		}),
	}
}

/** Deep-freeze helper after controlled mutations. */
export function freezeSave(save: SaveRoot): SaveRoot {
	return Object.freeze({
		...save,
		activeGame:
			save.activeGame === null
				? null
				: Object.freeze({ ...save.activeGame }),
		activeDailyGame:
			save.activeDailyGame === null
				? null
				: Object.freeze({ ...save.activeDailyGame }),
		completedPuzzleIds: Object.freeze([...save.completedPuzzleIds]),
		solvedPuzzleIds: Object.freeze([...save.solvedPuzzleIds]),
		startedPuzzleIds: Object.freeze([...save.startedPuzzleIds]),
		bestTimes: Object.freeze(
			save.bestTimes.map((item) => Object.freeze({ ...item })),
		),
		statistics: Object.freeze({ ...save.statistics }),
		dailyCompletionRecords: Object.freeze(
			save.dailyCompletionRecords.map((item) =>
				Object.freeze({ ...item }),
			),
		),
		restoredDailyDays: Object.freeze([...save.restoredDailyDays]),
		dailyStartedDay: save.dailyStartedDay,
		unlockedAchievementIds: Object.freeze([
			...save.unlockedAchievementIds,
		]),
		tutorialVersionCompleted: save.tutorialVersionCompleted,
		tutorialOfferDismissed: save.tutorialOfferDismissed,
		tutorialFirstRunSkipped: save.tutorialFirstRunSkipped,
		helpAllowanceDay: save.helpAllowanceDay,
		freeHintsUsedToday: save.freeHintsUsedToday,
		freeTeachMeUsedToday: save.freeTeachMeUsedToday,
		pendingRewardedHints: save.pendingRewardedHints,
		pendingRewardedTeachMe: save.pendingRewardedTeachMe,
	})
}

export function recoveredDefaultSave(): SaveRoot {
	return createDefaultSave()
}
