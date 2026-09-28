/**
 * Active timer: background wall time must not accumulate.
 */

import {
	createPausedTimer,
	pauseTimer,
	readActiveElapsedMs,
	startOrResumeTimer,
} from '../timer'

describe('active timer', () => {
	it('background hour does not count toward active elapsed', () => {
		let timer = createPausedTimer(0)
		timer = startOrResumeTimer(timer, 1_000)
		// +10 sec active
		timer = pauseTimer(timer, 11_000)
		expect(readActiveElapsedMs(timer, 11_000)).toBe(10_000)

		// sit in background for 1 hour wall time (still paused)
		expect(readActiveElapsedMs(timer, 11_000 + 3_600_000)).toBe(10_000)

		timer = startOrResumeTimer(timer, 11_000 + 3_600_000)
		// +5 sec more active
		const end = 11_000 + 3_600_000 + 5_000
		expect(readActiveElapsedMs(timer, end)).toBe(15_000)
	})
})
