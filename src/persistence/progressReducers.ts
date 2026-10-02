/**
 * Pure progress transitions — repository only handles I/O.
 * Campaign and Daily active games coexist; reducers update only the needed branch.
 */

import { serializePlayerState } from '../domain/nonogram/playerState'
import type { PlayerState, Puzzle } from '../domain/nonogram/types'
import { PaintTool } from '../gameplay/tools'
import type { DayKey } from '../daily/dateUtils'
import {
	consumeHintApply as consumeHintApplyPure,
	consumeTeachMeReveal as consumeTeachMeRevealPure,
	grantRewardedHintEntitlement as grantRewardedHintPure,
	grantRewardedTeachMeEntitlement as grantRewardedTeachMePure,
	rollHelpAllowanceToDay,
	type HelpAllowanceState,
} from '../help/allowance'
import { buildPuzzleContentFingerprint } from './fingerprint'
import { createDefaultSave } from './createDefaultSave'
import type {
	ActiveDailyGameSave,
	ActiveGameSave,
	DailyCompletionRecordSave,
	PuzzleBestTime,
	SaveRoot,
} from './schema'
import { freezeSave } from './validate'

function withUniqueId(
	ids: readonly string[],
	id: string,
): readonly string[] {
	if (ids.includes(id)) {
		return ids
	}
	return Object.freeze([...ids, id])
}

function upsertBestTime(
	bestTimes: readonly PuzzleBestTime[],
	puzzleId: string,
	activeTimeMs: number,
): readonly PuzzleBestTime[] {
	const existing = bestTimes.find((item) => item.puzzleId === puzzleId)
	if (existing === undefined) {
		return Object.freeze([
			...bestTimes,
			Object.freeze({ puzzleId, bestActiveTimeMs: activeTimeMs }),
		])
	}
	if (activeTimeMs >= existing.bestActiveTimeMs) {
		return bestTimes
	}
	return Object.freeze(
		bestTimes.map((item) =>
			item.puzzleId === puzzleId
				? Object.freeze({ puzzleId, bestActiveTimeMs: activeTimeMs })
				: item,
		),
	)
}

export function createActiveGameSave(input: {
	readonly puzzle: Puzzle
	readonly player: PlayerState
	readonly accumulatedActiveMs: number
	readonly startedAtMs: number
	readonly savedAtMs: number
	readonly tool: PaintTool
	readonly restartCountThisRun: number
	readonly hintsUsedThisRun?: number
}): ActiveGameSave {
	return Object.freeze({
		puzzleId: input.puzzle.id,
		contentFingerprint: buildPuzzleContentFingerprint(input.puzzle),
		player: serializePlayerState(input.player),
		accumulatedActiveMs: Math.max(0, input.accumulatedActiveMs),
		startedAtMs: input.startedAtMs,
		savedAtMs: input.savedAtMs,
		tool: input.tool,
		restartCountThisRun: Math.max(0, input.restartCountThisRun),
		hintsUsedThisRun: Math.max(0, input.hintsUsedThisRun ?? 0),
	})
}

export function createActiveDailyGameSave(input: {
	readonly dayKey: DayKey
	readonly puzzle: Puzzle
	readonly selectionVersion: string
	readonly player: PlayerState
	readonly accumulatedActiveMs: number
	readonly startedAtMs: number
	readonly savedAtMs: number
	readonly tool: PaintTool
	readonly restartCountThisRun: number
	readonly hintsUsedThisRun?: number
}): ActiveDailyGameSave {
	return Object.freeze({
		dayKey: input.dayKey,
		puzzleId: input.puzzle.id,
		selectionVersion: input.selectionVersion,
		contentFingerprint: buildPuzzleContentFingerprint(input.puzzle),
		player: serializePlayerState(input.player),
		accumulatedActiveMs: Math.max(0, input.accumulatedActiveMs),
		startedAtMs: input.startedAtMs,
		savedAtMs: input.savedAtMs,
		tool: input.tool,
		restartCountThisRun: Math.max(0, input.restartCountThisRun),
		hintsUsedThisRun: Math.max(0, input.hintsUsedThisRun ?? 0),
	})
}

/** Mark a puzzle as started (campaign-oriented unique set). */
export function markPuzzleStarted(save: SaveRoot, puzzleId: string): SaveRoot {
	return freezeSave({
		...save,
		startedPuzzleIds: withUniqueId(save.startedPuzzleIds, puzzleId),
	})
}

/** Replace or clear the Campaign unfinished party (Daily untouched). */
export function setActiveGame(
	save: SaveRoot,
	activeGame: ActiveGameSave | null,
): SaveRoot {
	return freezeSave({
		...save,
		activeGame,
	})
}

/** Replace or clear the Daily unfinished party (Campaign untouched). */
export function setActiveDailyGame(
	save: SaveRoot,
	activeDailyGame: ActiveDailyGameSave | null,
): SaveRoot {
	return freezeSave({
		...save,
		activeDailyGame,
	})
}

export function persistActivePlayerState(
	save: SaveRoot,
	input: {
		readonly puzzle: Puzzle
		readonly player: PlayerState
		readonly accumulatedActiveMs: number
		readonly tool: PaintTool
		readonly savedAtMs: number
		readonly restartCountThisRun: number
		readonly hintsUsedThisRun?: number
	},
): SaveRoot {
	const startedAtMs = save.activeGame?.startedAtMs ?? input.savedAtMs
	const active = createActiveGameSave({
		puzzle: input.puzzle,
		player: input.player,
		accumulatedActiveMs: input.accumulatedActiveMs,
		startedAtMs,
		savedAtMs: input.savedAtMs,
		tool: input.tool,
		restartCountThisRun: input.restartCountThisRun,
		hintsUsedThisRun:
			input.hintsUsedThisRun ?? save.activeGame?.hintsUsedThisRun ?? 0,
	})
	return freezeSave({
		...save,
		activeGame: active,
		startedPuzzleIds: withUniqueId(save.startedPuzzleIds, input.puzzle.id),
	})
}

export function persistActiveDailyPlayerState(
	save: SaveRoot,
	input: {
		readonly dayKey: DayKey
		readonly puzzle: Puzzle
		readonly selectionVersion: string
		readonly player: PlayerState
		readonly accumulatedActiveMs: number
		readonly tool: PaintTool
		readonly savedAtMs: number
		readonly restartCountThisRun: number
		readonly hintsUsedThisRun?: number
	},
): SaveRoot {
	const startedAtMs = save.activeDailyGame?.startedAtMs ?? input.savedAtMs
	const active = createActiveDailyGameSave({
		dayKey: input.dayKey,
		puzzle: input.puzzle,
		selectionVersion: input.selectionVersion,
		player: input.player,
		accumulatedActiveMs: input.accumulatedActiveMs,
		startedAtMs,
		savedAtMs: input.savedAtMs,
		tool: input.tool,
		restartCountThisRun: input.restartCountThisRun,
		hintsUsedThisRun:
			input.hintsUsedThisRun ??
			save.activeDailyGame?.hintsUsedThisRun ??
			0,
	})
	return freezeSave({
		...save,
		activeDailyGame: active,
	})
}

/**
 * Atomic Campaign completion:
 * stats + completed IDs + solved IDs + best time + clear Campaign active.
 * Daily active untouched.
 *
 * Replay must NOT advance Campaign progression or clear unfinished Campaign.
 */
export function completePuzzle(
	save: SaveRoot,
	input: {
		readonly puzzleId: string
		readonly activeTimeMs: number
		readonly isReplay?: boolean
	},
): SaveRoot {
	if (input.isReplay) {
		// Ephemeral replay (H5): keep activeGame untouched, never add Campaign
		// completedPuzzleIds / startedPuzzleIds, never bump totalCompletions
		// (so Campaign unlock + completion achievements cannot be farmed).
		const hasBest = save.bestTimes.some(
			(item) => item.puzzleId === input.puzzleId,
		)
		return freezeSave({
			...save,
			// Solved is a noop for already-solved puzzles; replay entry is only
			// reachable from solved Gallery items.
			solvedPuzzleIds: withUniqueId(save.solvedPuzzleIds, input.puzzleId),
			// Only improve an existing best time — never create a Campaign one.
			bestTimes: hasBest
				? upsertBestTime(save.bestTimes, input.puzzleId, input.activeTimeMs)
				: save.bestTimes,
			statistics: Object.freeze({
				...save.statistics,
				totalActiveSolveTimeMs:
					save.statistics.totalActiveSolveTimeMs +
					Math.max(0, input.activeTimeMs),
			}),
		})
	}
	if (save.completedPuzzleIds.includes(input.puzzleId)) {
		// H6 idempotence: a duplicate Campaign completion (double persist /
		// retry after a lost ack) must not double-count statistics. It may only
		// clear a stale active party for the same puzzle.
		const staleActive = save.activeGame?.puzzleId === input.puzzleId
		return staleActive
			? freezeSave({ ...save, activeGame: null })
			: save
	}
	return freezeSave({
		...save,
		activeGame: null,
		completedPuzzleIds: withUniqueId(save.completedPuzzleIds, input.puzzleId),
		solvedPuzzleIds: withUniqueId(save.solvedPuzzleIds, input.puzzleId),
		startedPuzzleIds: withUniqueId(save.startedPuzzleIds, input.puzzleId),
		bestTimes: upsertBestTime(
			save.bestTimes,
			input.puzzleId,
			input.activeTimeMs,
		),
		statistics: Object.freeze({
			...save.statistics,
			totalCompletions: save.statistics.totalCompletions + 1,
			totalActiveSolveTimeMs:
				save.statistics.totalActiveSolveTimeMs +
				Math.max(0, input.activeTimeMs),
		}),
	})
}

/**
 * Atomic Daily completion (idempotent on dayKey):
 * - adds DailyCompletionRecord (unique day)
 * - clears activeDailyGame
 * - adds solvedPuzzleId (NOT campaign completed)
 * - increments totalCompletions once for new day only
 * - does NOT touch campaign bestTimes / completedPuzzleIds / activeGame
 */
export function completeDaily(
	save: SaveRoot,
	input: {
		readonly dayKey: DayKey
		readonly puzzleId: string
		readonly selectionVersion: string
		readonly activeTimeMs: number
	},
): SaveRoot {
	const already = save.dailyCompletionRecords.some(
		(r) => r.dayKey === input.dayKey,
	)
	if (already) {
		return freezeSave({
			...save,
			activeDailyGame: null,
			solvedPuzzleIds: withUniqueId(save.solvedPuzzleIds, input.puzzleId),
		})
	}
	const record: DailyCompletionRecordSave = Object.freeze({
		dayKey: input.dayKey,
		puzzleId: input.puzzleId,
		selectionVersion: input.selectionVersion,
		activeTimeMs: Math.max(0, input.activeTimeMs),
	})
	return freezeSave({
		...save,
		activeDailyGame: null,
		dailyCompletionRecords: Object.freeze([
			...save.dailyCompletionRecords,
			record,
		]),
		solvedPuzzleIds: withUniqueId(save.solvedPuzzleIds, input.puzzleId),
		statistics: Object.freeze({
			...save.statistics,
			totalCompletions: save.statistics.totalCompletions + 1,
			totalActiveSolveTimeMs:
				save.statistics.totalActiveSolveTimeMs +
				Math.max(0, input.activeTimeMs),
		}),
	})
}

/** Persist streak restore for a missed day (not a puzzle solve). */
export function restoreDailyDay(
	save: SaveRoot,
	dayKey: DayKey,
): SaveRoot {
	if (save.restoredDailyDays.includes(dayKey)) {
		return save
	}
	if (save.dailyCompletionRecords.some((r) => r.dayKey === dayKey)) {
		return save
	}
	return freezeSave({
		...save,
		restoredDailyDays: Object.freeze([...save.restoredDailyDays, dayKey]),
	})
}

/** First Daily screen open — set participation start once. */
export function ensureDailyStartedDay(
	save: SaveRoot,
	today: DayKey,
): SaveRoot {
	if (save.dailyStartedDay !== null) {
		return save
	}
	return freezeSave({
		...save,
		dailyStartedDay: today,
	})
}

export function recordUndoAction(save: SaveRoot): SaveRoot {
	return freezeSave({
		...save,
		statistics: Object.freeze({
			...save.statistics,
			totalUndoActions: save.statistics.totalUndoActions + 1,
		}),
	})
}

export function recordRedoAction(save: SaveRoot): SaveRoot {
	return freezeSave({
		...save,
		statistics: Object.freeze({
			...save.statistics,
			totalRedoActions: save.statistics.totalRedoActions + 1,
		}),
	})
}

/** User-confirmed restart — Campaign branch. */
export function recordRestart(save: SaveRoot): SaveRoot {
	const active = save.activeGame
	return freezeSave({
		...save,
		activeGame:
			active === null
				? null
				: Object.freeze({
						...active,
						restartCountThisRun: active.restartCountThisRun + 1,
					}),
		statistics: Object.freeze({
			...save.statistics,
			totalRestarts: save.statistics.totalRestarts + 1,
		}),
	})
}

/** User-confirmed Daily restart — does not touch Campaign active. */
export function recordDailyRestart(save: SaveRoot): SaveRoot {
	const active = save.activeDailyGame
	return freezeSave({
		...save,
		activeDailyGame:
			active === null
				? null
				: Object.freeze({
						...active,
						restartCountThisRun: active.restartCountThisRun + 1,
					}),
		statistics: Object.freeze({
			...save.statistics,
			totalRestarts: save.statistics.totalRestarts + 1,
		}),
	})
}

export function clearActiveGame(save: SaveRoot): SaveRoot {
	return freezeSave({
		...save,
		activeGame: null,
	})
}

export function clearActiveDailyGame(save: SaveRoot): SaveRoot {
	return freezeSave({
		...save,
		activeDailyGame: null,
	})
}

/** +1 global hintRequests (STEP / CONTRADICTION / STALLED response). */
export function recordHintRequest(save: SaveRoot): SaveRoot {
	return freezeSave({
		...save,
		statistics: Object.freeze({
			...save.statistics,
			hintRequests: save.statistics.hintRequests + 1,
		}),
	})
}

/** +1 teachMeViews when a STEP explanation was shown. */
export function recordTeachMeView(save: SaveRoot): SaveRoot {
	return freezeSave({
		...save,
		statistics: Object.freeze({
			...save.statistics,
			teachMeViews: save.statistics.teachMeViews + 1,
		}),
	})
}

/**
 * Atomic Apply: bump global hintsApplied + hintsUsedThisRun on Campaign or Daily.
 * Player cells are persisted separately via persistActive* after session apply.
 */
export function recordHintApplied(
	save: SaveRoot,
	branch: 'campaign' | 'daily' | 'none',
): SaveRoot {
	const nextStats = Object.freeze({
		...save.statistics,
		hintsApplied: save.statistics.hintsApplied + 1,
	})
	if (branch === 'campaign' && save.activeGame !== null) {
		return freezeSave({
			...save,
			statistics: nextStats,
			activeGame: Object.freeze({
				...save.activeGame,
				hintsUsedThisRun: save.activeGame.hintsUsedThisRun + 1,
			}),
		})
	}
	if (branch === 'daily' && save.activeDailyGame !== null) {
		return freezeSave({
			...save,
			statistics: nextStats,
			activeDailyGame: Object.freeze({
				...save.activeDailyGame,
				hintsUsedThisRun: save.activeDailyGame.hintsUsedThisRun + 1,
			}),
		})
	}
	// Replay / none — global applied only
	return freezeSave({
		...save,
		statistics: nextStats,
	})
}

/**
 * Contradiction/STALLED still counts as help for this run (hintsUsedThisRun),
 * but does not increase hintsApplied.
 */
export function recordHintAssistanceUsed(
	save: SaveRoot,
	branch: 'campaign' | 'daily' | 'none',
): SaveRoot {
	if (branch === 'campaign' && save.activeGame !== null) {
		return freezeSave({
			...save,
			activeGame: Object.freeze({
				...save.activeGame,
				hintsUsedThisRun: save.activeGame.hintsUsedThisRun + 1,
			}),
		})
	}
	if (branch === 'daily' && save.activeDailyGame !== null) {
		return freezeSave({
			...save,
			activeDailyGame: Object.freeze({
				...save.activeDailyGame,
				hintsUsedThisRun: save.activeDailyGame.hintsUsedThisRun + 1,
			}),
		})
	}
	return save
}

export function resetProgress(): SaveRoot {
	return createDefaultSave()
}

/** Persist tutorial completion for the current curriculum version. */
export function markTutorialCompleted(
	save: SaveRoot,
	tutorialVersion: number,
): SaveRoot {
	return freezeSave({
		...save,
		tutorialVersionCompleted: tutorialVersion,
		tutorialOfferDismissed: true,
	})
}

/** Soft-dismiss Home tutorial offer («Позже»). */
export function dismissTutorialOffer(save: SaveRoot): SaveRoot {
	return freezeSave({
		...save,
		tutorialOfferDismissed: true,
	})
}

/**
 * Persist that the user skipped / exited the first-run tutorial so it does
 * not auto-reopen on every cold start. Settings replay is unaffected.
 */
export function markTutorialFirstRunSkipped(save: SaveRoot): SaveRoot {
	if (save.tutorialFirstRunSkipped) {
		return save
	}
	return freezeSave({
		...save,
		tutorialFirstRunSkipped: true,
	})
}

/**
 * DEV-only: clear tutorial completion so first-run / soft offer can be retested
 * without wiping Campaign / Gallery / Daily progress.
 */
export function resetTutorialProgressDevOnly(save: SaveRoot): SaveRoot {
	return freezeSave({
		...save,
		tutorialVersionCompleted: null,
		tutorialOfferDismissed: false,
		tutorialFirstRunSkipped: false,
	})
}

function helpStateFromSave(save: SaveRoot): HelpAllowanceState {
	return {
		helpAllowanceDay: save.helpAllowanceDay,
		freeHintsUsedToday: save.freeHintsUsedToday,
		freeTeachMeUsedToday: save.freeTeachMeUsedToday,
		pendingRewardedHints: save.pendingRewardedHints,
		pendingRewardedTeachMe: save.pendingRewardedTeachMe,
	}
}

function applyHelpState(save: SaveRoot, help: HelpAllowanceState): SaveRoot {
	return freezeSave({
		...save,
		helpAllowanceDay: help.helpAllowanceDay,
		freeHintsUsedToday: help.freeHintsUsedToday,
		freeTeachMeUsedToday: help.freeTeachMeUsedToday,
		pendingRewardedHints: help.pendingRewardedHints,
		pendingRewardedTeachMe: help.pendingRewardedTeachMe,
	})
}

/** Roll free counters when local day changes (preserves pending entitlements). */
export function ensureHelpAllowanceDay(
	save: SaveRoot,
	today: DayKey,
): SaveRoot {
	const currentHelp = helpStateFromSave(save)
	const next = rollHelpAllowanceToDay(currentHelp, today)
	// rollHelpAllowanceToDay returns the same reference when the day matches.
	if (next === currentHelp) {
		return save
	}
	return applyHelpState(save, next)
}

export function consumeHintApplyAllowance(
	save: SaveRoot,
	today: DayKey,
): SaveRoot | null {
	const rolled = rollHelpAllowanceToDay(helpStateFromSave(save), today)
	const consumed = consumeHintApplyPure(rolled)
	if (consumed === null) {
		return null
	}
	return applyHelpState(save, consumed)
}

export function consumeTeachMeRevealAllowance(
	save: SaveRoot,
	today: DayKey,
): SaveRoot | null {
	const rolled = rollHelpAllowanceToDay(helpStateFromSave(save), today)
	const consumed = consumeTeachMeRevealPure(rolled)
	if (consumed === null) {
		return null
	}
	return applyHelpState(save, consumed)
}

export function grantRewardedHintAllowance(
	save: SaveRoot,
	today: DayKey,
): SaveRoot {
	const rolled = rollHelpAllowanceToDay(helpStateFromSave(save), today)
	return applyHelpState(save, grantRewardedHintPure(rolled))
}

export function grantRewardedTeachMeAllowance(
	save: SaveRoot,
	today: DayKey,
): SaveRoot {
	const rolled = rollHelpAllowanceToDay(helpStateFromSave(save), today)
	return applyHelpState(save, grantRewardedTeachMePure(rolled))
}
