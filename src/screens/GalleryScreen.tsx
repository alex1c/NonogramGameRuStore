/**
 * Gallery — sectioned virtualized list of collections / items.
 * Architecture choice: single screen with collection sections (FlatList of
 * flattened rows) — simpler for 21 items, stable keys, scales via virtualization.
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
	buildGalleryScreenView,
	type GalleryItemView,
} from '../gallery'
import { useProgress } from '../progress/ProgressProvider'
import { colors, spacing, typography } from '../theme'

type Row =
	| {
			readonly kind: 'intro'
			readonly key: string
			readonly text: string
	  }
	| {
			readonly kind: 'header'
			readonly key: string
			readonly title: string
			readonly progress: string
	  }
	| {
			readonly kind: 'item'
			readonly key: string
			readonly item: GalleryItemView
	  }

interface GalleryScreenProps {
	readonly onBack: () => void
	readonly onOpenDetail: (puzzleId: string) => void
}

export function GalleryScreen({ onBack, onOpenDetail }: GalleryScreenProps) {
	const insets = useSafeAreaInsets()
	const { save } = useProgress()
	const gallery = useMemo(() => buildGalleryScreenView(save), [save])

	const rows = useMemo(() => {
		const out: Row[] = [
			{
				kind: 'intro',
				key: 'intro',
				text:
					gallery.unlockedCount === 0
						? gallery.introLabel
						: gallery.progressLabel,
			},
		]
		for (const collection of gallery.collections) {
			out.push({
				kind: 'header',
				key: `h:${collection.collectionId}`,
				title: collection.titleRu,
				progress: `${collection.completed} / ${collection.total}`,
			})
			for (const item of collection.items) {
				out.push({
					kind: 'item',
					key: item.puzzleId,
					item,
				})
			}
		}
		return out
	}, [gallery])

	useEffect(() => {
		const sub = BackHandler.addEventListener('hardwareBackPress', () => {
			onBack()
			return true
		})
		return () => sub.remove()
	}, [onBack])

	const renderItem: ListRenderItem<Row> = useCallback(
		({ item }) => {
			if (item.kind === 'intro') {
				return <Text style={styles.intro}>{item.text}</Text>
			}
			if (item.kind === 'header') {
				return (
					<View style={styles.sectionHeader}>
						<Text style={styles.sectionTitle}>{item.title}</Text>
						<Text style={styles.sectionMeta}>{item.progress}</Text>
					</View>
				)
			}
			return (
				<GalleryCard
					item={item.item}
					onPress={() => {
						if (item.item.access === 'UNLOCKED') {
							onOpenDetail(item.item.puzzleId)
						}
					}}
				/>
			)
		},
		[onOpenDetail],
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
				<Text style={styles.title} accessibilityRole="header">
					Галерея
				</Text>
			</View>
			<Text style={styles.progress}>{gallery.progressLabel}</Text>
			<FlatList
				data={rows}
				keyExtractor={(row) => row.key}
				renderItem={renderItem}
				initialNumToRender={14}
				windowSize={8}
				maxToRenderPerBatch={10}
				removeClippedSubviews
				contentContainerStyle={styles.list}
				ItemSeparatorComponent={Separator}
			/>
		</View>
	)
}

function Separator() {
	return <View style={styles.sep} />
}

function GalleryCard({
	item,
	onPress,
}: {
	item: GalleryItemView
	onPress: () => void
}) {
	const locked = item.access === 'LOCKED'
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={item.accessibilityLabel}
			accessibilityState={{ disabled: locked }}
			disabled={locked}
			onPress={onPress}
			style={({ pressed }) => [
				styles.card,
				locked ? styles.cardLocked : null,
				{ opacity: pressed && !locked ? 0.9 : 1 },
			]}
		>
			<View style={styles.previewSlot}>
				{item.access === 'UNLOCKED' && item.preview !== null ? (
					<SolutionPreview bitmap={item.preview} maxSize={72} />
				) : (
					<LockedPlaceholder />
				)}
			</View>
			<View style={styles.cardBody}>
				<Text style={[styles.cardTitle, locked ? styles.dim : null]}>
					{item.displayTitle}
				</Text>
				<Text style={[styles.cardMeta, locked ? styles.dim : null]}>
					{item.sizeLabel} · {item.difficultyLabel}
					{item.bestTimeLabel !== null ? ` · ${item.bestTimeLabel}` : ''}
				</Text>
			</View>
		</Pressable>
	)
}

function LockedPlaceholder() {
	return (
		<View style={styles.lockedBox} accessibilityElementsHidden>
			<View style={styles.lockShackle} />
			<View style={styles.lockBody}>
				<Text style={styles.q}>?</Text>
			</View>
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
		marginBottom: 8,
		fontWeight: '600',
	},
	list: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
	sep: { height: 8 },
	intro: {
		color: colors.textMuted,
		fontSize: 14,
		marginBottom: 4,
		textAlign: 'center',
	},
	sectionHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-end',
		marginTop: 8,
		marginBottom: 4,
	},
	sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
	sectionMeta: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
	card: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#FFFFFF',
		borderRadius: 12,
		borderWidth: 1,
		borderColor: colors.border,
		padding: 10,
		minHeight: 88,
		gap: 12,
	},
	cardLocked: { backgroundColor: colors.surface },
	previewSlot: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
	cardBody: { flex: 1 },
	cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
	cardMeta: { marginTop: 4, fontSize: 13, color: colors.textMuted },
	dim: { opacity: 0.75 },
	lockedBox: { width: 64, height: 64, alignItems: 'center', justifyContent: 'flex-end' },
	lockShackle: {
		width: 18,
		height: 12,
		borderWidth: 2,
		borderBottomWidth: 0,
		borderColor: colors.textMuted,
		borderTopLeftRadius: 8,
		borderTopRightRadius: 8,
	},
	lockBody: {
		width: 28,
		height: 22,
		borderRadius: 4,
		backgroundColor: colors.textMuted,
		alignItems: 'center',
		justifyContent: 'center',
	},
	q: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
})
