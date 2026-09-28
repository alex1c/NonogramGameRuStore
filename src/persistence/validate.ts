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

function parseStatistics(raw: unknown): SaveRoot['statistics'] | null {
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
	} = {
		totalCompletions: 0,
		totalActiveSolveTimeMs: 0,
		totalRestarts: 0,
		totalUndoActions: 0,
		totalRedoActions: 0,
	}
	for (const key of keys) {
		const value = record[key]
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

/**
 * Migrate a validated v1 document to v2.
 * solvedPuzzleIds = completedPuzzleIds (pre-Daily every solve was campaign).
 * dailyStartedDay = null (no fake missed history on update).
 */
export function migrateV1DocumentToV2(v1: SaveRootV1): SaveRoot {
	return Object.freeze({
		schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
		activeGame: v1.activeGame,
		activeDailyGame: null,
		completedPuzzleIds: Object.freeze([...v1.completedPuzzleIds]),
		solvedPuzzleIds: Object.freeze([...v1.completedPuzzleIds]),
		startedPuzzleIds: Object.freeze([...v1.startedPuzzleIds]),
		bestTimes: v1.bestTimes,
		statistics: v1.statistics,
		dailyCompletionRecords: Object.freeze([] as DailyCompletionRecordSave[]),
		restoredDailyDays: Object.freeze([] as DayKey[]),
		dailyStartedDay: null,
	})
}

/**
 * Validate an unknown object into a frozen SaveRoot (schema v2).
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
	})
}

export function recoveredDefaultSave(): SaveRoot {
	return createDefaultSave()
}
