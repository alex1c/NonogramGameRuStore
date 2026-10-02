/**
 * BannerSlot — bottom-of-stack ad host (never absolute overlay).
 *
 * Height strategy:
 * - 0 until sticky size is known / while failed (no giant blank);
 * - reserved BANNER_SLOT_HEIGHT while loading after size known;
 * - measured sticky height once the ad reports loaded.
 *
 * Placement changes remount via key so state resets without sync setState in effects.
 */

import { useEffect, useState } from 'react'
import { Dimensions, StyleSheet, View } from 'react-native'
import { BannerAdSize, BannerView } from 'yandex-mobile-ads'
import { getBannerUnitId, type BannerPlacement } from '../ads/config'
import { colors } from '../theme'

/** Minimal reserved height while a banner is actively loading. */
export const BANNER_SLOT_HEIGHT = 50

type BannerLoadState = 'idle' | 'loading' | 'ready' | 'failed'

interface BannerSlotProps {
	/** When null, mount nothing and request no ad (tutorial). */
	readonly placement: BannerPlacement | null
	readonly testID?: string
}

export function BannerSlot({
	placement,
	testID = 'banner-slot',
}: BannerSlotProps) {
	if (placement === null) {
		return null
	}
	return (
		<BannerSlotMounted
			key={placement}
			placement={placement}
			testID={testID}
		/>
	)
}

function BannerSlotMounted({
	placement,
	testID,
}: {
	readonly placement: BannerPlacement
	readonly testID: string
}) {
	const [bannerSize, setBannerSize] = useState<Awaited<
		ReturnType<typeof BannerAdSize.stickySize>
	> | null>(null)
	const [loadState, setLoadState] = useState<BannerLoadState>('loading')
	const [readyHeight, setReadyHeight] = useState(BANNER_SLOT_HEIGHT)

	useEffect(() => {
		let active = true
		void BannerAdSize.stickySize(Dimensions.get('window').width)
			.then((size) => {
				if (!active) {
					return
				}
				setBannerSize(size)
				setReadyHeight(Math.max(BANNER_SLOT_HEIGHT, size.height))
			})
			.catch(() => {
				if (!active) {
					return
				}
				setLoadState('failed')
			})
		return () => {
			active = false
		}
	}, [placement])

	const slotHeight =
		loadState === 'failed'
			? 0
			: loadState === 'ready'
				? readyHeight
				: bannerSize === null
					? 0
					: BANNER_SLOT_HEIGHT

	if (slotHeight === 0 && loadState === 'failed') {
		return (
			<View
				testID={testID}
				accessibilityElementsHidden
				style={styles.collapsed}
			/>
		)
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
					onAdLoaded={() => setLoadState('ready')}
					onAdFailedToLoad={() => setLoadState('failed')}
				/>
			) : null}
		</View>
	)
}

/** Pure helper for layout tests — documents collapse rules. */
export function resolveBannerHostHeight(input: {
	readonly loadState: BannerLoadState
	readonly measuredHeight: number | null
}): number {
	if (input.loadState === 'failed' || input.loadState === 'idle') {
		return 0
	}
	if (input.loadState === 'ready') {
		return Math.max(BANNER_SLOT_HEIGHT, input.measuredHeight ?? BANNER_SLOT_HEIGHT)
	}
	return input.measuredHeight === null ? 0 : BANNER_SLOT_HEIGHT
}

const styles = StyleSheet.create({
	collapsed: {
		height: 0,
		width: '100%',
		overflow: 'hidden',
	},
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
