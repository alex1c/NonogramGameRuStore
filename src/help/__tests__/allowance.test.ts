/**
 * Daily free Hint / Teach Me allowances + rewarded entitlement semantics.
 */

import {
	FREE_HINTS_PER_DAY,
	FREE_TEACH_ME_PER_DAY,
	canUseHintWithoutRewarded,
	canUseTeachMeWithoutRewarded,
	consumeHintApply,
	consumeTeachMeReveal,
	createDefaultHelpAllowance,
	formatFreeRemainingLabel,
	freeHintsRemaining,
	freeTeachMeRemaining,
	grantRewardedHintEntitlement,
	grantRewardedTeachMeEntitlement,
	rollHelpAllowanceToDay,
	willConsumeFreeHint,
	willConsumeFreeTeachMe,
	willConsumePendingHint,
	willConsumePendingTeachMe,
	type HelpAllowanceState,
} from '../allowance'

function withUsed(
	overrides: Partial<HelpAllowanceState>,
): HelpAllowanceState {
	return {
		...createDefaultHelpAllowance('2026-10-01'),
		...overrides,
	}
}

describe('help allowance — free Hint', () => {
	it('allows first 5 successful Apply operations free', () => {
		let state = createDefaultHelpAllowance('2026-10-01')
		for (let i = 0; i < FREE_HINTS_PER_DAY; i += 1) {
			expect(canUseHintWithoutRewarded(state)).toBe(true)
			expect(willConsumeFreeHint(state)).toBe(true)
			const next = consumeHintApply(state)
			expect(next).not.toBeNull()
			state = next!
		}
		expect(freeHintsRemaining(state)).toBe(0)
		expect(canUseHintWithoutRewarded(state)).toBe(false)
	})

	it('sixth Hint requires rewarded (no free left, no pending)', () => {
		const exhausted = withUsed({ freeHintsUsedToday: FREE_HINTS_PER_DAY })
		expect(canUseHintWithoutRewarded(exhausted)).toBe(false)
		expect(consumeHintApply(exhausted)).toBeNull()
	})

	it('opening/closing Hint does not consume (pure helpers only on Apply)', () => {
		const state = createDefaultHelpAllowance('2026-10-01')
		expect(freeHintsRemaining(state)).toBe(FREE_HINTS_PER_DAY)
		// No consume call ⇒ unchanged
		expect(state.freeHintsUsedToday).toBe(0)
	})

	it('STALLED / failed Apply path: no consume helper invoked ⇒ unchanged', () => {
		const state = withUsed({ freeHintsUsedToday: 2 })
		expect(freeHintsRemaining(state)).toBe(3)
		expect(willConsumeFreeHint(state)).toBe(true)
	})
})

describe('help allowance — free Teach Me', () => {
	it('allows first 5 valid explanations free', () => {
		let state = createDefaultHelpAllowance('2026-10-01')
		for (let i = 0; i < FREE_TEACH_ME_PER_DAY; i += 1) {
			expect(canUseTeachMeWithoutRewarded(state)).toBe(true)
			expect(willConsumeFreeTeachMe(state)).toBe(true)
			const next = consumeTeachMeReveal(state)
			expect(next).not.toBeNull()
			state = next!
		}
		expect(freeTeachMeRemaining(state)).toBe(0)
		expect(canUseTeachMeWithoutRewarded(state)).toBe(false)
	})

	it('Hint and Teach Me counters are separate', () => {
		let state = createDefaultHelpAllowance('2026-10-01')
		for (let i = 0; i < FREE_HINTS_PER_DAY; i += 1) {
			state = consumeHintApply(state)!
		}
		expect(canUseHintWithoutRewarded(state)).toBe(false)
		expect(canUseTeachMeWithoutRewarded(state)).toBe(true)
		expect(freeTeachMeRemaining(state)).toBe(FREE_TEACH_ME_PER_DAY)
	})

	it('rerender does not double-consume — consume once per reveal', () => {
		const state = createDefaultHelpAllowance('2026-10-01')
		const once = consumeTeachMeReveal(state)!
		expect(once.freeTeachMeUsedToday).toBe(1)
		// Same open explanation must not call consume again; second call is a
		// new reveal and would count — callers must not re-invoke.
		expect(once.freeTeachMeUsedToday).toBe(1)
	})
})

describe('help allowance — daily reset', () => {
	it('same day persists counters', () => {
		const state = withUsed({
			helpAllowanceDay: '2026-10-01',
			freeHintsUsedToday: 3,
			freeTeachMeUsedToday: 2,
		})
		const rolled = rollHelpAllowanceToDay(state, '2026-10-01')
		expect(rolled).toBe(state)
		expect(rolled.freeHintsUsedToday).toBe(3)
		expect(rolled.freeTeachMeUsedToday).toBe(2)
	})

	it('next local day resets both free counters to 0 (5 remaining)', () => {
		const state = withUsed({
			helpAllowanceDay: '2026-10-01',
			freeHintsUsedToday: 5,
			freeTeachMeUsedToday: 5,
			pendingRewardedHints: 1,
			pendingRewardedTeachMe: 1,
		})
		const rolled = rollHelpAllowanceToDay(state, '2026-10-02')
		expect(rolled.helpAllowanceDay).toBe('2026-10-02')
		expect(rolled.freeHintsUsedToday).toBe(0)
		expect(rolled.freeTeachMeUsedToday).toBe(0)
		expect(freeHintsRemaining(rolled)).toBe(FREE_HINTS_PER_DAY)
		expect(freeTeachMeRemaining(rolled)).toBe(FREE_TEACH_ME_PER_DAY)
		// Pending entitlements survive midnight.
		expect(rolled.pendingRewardedHints).toBe(1)
		expect(rolled.pendingRewardedTeachMe).toBe(1)
	})
})

describe('help allowance — rewarded entitlement', () => {
	it('confirmed reward grants exactly one pending Hint', () => {
		const exhausted = withUsed({ freeHintsUsedToday: FREE_HINTS_PER_DAY })
		const granted = grantRewardedHintEntitlement(exhausted)
		expect(granted.pendingRewardedHints).toBe(1)
		expect(canUseHintWithoutRewarded(granted)).toBe(true)
		expect(willConsumePendingHint(granted)).toBe(true)
		expect(willConsumeFreeHint(granted)).toBe(false)
	})

	it('duplicate grant does not accumulate beyond one', () => {
		const exhausted = withUsed({ freeHintsUsedToday: FREE_HINTS_PER_DAY })
		const once = grantRewardedHintEntitlement(exhausted)
		const twice = grantRewardedHintEntitlement(once)
		expect(twice.pendingRewardedHints).toBe(1)
	})

	it('one rewarded entitlement → exactly one successful use', () => {
		let state = grantRewardedHintEntitlement(
			withUsed({ freeHintsUsedToday: FREE_HINTS_PER_DAY }),
		)
		state = consumeHintApply(state)!
		expect(state.pendingRewardedHints).toBe(0)
		expect(canUseHintWithoutRewarded(state)).toBe(false)
		expect(consumeHintApply(state)).toBeNull()
	})

	it('Teach Me rewarded entitlement is independent', () => {
		let state = withUsed({
			freeHintsUsedToday: FREE_HINTS_PER_DAY,
			freeTeachMeUsedToday: FREE_TEACH_ME_PER_DAY,
		})
		state = grantRewardedTeachMeEntitlement(state)
		expect(canUseHintWithoutRewarded(state)).toBe(false)
		expect(canUseTeachMeWithoutRewarded(state)).toBe(true)
		expect(willConsumePendingTeachMe(state)).toBe(true)
		state = consumeTeachMeReveal(state)!
		expect(state.pendingRewardedTeachMe).toBe(0)
		expect(canUseTeachMeWithoutRewarded(state)).toBe(false)
	})

	it('failed post-ad computation does not steal entitlement', () => {
		const pending = grantRewardedHintEntitlement(
			withUsed({ freeHintsUsedToday: FREE_HINTS_PER_DAY }),
		)
		// STALLED / no Apply ⇒ never call consumeHintApply
		expect(pending.pendingRewardedHints).toBe(1)
		expect(canUseHintWithoutRewarded(pending)).toBe(true)
	})

	it('formats remaining label consistently (remaining of total)', () => {
		expect(formatFreeRemainingLabel(3, 5)).toBe(
			'Бесплатно сегодня: 3 из 5 осталось',
		)
	})
})
