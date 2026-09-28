import { useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { RootNavigation } from './src/navigation/RootNavigation'
import { BannerSlot } from './src/components/BannerSlot'
import { ProgressProvider, useProgress } from './src/progress/ProgressProvider'
import { colors, typography } from './src/theme'

/**
 * App shell.
 * Hydrates save before showing Home. BannerSlot on Home/Levels/Statistics.
 * Game owns its own safe-area padding and does not show a banner.
 */
export default function App() {
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
	const [bannerHost, setBannerHost] = useState(true)

	if (status === 'LOADING') {
		return (
			<View style={styles.loading} testID="hydration-loading">
				<Text style={styles.loadingTitle}>Японские кроссворды</Text>
				<Text style={styles.loadingCaption}>Загрузка…</Text>
				<ActivityIndicator color={colors.accent} />
				<StatusBar style="dark" />
			</View>
		)
	}

	return (
		<View style={styles.flex}>
			<View style={styles.flex}>
				<RootNavigation onBannerHostChange={setBannerHost} />
			</View>
			{bannerHost ? (
				<>
					<BannerSlot />
					<SafeAreaView edges={['bottom']} style={styles.bottomInset} />
				</>
			) : null}
			<StatusBar style={bannerHost ? 'dark' : 'auto'} />
		</View>
	)
}

const styles = StyleSheet.create({
	flex: {
		flex: 1,
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
