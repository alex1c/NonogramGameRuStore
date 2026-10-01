/**
 * Gallery collection detail — virtualized items for one production collection.
 */

import { useCallback, useEffect, useMemo } from 'react'
import {
	BackHandler,
	FlatList,
	Pressable,
	StyleSheet,
	Text,
	View,
	type ListRenderItem,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SolutionPreview } from '../components/SolutionPreview'
import {
	buildGalleryCollectionDetailView,
	type GalleryItemView,
} from '../gallery'
import { useProgress } from '../progress/ProgressProvider'
import { colors, spacing, typography } from '../theme'

interface GalleryCollectionScreenProps {
	readonly collectionId: string
	readonly onBack: () => void
	readonly onOpenDetail: (puzzleId: string) => void
}

export function GalleryCollectionScreen({
	collectionId,
	onBack,
	onOpenDetail,
}: GalleryCollectionScreenProps) {
	const insets = useSafeAreaInsets()
	const { save } = useProgress()
	const collection = useMemo(
		() => buildGalleryCollectionDetailView(collectionId, save),
		[collectionId, save],
	)

	useEffect(() => {
		const sub = BackHandler.addEventListener('hardwareBackPress', () => {
			onBack()
			return true
		})
		return () => sub.remove()
	}, [onBack])

	const renderItem: ListRenderItem<GalleryItemView> = useCallback(
		({ item }) => (
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={item.accessibilityLabel}
				disabled={item.access === 'LOCKED'}
				onPress={() => {
					if (item.access === 'UNLOCKED') {
						onOpenDetail(item.puzzleId)
					}
				}}
				style={({ pressed }) => [
					styles.card,
					item.access === 'LOCKED' ? styles.locked : null,
					{ opacity: pressed && item.access === 'UNLOCKED' ? 0.88 : 1 },
				]}
			>
				<View style={styles.thumb}>
					{item.access === 'UNLOCKED' && item.preview !== null ? (
						<SolutionPreview bitmap={item.preview} maxSize={52} />
					) : (
						<View style={styles.placeholder} />
					)}
				</View>
				<View style={styles.body}>
					<Text style={styles.title}>{item.displayTitle}</Text>
					<Text style={styles.meta}>
						{item.sizeLabel} · {item.difficultyLabel}
						{item.bestTimeLabel !== null ? ` · ${item.bestTimeLabel}` : ''}
					</Text>
				</View>
			</Pressable>
		),
		[onOpenDetail],
	)

	if (collection === null) {
		return (
			<View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
				<Pressable onPress={onBack}>
					<Text style={styles.backText}>← Назад</Text>
				</Pressable>
				<Text style={styles.headerTitle}>Коллекция не найдена</Text>
			</View>
		)
	}

	return (
		<View
			style={[
				styles.root,
				{
					paddingTop: insets.top + spacing.sm,
					paddingBottom: Math.max(insets.bottom, 8),
				},
			]}
			testID="gallery-collection-screen"
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
				<Text style={styles.headerTitle} accessibilityRole="header">
					{collection.titleRu}
				</Text>
			</View>
			<Text style={styles.progress}>
				{collection.completed} / {collection.total}
			</Text>
			<FlatList
				data={collection.items}
				keyExtractor={(item) => item.puzzleId}
				renderItem={renderItem}
				contentContainerStyle={styles.list}
				ItemSeparatorComponent={() => <View style={styles.sep} />}
				initialNumToRender={12}
				windowSize={7}
				maxToRenderPerBatch={10}
				removeClippedSubviews
			/>
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
	headerTitle: {
		...typography.title,
		fontSize: 20,
		color: colors.text,
		flex: 1,
		textAlign: 'center',
		marginRight: 72,
	},
	progress: {
		textAlign: 'center',
		color: colors.textMuted,
		fontSize: 13,
		marginBottom: 8,
	},
	list: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
	sep: { height: 8 },
	card: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#FFF',
		borderRadius: 12,
		borderWidth: 1,
		borderColor: colors.border,
		padding: 10,
		minHeight: 72,
		gap: 12,
	},
	locked: { backgroundColor: colors.surface },
	thumb: {
		width: 56,
		height: 56,
		borderRadius: 6,
		overflow: 'hidden',
		backgroundColor: colors.surface,
		alignItems: 'center',
		justifyContent: 'center',
	},
	placeholder: {
		width: 40,
		height: 40,
		borderRadius: 4,
		backgroundColor: colors.border,
	},
	body: { flex: 1 },
	title: { fontSize: 15, fontWeight: '700', color: colors.text },
	meta: { marginTop: 2, fontSize: 12, color: colors.textMuted },
})
