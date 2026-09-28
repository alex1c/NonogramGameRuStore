/**
 * Reserved BannerSlot geometry contract (ForestMusic DevTools).
 * Phase 0/1 does not mount an ad SDK — this only reserves layout height.
 */

import { StyleSheet, View } from 'react-native'

/** Standard reserved banner height before SDK integration. */
export const BANNER_SLOT_HEIGHT = 50

interface BannerSlotProps {
	readonly visible?: boolean
}

export function BannerSlot({ visible = true }: BannerSlotProps) {
	if (!visible) {
		return null
	}
	return <View style={styles.slot} testID="banner-slot" accessibilityElementsHidden />
}

const styles = StyleSheet.create({
	slot: {
		height: BANNER_SLOT_HEIGHT,
		width: '100%',
		backgroundColor: 'transparent',
	},
})
