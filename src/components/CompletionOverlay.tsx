/**
 * Completion overlay — solved image reward + gallery/achievements messages.
 * Supports Campaign/Replay and Daily event results.
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
import type {
	CompletionEventResult,
	DailyCompletionEventResult,
} from '../persistence/completionResult'
import { formatAchievementCount } from '../presentation/russianPlural'

interface CompletionOverlayProps {
	readonly visible: boolean
	readonly headline: string
	readonly title: string
	readonly sizeLabel: string
	readonly elapsedLabel: string
	readonly palette: BoardPalette
	readonly preview: CroppedBitmap | null
	readonly event: CompletionEventResult | DailyCompletionEventResult | null
	readonly streakLabel: string | null
	readonly onHome: () => void
	readonly onGallery: () => void
	readonly onCalendar: (() => void) | null
	readonly onNext: (() => void) | null
}

export function CompletionOverlay({
	visible,
	headline,
	title,
	sizeLabel,
	elapsedLabel,
	palette,
	preview,
	event,
	streakLabel,
	onHome,
	onGallery,
	onCalendar,
	onNext,
}: CompletionOverlayProps) {
	const galleryJustUnlocked =
		event !== null && event.galleryJustUnlocked === true
	const galleryMessage = galleryJustUnlocked
		? 'Добавлено в галерею'
		: event !== null &&
			  event.mode !== 'DAILY' &&
			  !event.firstPuzzleSolve
			? 'Пройдено снова'
			: null

	const achievements = event?.newlyUnlockedAchievements ?? []
	const showGalleryButton =
		event !== null && (event.galleryJustUnlocked || event.galleryIncluded)

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
							{headline}
						</Text>
						<Text style={[styles.body, { color: palette.headerText }]}>
							{title}
						</Text>
						<Text style={[styles.meta, { color: palette.clueTextDimmed }]}>
							{sizeLabel} · {elapsedLabel}
						</Text>
						{streakLabel !== null ? (
							<Text style={[styles.reward, { color: palette.controlSelected }]}>
								{streakLabel}
							</Text>
						) : null}
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
									{formatAchievementCount(achievements.length)}
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
						<Pressable
							accessibilityRole="button"
							accessibilityLabel="На главную"
							onPress={onHome}
							style={[
								styles.button,
								{ backgroundColor: palette.controlSelected },
							]}
						>
							<Text style={styles.buttonTextPrimary}>На главную</Text>
						</Pressable>
						{showGalleryButton ? (
							<Pressable
								accessibilityRole="button"
								accessibilityLabel="В галерею"
								onPress={onGallery}
								style={[
									styles.button,
									{
										backgroundColor: palette.controlBackground,
										borderColor: palette.controlBorder,
										borderWidth: 1,
									},
								]}
							>
								<Text
									style={[
										styles.buttonTextSecondary,
										{ color: palette.headerText },
									]}
								>
									В галерею
								</Text>
							</Pressable>
						) : null}
						{onCalendar !== null ? (
							<Pressable
								accessibilityRole="button"
								accessibilityLabel="К календарю"
								onPress={onCalendar}
								style={[
									styles.button,
									{
										backgroundColor: palette.controlBackground,
										borderColor: palette.controlBorder,
										borderWidth: 1,
									},
								]}
							>
								<Text
									style={[
										styles.buttonTextSecondary,
										{ color: palette.headerText },
									]}
								>
									К календарю
								</Text>
							</Pressable>
						) : null}
						{onNext !== null ? (
							<Pressable
								accessibilityRole="button"
								accessibilityLabel="Дальше"
								onPress={onNext}
								style={[
									styles.button,
									{
										backgroundColor: palette.controlBackground,
										borderColor: palette.controlBorder,
										borderWidth: 1,
									},
								]}
							>
								<Text
									style={[
										styles.buttonTextSecondary,
										{ color: palette.headerText },
									]}
								>
									Дальше
								</Text>
							</Pressable>
						) : null}
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
		justifyContent: 'center',
		padding: 20,
	},
	card: {
		borderRadius: 16,
		borderWidth: 1,
		maxHeight: '88%',
		overflow: 'hidden',
	},
	scroll: {
		padding: 20,
		alignItems: 'center',
		gap: 6,
	},
	previewWrap: { marginBottom: 8 },
	title: { fontSize: 22, fontWeight: '800' },
	body: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
	meta: { fontSize: 14 },
	reward: { fontSize: 15, fontWeight: '700', marginTop: 4 },
	achBlock: { alignSelf: 'stretch', marginTop: 8, gap: 2 },
	achHeader: { fontSize: 14, fontWeight: '700' },
	achItem: { fontSize: 14 },
	actions: { padding: 16, gap: 8 },
	button: {
		borderRadius: 12,
		paddingVertical: 12,
		alignItems: 'center',
		minHeight: 48,
		justifyContent: 'center',
	},
	buttonTextPrimary: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
	buttonTextSecondary: { fontWeight: '700', fontSize: 16 },
})
