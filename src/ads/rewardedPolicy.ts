/**
 * Verified-reward grant guard (ForestMusic / Переливайка pattern).
 * Only the SDK reward callback may grant; dismiss/fail never grants.
 */

export interface RewardGrantGuard {
	readonly onVerifiedReward: () => boolean
	readonly onDismissed: () => void
	readonly hasGranted: () => boolean
}

export function createRewardGrantGuard(onGrant: () => void): RewardGrantGuard {
	let granted = false

	return {
		onVerifiedReward: () => {
			if (granted) {
				return false
			}
			granted = true
			onGrant()
			return true
		},
		onDismissed: () => undefined,
		hasGranted: () => granted,
	}
}
