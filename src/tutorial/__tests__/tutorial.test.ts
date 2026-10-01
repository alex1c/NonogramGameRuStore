/**
 * Phase 9 — tutorial curriculum soundness + isolation helpers.
 */

import {
	CURRENT_TUTORIAL_VERSION,
	TUTORIAL_STEPS,
	shouldFirstRunOfferTutorial,
	shouldSoftOfferTutorial,
	tutorialTargetsMet,
} from '../definition'
import { createDefaultSave } from '../../persistence/createDefaultSave'
import {
	dismissTutorialOffer,
	markTutorialCompleted,
} from '../../persistence/progressReducers'

describe('tutorial curriculum', () => {
	it('ships versioned multi-step curriculum', () => {
		expect(CURRENT_TUTORIAL_VERSION).toBe(1)
		expect(TUTORIAL_STEPS.length).toBeGreaterThanOrEqual(15)
		expect(TUTORIAL_STEPS[0]?.id).toBe('intro')
		expect(TUTORIAL_STEPS[TUTORIAL_STEPS.length - 1]?.id).toBe('finale')
	})

	it('overlap step forces only the center cell', () => {
		const overlap = TUTORIAL_STEPS.find((s) => s.id === 'overlap')
		expect(overlap?.targets).toEqual([{ row: 0, col: 2, expect: 1 }])
		expect(
			tutorialTargetsMet([[0, 0, 1, 0, 0]], overlap?.targets ?? []),
		).toBe(true)
		expect(
			tutorialTargetsMet([[0, 0, 0, 0, 0]], overlap?.targets ?? []),
		).toBe(false)
	})

	it('multi-group 2 1 requires separator', () => {
		const step = TUTORIAL_STEPS.find((s) => s.id === 'multi_2_1')
		expect(step?.lineClues).toEqual([2, 1])
		expect(
			tutorialTargetsMet([[1, 1, 2, 1, 2]], step?.targets ?? []),
		).toBe(true)
	})
})

describe('tutorial persistence helpers', () => {
	it('fresh empty save → first-run offer', () => {
		const save = createDefaultSave()
		expect(shouldFirstRunOfferTutorial(save)).toBe(true)
		expect(shouldSoftOfferTutorial(save)).toBe(false)
	})

	it('existing progress → soft offer until dismissed or completed', () => {
		const withProgress = {
			...createDefaultSave(),
			completedPuzzleIds: ['x'],
			solvedPuzzleIds: ['x'],
		}
		expect(shouldFirstRunOfferTutorial(withProgress)).toBe(false)
		expect(shouldSoftOfferTutorial(withProgress)).toBe(true)
		const dismissed = dismissTutorialOffer(withProgress)
		expect(shouldSoftOfferTutorial(dismissed)).toBe(false)
		const completed = markTutorialCompleted(withProgress, 1)
		expect(completed.tutorialVersionCompleted).toBe(1)
		expect(shouldSoftOfferTutorial(completed)).toBe(false)
	})
})
