/**
 * Home — real game entry (Continue / Play / Levels / Statistics).
 * BannerSlot remains in App shell. DEV controls stay under __DEV__.
 */

import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getCampaignProgressSummary } from '../campaign'
import { buildHomeViewModel } from '../presentation/homeViewModel'
import { useProgress } from '../progress/ProgressProvider'
import { colors, spacing, typography } from '../theme'

interface HomeScreenProps {
	readonly onContinue: () => void
	readonly onPlay: () => void
	readonly onOpenLevels: () => void
	readonly onOpenStatistics: () => void
	readonly darkMode: boolean
	readonly onToggleDarkMode: () => void
}

export function HomeScreen({
	onContinue,
	onPlay,
	onOpenLevels,
	onOpenStatistics,
	darkMode,
	onToggleDarkMode,
}: HomeScreenProps) {
	const insets = useSafeAreaInsets()
	const { save, service, refresh } = useProgress()
	const home = buildHomeViewModel(save)
	const progress = getCampaignProgressSummary(save)
	const progressRatio =
		progress.total === 0 ? 0 : progress.completed / progress.total

	return (
		<View
			style={[styles.root, { paddingTop: insets.top + spacing.md }]}
			testID="home-screen"
		>
			<Text style={styles.title} accessibilityRole="header">
				Японские кроссворды
			</Text>

			<Text style={styles.progress} accessibilityLabel={progress.label}>
				{progress.label}
			</Text>
			<View
				style={styles.progressTrack}
				accessibilityRole="progressbar"
				accessibilityLabel={progress.label}
				accessibilityValue={{
					min: 0,
					max: 100,
					now: Math.round(progressRatio * 100),
				}}
			>
				<View
					style={[
						styles.progressFill,
						{ width: `${Math.round(progressRatio * 100)}%` },
					]}
				/>
			</View>

			{home.continueCard !== null ? (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={`${home.primaryLabel}. ${home.continueCard.sizeLabel}. ${home.continueCard.difficultyLabel}. ${home.continueCard.markedLabel}. ${home.continueCard.elapsedLabel}`}
					onPress={onContinue}
					style={({ pressed }) => [
						styles.primaryCard,
						{ opacity: pressed ? 0.9 : 1 },
					]}
					testID="home-continue"
				>
					<Text style={styles.primaryLabel}>{home.primaryLabel}</Text>
					<Text style={styles.primaryMeta}>
						{home.continueCard.sizeLabel} ·{' '}
						{home.continueCard.difficultyLabel}
					</Text>
					<Text style={styles.primaryMeta}>
						{home.continueCard.markedLabel} ·{' '}
						{home.continueCard.elapsedLabel}
					</Text>
				</Pressable>
			) : (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={home.primaryLabel}
					onPress={onPlay}
					style={({ pressed }) => [
						styles.primaryCard,
						{ opacity: pressed ? 0.9 : 1 },
					]}
					testID="home-play"
				>
					<Text style={styles.primaryLabel}>{home.primaryLabel}</Text>
					<Text style={styles.primaryMeta}>Выберите уровень</Text>
				</Pressable>
			)}

			<Pressable
				accessibilityRole="button"
				accessibilityLabel="Уровни"
				onPress={onOpenLevels}
				style={({ pressed }) => [
					styles.secondaryButton,
					{ opacity: pressed ? 0.85 : 1 },
				]}
			>
				<Text style={styles.secondaryText}>Уровни</Text>
			</Pressable>

			<Pressable
				accessibilityRole="button"
				accessibilityLabel="Статистика"
				onPress={onOpenStatistics}
				style={({ pressed }) => [
					styles.secondaryButton,
					{ opacity: pressed ? 0.85 : 1 },
				]}
			>
				<Text style={styles.secondaryText}>Статистика</Text>
			</Pressable>

			{__DEV__ ? (
				<View style={styles.devBlock}>
					<Pressable
						onPress={onToggleDarkMode}
						style={styles.devToggle}
						accessibilityRole="button"
					>
						<Text style={styles.devToggleText}>
							DEV: {darkMode ? 'Dark board' : 'Light board'}
						</Text>
					</Pressable>
					<Pressable
						onPress={() => {
							Alert.alert(
								'Сбросить прогресс?',
								'Только для DEV QA.',
								[
									{ text: 'Отмена', style: 'cancel' },
									{
										text: 'Сбросить',
										style: 'destructive',
										onPress: () => {
											void service.resetProgressDevOnly().then(() => {
												refresh()
											})
										},
									},
								],
							)
						}}
						style={styles.devToggle}
						accessibilityRole="button"
					>
						<Text style={styles.devToggleText}>DEV: Сбросить прогресс</Text>
					</Pressable>
				</View>
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
	title: {
		...typography.title,
		color: colors.text,
		textAlign: 'center',
		marginBottom: spacing.sm,
	},
	progress: {
		...typography.subtitle,
		color: colors.textMuted,
		textAlign: 'center',
	},
	progressTrack: {
		height: 8,
		borderRadius: 4,
		backgroundColor: colors.surface,
		overflow: 'hidden',
		marginBottom: spacing.md,
	},
	progressFill: {
		height: '100%',
		backgroundColor: colors.accent,
	},
	primaryCard: {
		backgroundColor: colors.accent,
		borderRadius: 16,
		paddingHorizontal: 18,
		paddingVertical: 18,
		minHeight: 88,
		justifyContent: 'center',
		marginTop: spacing.sm,
	},
	primaryLabel: {
		fontSize: 22,
		fontWeight: '700',
		color: '#FFFFFF',
	},
	primaryMeta: {
		marginTop: 4,
		fontSize: 14,
		color: '#E7F5EE',
	},
	secondaryButton: {
		backgroundColor: '#FFFFFF',
		borderRadius: 14,
		borderWidth: 1,
		borderColor: colors.border,
		paddingHorizontal: 16,
		paddingVertical: 14,
		minHeight: 52,
		justifyContent: 'center',
	},
	secondaryText: {
		fontSize: 17,
		fontWeight: '700',
		color: colors.text,
		textAlign: 'center',
	},
	devBlock: {
		marginTop: 'auto',
		marginBottom: spacing.md,
		gap: 4,
	},
	devToggle: {
		alignSelf: 'center',
		minHeight: 44,
		justifyContent: 'center',
	},
	devToggleText: {
		color: colors.accent,
		fontWeight: '600',
	},
})
