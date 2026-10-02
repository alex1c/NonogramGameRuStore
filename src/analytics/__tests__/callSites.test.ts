/**
 * M4 — analytics call-site wiring.
 *
 * Lightweight source scan (same style as homeBannerLayout tests): asserts every
 * product-funnel event is referenced from a production file and that payloads
 * never carry board / solution data. Pure payload planners are exercised
 * directly for exactly-once / after-success semantics.
 */

import fs from 'node:fs'
import path from 'node:path'
import {
	ANALYTICS_EVENT_NAMES,
	type AnalyticsEventName,
} from '../events'
import {
	analyticsPlayMode,
	planCompletionEvents,
	planPuzzleBindEvents,
	type PuzzleAnalyticsContext,
} from '../payloads'
import type {
	CompletionEventResult,
	DailyCompletionEventResult,
} from '../../persistence/completionResult'

const SRC_ROOT = path.join(__dirname, '../..')
const APP_ROOT = path.join(SRC_ROOT, '..')

function readSrc(relative: string): string {
	return fs.readFileSync(path.join(SRC_ROOT, relative), 'utf8')
}

/** Production files that may legitimately emit analytics. */
const PRODUCTION_FILES = [
	'screens/GameScreen.tsx',
	'screens/LevelsScreen.tsx',
	'screens/TutorialScreen.tsx',
	'navigation/RootNavigation.tsx',
	'analytics/payloads.ts',
	'ads/service.ts',
]

function productionSources(): Record<string, string> {
	const result: Record<string, string> = {}
	for (const file of PRODUCTION_FILES) {
		result[file] = readSrc(file)
	}
	result['App.tsx'] = fs.readFileSync(path.join(APP_ROOT, 'App.tsx'), 'utf8')
	return result
}

/** Events that must be wired somewhere in production code. */
const REQUIRED_EVENTS: readonly AnalyticsEventName[] = [
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
	'hint_free_consumed',
	'teach_me_free_consumed',
]

describe('analytics call sites', () => {
	it('requires every defined event name', () => {
		expect([...REQUIRED_EVENTS].sort()).toEqual(
			[...ANALYTICS_EVENT_NAMES].sort(),
		)
	})

	it.each(REQUIRED_EVENTS)('%s is referenced from production code', (name) => {
		const sources = productionSources()
		const referenced = Object.values(sources).some((source) =>
			source.includes(`'${name}'`),
		)
		expect(referenced).toBe(true)
	})

	it('production files never pass board / solution payloads', () => {
		const forbidden = /trackEvent\([^)]*\b(solution|player|grid|bitmap|board)\b/
		for (const [file, source] of Object.entries(productionSources())) {
			expect({ file, leaks: forbidden.test(source) }).toEqual({
				file,
				leaks: false,
			})
		}
	})

	it('tutorial_complete fires only after onPersistComplete succeeds', () => {
		const source = readSrc('screens/TutorialScreen.tsx')
		const persistIdx = source.indexOf('await onPersistComplete()')
		const trackIdx = source.indexOf("trackEvent('tutorial_complete'")
		expect(persistIdx).toBeGreaterThan(-1)
		expect(trackIdx).toBeGreaterThan(persistIdx)
	})

	it('Levels reports campaign_set_open only for unlocked sets', () => {
		const source = readSrc('screens/LevelsScreen.tsx')
		const lockedReturnIdx = source.indexOf('card.locked')
		const trackIdx = source.indexOf("trackEvent('campaign_set_open'")
		expect(lockedReturnIdx).toBeGreaterThan(-1)
		expect(trackIdx).toBeGreaterThan(lockedReturnIdx)
	})

	it('GameScreen guards completion analytics once per run', () => {
		const source = readSrc('screens/GameScreen.tsx')
		expect(source).toContain('completionTrackedRunId')
		expect(source).toContain('planCompletionEvents')
		expect(source).toContain('planPuzzleBindEvents')
		expect(source).toContain("trackEvent('puzzle_restart'")
		expect(source).toContain("'hint_open' : 'teach_me_open'")
		expect(source).toContain("trackEvent('hint_apply'")
	})

	it('Root tracks Daily / Gallery entry on route change', () => {
		const source = readSrc('navigation/RootNavigation.tsx')
		expect(source).toContain("trackEvent('daily_open'")
		expect(source).toContain("trackEvent('gallery_open'")
	})
})

describe('analytics payload planners', () => {
	const context: PuzzleAnalyticsContext = {
		mode: 'campaign',
		puzzleId: 'p-1',
		width: 10,
		height: 10,
		difficulty: 'EASY',
		setNumber: 3,
	}

	const baseCompletion: CompletionEventResult = {
		mode: 'CAMPAIGN',
		puzzleId: 'p-1',
		firstCompletion: true,
		firstPuzzleSolve: true,
		galleryJustUnlocked: false,
		bestTimeImproved: true,
		previousBestTimeMs: null,
		newBestTimeMs: 12_400,
		newlyUnlockedAchievements: [],
		collectionJustCompletedTitle: null,
		nextCampaignPuzzleId: null,
		galleryIncluded: false,
	}

	const names = (events: readonly { name: string }[]) =>
		events.map((event) => event.name)

	it('maps session modes to analytics labels', () => {
		expect(analyticsPlayMode('CAMPAIGN')).toBe('campaign')
		expect(analyticsPlayMode('REPLAY')).toBe('replay')
		expect(analyticsPlayMode('DAILY')).toBe('daily')
	})

	it('bind emits puzzle_start; fresh Daily adds daily_start', () => {
		expect(names(planPuzzleBindEvents(context, 'fresh'))).toEqual([
			'puzzle_start',
		])
		const daily = { ...context, mode: 'daily' as const }
		expect(names(planPuzzleBindEvents(daily, 'fresh'))).toEqual([
			'puzzle_start',
			'daily_start',
		])
		expect(names(planPuzzleBindEvents(daily, 'resume'))).toEqual([
			'puzzle_start',
		])
	})

	it('campaign completion emits puzzle_complete with scalars only', () => {
		const events = planCompletionEvents({
			context,
			event: baseCompletion,
			hintsUsed: 2,
			elapsedMs: 12_400,
			galleryCollectionId: null,
		})
		expect(names(events)).toEqual(['puzzle_complete'])
		expect(events[0]?.parameters).toEqual({
			mode: 'campaign',
			puzzleId: 'p-1',
			width: 10,
			height: 10,
			difficulty: 'EASY',
			setNumber: 3,
			hintsUsed: 2,
			isFirstCompletion: true,
			elapsedSec: 12,
		})
	})

	it('emits gallery_unlock and one achievement_unlock per achievement', () => {
		const events = planCompletionEvents({
			context,
			event: {
				...baseCompletion,
				galleryJustUnlocked: true,
				newlyUnlockedAchievements: [
					{ id: 'ach-a' },
					{ id: 'ach-b' },
				] as unknown as CompletionEventResult['newlyUnlockedAchievements'],
			},
			hintsUsed: 0,
			elapsedMs: 1000,
			galleryCollectionId: 'col-1',
		})
		expect(names(events)).toEqual([
			'puzzle_complete',
			'gallery_unlock',
			'achievement_unlock',
			'achievement_unlock',
		])
		expect(events[1]?.parameters).toEqual({ collectionId: 'col-1' })
		expect(events[2]?.parameters).toEqual({ achievementId: 'ach-a' })
		expect(events[3]?.parameters).toEqual({ achievementId: 'ach-b' })
	})

	it('Daily completion adds daily_complete and uses firstDailyCompletion', () => {
		const dailyEvent: DailyCompletionEventResult = {
			mode: 'DAILY',
			dayKey: '2026-10-02',
			puzzleId: 'p-1',
			firstDailyCompletion: false,
			firstPuzzleSolve: false,
			galleryJustUnlocked: false,
			newlyUnlockedAchievements: [],
			collectionJustCompletedTitle: null,
			streakBefore: 1,
			streakAfter: 2,
			streakExtended: true,
			galleryIncluded: false,
			activeTimeMs: 61_000,
			restoreEligible: false,
			restoreMissingDayKey: null,
		}
		const events = planCompletionEvents({
			context: { ...context, mode: 'daily' },
			event: dailyEvent,
			hintsUsed: 0,
			elapsedMs: 61_000,
			galleryCollectionId: null,
		})
		expect(names(events)).toEqual(['puzzle_complete', 'daily_complete'])
		expect(events[0]?.parameters.isFirstCompletion).toBe(false)
		expect(events[1]?.parameters).toEqual({
			width: 10,
			height: 10,
			difficulty: 'EASY',
			elapsedSec: 61,
		})
	})

	it('omits setNumber when the puzzle is outside the campaign', () => {
		const { setNumber: _unused, ...withoutSet } = context
		void _unused
		const [start] = planPuzzleBindEvents(withoutSet, 'fresh')
		expect(start?.parameters).not.toHaveProperty('setNumber')
	})
})
