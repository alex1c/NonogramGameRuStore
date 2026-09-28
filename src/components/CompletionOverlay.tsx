/**
 * Completion overlay — solved image reward + gallery/achievements messages.
 * No banner. Scrollable so multiple achievements fit above safe area.
 */

import {
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import type { BoardPalette } from '../board/palette'
import { SolutionPreview } from './SolutionPreview'
import type { CroppedBitmap } from '../gallery/crop'
import type { CompletionEventResult } from '../persistence/completionResult'
import { formatAchievementCount } from '../presentation/russianPlural'

interface CompletionOverlayProps {
	readonly visible: boolean
	readonly title: string
	readonly sizeLabel: string
	readonly elapsedLabel: string
	readonly palette: BoardPalette
	readonly preview: CroppedBitmap | null
	readonly event: CompletionEventResult | null
	readonly onHome: () => void
	readonly onGallery: () => void
	readonly onNext: (() => void) | null
}

export function CompletionOverlay({
	visible,
	title,
	sizeLabel,
	elapsedLabel,
	palette,
	preview,
	event,
	onHome,
	onGallery,
	onNext,
}: CompletionOverlayProps) {
	const galleryMessage =
		event === null
			? null
			: event.firstCompletion && event.galleryIncluded
				? 'Добавлено в галерею'
				: event.firstCompletion
					? null
					: 'Пройдено снова'

	const achievements = event?.newlyUnlockedAchievements ?? []

	return (
		<Modal visible={visible} transparent animationType="fade">
			<View style={styles.backdrop}>
				<View
					style={[
						styles.card,
						{
							backgroundColor: palette.controlBackground,
							borderColor: palette.controlBorder,
						},
					]}
				>
					<ScrollView
						contentContainerStyle={styles.scroll}
						showsVerticalScrollIndicator={false}
					>
						{preview !== null ? (
							<View style={styles.previewWrap}>
								<SolutionPreview bitmap={preview} maxSize={180} />
							</View>
						) : null}
						<Text style={[styles.title, { color: palette.headerText }]}>
							Готово
						</Text>
						<Text style={[styles.body, { color: palette.headerText }]}>
							{title}
						</Text>
						<Text style={[styles.meta, { color: palette.clueTextDimmed }]}>
							{sizeLabel} · {elapsedLabel}
						</Text>
						{galleryMessage !== null ? (
							<Text style={[styles.reward, { color: palette.controlSelected }]}>
								{galleryMessage}
							</Text>
						) : null}
						{event?.collectionJustCompletedTitle !== null &&
						event?.collectionJustCompletedTitle !== undefined ? (
							<Text style={[styles.reward, { color: palette.controlSelected }]}>
								Коллекция «{event.collectionJustCompletedTitle}» собрана!
							</Text>
						) : null}
						{achievements.length > 0 ? (
							<View style={styles.achBlock}>
								<Text
									style={[styles.achHeader, { color: palette.headerText }]}
								>
									{achievements.length === 1
										? 'Новое достижение'
										: `Новые достижения — ${formatAchievementCount(achievements.length)}`}
								</Text>
								{achievements.map((item) => (
									<Text
										key={item.id}
										style={[styles.achItem, { color: palette.headerText }]}
									>
										• {item.titleRu}
									</Text>
								))}
							</View>
						) : null}
					</ScrollView>

					<View style={styles.actions}>
						{onNext !== null ? (
							<Pressable
								accessibilityRole="button"
								accessibilityLabel="Дальше"
								onPress={onNext}
								style={[
									styles.button,
									{ backgroundColor: palette.controlSelected },
								]}
							>
								<Text style={styles.buttonTextLight}>Дальше</Text>
							</Pressable>
						) : null}
						<Pressable
							accessibilityRole="button"
							accessibilityLabel="В галерею"
							onPress={onGallery}
							style={[
								styles.button,
								{
									backgroundColor: palette.boardBackground,
									borderColor: palette.controlBorder,
									borderWidth: 1,
								},
							]}
						>
							<Text
								style={[styles.buttonText, { color: palette.headerText }]}
							>
								В галерею
							</Text>
						</Pressable>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel="На главную"
							onPress={onHome}
							style={[
								styles.button,
								{
									backgroundColor: palette.boardBackground,
									borderColor: palette.controlBorder,
									borderWidth: 1,
								},
							]}
						>
							<Text
								style={[styles.buttonText, { color: palette.headerText }]}
							>
								На главную
							</Text>
						</Pressable>
					</View>
				</View>
			</View>
		</Modal>
	)
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.45)',
		alignItems: 'center',
		justifyContent: 'center',
		padding: 20,
	},
	card: {
		width: '100%',
		maxWidth: 380,
		maxHeight: '92%',
		borderRadius: 16,
		borderWidth: 1,
		padding: 16,
	},
	scroll: {
		alignItems: 'center',
		gap: 6,
		paddingBottom: 8,
	},
	previewWrap: { marginBottom: 4 },
	title: { fontSize: 24, fontWeight: '700' },
	body: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
	meta: { fontSize: 13 },
	reward: { fontSize: 14, fontWeight: '700', textAlign: 'center', marginTop: 4 },
	achBlock: { alignSelf: 'stretch', marginTop: 8, gap: 2 },
	achHeader: { fontSize: 14, fontWeight: '700' },
	achItem: { fontSize: 13 },
	actions: { gap: 8, marginTop: 10 },
	button: {
		minHeight: 48,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
	},
	buttonTextLight: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
	buttonText: { fontWeight: '700', fontSize: 16 },
})
