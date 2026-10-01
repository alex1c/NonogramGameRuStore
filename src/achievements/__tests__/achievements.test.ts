/**
 * Achievement engine + transitions + feasibility.
 */

import { createDefaultSave } from '../../persistence/createDefaultSave'
import { completePuzzle } from '../../persistence/progressReducers'
import { auditAchievements } from '../audit'
import { ACHIEVEMENT_DEFINITIONS } from '../definitions'
import {
	contextFromSave,
	evaluateAchievements,
	getNewlyUnlockedAchievements,
} from '../evaluate'
import { CAMPAIGN_ENTRIES } from '../../campaign/definition'
import { GALLERY_ITEMS } from '../../gallery/definitions'
import { getProductionPuzzleById } from '../../content/playable'
import { getRuntimePuzzleEntry } from '../../content/runtime'
import type { DifficultyTier } from '../../domain/difficulty/tiers'

/** Stable production ID with a known runtime tier (for difficulty achievements). */
function galleryIdWithTier(tier: DifficultyTier): string {
	for (const item of GALLERY_ITEMS) {
		const entry = getRuntimePuzzleEntry(item.puzzleId)
		if (
			entry?.tier === tier &&
			getProductionPuzzleById(item.puzzleId) !== null
		) {
			return item.puzzleId
		}
	}
	throw new Error(`No production gallery puzzle for tier ${tier}`)
}

const WEATHER_COLLECTION_IDS = GALLERY_ITEMS.filter(
	(item) => item.collectionId === 'weather',
).map((item) => item.puzzleId)

describe('achievement audit', () => {
	it('all Phase 5 achievements are reachable', () => {
		const summary = auditAchievements()
		expect(summary.ok).toBe(true)
		expect(summary.unreachable).toBe(0)
		expect(summary.duplicateIds).toBe(0)
		expect(summary.total).toBe(ACHIEVEMENT_DEFINITIONS.length)
	})
})

describe('achievement evaluator', () => {
	it('fresh save unlocks none', () => {
		const states = evaluateAchievements(contextFromSave(createDefaultSave()))
		expect(states.every((item) => item.access === 'LOCKED')).toBe(true)
	})

	it('first completion unlocks first_picture only among unique targets', () => {
		let save = createDefaultSave()
		const before = evaluateAchievements(contextFromSave(save))
		save = completePuzzle(save, {
			puzzleId: CAMPAIGN_ENTRIES[0]!.puzzleId,
			activeTimeMs: 100,
		})
		const after = evaluateAchievements(contextFromSave(save))
		const newly = getNewlyUnlockedAchievements(before, after)
		expect(newly.map((item) => item.id)).toContain('first_picture')
		expect(newly.every((item) => item.access === 'UNLOCKED')).toBe(true)
	})

	it('unique milestones and replay semantics', () => {
		let save = createDefaultSave()
		const ids = CAMPAIGN_ENTRIES.slice(0, 5).map((entry) => entry.puzzleId)
		for (const id of ids) {
			save = completePuzzle(save, { puzzleId: id, activeTimeMs: 100 })
		}
		let states = evaluateAchievements(contextFromSave(save))
		expect(states.find((s) => s.id === 'five_pictures')?.access).toBe(
			'UNLOCKED',
		)
		expect(states.find((s) => s.id === 'ten_pictures')?.access).toBe('LOCKED')

		// replay does not increase unique
		save = completePuzzle(save, {
			puzzleId: CAMPAIGN_ENTRIES[0]!.puzzleId,
			activeTimeMs: 90,
		})
		states = evaluateAchievements(contextFromSave(save))
		expect(states.find((s) => s.id === 'five_pictures')?.current).toBe(5)
		expect(save.statistics.totalCompletions).toBe(6)
	})

	it('difficulty and large grid achievements', () => {
		const hardId = galleryIdWithTier('HARD')
		const expertId = galleryIdWithTier('EXPERT')
		const largeGridId = GALLERY_ITEMS.find((item) => {
			const puzzle = getProductionPuzzleById(item.puzzleId)
			return (
				puzzle !== null &&
				(puzzle.width >= 15 || puzzle.height >= 15)
			)
		})!.puzzleId
		let save = createDefaultSave()
		save = completePuzzle(save, {
			puzzleId: hardId,
			activeTimeMs: 1000,
		})
		save = completePuzzle(save, {
			puzzleId: expertId,
			activeTimeMs: 2000,
		})
		save = completePuzzle(save, {
			puzzleId: largeGridId,
			activeTimeMs: 3000,
		})
		const states = evaluateAchievements(contextFromSave(save))
		expect(states.find((s) => s.id === 'first_hard')?.access).toBe('UNLOCKED')
		expect(states.find((s) => s.id === 'first_expert')?.access).toBe(
			'UNLOCKED',
		)
		expect(states.find((s) => s.id === 'large_grid')?.access).toBe('UNLOCKED')
	})

	it('collection complete unlocks first_collection', () => {
		let save = createDefaultSave()
		const objectIds = WEATHER_COLLECTION_IDS
		const before = evaluateAchievements(contextFromSave(save))
		for (const id of objectIds) {
			save = completePuzzle(save, { puzzleId: id, activeTimeMs: 100 })
		}
		const after = evaluateAchievements(contextFromSave(save))
		const newly = getNewlyUnlockedAchievements(before, after)
		expect(newly.map((s) => s.id)).toContain('first_collection')
	})

	it('transition returns only newly unlocked and is ordered', () => {
		const before = evaluateAchievements(contextFromSave(createDefaultSave()))
		let save = createDefaultSave()
		save = completePuzzle(save, {
			puzzleId: CAMPAIGN_ENTRIES[0]!.puzzleId,
			activeTimeMs: 1,
		})
		expect(
			getNewlyUnlockedAchievements(
				before,
				evaluateAchievements(contextFromSave(save)),
			).map((s) => s.id),
		).toContain('first_picture')
		const mid = evaluateAchievements(contextFromSave(save))
		save = completePuzzle(save, {
			puzzleId: CAMPAIGN_ENTRIES[1]!.puzzleId,
			activeTimeMs: 1,
		})
		save = completePuzzle(save, {
			puzzleId: CAMPAIGN_ENTRIES[2]!.puzzleId,
			activeTimeMs: 1,
		})
		const after = evaluateAchievements(contextFromSave(save))
		const secondWave = getNewlyUnlockedAchievements(mid, after)
		expect(secondWave.map((s) => s.id)).not.toContain('first_picture')
		expect(secondWave.map((s) => s.id)).toContain('collection_start')
		const orders = secondWave.map((s) => s.displayOrder)
		expect(orders).toEqual([...orders].sort((a, b) => a - b))
	})

	it('evaluator is deterministic for same context', () => {
		let save = createDefaultSave()
		save = completePuzzle(save, {
			puzzleId: CAMPAIGN_ENTRIES[3]!.puzzleId,
			activeTimeMs: 10,
		})
		const a = evaluateAchievements(contextFromSave(save))
		const b = evaluateAchievements(contextFromSave(save))
		expect(a).toEqual(b)
	})

	it('unknown solved IDs are safe', () => {
		const save = {
			...createDefaultSave(),
			solvedPuzzleIds: Object.freeze(['ghost-id'] as string[]),
			statistics: Object.freeze({
				...createDefaultSave().statistics,
				totalCompletions: 1,
			}),
		}
		const states = evaluateAchievements(contextFromSave(save))
		expect(states.find((s) => s.id === 'first_picture')?.access).toBe(
			'UNLOCKED',
		)
	})
})
