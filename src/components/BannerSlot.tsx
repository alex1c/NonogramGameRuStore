/**
 * BannerSlot — reserved bottom geometry + optional Yandex BannerView.
 * Tutorial must pass visible={false} / null placement (no ad request).
 */

import { useEffect, useState } from 'react'
import { Dimensions, StyleSheet, View } from 'react-native'
import { BannerAdSize, BannerView } from 'yandex-mobile-ads'
import { getBannerUnitId, type BannerPlacement } from '../ads/config'
import { colors } from '../theme'

/** Standard reserved banner height (ForestMusic geometry contract). */
export const BANNER_SLOT_HEIGHT = 50

interface BannerSlotProps {
	/** When null, reserve nothing and do not request an ad (tutorial). */
	readonly placement: BannerPlacement | null
	readonly testID?: string
}

export function BannerSlot({
	placement,
	testID = 'banner-slot',
}: BannerSlotProps) {
	const [bannerSize, setBannerSize] = useState<Awaited<
		ReturnType<typeof BannerAdSize.stickySize>
	> | null>(null)
	const [slotHeight, setSlotHeight] = useState(BANNER_SLOT_HEIGHT)

	useEffect(() => {
		if (placement === null) {
			return
		}
		let active = true
		void BannerAdSize.stickySize(Dimensions.get('window').width)
			.then((size) => {
				if (!active) {
					return
				}
				setBannerSize(size)
				setSlotHeight(Math.max(BANNER_SLOT_HEIGHT, size.height))
			})
			.catch(() => undefined)
		return () => {
			active = false
		}
	}, [placement])

	if (placement === null) {
		return null
	}

	return (
		<View
			accessibilityLabel="Рекламный баннер"
			style={[styles.container, { height: slotHeight }]}
			testID={testID}
		>
			{bannerSize !== null ? (
				<BannerView
					size={bannerSize}
					adRequest={{ adUnitId: getBannerUnitId(placement) }}
					style={styles.ad}
					onAdFailedToLoad={() => undefined}
				/>
			) : null}
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		width: '100%',
		backgroundColor: colors.surface,
		alignItems: 'center',
		justifyContent: 'center',
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: colors.border,
		overflow: 'hidden',
	},
	ad: {
		width: '100%',
		height: '100%',
	},
})
