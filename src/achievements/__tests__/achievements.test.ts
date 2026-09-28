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
			puzzleId: 'mini-beginner-bar',
			activeTimeMs: 100,
		})
		const after = evaluateAchievements(contextFromSave(save))
		const newly = getNewlyUnlockedAchievements(before, after)
		expect(newly.map((item) => item.id)).toContain('first_picture')
		expect(newly.every((item) => item.access === 'UNLOCKED')).toBe(true)
	})

	it('unique milestones and replay semantics', () => {
		let save = createDefaultSave()
		const ids = [
			'mini-beginner-bar',
			'mini-beginner-full',
			'mini-beginner-frame',
			'mini-easy-block',
			'mini-easy-stairs',
		]
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
			puzzleId: 'mini-beginner-bar',
			activeTimeMs: 90,
		})
		states = evaluateAchievements(contextFromSave(save))
		expect(states.find((s) => s.id === 'five_pictures')?.current).toBe(5)
		expect(save.statistics.totalCompletions).toBe(6)
	})

	it('difficulty and large grid achievements', () => {
		let save = createDefaultSave()
		save = completePuzzle(save, {
			puzzleId: 'mini-hard-tree',
			activeTimeMs: 1000,
		})
		save = completePuzzle(save, {
			puzzleId: 'mini-expert-scatter',
			activeTimeMs: 2000,
		})
		save = completePuzzle(save, {
			puzzleId: 'mini-hard-frame-cross',
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
		const objectIds = [
			'mini-medium-boat',
			'mini-hard-tree',
			'mini-hard-bridge',
			'mini-hard-arrows',
			'mini-hard-window',
		]
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
			puzzleId: 'mini-beginner-bar',
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
			puzzleId: 'mini-beginner-full',
			activeTimeMs: 1,
		})
		save = completePuzzle(save, {
			puzzleId: 'mini-beginner-frame',
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
			puzzleId: 'mini-easy-plus',
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
