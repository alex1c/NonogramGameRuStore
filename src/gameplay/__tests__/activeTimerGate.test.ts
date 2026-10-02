/**
 * Active timer gate — deterministic tests, including a fake-clock simulation
 * of the interval + AppState wiring used by GameScreen.
 */

import {
	createPausedTimer,
	pauseTimer,
	readActiveElapsedMs,
	startOrResumeTimer,
	type ActiveTimerState,
} from '../../persistence/timer'
import { createFakeClock } from '../../persistence/clock'
import {
	shouldRunActiveTimer,
	type ActiveTimerAppState,
} from '../activeTimerGate'

describe('shouldRunActiveTimer', () => {
	it('allows only a foreground, unfinished, ad-free run', () => {
		expect(
			shouldRunActiveTimer({
				appState: 'active',
				completed: false,
				rewardedOpen: false,
			}),
		).toBe(true)
	})

	it.each(['background', 'inactive', 'unknown', 'extension'] as const)(
		'blocks while appState is %s',
		(appState) => {
			expect(
				shouldRunActiveTimer({
					appState,
					completed: false,
					rewardedOpen: false,
				}),
			).toBe(false)
		},
	)

	it('blocks after completion', () => {
		expect(
			shouldRunActiveTimer({
				appState: 'active',
				completed: true,
				rewardedOpen: false,
			}),
		).toBe(false)
	})

	it('blocks while a rewarded ad is open', () => {
		expect(
			shouldRunActiveTimer({
				appState: 'active',
				completed: false,
				rewardedOpen: true,
			}),
		).toBe(false)
	})

	it('blocks stale callbacks from another run', () => {
		expect(
			shouldRunActiveTimer({
				appState: 'active',
				completed: false,
				rewardedOpen: false,
				callbackRunId: 1,
				currentRunId: 2,
			}),
		).toBe(false)
		expect(
			shouldRunActiveTimer({
				appState: 'active',
				completed: false,
				rewardedOpen: false,
				callbackRunId: 2,
				currentRunId: 2,
			}),
		).toBe(true)
	})
})

describe('interval tick simulation with fake clock', () => {
	/** Mirrors GameScreen: tick resumes only through the gate. */
	function createHarness() {
		const clock = createFakeClock(1_000)
		let appState: ActiveTimerAppState = 'active'
		let timer: ActiveTimerState = createPausedTimer(0)
		let completed = false
		let rewardedOpen = false
		let currentRunId = 1
		return {
			clock,
			setAppState(next: ActiveTimerAppState) {
				appState = next
				if (next !== 'active') {
					timer = pauseTimer(timer, clock.now())
				}
			},
			setRewardedOpen(next: boolean) {
				rewardedOpen = next
				if (next) {
					timer = pauseTimer(timer, clock.now())
				}
			},
			complete() {
				completed = true
				timer = pauseTimer(timer, clock.now())
			},
			bumpRun() {
				currentRunId += 1
			},
			tick(callbackRunId: number = currentRunId) {
				if (
					shouldRunActiveTimer({
						appState,
						completed,
						rewardedOpen,
						callbackRunId,
						currentRunId,
					})
				) {
					timer = startOrResumeTimer(timer, clock.now())
				}
			},
			elapsed() {
				return readActiveElapsedMs(timer, clock.now())
			},
			get runId() {
				return currentRunId
			},
		}
	}

	it('does not resume on interval ticks while backgrounded', () => {
		const h = createHarness()
		h.tick()
		h.clock.advance(5_000)
		h.setAppState('background')
		h.clock.advance(60_000)
		h.tick()
		h.tick()
		expect(h.elapsed()).toBe(5_000)
	})

	it('does not resume while inactive and resumes only after active', () => {
		const h = createHarness()
		h.tick()
		h.clock.advance(2_000)
		h.setAppState('inactive')
		h.clock.advance(10_000)
		h.tick()
		expect(h.elapsed()).toBe(2_000)
		h.setAppState('active')
		h.tick()
		h.clock.advance(1_000)
		expect(h.elapsed()).toBe(3_000)
	})

	it('does not resume during a rewarded ad or after completion', () => {
		const h = createHarness()
		h.tick()
		h.clock.advance(1_000)
		h.setRewardedOpen(true)
		h.clock.advance(30_000)
		h.tick()
		expect(h.elapsed()).toBe(1_000)
		h.setRewardedOpen(false)
		h.tick()
		h.clock.advance(500)
		h.complete()
		h.clock.advance(10_000)
		h.tick()
		expect(h.elapsed()).toBe(1_500)
	})

	it('ignores a stale tick captured by the previous run', () => {
		const h = createHarness()
		const staleRun = h.runId
		h.bumpRun()
		h.tick(staleRun)
		h.clock.advance(5_000)
		expect(h.elapsed()).toBe(0)
		h.tick()
		h.clock.advance(1_000)
		expect(h.elapsed()).toBe(1_000)
	})
})
