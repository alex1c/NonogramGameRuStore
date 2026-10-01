/**
 * Settings — game options, tutorial replay, About entry.
 * No ads inside nested dialogs; banner hosted by App shell (information).
 */

import Constants from 'expo-constants'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { APP_SHORT_NAME } from '../about/config'
import { colors, spacing, typography } from '../theme'

interface SettingsScreenProps {
	readonly onBack: () => void
	readonly onOpenAbout: () => void
	readonly onReplayTutorial: () => void
	readonly onResetTutorialDev?: () => void
}

export function SettingsScreen({
	onBack,
	onOpenAbout,
	onReplayTutorial,
	onResetTutorialDev,
}: SettingsScreenProps) {
	const insets = useSafeAreaInsets()
	const version =
		Constants.expoConfig?.version ??
		Constants.nativeAppVersion ??
		'1.0.0'

	return (
		<View
			style={[styles.root, { paddingTop: insets.top + spacing.md }]}
			testID="settings-screen"
		>
			<Pressable onPress={onBack} accessibilityRole="button">
				<Text style={styles.back}>← Назад</Text>
			</Pressable>
			<Text style={styles.title} accessibilityRole="header">
				Настройки
			</Text>
			<Text style={styles.caption}>{APP_SHORT_NAME}</Text>

			<Text style={styles.section}>Игра</Text>
			<Pressable
				onPress={onReplayTutorial}
				style={styles.row}
				accessibilityRole="button"
				accessibilityLabel="Пройти обучение снова"
				testID="settings-replay-tutorial"
			>
				<Text style={styles.rowText}>Пройти обучение снова</Text>
			</Pressable>

			<Text style={styles.section}>О приложении</Text>
			<Pressable
				onPress={onOpenAbout}
				style={styles.row}
				accessibilityRole="button"
				testID="settings-about"
			>
				<Text style={styles.rowText}>О приложении</Text>
			</Pressable>
			<Text style={styles.meta}>Версия {version}</Text>

			{__DEV__ && onResetTutorialDev !== undefined ? (
				<Pressable
					onPress={onResetTutorialDev}
					style={styles.devRow}
					accessibilityRole="button"
				>
					<Text style={styles.devText}>DEV: Сбросить обучение</Text>
				</Pressable>
			) : null}
		</View>
	)
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
		paddingHorizontal: spacing.lg,
		backgroundColor: colors.background,
		gap: spacing.sm,
	},
	back: {
		...typography.caption,
		color: colors.accent,
		fontWeight: '600',
	},
	title: {
		...typography.title,
		color: colors.text,
	},
	caption: {
		...typography.subtitle,
		color: colors.textMuted,
		marginBottom: spacing.md,
	},
	section: {
		...typography.badge,
		color: colors.textMuted,
		marginTop: spacing.md,
	},
	row: {
		backgroundColor: colors.surface,
		borderRadius: 12,
		padding: spacing.md,
		borderWidth: 1,
		borderColor: colors.border,
	},
	rowText: {
		...typography.subtitle,
		color: colors.text,
	},
	meta: {
		...typography.caption,
		color: colors.textMuted,
	},
	devRow: {
		marginTop: spacing.lg,
		padding: spacing.sm,
	},
	devText: {
		...typography.caption,
		color: '#8A4B2E',
	},
})
