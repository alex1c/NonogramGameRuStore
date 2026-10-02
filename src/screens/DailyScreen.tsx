/**
 * Daily Challenge screen — Today card + streak + month calendar.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
	Alert,
	BackHandler,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
	projectCalendarMonth,
	type CalendarCellViewModel,
} from '../daily/calendar'
import {
	formatDayTitleRu,
	WEEKDAY_LABELS_RU,
	type DayKey,
} from '../daily/dateUtils'
import { getRestoreEligibility } from '../daily/streak'
import { getGalleryItemDef } from '../gallery/definitions'
import type { SaveRoot } from '../persistence/schema'
import {
	buildDailyStatsSummary,
	buildHomeDailyCard,
} from '../presentation/homeDailyViewModel'
import { formatGameElapsed } from '../presentation/timeFormat'
import { useProgress } from '../progress/ProgressProvider'
import { colors, spacing, typography } from '../theme'

interface DailyScreenProps {
	readonly onBack: () => void
	readonly onStartDaily: (puzzleId: string, dayKey: DayKey) => void
	readonly onResumeDaily: (puzzleId: string, dayKey: DayKey) => void
	readonly focusDayKey?: DayKey
}

export function DailyScreen({
	onBack,
	onStartDaily,
	onResumeDaily,
	focusDayKey,
}: DailyScreenProps) {
	const insets = useSafeAreaInsets()
	const { save, service, refresh } = useProgress()
	const today = service.todayDayKey()

	const focus = focusDayKey ?? today
	const [year, setYear] = useState(() => Number(focus.slice(0, 4)))
	const [month, setMonth] = useState(() => Number(focus.slice(5, 7)))
	const [detailKey, setDetailKey] = useState<DayKey | null>(null)

	useEffect(() => {
		void service.openDailyScreen().then(() => refresh())
	}, [refresh, service])

	useEffect(() => {
		const sub = BackHandler.addEventListener('hardwareBackPress', () => {
			if (detailKey !== null) {
				setDetailKey(null)
				return true
			}
			onBack()
			return true
		})
		return () => sub.remove()
	}, [detailKey, onBack])

	const calendar = useMemo(
		() =>
			projectCalendarMonth({
				year,
				month,
				today,
				completions: save.dailyCompletionRecords,
				restoredDays: save.restoredDailyDays,
				dailyStartedDay: save.dailyStartedDay,
				activeDailyDayKey: save.activeDailyGame?.dayKey ?? null,
			}),
		[year, month, today, save],
	)

	const stats = useMemo(
		() => buildDailyStatsSummary(save, today),
		[save, today],
	)
	const todayCard = useMemo(
		() => buildHomeDailyCard(save, today),
		[save, today],
	)

	const restore = useMemo(
		() =>
			getRestoreEligibility({
				today,
				completions: save.dailyCompletionRecords,
				restoredDays: save.restoredDailyDays,
				dailyStartedDay: save.dailyStartedDay,
			}),
		[save, today],
	)

	const handleTodayCta = useCallback(() => {
		if (
			todayCard.state === 'COMPLETED' ||
			todayCard.state === 'UNAVAILABLE'
		) {
			return
		}
		void service.startOrResumeDaily(today).then((result) => {
			refresh()
			if (result.kind === 'started' || result.kind === 'resumed') {
				if (result.kind === 'resumed') {
					onResumeDaily(result.puzzleId, result.dayKey)
				} else {
					onStartDaily(result.puzzleId, result.dayKey)
				}
			}
		})
	}, [onResumeDaily, onStartDaily, refresh, service, today, todayCard.state])

	const handleRestore = useCallback(() => {
		if (!restore.eligible || restore.missingDayKey === null) {
			return
		}
		const label = formatDayTitleRu(restore.missingDayKey)
		Alert.alert(
			'Восстановить серию?',
			`Восстановить серию за ${label}?`,
			[
				{ text: 'Не сейчас', style: 'cancel' },
				{
					text: 'Восстановить',
					onPress: () => {
						void service.restoreStreakDay().then(() => refresh())
					},
				},
			],
		)
	}, [refresh, restore, service])

	const detail = detailKey === null
		? null
		: buildDayDetail(detailKey, save, today, restore)

	return (
		<View
			style={[
				styles.root,
				{
					paddingTop: insets.top + spacing.sm,
				},
			]}
			testID="daily-screen"
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
					Кроссворд дня
				</Text>
			</View>

			<ScrollView contentContainerStyle={styles.content}>
				{save.dailyStartedDay === today ? (
					<Text style={styles.intro}>
						Каждый день — новый японский кроссворд. Решайте их
						подряд и собирайте серию.
					</Text>
				) : null}

				<View style={styles.todayCard}>
					<Text style={styles.cardTitle}>{todayCard.title}</Text>
					<Text style={styles.cardMeta}>{todayCard.metaLine}</Text>
					<Text style={styles.streakLine}>{stats.currentStreakLabel}</Text>
					<Text style={styles.streakLine}>{stats.longestStreakLabel}</Text>
					{todayCard.state !== 'COMPLETED' &&
					todayCard.state !== 'UNAVAILABLE' ? (
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={todayCard.accessibilityLabel}
							onPress={handleTodayCta}
							style={({ pressed }) => [
								styles.cta,
								{ opacity: pressed ? 0.9 : 1 },
							]}
							testID="daily-today-cta"
						>
							<Text style={styles.ctaText}>{todayCard.ctaLabel}</Text>
						</Pressable>
					) : (
						<Text style={styles.doneBadge}>Пройдено</Text>
					)}
				</View>

				{restore.eligible && restore.missingDayKey !== null ? (
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={`Восстановить серию за ${formatDayTitleRu(restore.missingDayKey)}`}
						onPress={handleRestore}
						style={styles.restoreButton}
					>
						<Text style={styles.restoreText}>
							Восстановить серию за{' '}
							{formatDayTitleRu(restore.missingDayKey)}
						</Text>
					</Pressable>
				) : null}

				<View style={styles.monthNav}>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel="Предыдущий месяц"
						disabled={!calendar.canGoPrevious}
						onPress={() => {
							if (month === 1) {
								setYear((y) => y - 1)
								setMonth(12)
							} else {
								setMonth((m) => m - 1)
							}
						}}
						style={[
							styles.navBtn,
							!calendar.canGoPrevious && styles.navDisabled,
						]}
					>
						<Text style={styles.navText}>‹</Text>
					</Pressable>
					<Text style={styles.monthTitle}>{calendar.titleRu}</Text>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel="Следующий месяц"
						disabled={!calendar.canGoNext}
						onPress={() => {
							if (month === 12) {
								setYear((y) => y + 1)
								setMonth(1)
							} else {
								setMonth((m) => m + 1)
							}
						}}
						style={[
							styles.navBtn,
							!calendar.canGoNext && styles.navDisabled,
						]}
					>
						<Text style={styles.navText}>›</Text>
					</Pressable>
				</View>

				<View style={styles.weekRow}>
					{WEEKDAY_LABELS_RU.map((label) => (
						<Text key={label} style={styles.weekLabel}>
							{label}
						</Text>
					))}
				</View>

				<View style={styles.grid}>
					{calendar.cells.map((cell, index) => (
						<CalendarCell
							key={`${cell.dayKey ?? 'e'}-${index}`}
							cell={cell}
							onPress={() => {
								if (cell.tappable && cell.dayKey !== null) {
									setDetailKey(cell.dayKey)
								}
							}}
						/>
					))}
				</View>

				{detail !== null ? (
					<View style={styles.detailCard}>
						<Text style={styles.detailTitle}>{detail.title}</Text>
						{detail.lines.map((line) => (
							<Text key={line} style={styles.detailLine}>
								{line}
							</Text>
						))}
						<Pressable
							onPress={() => setDetailKey(null)}
							accessibilityRole="button"
							accessibilityLabel="Закрыть"
						>
							<Text style={styles.detailClose}>Закрыть</Text>
						</Pressable>
					</View>
				) : null}

				<Text style={styles.footerStats}>
					Кроссвордов дня: {stats.completedCount}
				</Text>
			</ScrollView>
		</View>
	)
}

function CalendarCell({
	cell,
	onPress,
}: {
	readonly cell: CalendarCellViewModel
	readonly onPress: () => void
}) {
	if (cell.dayNumber === null) {
		return <View style={styles.cellEmpty} />
	}
	const marker =
		cell.state === 'COMPLETED'
			? '✓'
			: cell.state === 'RESTORED'
				? '↻'
				: cell.state === 'MISSED'
					? '·'
					: ''
	const isToday = cell.isToday
	const content = (
		<View
			style={[
				styles.cell,
				isToday && styles.cellToday,
				cell.state === 'FUTURE' && styles.cellMuted,
				cell.state === 'BEFORE_EPOCH' && styles.cellMuted,
				cell.state === 'BEFORE_USER_START' && styles.cellMuted,
			]}
		>
			<Text style={styles.cellDay}>{cell.dayNumber}</Text>
			{marker !== '' ? (
				<Text style={styles.cellMarker}>{marker}</Text>
			) : null}
		</View>
	)
	if (!cell.tappable) {
		return (
			<View
				style={styles.cellWrap}
				accessibilityLabel={cell.accessibilityLabel}
			>
				{content}
			</View>
		)
	}
	return (
		<Pressable
			style={styles.cellWrap}
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={cell.accessibilityLabel}
		>
			{content}
		</Pressable>
	)
}

function buildDayDetail(
	dayKey: DayKey,
	save: SaveRoot,
	today: DayKey,
	restore: ReturnType<typeof getRestoreEligibility>,
): { title: string; lines: string[] } {
	const title = formatDayTitleRu(dayKey, Number(today.slice(0, 4)))
	const record = save.dailyCompletionRecords.find((r) => r.dayKey === dayKey)
	if (record !== undefined) {
		const gallery = getGalleryItemDef(record.puzzleId)
		return {
			title,
			lines: [
				gallery?.titleRu ?? 'Кроссворд дня',
				formatGameElapsed(record.activeTimeMs),
				'Пройдено',
			],
		}
	}
	if (save.restoredDailyDays.includes(dayKey)) {
		return { title, lines: ['Восстановлено'] }
	}
	if (dayKey === today) {
		return { title, lines: ['Сегодня'] }
	}
	const lines = ['Этот кроссворд дня пропущен']
	if (restore.eligible && restore.missingDayKey === dayKey) {
		lines.push('Можно восстановить серию')
	}
	return { title, lines }
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.background },
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: spacing.md,
		marginBottom: spacing.sm,
	},
	backButton: { minHeight: 44, justifyContent: 'center', paddingRight: 12 },
	backText: { color: colors.accent, fontWeight: '600', fontSize: 16 },
	title: { ...typography.title, color: colors.text, flex: 1, fontSize: 20 },
	content: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, gap: 10 },
	intro: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
	todayCard: {
		backgroundColor: '#FFFFFF',
		borderRadius: 14,
		borderWidth: 1,
		borderColor: colors.border,
		padding: 16,
		gap: 4,
	},
	cardTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
	cardMeta: { fontSize: 14, color: colors.textMuted },
	streakLine: { fontSize: 14, color: colors.text, fontWeight: '600' },
	cta: {
		marginTop: 10,
		backgroundColor: colors.accent,
		borderRadius: 12,
		paddingVertical: 12,
		alignItems: 'center',
	},
	ctaText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
	doneBadge: {
		marginTop: 8,
		color: colors.accent,
		fontWeight: '700',
		fontSize: 15,
	},
	restoreButton: {
		backgroundColor: '#FFFFFF',
		borderRadius: 12,
		borderWidth: 1,
		borderColor: colors.accent,
		paddingVertical: 12,
		paddingHorizontal: 14,
	},
	restoreText: {
		color: colors.accent,
		fontWeight: '700',
		textAlign: 'center',
		fontSize: 14,
	},
	monthNav: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginTop: 8,
	},
	navBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
	navDisabled: { opacity: 0.3 },
	navText: { fontSize: 28, color: colors.text, fontWeight: '300' },
	monthTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
	weekRow: { flexDirection: 'row' },
	weekLabel: {
		flex: 1,
		textAlign: 'center',
		fontSize: 12,
		color: colors.textMuted,
		fontWeight: '600',
	},
	grid: { flexDirection: 'row', flexWrap: 'wrap' },
	cellWrap: { width: '14.28%', aspectRatio: 1, padding: 2 },
	cellEmpty: { width: '14.28%', aspectRatio: 1 },
	cell: {
		flex: 1,
		borderRadius: 8,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#FFFFFF',
		borderWidth: 1,
		borderColor: colors.border,
	},
	cellToday: { borderColor: colors.accent, borderWidth: 2 },
	cellMuted: { opacity: 0.4 },
	cellDay: { fontSize: 13, fontWeight: '600', color: colors.text },
	cellMarker: { fontSize: 10, color: colors.accent, fontWeight: '700' },
	detailCard: {
		backgroundColor: colors.surface,
		borderRadius: 12,
		padding: 14,
		gap: 4,
	},
	detailTitle: { fontWeight: '700', color: colors.text, fontSize: 16 },
	detailLine: { color: colors.textMuted, fontSize: 14 },
	detailClose: { marginTop: 8, color: colors.accent, fontWeight: '600' },
	footerStats: {
		marginTop: 8,
		textAlign: 'center',
		color: colors.textMuted,
		fontSize: 13,
	},
})
