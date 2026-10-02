/**
 * H3 — Teach Me Apply must independently satisfy Hint allowance.
 *
 * Matrix (Hint free left / Teach free left / pending rewarded Hint):
 *   Hint 0 / Teach 3 / no pending  → Teach STEP reveal OK, Apply BLOCKED
 *   Hint 0 / Teach 3 / pending 1   → Apply OK once, then BLOCKED again
 *   Hint 2 / Teach 0 / no pending  → Teach reveal needs rewarded, Apply OK
 */

import {
	FREE_HINTS_PER_DAY,
	FREE_TEACH_ME_PER_DAY,
	canUseHintWithoutRewarded,
	canUseTeachMeWithoutRewarded,
	consumeHintApply,
	consumeTeachMeReveal,
	createDefaultHelpAllowance,
	evaluateHintApplyGate,
	grantRewardedHintEntitlement,
} from '../allowance'
import { createGameProgressService } from '../../persistence/progressService'
import { createSaveRepository } from '../../persistence/repository'
import { createFakeClock } from '../../persistence/clock'
import { createMemoryStorage } from '../../storage'

const TODAY = '2026-10-02'

describe('Teach Me Apply vs Hint allowance (H3) — pure state', () => {
	it('Hint 0 / Teach 3: Teach reveal allowed; Apply requires Hint entitlement', () => {
		let state = createDefaultHelpAllowance(TODAY)
		state = {
			...state,
			freeHintsUsedToday: FREE_HINTS_PER_DAY,
			freeTeachMeUsedToday: FREE_TEACH_ME_PER_DAY - 3,
		}
		expect(canUseHintWithoutRewarded(state)).toBe(false)
		expect(canUseTeachMeWithoutRewarded(state)).toBe(true)
		expect(evaluateHintApplyGate(state)).toBe('needs_rewarded')

		state = consumeTeachMeReveal(state)!
		expect(state.freeTeachMeUsedToday).toBe(FREE_TEACH_ME_PER_DAY - 2)
		// Teach reveal must NOT unlock Apply.
		expect(canUseHintWithoutRewarded(state)).toBe(false)
		expect(evaluateHintApplyGate(state)).toBe('needs_rewarded')
		expect(consumeHintApply(state)).toBeNull()

		state = grantRewardedHintEntitlement(state)
		expect(evaluateHintApplyGate(state)).toBe('pending_rewarded')
		state = consumeHintApply(state)!
		expect(state.pendingRewardedHints).toBe(0)
		expect(evaluateHintApplyGate(state)).toBe('needs_rewarded')
		expect(consumeHintApply(state)).toBeNull()
	})

	it('Hint 2 / Teach 0: Apply is free even though Teach is exhausted', () => {
		const state = {
			...createDefaultHelpAllowance(TODAY),
			freeHintsUsedToday: FREE_HINTS_PER_DAY - 2,
			freeTeachMeUsedToday: FREE_TEACH_ME_PER_DAY,
		}
		expect(canUseTeachMeWithoutRewarded(state)).toBe(false)
		expect(evaluateHintApplyGate(state)).toBe('free')
		const next = consumeHintApply(state)!
		// Apply spends Hint quota only — Teach counter is untouched.
		expect(next.freeHintsUsedToday).toBe(FREE_HINTS_PER_DAY - 1)
		expect(next.freeTeachMeUsedToday).toBe(FREE_TEACH_ME_PER_DAY)
	})

	it('pending rewarded Teach Me never satisfies the Hint gate', () => {
		const state = {
			...createDefaultHelpAllowance(TODAY),
			freeHintsUsedToday: FREE_HINTS_PER_DAY,
			pendingRewardedTeachMe: 1,
		}
		expect(evaluateHintApplyGate(state)).toBe('needs_rewarded')
	})
})

describe('Teach Me Apply vs Hint allowance (H3) — service gate', () => {
	async function createService() {
		const repo = createSaveRepository(createMemoryStorage())
		const clock = createFakeClock(Date.parse(`${TODAY}T12:00:00`))
		const service = createGameProgressService(repo, clock)
		await service.hydrate()
		return service
	}

	it('Hint 0 / Teach 3: Apply gate stays closed and the save is untouched', async () => {
		const service = await createService()
		for (let i = 0; i < FREE_HINTS_PER_DAY; i += 1) {
			await service.consumeHintApplyAllowance()
		}
		const before = service.getSave()
		expect(before.freeHintsUsedToday).toBe(FREE_HINTS_PER_DAY)
		expect(before.freeTeachMeUsedToday).toBe(0)

		// Teach Me STEP reveal consumes Teach Me only.
		await service.consumeTeachMeRevealAllowance()
		const afterTeach = service.getSave()
		expect(afterTeach.freeTeachMeUsedToday).toBe(1)
		expect(afterTeach.freeHintsUsedToday).toBe(FREE_HINTS_PER_DAY)

		// Apply is still gated on Hint allowance — and a blocked attempt must
		// neither consume nor mutate anything.
		expect(service.canConsumeHintApplyAllowance()).toBe(false)
		expect(await service.consumeHintApplyAllowance()).toBeNull()
		expect(service.getSave()).toBe(afterTeach)
	})

	it('rewarded grant reopens the gate for exactly one Apply', async () => {
		const service = await createService()
		for (let i = 0; i < FREE_HINTS_PER_DAY; i += 1) {
			await service.consumeHintApplyAllowance()
		}
		expect(service.canConsumeHintApplyAllowance()).toBe(false)

		await service.grantRewardedHintAllowance()
		expect(service.canConsumeHintApplyAllowance()).toBe(true)
		const consumed = await service.consumeHintApplyAllowance()
		expect(consumed).not.toBeNull()
		expect(consumed!.pendingRewardedHints).toBe(0)
		expect(service.canConsumeHintApplyAllowance()).toBe(false)
		expect(await service.consumeHintApplyAllowance()).toBeNull()
	})

	it('consume only publishes memory after durable write settles (N1)', async () => {
		const service = await createService()
		const before = service.getSave().freeHintsUsedToday
		const pending = service.consumeHintApplyAllowance()
		// Durable-first commit: memory is unchanged until the write succeeds.
		expect(service.getSave().freeHintsUsedToday).toBe(before)
		await pending
		expect(service.getSave().freeHintsUsedToday).toBe(before + 1)
	})

	it('double synchronous Apply consumes two distinct allowances, never one twice', async () => {
		const service = await createService()
		for (let i = 0; i < FREE_HINTS_PER_DAY - 1; i += 1) {
			await service.consumeHintApplyAllowance()
		}
		// One free Hint left: two back-to-back attempts → exactly one succeeds.
		const first = service.consumeHintApplyAllowance()
		const second = service.consumeHintApplyAllowance()
		const results = await Promise.all([first, second])
		expect(results.filter((r) => r !== null)).toHaveLength(1)
		expect(service.getSave().freeHintsUsedToday).toBe(FREE_HINTS_PER_DAY)
	})
})
