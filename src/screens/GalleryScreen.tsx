/**
 * Gallery root — production collection cards (20).
 * Hierarchy: Gallery → Collection → Item detail.
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
import {
	buildGalleryScreenView,
	type GalleryCollectionView,
} from '../gallery'
import { useProgress } from '../progress/ProgressProvider'
import { colors, spacing, typography } from '../theme'

interface GalleryScreenProps {
	readonly onBack: () => void
	readonly onOpenCollection: (collectionId: string) => void
}

export function GalleryScreen({
	onBack,
	onOpenCollection,
}: GalleryScreenProps) {
	const insets = useSafeAreaInsets()
	const { save } = useProgress()
	const gallery = useMemo(() => buildGalleryScreenView(save), [save])

	useEffect(() => {
		const sub = BackHandler.addEventListener('hardwareBackPress', () => {
			onBack()
			return true
		})
		return () => sub.remove()
	}, [onBack])

	const renderItem: ListRenderItem<GalleryCollectionView> = useCallback(
		({ item }) => (
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={`${item.titleRu}. ${item.completed} из ${item.total}`}
				onPress={() => onOpenCollection(item.collectionId)}
				style={({ pressed }) => [
					styles.card,
					{ opacity: pressed ? 0.88 : 1 },
				]}
			>
				<View style={styles.cover}>
					<Text style={styles.coverGlyph}>
						{item.completed > 0 ? '▣' : '□'}
					</Text>
				</View>
				<View style={styles.body}>
					<Text style={styles.title}>{item.titleRu}</Text>
					<Text style={styles.meta}>
						{item.completed} / {item.total}
						{item.isComplete ? ' · собрано' : ''}
					</Text>
				</View>
			</Pressable>
		),
		[onOpenCollection],
	)

	return (
		<View
			style={[
				styles.root,
				{
					paddingTop: insets.top + spacing.sm,
				},
			]}
			testID="gallery-screen"
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
					Галерея
				</Text>
			</View>
			<Text style={styles.progress}>{gallery.progressLabel}</Text>
			{gallery.unlockedCount === 0 ? (
				<Text style={styles.intro}>{gallery.introLabel}</Text>
			) : null}
			<FlatList
				data={gallery.collections}
				keyExtractor={(item) => item.collectionId}
				renderItem={renderItem}
				contentContainerStyle={styles.list}
				ItemSeparatorComponent={() => <View style={styles.sep} />}
				initialNumToRender={12}
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
		fontSize: 22,
		color: colors.text,
		flex: 1,
		textAlign: 'center',
		marginRight: 72,
	},
	progress: {
		textAlign: 'center',
		color: colors.textMuted,
		fontSize: 13,
		marginBottom: 4,
	},
	intro: {
		textAlign: 'center',
		color: colors.textMuted,
		fontSize: 13,
		paddingHorizontal: spacing.md,
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
		padding: 12,
		minHeight: 72,
		gap: 12,
	},
	cover: {
		width: 48,
		height: 48,
		borderRadius: 8,
		backgroundColor: colors.surface,
		alignItems: 'center',
		justifyContent: 'center',
	},
	coverGlyph: { fontSize: 22, color: colors.textMuted },
	body: { flex: 1 },
	title: { fontSize: 16, fontWeight: '700', color: colors.text },
	meta: { marginTop: 2, fontSize: 13, color: colors.textMuted },
})
