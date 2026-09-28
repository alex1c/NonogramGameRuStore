/**
 * Gallery Detail — re-checks unlock; locked never shows solution.
 */

import { useEffect, useMemo } from 'react'
import {
	BackHandler,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SolutionPreview } from '../components/SolutionPreview'
import { buildGalleryDetail } from '../gallery/detail'
import { useProgress } from '../progress/ProgressProvider'
import { colors, spacing, typography } from '../theme'

interface GalleryDetailScreenProps {
	readonly puzzleId: string
	readonly onBack: () => void
	readonly onReplay: (puzzleId: string) => void
}

export function GalleryDetailScreen({
	puzzleId,
	onBack,
	onReplay,
}: GalleryDetailScreenProps) {
	const insets = useSafeAreaInsets()
	const { save } = useProgress()
	const detail = useMemo(
		() => buildGalleryDetail(puzzleId, save),
		[puzzleId, save],
	)

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
			testID="gallery-detail-screen"
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
					Картинка
				</Text>
			</View>

			<ScrollView contentContainerStyle={styles.content}>
				{detail.kind === 'unlocked' ? (
					<>
						<View style={styles.previewWrap}>
							<SolutionPreview bitmap={detail.preview} maxSize={240} />
						</View>
						<Text style={styles.name}>{detail.titleRu}</Text>
						<Text style={styles.meta}>
							{detail.collectionTitleRu} · {detail.sizeLabel} ·{' '}
							{detail.difficultyLabel}
						</Text>
						{detail.bestTimeLabel !== null ? (
							<Text style={styles.meta}>
								Лучшее время: {detail.bestTimeLabel}
							</Text>
						) : null}
						<Pressable
							accessibilityRole="button"
							accessibilityLabel="Пройти ещё раз"
							onPress={() => onReplay(detail.puzzleId)}
							style={styles.primary}
						>
							<Text style={styles.primaryText}>Пройти ещё раз</Text>
						</Pressable>
					</>
				) : (
					<>
						<View style={styles.lockedBox}>
							<Text style={styles.lockedQ}>?</Text>
						</View>
						<Text style={styles.name}>
							{detail.kind === 'locked'
								? detail.displayTitle
								: 'Картинка'}
						</Text>
						<Text style={styles.meta}>{detail.message}</Text>
					</>
				)}
			</ScrollView>
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
	content: {
		paddingHorizontal: spacing.lg,
		paddingBottom: spacing.xl,
		alignItems: 'center',
		gap: 10,
	},
	previewWrap: { marginVertical: spacing.md },
	name: {
		fontSize: 22,
		fontWeight: '700',
		color: colors.text,
		textAlign: 'center',
	},
	meta: {
		fontSize: 14,
		color: colors.textMuted,
		textAlign: 'center',
	},
	primary: {
		marginTop: spacing.md,
		minHeight: 52,
		minWidth: 220,
		borderRadius: 14,
		backgroundColor: colors.accent,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 20,
	},
	primaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
	lockedBox: {
		width: 120,
		height: 120,
		borderRadius: 16,
		backgroundColor: colors.surface,
		borderWidth: 1,
		borderColor: colors.border,
		alignItems: 'center',
		justifyContent: 'center',
		marginVertical: spacing.lg,
	},
	lockedQ: { fontSize: 40, fontWeight: '700', color: colors.textMuted },
})
