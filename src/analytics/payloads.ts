/**
 * Pure analytics payload builders for gameplay call sites.
 *
 * Only scalar metadata is produced (ids, sizes, counters). Boards, solutions
 * and player grids must never be passed in — callers hand over plain numbers.
 */

import type {
	CompletionEventResult,
	DailyCompletionEventResult,
} from '../persistence/completionResult'
import type { AnalyticsEventName } from './events'

/** Lower-case mode label reported to analytics. */
export type AnalyticsPlayMode = 'campaign' | 'daily' | 'replay'

/** Maps a route session mode to its analytics label. */
export function analyticsPlayMode(
	mode: 'CAMPAIGN' | 'REPLAY' | 'DAILY',
): AnalyticsPlayMode {
	switch (mode) {
		case 'DAILY':
			return 'daily'
		case 'REPLAY':
			return 'replay'
		default:
			return 'campaign'
	}
}

/** Scalar facts about the puzzle being played. */
export interface PuzzleAnalyticsContext {
	readonly mode: AnalyticsPlayMode
	readonly puzzleId: string
	readonly width: number
	readonly height: number
	readonly difficulty: string
	/** Campaign set display number; omitted for puzzles outside the campaign. */
	readonly setNumber?: number
}

/** One analytics event ready for `trackEvent`. */
export interface PlannedAnalyticsEvent {
	readonly name: AnalyticsEventName
	readonly parameters: Record<string, string | number | boolean>
}

function puzzleScalars(
	context: PuzzleAnalyticsContext,
): Record<string, string | number> {
	const scalars: Record<string, string | number> = {
		mode: context.mode,
		puzzleId: context.puzzleId,
		width: context.width,
		height: context.height,
		difficulty: context.difficulty,
	}
	if (context.setNumber !== undefined) {
		scalars.setNumber = context.setNumber
	}
	return scalars
}

/**
 * Events fired when GameScreen binds a run.
 * A fresh Daily bind is the moment today's Daily is started.
 */
export function planPuzzleBindEvents(
	context: PuzzleAnalyticsContext,
	launch: 'resume' | 'fresh' | 'replay',
): readonly PlannedAnalyticsEvent[] {
	const events: PlannedAnalyticsEvent[] = [
		{ name: 'puzzle_start', parameters: puzzleScalars(context) },
	]
	if (context.mode === 'daily' && launch === 'fresh') {
		events.push({
			name: 'daily_start',
			parameters: {
				width: context.width,
				height: context.height,
				difficulty: context.difficulty,
			},
		})
	}
	return events
}

/** Inputs for the post-completion event plan. */
export interface CompletionAnalyticsInput {
	readonly context: PuzzleAnalyticsContext
	readonly event: CompletionEventResult | DailyCompletionEventResult
	readonly hintsUsed: number
	readonly elapsedMs: number
	/** Collection id of the puzzle's gallery item, when it has one. */
	readonly galleryCollectionId: string | null
}

/**
 * Events fired once a completion is confirmed persisted:
 * puzzle_complete, daily_complete (Daily), gallery_unlock, and one
 * achievement_unlock per newly unlocked achievement.
 */
export function planCompletionEvents(
	input: CompletionAnalyticsInput,
): readonly PlannedAnalyticsEvent[] {
	const { context, event } = input
	const elapsedSec = Math.max(0, Math.round(input.elapsedMs / 1000))
	const isFirstCompletion =
		event.mode === 'DAILY' ? event.firstDailyCompletion : event.firstCompletion

	const events: PlannedAnalyticsEvent[] = [
		{
			name: 'puzzle_complete',
			parameters: {
				...puzzleScalars(context),
				hintsUsed: input.hintsUsed,
				isFirstCompletion,
				elapsedSec,
			},
		},
	]
	if (event.mode === 'DAILY') {
		events.push({
			name: 'daily_complete',
			parameters: {
				width: context.width,
				height: context.height,
				difficulty: context.difficulty,
				elapsedSec,
			},
		})
	}
	if (event.galleryJustUnlocked && input.galleryCollectionId !== null) {
		events.push({
			name: 'gallery_unlock',
			parameters: { collectionId: input.galleryCollectionId },
		})
	}
	for (const achievement of event.newlyUnlockedAchievements) {
		events.push({
			name: 'achievement_unlock',
			parameters: { achievementId: achievement.id },
		})
	}
	return events
}
