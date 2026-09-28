/**
 * Levels — virtualized campaign list (scales toward 1000 entries).
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
	const cards = useMemo(() => buildCampaignLevelCards(save), [save])
	const [lockedHint, setLockedHint] = useState<string | null>(null)
	const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(() => {
		const sub = BackHandler.addEventListener('hardwareBackPress', () => {
			onBack()
			return true
		})
		return () => sub.remove()
	}, [onBack])

	const showLockedFeedback = useCallback(() => {
		setLockedHint('Пройдите предыдущий уровень')
		if (hintTimer.current !== null) {
			clearTimeout(hintTimer.current)
		}
		hintTimer.current = setTimeout(() => setLockedHint(null), 1800)
	}, [])

	const handlePress = useCallback(
		(card: LevelCardViewModel) => {
			if (card.access === 'LOCKED') {
				showLockedFeedback()
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

	const renderItem: ListRenderItem<LevelCardViewModel> = useCallback(
		({ item }) => (
			<LevelCard card={item} onPress={() => handlePress(item)} />
		),
		[handlePress],
	)

	return (
		<View
			style={[
				styles.root,
				{
					paddingTop: insets.top + spacing.sm,
					paddingBottom: Math.max(insets.bottom, 8),
				},
			]}
			testID="levels-screen"
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
					Уровни
				</Text>
			</View>

			{lockedHint !== null ? (
				<Text style={styles.hint} accessibilityLiveRegion="polite">
					{lockedHint}
				</Text>
			) : (
				<View style={styles.hintPlaceholder} />
			)}

			<FlatList
				data={cards}
				keyExtractor={(item) => item.puzzleId}
				renderItem={renderItem}
				initialNumToRender={12}
				windowSize={7}
				maxToRenderPerBatch={10}
				removeClippedSubviews
				contentContainerStyle={styles.listContent}
				ItemSeparatorComponent={Separator}
			/>
		</View>
	)
}

function Separator() {
	return <View style={styles.separator} />
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
	// Non-emoji markers — distinguishable without relying on color alone.
	if (access === 'LOCKED') {
		return (
			<View
				style={styles.lockGlyph}
				accessibilityLabel="Закрыт"
			>
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
	hint: {
		textAlign: 'center',
		color: colors.accent,
		fontSize: 13,
		fontWeight: '600',
		minHeight: 20,
		marginBottom: 4,
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
