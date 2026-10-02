/**
 * Statistics — campaign progress aggregates (no chart library).
 */

import { useEffect } from 'react'
import {
	BackHandler,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
	contextFromSave,
	evaluateAchievements,
} from '../achievements'
import { countGalleryUnlocked } from '../gallery'
import { buildStatisticsViewModel } from '../presentation/statisticsViewModel'
import { useProgress } from '../progress/ProgressProvider'
import { colors, spacing, typography } from '../theme'

interface StatisticsScreenProps {
	readonly onBack: () => void
}

export function StatisticsScreen({ onBack }: StatisticsScreenProps) {
	const insets = useSafeAreaInsets()
	const { save } = useProgress()
	const stats = buildStatisticsViewModel(save)
	const gallery = countGalleryUnlocked(save.solvedPuzzleIds)
	const achievements = evaluateAchievements(contextFromSave(save))
	const unlockedAchievements = achievements.filter(
		(item) => item.access === 'UNLOCKED',
	).length
	const dailyCount = save.dailyCompletionRecords.length

	useEffect(() => {
		const sub = BackHandler.addEventListener('hardwareBackPress', () => {
			onBack()
			return true
		})
		return () => sub.remove()
	}, [onBack])

	return (
		<View
			style={[
				styles.root,
				{
					paddingTop: insets.top + spacing.sm,
				},
			]}
			testID="statistics-screen"
		>
			<View style={styles.header}>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Назад"
					onPress={onBack}
					style={styles.backButton}
					hitSlop={12}
				>
					<Text style={styles.backText}>← Назад</Text>
				</Pressable>
				<Text style={styles.title} accessibilityRole="header">
					Статистика
				</Text>
			</View>

			<ScrollView contentContainerStyle={styles.content}>
				<StatRow
					label="Уровней пройдено"
					value={`${stats.completedUnique} / ${stats.campaignTotal}`}
				/>
				<StatRow
					label="Картинок открыто"
					value={`${gallery.unlocked} / ${gallery.total}`}
				/>
				<StatRow label="Кроссвордов дня" value={String(dailyCount)} />
				<StatRow label="Начато" value={String(stats.startedUnique)} />
				<StatRow
					label="Всего прохождений"
					value={String(stats.totalCompletions)}
				/>
				<StatRow
					label="Активное время"
					value={stats.totalActiveTimeLabel}
				/>
				<StatRow
					label="Начать заново"
					value={String(stats.totalRestarts)}
				/>
				<StatRow
					label="Подсказок применено"
					value={String(stats.hintsApplied)}
				/>
				<StatRow
					label="Достижения"
					value={`${unlockedAchievements} / ${achievements.length}`}
				/>

				<Text style={styles.section}>По сложности</Text>
				{stats.byDifficulty.map((row) => (
					<StatRow
						key={row.tier}
						label={row.label}
						value={`${row.completed} / ${row.available}`}
					/>
				))}
			</ScrollView>
		</View>
	)
}

function StatRow({ label, value }: { label: string; value: string }) {
	return (
		<View style={styles.row} accessibilityLabel={`${label}: ${value}`}>
			<Text style={styles.rowLabel}>{label}</Text>
			<Text style={styles.rowValue}>{value}</Text>
		</View>
	)
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
		backgroundColor: colors.background,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: spacing.md,
		minHeight: 48,
	},
	backButton: {
		minWidth: 72,
		minHeight: 44,
		justifyContent: 'center',
	},
	backText: {
		fontSize: 16,
		fontWeight: '700',
		color: colors.accent,
	},
	title: {
		...typography.title,
		fontSize: 22,
		color: colors.text,
		flex: 1,
		textAlign: 'center',
		marginRight: 72,
	},
	content: {
		paddingHorizontal: spacing.lg,
		paddingBottom: spacing.xl,
		gap: 10,
	},
	section: {
		marginTop: spacing.md,
		marginBottom: spacing.xs,
		fontSize: 15,
		fontWeight: '700',
		color: colors.text,
	},
	row: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		backgroundColor: '#FFFFFF',
		borderRadius: 12,
		borderWidth: 1,
		borderColor: colors.border,
		paddingHorizontal: 14,
		paddingVertical: 12,
		minHeight: 48,
	},
	rowLabel: {
		fontSize: 15,
		color: colors.text,
		fontWeight: '600',
	},
	rowValue: {
		fontSize: 15,
		color: colors.textMuted,
		fontWeight: '700',
	},
})
