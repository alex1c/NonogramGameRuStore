/**
 * Simple completion overlay — no ads, no gallery rewards.
 */

import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import type { BoardPalette } from '../board/palette'

interface CompletionOverlayProps {
	readonly visible: boolean
	readonly title: string
	readonly sizeLabel: string
	readonly elapsedLabel: string
	readonly palette: BoardPalette
	readonly onDone: () => void
	readonly onPlayAgain: () => void
}

export function CompletionOverlay({
	visible,
	title,
	sizeLabel,
	elapsedLabel,
	palette,
	onDone,
	onPlayAgain,
}: CompletionOverlayProps) {
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
					<Text style={[styles.title, { color: palette.headerText }]}>
						Готово
					</Text>
					<Text style={[styles.body, { color: palette.headerText }]}>
						{title}
					</Text>
					<Text style={[styles.meta, { color: palette.clueTextDimmed }]}>
						{sizeLabel} · {elapsedLabel}
					</Text>
					<View style={styles.actions}>
						<Pressable
							accessibilityRole="button"
							onPress={onDone}
							style={[
								styles.button,
								{ backgroundColor: palette.controlSelected },
							]}
						>
							<Text style={styles.buttonTextLight}>Готово</Text>
						</Pressable>
						<Pressable
							accessibilityRole="button"
							onPress={onPlayAgain}
							style={[
								styles.button,
								{
									backgroundColor: palette.boardBackground,
									borderColor: palette.controlBorder,
									borderWidth: 1,
								},
							]}
						>
							<Text style={[styles.buttonText, { color: palette.headerText }]}>
								Сыграть ещё
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
		padding: 24,
	},
	card: {
		width: '100%',
		maxWidth: 360,
		borderRadius: 16,
		borderWidth: 1,
		padding: 20,
		gap: 8,
	},
	title: {
		fontSize: 24,
		fontWeight: '700',
	},
	body: {
		fontSize: 16,
		fontWeight: '500',
	},
	meta: {
		fontSize: 13,
		marginBottom: 8,
	},
	actions: {
		gap: 10,
		marginTop: 8,
	},
	button: {
		minHeight: 48,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
	},
	buttonTextLight: {
		color: '#FFFFFF',
		fontWeight: '700',
		fontSize: 16,
	},
	buttonText: {
		fontWeight: '700',
		fontSize: 16,
	},
})
