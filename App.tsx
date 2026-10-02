import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { RootNavigation } from './src/navigation/RootNavigation'
import { BannerSlot } from './src/components/BannerSlot'
import type { BannerPlacement } from './src/ads'
import { initializeAds, preloadInterstitial } from './src/ads'
import { initializeAnalytics, trackEvent } from './src/analytics'
import { ProgressProvider, useProgress } from './src/progress/ProgressProvider'
import { colors, typography } from './src/theme'
import { APP_SHORT_NAME } from './src/about/config'

/**
 * App shell layout contract (ForestMusic):
 *
 * root (column)
 *   ├─ contentHost flex:1 overflow:hidden  ← screens / ScrollView / FlatList
 *   ├─ BannerSlot                         ← own layout row, never absolute
 *   └─ bottom SafeArea inset
 *
 * Game/Tutorial set placement=null so the shell banner is omitted;
 * Game mounts Banner 1 inside its own column above the system inset.
 */
export default function App() {
	useEffect(() => {
		initializeAnalytics()
		initializeAds()
		trackEvent('app_open')
		void preloadInterstitial()
	}, [])

	return (
		<GestureHandlerRootView style={styles.flex}>
			<SafeAreaProvider>
				<ProgressProvider>
					<AppBody />
				</ProgressProvider>
			</SafeAreaProvider>
		</GestureHandlerRootView>
	)
}

function AppBody() {
	const { status } = useProgress()
	const [bannerPlacement, setBannerPlacement] =
		useState<BannerPlacement | null>('home_levels')

	if (status === 'LOADING') {
		return (
			<View style={styles.loading} testID="hydration-loading">
				<Text style={styles.loadingTitle}>{APP_SHORT_NAME}</Text>
				<Text style={styles.loadingCaption}>Загрузка…</Text>
				<ActivityIndicator color={colors.accent} />
				<StatusBar style="dark" />
			</View>
		)
	}

	const showShellBanner = bannerPlacement !== null

	return (
		<View style={styles.flex} testID="app-shell">
			<View style={styles.contentHost} testID="app-content-host">
				<RootNavigation onBannerPlacementChange={setBannerPlacement} />
			</View>
			{showShellBanner ? (
				<>
					<BannerSlot placement={bannerPlacement} />
					<SafeAreaView edges={['bottom']} style={styles.bottomInset} />
				</>
			) : null}
			<StatusBar style="dark" />
		</View>
	)
}

const styles = StyleSheet.create({
	flex: {
		flex: 1,
		backgroundColor: colors.background,
	},
	/**
	 * Clip overflowing screen content so it cannot paint over the banner
	 * sibling (Android default overflow is visible).
	 */
	contentHost: {
		flex: 1,
		overflow: 'hidden',
		backgroundColor: colors.background,
	},
	bottomInset: {
		backgroundColor: colors.background,
	},
	loading: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colors.background,
		gap: 12,
	},
	loadingTitle: {
		...typography.title,
		color: colors.text,
	},
	loadingCaption: {
		...typography.subtitle,
		color: colors.textMuted,
	},
})
