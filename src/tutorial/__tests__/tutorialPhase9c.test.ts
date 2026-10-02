/**
 * Phase 9C — tutorial first-run skip persistence (schema v7), Undo step
 * board visibility (H2) and strict micro-board validation (L1).
 */

import {
	TUTORIAL_STEPS,
	shouldFirstRunOfferTutorial,
	tutorialTargetsMet,
} from '../definition'
import { createDefaultSave } from '../../persistence/createDefaultSave'
import { createFakeClock } from '../../persistence/clock'
import { createGameProgressService } from '../../persistence/progressService'
import { markTutorialFirstRunSkipped } from '../../persistence/progressReducers'
import { createSaveRepository } from '../../persistence/repository'
import { createMemoryStorage } from '../../storage'
import { SAVE_STORAGE_KEY } from '../../storage/keys'

describe('first-run offer gating (B)', () => {
	it('fresh save offers first-run tutorial', () => {
		expect(shouldFirstRunOfferTutorial(createDefaultSave())).toBe(true)
	})

	it('tutorialFirstRunSkipped suppresses the offer', () => {
		const save = markTutorialFirstRunSkipped(createDefaultSave())
		expect(save.tutorialFirstRunSkipped).toBe(true)
		expect(shouldFirstRunOfferTutorial(save)).toBe(false)
	})

	it('completed tutorial version suppresses the offer', () => {
		expect(
			shouldFirstRunOfferTutorial({
				...createDefaultSave(),
				tutorialVersionCompleted: 1,
			}),
		).toBe(false)
	})

	it.each([
		['startedPuzzleIds', { startedPuzzleIds: ['p1'] }],
		['activeGame', { activeGame: { puzzleId: 'p1' } }],
		['activeDailyGame', { activeDailyGame: { puzzleId: 'p1' } }],
	])('existing progress (%s) suppresses the offer', (_name, patch) => {
		expect(
			shouldFirstRunOfferTutorial({ ...createDefaultSave(), ...patch }),
		).toBe(false)
	})

	it('markTutorialFirstRunSkipped is idempotent', () => {
		const once = markTutorialFirstRunSkipped(createDefaultSave())
		expect(markTutorialFirstRunSkipped(once)).toBe(once)
	})

	it('skip survives a service restart and does not mark completion', async () => {
		const storage = createMemoryStorage()
		const clock = createFakeClock(Date.parse('2026-09-28T12:00:00'))

		const first = createGameProgressService(
			createSaveRepository(storage),
			clock,
		)
		await first.hydrate()
		expect(shouldFirstRunOfferTutorial(first.getSave())).toBe(true)
		await first.markTutorialFirstRunSkipped()

		// Simulate a cold start with a brand new service over the same storage.
		const second = createGameProgressService(
			createSaveRepository(storage),
			clock,
		)
		const hydrated = await second.hydrate()
		expect(hydrated.save.tutorialFirstRunSkipped).toBe(true)
		expect(hydrated.save.tutorialVersionCompleted).toBeNull()
		expect(shouldFirstRunOfferTutorial(hydrated.save)).toBe(false)
		expect(
			JSON.parse((await storage.getItem(SAVE_STORAGE_KEY)) as string)
				.schemaVersion,
		).toBe(7)
	})

	it('Settings replay stays available after a skip', () => {
		// Replay is driven by Settings navigation, not by first-run gating:
		// the skip flag must not erase or block tutorial content/completion.
		const skipped = markTutorialFirstRunSkipped(createDefaultSave())
		expect(skipped.tutorialVersionCompleted).toBeNull()
		expect(TUTORIAL_STEPS.length).toBeGreaterThan(0)
	})
})

describe('undo step (H2)', () => {
	it('has lineLength so the board and Undo button are shown', () => {
		const undo = TUTORIAL_STEPS.find((step) => step.kind === 'undo')
		expect(undo).toBeDefined()
		expect(undo?.lineLength).toBe(5)
		// TutorialScreen renders the board iff lineLength !== undefined.
		expect(undo?.lineLength !== undefined).toBe(true)
	})

	it('is completed by painting then undoing, not by target cells', () => {
		const undo = TUTORIAL_STEPS.find((step) => step.kind === 'undo')
		expect(undo?.targets ?? []).toEqual([])
	})
})

describe('strict micro-board validation (L1)', () => {
	const overlap = TUTORIAL_STEPS.find((step) => step.id === 'overlap')
	const targets = overlap?.targets ?? []

	it('accepts only the center cell', () => {
		expect(tutorialTargetsMet([[0, 0, 1, 0, 0]], targets)).toBe(true)
	})

	it('rejects extra filled cells outside the targets', () => {
		expect(tutorialTargetsMet([[0, 1, 1, 0, 0]], targets)).toBe(false)
		expect(tutorialTargetsMet([[1, 1, 1, 1, 1]], targets)).toBe(false)
	})

	it('rejects extra crosses outside the targets', () => {
		expect(tutorialTargetsMet([[2, 0, 1, 0, 0]], targets)).toBe(false)
	})

	it('rejects a missing target', () => {
		expect(tutorialTargetsMet([[0, 0, 0, 0, 0]], targets)).toBe(false)
	})
})
