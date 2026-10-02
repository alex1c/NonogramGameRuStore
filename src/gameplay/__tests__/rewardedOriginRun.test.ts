/**
 * Phase 9D — M1 rewarded origin run id gate.
 */

import { shouldRunActiveTimer } from '../activeTimerGate'

describe('rewarded origin run resume (M1)', () => {
	it('stale rewarded dismiss for run A must not resume run B', () => {
		expect(
			shouldRunActiveTimer({
				appState: 'active',
				completed: false,
				rewardedOpen: false,
				callbackRunId: 'run-A',
				currentRunId: 'run-B',
			}),
		).toBe(false)
	})

	it('same run resumes after rewarded when active', () => {
		expect(
			shouldRunActiveTimer({
				appState: 'active',
				completed: false,
				rewardedOpen: false,
				callbackRunId: 'run-A',
				currentRunId: 'run-A',
			}),
		).toBe(true)
	})

	it('background during rewarded → dismiss keeps timer paused', () => {
		expect(
			shouldRunActiveTimer({
				appState: 'background',
				completed: false,
				rewardedOpen: false,
				callbackRunId: 'run-A',
				currentRunId: 'run-A',
			}),
		).toBe(false)
	})
})
