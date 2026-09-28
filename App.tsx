import { StatusBar } from 'expo-status-bar'
import { StyleSheet, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { RootNavigation } from './src/navigation/RootNavigation'
import { BannerSlot } from './src/components/BannerSlot'
import { colors } from './src/theme'

/**
 * Minimal application shell.
 * Layout contract: CONTENT -> BANNER -> SAFE AREA (ForestMusic DevTools).
 */
export default function App() {
	return (
		<SafeAreaProvider>
			<SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
				<View style={styles.content}>
					<RootNavigation />
				</View>
				<BannerSlot />
				<SafeAreaView edges={['bottom']} style={styles.bottomInset} />
				<StatusBar style="dark" />
			</SafeAreaView>
		</SafeAreaProvider>
	)
}

const styles = StyleSheet.create({
	safe: {
		flex: 1,
		backgroundColor: colors.background,
	},
	content: {
		flex: 1,
	},
	bottomInset: {
		backgroundColor: colors.background,
	},
})
