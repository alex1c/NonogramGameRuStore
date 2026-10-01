/**
 * About — product name, version, Privacy Policy, Other apps.
 */

import Constants from 'expo-constants'
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
	ABOUT_DEVELOPER,
	ABOUT_OTHER_APPS_URL,
	ABOUT_PRIVACY_URL,
	ABOUT_WEBSITE_URL,
	APP_FULL_NAME,
} from '../about/config'
import { colors, spacing, typography } from '../theme'

interface AboutScreenProps {
	readonly onBack: () => void
}

async function openUrl(url: string): Promise<void> {
	try {
		await Linking.openURL(url)
	} catch {
		// Offline / no handler — non-blocking.
	}
}

export function AboutScreen({ onBack }: AboutScreenProps) {
	const insets = useSafeAreaInsets()
	const version =
		Constants.expoConfig?.version ??
		Constants.nativeAppVersion ??
		'1.0.0'

	return (
		<View
			style={[styles.root, { paddingTop: insets.top + spacing.md }]}
			testID="about-screen"
		>
			<Pressable onPress={onBack} accessibilityRole="button">
				<Text style={styles.back}>← Назад</Text>
			</Pressable>
			<Text style={styles.title} accessibilityRole="header">
				О приложении
			</Text>
			<Text style={styles.name}>{APP_FULL_NAME}</Text>
			<Text style={styles.meta}>Разработчик: {ABOUT_DEVELOPER}</Text>
			<Text style={styles.meta}>Версия {version}</Text>

			<Pressable
				onPress={() => {
					void openUrl(ABOUT_PRIVACY_URL)
				}}
				style={styles.linkRow}
				accessibilityRole="link"
				accessibilityLabel="Политика конфиденциальности"
				testID="about-privacy"
			>
				<Text style={styles.linkText}>Политика конфиденциальности</Text>
			</Pressable>

			<Pressable
				onPress={() => {
					void openUrl(ABOUT_OTHER_APPS_URL)
				}}
				style={styles.linkRow}
				accessibilityRole="link"
				accessibilityLabel="Другие наши программы"
				testID="about-other-apps"
			>
				<Text style={styles.linkText}>Другие наши программы</Text>
			</Pressable>

			<Pressable
				onPress={() => {
					void openUrl(ABOUT_WEBSITE_URL)
				}}
				style={styles.linkRow}
				accessibilityRole="link"
			>
				<Text style={styles.linkText}>Сайт разработчика</Text>
			</Pressable>
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
	name: {
		...typography.subtitle,
		color: colors.text,
		fontWeight: '700',
		marginTop: spacing.sm,
	},
	meta: {
		...typography.caption,
		color: colors.textMuted,
	},
	linkRow: {
		marginTop: spacing.sm,
		backgroundColor: colors.surface,
		borderRadius: 12,
		padding: spacing.md,
		borderWidth: 1,
		borderColor: colors.border,
	},
	linkText: {
		...typography.subtitle,
		color: colors.accent,
		fontWeight: '600',
	},
})
