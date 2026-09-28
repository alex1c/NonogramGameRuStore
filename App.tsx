import { useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { StyleSheet, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { RootNavigation } from './src/navigation/RootNavigation'
import { BannerSlot } from './src/components/BannerSlot'
import { colors } from './src/theme'

/**
 * App shell.
 * Single navigation instance. BannerSlot only while Home is active.
 * Game owns its own safe-area padding and does not show a banner.
 */
export default function App() {
	const [homeActive, setHomeActive] = useState(true)

	return (
		<GestureHandlerRootView style={styles.flex}>
			<SafeAreaProvider>
				<View style={styles.flex}>
					<View style={styles.flex}>
						<RootNavigation onHomeActiveChange={setHomeActive} />
					</View>
					{homeActive ? (
						<>
							<BannerSlot />
							<SafeAreaView
								edges={['bottom']}
								style={styles.bottomInset}
							/>
						</>
					) : null}
					<StatusBar style={homeActive ? 'dark' : 'auto'} />
				</View>
			</SafeAreaProvider>
		</GestureHandlerRootView>
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
})
