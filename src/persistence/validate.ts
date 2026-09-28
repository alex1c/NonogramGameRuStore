/**
 * Save validation — never trust JSON.parse output blindly.
 */

import { PlayerCell } from '../domain/nonogram/types'
import { deserializePlayerState } from '../domain/nonogram/playerState'
import { PaintTool } from '../gameplay/tools'
import { CURRENT_SAVE_SCHEMA_VERSION, type SaveRoot } from './schema'
import { createDefaultSave } from './createDefaultSave'

const PAINT_TOOLS: ReadonlySet<string> = new Set(Object.values(PaintTool))
const PLAYER_CELLS: ReadonlySet<string> = new Set(Object.values(PlayerCell))

export type SaveParseOutcome =
	| { readonly ok: true; readonly save: SaveRoot }
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

function parseActiveGame(raw: unknown): SaveRoot['activeGame'] | null | false {
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
	if (
		typeof record.tool !== 'string' ||
		!PAINT_TOOLS.has(record.tool)
	) {
		return false
	}
	if (!isNonNegativeInt(record.restartCountThisRun)) {
		return false
	}

	try {
		const player = deserializePlayerState(record.player)
		// Extra cell-token guard after deserialize (defensive).
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

/**
 * Validate an unknown object into a frozen SaveRoot.
 * Returns a reason string on failure (caller decides recovery).
 */
export function parseAndValidateSave(raw: unknown): SaveParseOutcome {
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
	const statistics = parseStatistics(record.statistics)
	if (statistics === null) {
		return { ok: false, reason: 'Invalid statistics' }
	}
	const bestTimes = parseBestTimes(record.bestTimes)
	if (bestTimes === null) {
		return { ok: false, reason: 'Invalid bestTimes' }
	}
	const activeGame = parseActiveGame(record.activeGame)
	if (activeGame === false) {
		return { ok: false, reason: 'Invalid activeGame' }
	}

	return {
		ok: true,
		save: Object.freeze({
			schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
			activeGame,
			completedPuzzleIds: Object.freeze(completedPuzzleIds),
			startedPuzzleIds: Object.freeze(startedPuzzleIds),
			bestTimes,
			statistics,
		}),
	}
}

/** Deep-freeze helper after controlled mutations (already frozen fields). */
export function freezeSave(save: SaveRoot): SaveRoot {
	return Object.freeze({
		...save,
		activeGame:
			save.activeGame === null ? null : Object.freeze({ ...save.activeGame }),
		completedPuzzleIds: Object.freeze([...save.completedPuzzleIds]),
		startedPuzzleIds: Object.freeze([...save.startedPuzzleIds]),
		bestTimes: Object.freeze(save.bestTimes.map((item) => Object.freeze({ ...item }))),
		statistics: Object.freeze({ ...save.statistics }),
	})
}

export function recoveredDefaultSave(): SaveRoot {
	return createDefaultSave()
}
