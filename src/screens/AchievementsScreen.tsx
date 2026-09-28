/**
 * Achievements screen — stable displayOrder, derived unlock/progress.
 */

import { useEffect, useMemo } from 'react'
import {
	BackHandler,
	FlatList,
	Pressable,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AchievementIcon } from '../components/AchievementIcon'
import {
	contextFromSave,
	evaluateAchievements,
	type AchievementState,
} from '../achievements'
import { useProgress } from '../progress/ProgressProvider'
import { colors, spacing, typography } from '../theme'

interface AchievementsScreenProps {
	readonly onBack: () => void
}

export function AchievementsScreen({ onBack }: AchievementsScreenProps) {
	const insets = useSafeAreaInsets()
	const { save } = useProgress()
	const states = useMemo(
		() => evaluateAchievements(contextFromSave(save)),
		[save],
	)
	const unlockedCount = states.filter((item) => item.access === 'UNLOCKED').length

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
					paddingBottom: Math.max(insets.bottom, 8),
				},
			]}
			testID="achievements-screen"
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
					Достижения
				</Text>
			</View>
			<Text style={styles.progress}>
				Получено {unlockedCount} из {states.length}
			</Text>
			<FlatList
				data={states}
				keyExtractor={(item) => item.id}
				contentContainerStyle={styles.list}
				ItemSeparatorComponent={() => <View style={styles.sep} />}
				renderItem={({ item }) => <AchievementRow item={item} />}
			/>
		</View>
	)
}

function AchievementRow({ item }: { item: AchievementState }) {
	const unlocked = item.access === 'UNLOCKED'
	return (
		<View
			style={[styles.row, unlocked ? styles.rowUnlocked : styles.rowLocked]}
			accessibilityLabel={`${item.titleRu}. ${item.descriptionRu}. ${item.progressLabel}. ${unlocked ? 'Получено' : 'Не получено'}`}
		>
			<AchievementIcon iconKey={item.iconKey} unlocked={unlocked} />
			<View style={styles.body}>
				<Text style={styles.rowTitle}>{item.titleRu}</Text>
				<Text style={styles.rowDesc}>{item.descriptionRu}</Text>
				<Text style={styles.rowProgress}>
					{unlocked ? 'Получено' : item.progressLabel}
				</Text>
			</View>
			{unlocked ? <Text style={styles.check}>✓</Text> : <Text style={styles.lock}>◇</Text>}
		</View>
	)
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.background },
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: spacing.md,
		minHeight: 48,
	},
	backButton: { minWidth: 72, minHeight: 44, justifyContent: 'center' },
	backText: { fontSize: 16, fontWeight: '700', color: colors.accent },
	title: {
		...typography.title,
		fontSize: 22,
		color: colors.text,
		flex: 1,
		textAlign: 'center',
		marginRight: 72,
	},
	progress: {
		textAlign: 'center',
		color: colors.textMuted,
		fontWeight: '600',
		marginBottom: 8,
	},
	list: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
	sep: { height: 8 },
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: colors.border,
		padding: 12,
		minHeight: 76,
		backgroundColor: '#FFFFFF',
	},
	rowUnlocked: {},
	rowLocked: { backgroundColor: colors.surface },
	body: { flex: 1 },
	rowTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
	rowDesc: { marginTop: 2, fontSize: 13, color: colors.textMuted },
	rowProgress: { marginTop: 4, fontSize: 12, fontWeight: '700', color: colors.accent },
	check: { fontSize: 18, fontWeight: '700', color: colors.accent },
	lock: { fontSize: 16, color: colors.textMuted },
})
