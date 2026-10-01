/**
 * AppMetrica event contract — low-noise product funnel.
 * Never include solution bitmaps, board state, or personal data.
 */

export const ANALYTICS_EVENT_NAMES = [
	'app_open',
	'tutorial_start',
	'tutorial_step',
	'tutorial_complete',
	'tutorial_replay',
	'tutorial_skip',
	'campaign_set_open',
	'puzzle_start',
	'puzzle_complete',
	'puzzle_restart',
	'hint_open',
	'hint_apply',
	'teach_me_open',
	'daily_open',
	'daily_start',
	'daily_complete',
	'gallery_open',
	'gallery_unlock',
	'achievement_unlock',
	'interstitial_shown',
	'rewarded_requested',
	'rewarded_completed',
] as const

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number]

const ALLOWED_PARAMETERS: Record<AnalyticsEventName, readonly string[]> = {
	app_open: [],
	tutorial_start: ['source'],
	tutorial_step: ['chapterId', 'stepId'],
	tutorial_complete: ['source'],
	tutorial_replay: ['source'],
	tutorial_skip: ['source', 'chapterId'],
	campaign_set_open: ['setNumber'],
	puzzle_start: [
		'mode',
		'puzzleId',
		'width',
		'height',
		'difficulty',
		'setNumber',
	],
	puzzle_complete: [
		'mode',
		'puzzleId',
		'width',
		'height',
		'difficulty',
		'setNumber',
		'hintsUsed',
		'isFirstCompletion',
		'elapsedSec',
	],
	puzzle_restart: ['mode', 'puzzleId'],
	hint_open: ['mode'],
	hint_apply: ['mode', 'reason'],
	teach_me_open: ['mode'],
	daily_open: [],
	daily_start: ['width', 'height', 'difficulty'],
	daily_complete: ['width', 'height', 'difficulty', 'elapsedSec'],
	gallery_open: [],
	gallery_unlock: ['collectionId'],
	achievement_unlock: ['achievementId'],
	interstitial_shown: [],
	rewarded_requested: ['purpose'],
	rewarded_completed: ['purpose'],
}

export type AnalyticsParameter = string | number | boolean

export interface AnalyticsEvent {
	readonly name: AnalyticsEventName
	readonly parameters: Record<string, AnalyticsParameter>
}

/** Strip unknown keys and non-primitive values before reporting. */
export function buildAnalyticsEvent(
	name: AnalyticsEventName,
	parameters: Record<string, unknown> = {},
): AnalyticsEvent {
	const allowed = new Set(ALLOWED_PARAMETERS[name])
	const safeParameters: Record<string, AnalyticsParameter> = {}
	for (const [key, value] of Object.entries(parameters)) {
		if (!allowed.has(key)) {
			continue
		}
		if (
			typeof value !== 'string' &&
			typeof value !== 'number' &&
			typeof value !== 'boolean'
		) {
			continue
		}
		safeParameters[key] = value
	}
	return { name, parameters: safeParameters }
}

export function isAnalyticsEventName(value: string): value is AnalyticsEventName {
	return (ANALYTICS_EVENT_NAMES as readonly string[]).includes(value)
}
