/**
 * Levels — Sets list → Set detail (50 puzzles). Virtualized for B1000.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
	Alert,
	BackHandler,
	FlatList,
	Pressable,
	StyleSheet,
	Text,
	View,
	type ListRenderItem,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
	buildCampaignLevelCards,
	buildCampaignSetCards,
	type CampaignSetCardViewModel,
	type LevelCardViewModel,
} from '../campaign'
import { useProgress } from '../progress/ProgressProvider'
import { colors, spacing, typography } from '../theme'

export type LevelOpenIntent =
	| { readonly kind: 'start'; readonly puzzleId: string }
	| { readonly kind: 'resume'; readonly puzzleId: string }
	| { readonly kind: 'replay'; readonly puzzleId: string }

interface LevelsScreenProps {
	readonly onBack: () => void
	readonly onOpenLevel: (intent: LevelOpenIntent) => void
}

export function LevelsScreen({ onBack, onOpenLevel }: LevelsScreenProps) {
	const insets = useSafeAreaInsets()
	const { save } = useProgress()
	const setCards = useMemo(() => buildCampaignSetCards(save), [save])
	const [selectedSetId, setSelectedSetId] = useState<string | null>(null)
	const [lockedHint, setLockedHint] = useState<string | null>(null)
	const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

	const levelCards = useMemo(
		() =>
			selectedSetId === null
				? []
				: buildCampaignLevelCards(save, selectedSetId),
		[save, selectedSetId],
	)

	const selectedSet = setCards.find((s) => s.setId === selectedSetId) ?? null

	useEffect(() => {
		const sub = BackHandler.addEventListener('hardwareBackPress', () => {
			if (selectedSetId !== null) {
				setSelectedSetId(null)
				return true
			}
			onBack()
			return true
		})
		return () => sub.remove()
	}, [onBack, selectedSetId])

	const showLockedFeedback = useCallback((message: string) => {
		setLockedHint(message)
		if (hintTimer.current !== null) {
			clearTimeout(hintTimer.current)
		}
		hintTimer.current = setTimeout(() => setLockedHint(null), 1800)
	}, [])

	const handleSetPress = useCallback(
		(card: CampaignSetCardViewModel) => {
			if (card.locked) {
				showLockedFeedback(
					card.unlockHint ?? 'Пройдите больше уровней в предыдущем наборе',
				)
				return
			}
			setSelectedSetId(card.setId)
		},
		[showLockedFeedback],
	)

	const handleLevelPress = useCallback(
		(card: LevelCardViewModel) => {
			if (card.access === 'LOCKED') {
				showLockedFeedback('Пройдите предыдущий уровень')
				return
			}
			if (card.access === 'IN_PROGRESS') {
				onOpenLevel({ kind: 'resume', puzzleId: card.puzzleId })
				return
			}
			if (card.access === 'COMPLETED') {
				Alert.alert('Пройти ещё раз?', `Уровень ${card.order} уже пройден.`, [
					{ text: 'Отмена', style: 'cancel' },
					{
						text: 'Начать',
						onPress: () =>
							onOpenLevel({ kind: 'replay', puzzleId: card.puzzleId }),
					},
				])
				return
			}
			onOpenLevel({ kind: 'start', puzzleId: card.puzzleId })
		},
		[onOpenLevel, showLockedFeedback],
	)

	const renderSet: ListRenderItem<CampaignSetCardViewModel> = useCallback(
		({ item }) => (
			<SetCard card={item} onPress={() => handleSetPress(item)} />
		),
		[handleSetPress],
	)

	const renderLevel: ListRenderItem<LevelCardViewModel> = useCallback(
		({ item }) => (
			<LevelCard card={item} onPress={() => handleLevelPress(item)} />
		),
		[handleLevelPress],
	)

	const title =
		selectedSet !== null ? selectedSet.titleRu : 'Уровни'
	const handleHeaderBack = () => {
		if (selectedSetId !== null) {
			setSelectedSetId(null)
			return
		}
		onBack()
	}

	return (
		<View
			style={[
				styles.root,
				{
					paddingTop: insets.top + spacing.sm,
				},
			]}
			testID="levels-screen"
		>
			<View style={styles.header}>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Назад"
					onPress={handleHeaderBack}
					style={styles.backButton}
					hitSlop={12}
				>
					<Text style={styles.backText}>← Назад</Text>
				</Pressable>
				<Text style={styles.title} accessibilityRole="header">
					{title}
				</Text>
			</View>

			{selectedSet !== null ? (
				<Text style={styles.subMeta}>
					{selectedSet.progressLabel} · {selectedSet.difficultyRangeLabel}
				</Text>
			) : null}

			{lockedHint !== null ? (
				<Text style={styles.hint} accessibilityLiveRegion="polite">
					{lockedHint}
				</Text>
			) : (
				<View style={styles.hintPlaceholder} />
			)}

			{selectedSetId === null ? (
				<FlatList
					data={setCards}
					keyExtractor={(item) => item.setId}
					renderItem={renderSet}
					initialNumToRender={12}
					windowSize={7}
					contentContainerStyle={styles.listContent}
					ItemSeparatorComponent={Separator}
				/>
			) : (
				<FlatList
					data={levelCards}
					keyExtractor={(item) => item.puzzleId}
					renderItem={renderLevel}
					initialNumToRender={12}
					windowSize={7}
					maxToRenderPerBatch={10}
					removeClippedSubviews
					contentContainerStyle={styles.listContent}
					ItemSeparatorComponent={Separator}
				/>
			)}
		</View>
	)
}

function Separator() {
	return <View style={styles.separator} />
}

function SetCard({
	card,
	onPress,
}: {
	card: CampaignSetCardViewModel
	onPress: () => void
}) {
	const dimmed = card.locked
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ disabled: card.locked }}
			accessibilityLabel={`${card.titleRu}. ${card.progressLabel}. ${card.locked ? 'Закрыт' : 'Открыт'}`}
			onPress={onPress}
			style={({ pressed }) => [
				styles.card,
				dimmed ? styles.cardLocked : null,
				{ opacity: pressed && !dimmed ? 0.88 : 1 },
			]}
		>
			<View style={styles.cardLeft}>
				<Text style={[styles.order, dimmed ? styles.textDim : null]}>
					{card.displayOrder}
				</Text>
				{card.locked ? (
					<View style={styles.lockGlyph} accessibilityLabel="Закрыт">
						<View style={styles.lockShackle} />
						<View style={styles.lockBody} />
					</View>
				) : (
					<Text style={[styles.glyph, styles.glyphNew]}>▷</Text>
				)}
			</View>
			<View style={styles.cardBody}>
				<Text style={[styles.cardTitle, dimmed ? styles.textDim : null]}>
					{card.titleRu}
				</Text>
				<Text style={[styles.cardMeta, dimmed ? styles.textDim : null]}>
					{card.progressLabel} · {card.difficultyRangeLabel}
				</Text>
			</View>
		</Pressable>
	)
}

function LevelCard({
	card,
	onPress,
}: {
	card: LevelCardViewModel
	onPress: () => void
}) {
	const dimmed = card.access === 'LOCKED'
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ disabled: card.locked }}
			accessibilityLabel={`Уровень ${card.order}. ${card.sizeLabel}. ${card.difficultyLabel}. ${card.accessLabel}`}
			onPress={onPress}
			style={({ pressed }) => [
				styles.card,
				dimmed ? styles.cardLocked : null,
				{ opacity: pressed && !dimmed ? 0.88 : 1 },
			]}
		>
			<View style={styles.cardLeft}>
				<Text style={[styles.order, dimmed ? styles.textDim : null]}>
					{card.order}
				</Text>
				<StatusGlyph access={card.access} />
			</View>
			<View style={styles.cardBody}>
				<Text style={[styles.cardTitle, dimmed ? styles.textDim : null]}>
					{card.sizeLabel} · {card.difficultyLabel}
				</Text>
				<Text style={[styles.cardMeta, dimmed ? styles.textDim : null]}>
					{card.accessLabel}
					{card.markedLabel !== null ? ` · ${card.markedLabel}` : ''}
					{card.bestTimeLabel !== null
						? ` · ${card.bestTimeLabel}`
						: ''}
				</Text>
			</View>
		</Pressable>
	)
}

function StatusGlyph({ access }: { access: LevelCardViewModel['access'] }) {
	if (access === 'LOCKED') {
		return (
			<View style={styles.lockGlyph} accessibilityLabel="Закрыт">
				<View style={styles.lockShackle} />
				<View style={styles.lockBody} />
			</View>
		)
	}
	if (access === 'COMPLETED') {
		return <Text style={[styles.glyph, styles.glyphCheck]}>✓</Text>
	}
	if (access === 'IN_PROGRESS') {
		return <Text style={[styles.glyph, styles.glyphProgress]}>●</Text>
	}
	return <Text style={[styles.glyph, styles.glyphNew]}>○</Text>
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
	subMeta: {
		textAlign: 'center',
		color: colors.textMuted,
		fontSize: 13,
		marginBottom: 2,
	},
	hint: {
		textAlign: 'center',
		color: colors.accent,
		fontSize: 13,
		fontWeight: '600',
		minHeight: 20,
		marginBottom: 4,
		paddingHorizontal: spacing.md,
	},
	hintPlaceholder: {
		minHeight: 20,
		marginBottom: 4,
	},
	listContent: {
		paddingHorizontal: spacing.md,
		paddingBottom: spacing.lg,
	},
	separator: {
		height: 8,
	},
	card: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#FFFFFF',
		borderRadius: 12,
		borderWidth: 1,
		borderColor: colors.border,
		paddingHorizontal: 12,
		paddingVertical: 12,
		minHeight: 64,
		gap: 10,
	},
	cardLocked: {
		backgroundColor: colors.surface,
	},
	cardLeft: {
		width: 48,
		alignItems: 'center',
		gap: 2,
	},
	order: {
		fontSize: 18,
		fontWeight: '700',
		color: colors.text,
	},
	glyph: {
		fontSize: 14,
		color: colors.textMuted,
	},
	glyphCheck: {
		color: colors.accent,
		fontWeight: '700',
	},
	glyphProgress: {
		color: '#C47B2B',
		fontWeight: '700',
	},
	glyphNew: {
		color: colors.textMuted,
	},
	lockGlyph: {
		width: 14,
		height: 16,
		alignItems: 'center',
		justifyContent: 'flex-end',
	},
	lockShackle: {
		width: 8,
		height: 6,
		borderWidth: 1.5,
		borderBottomWidth: 0,
		borderColor: colors.textMuted,
		borderTopLeftRadius: 4,
		borderTopRightRadius: 4,
	},
	lockBody: {
		width: 12,
		height: 8,
		borderRadius: 2,
		backgroundColor: colors.textMuted,
	},
	cardBody: {
		flex: 1,
	},
	cardTitle: {
		fontSize: 15,
		fontWeight: '700',
		color: colors.text,
	},
	cardMeta: {
		marginTop: 2,
		fontSize: 13,
		color: colors.textMuted,
	},
	textDim: {
		color: colors.textMuted,
		opacity: 0.75,
	},
})
