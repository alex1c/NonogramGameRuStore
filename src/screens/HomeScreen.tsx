/**
 * Minimal Home shell — Phase 0 only.
 * No game board, ads, or production navigation.
 */

import { StyleSheet, Text, View } from 'react-native'
import { colors, spacing, typography } from '../theme'

export function HomeScreen() {
	return (
		<View style={styles.root} testID="home-screen">
			<Text style={styles.title} accessibilityRole="header">
				Японские кроссворды
			</Text>
			<Text style={styles.subtitle}>NonogramGame</Text>
			<Text style={styles.badge} testID="boot-ok">
				BOOT_OK
			</Text>
			<Text style={styles.hint}>
				Phase 0 + Phase 1 foundation loaded
			</Text>
		</View>
	)
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: spacing.lg,
		backgroundColor: colors.background,
		gap: spacing.sm,
	},
	title: {
		...typography.title,
		color: colors.text,
		textAlign: 'center',
	},
	subtitle: {
		...typography.subtitle,
		color: colors.textMuted,
	},
	badge: {
		...typography.badge,
		color: colors.accent,
		marginTop: spacing.md,
	},
	hint: {
		...typography.caption,
		color: colors.textMuted,
		textAlign: 'center',
		marginTop: spacing.sm,
	},
})
