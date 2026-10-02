/**
 * Transition guard — repeated CTA taps must not stack operations.
 */

import { createTransitionGuard } from '../transitionGuard'

describe('createTransitionGuard', () => {
	it('drops repeated runs while the first is in flight', async () => {
		const guard = createTransitionGuard()
		let release: () => void = () => undefined
		const gate = new Promise<void>((resolve) => {
			release = resolve
		})
		const operation = jest.fn(() => gate)

		const first = guard.run(operation)
		const second = guard.run(operation)
		const third = guard.run(operation)
		expect(guard.isInFlight()).toBe(true)

		release()
		await expect(first).resolves.toBe(true)
		await expect(second).resolves.toBe(false)
		await expect(third).resolves.toBe(false)
		expect(operation).toHaveBeenCalledTimes(1)
		expect(guard.isInFlight()).toBe(false)
	})

	it('allows a new run after the previous one settles', async () => {
		const guard = createTransitionGuard()
		const operation = jest.fn(async () => undefined)
		await guard.run(operation)
		await guard.run(operation)
		expect(operation).toHaveBeenCalledTimes(2)
	})

	it('releases the guard when the operation throws', async () => {
		const guard = createTransitionGuard()
		await expect(
			guard.run(async () => {
				throw new Error('interstitial failed')
			}),
		).rejects.toThrow('interstitial failed')
		expect(guard.isInFlight()).toBe(false)
		await expect(guard.run(async () => undefined)).resolves.toBe(true)
	})
})
