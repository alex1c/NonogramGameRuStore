/**
 * Help overlay — Подсказка (compact) vs Научи меня (pedagogical).
 * Custom modal (no bottom-sheet dependency). Locks board input while open.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { BoardPalette } from '../board/palette'
import type { HintExplanation } from '../hints/explain'

export type HelpPanelPhase =
	| { readonly kind: 'menu' }
	| { readonly kind: 'loading'; readonly mode: 'HINT' | 'TEACH' }
	| {
			readonly kind: 'result'
			readonly mode: 'HINT' | 'TEACH'
			readonly title: string
			readonly body: string
			readonly canApply: boolean
			readonly explanation: HintExplanation | null
	  }

export interface HelpOverlayProps {
	readonly palette: BoardPalette
	readonly phase: HelpPanelPhase
	readonly applying: boolean
	readonly onClose: () => void
	readonly onRequestHint: () => void
	readonly onRequestTeach: () => void
	readonly onApply: () => void
	readonly onUnderstood: () => void
}

export function HelpOverlay({
	palette,
	phase,
	applying,
	onClose,
	onRequestHint,
	onRequestTeach,
	onApply,
	onUnderstood,
}: HelpOverlayProps) {
	const insets = useSafeAreaInsets()

	return (
		<View
			style={styles.root}
			accessibilityViewIsModal
			pointerEvents="box-none"
		>
			<Pressable
				style={styles.backdrop}
				onPress={onClose}
				accessibilityLabel="Закрыть подсказки"
			/>
			<View
				style={[
					styles.panel,
					{
						backgroundColor: palette.controlBackground,
						borderColor: palette.controlBorder,
						paddingBottom: Math.max(insets.bottom, 12),
					},
				]}
				accessibilityLabel="Подсказки"
			>
				{phase.kind === 'menu' ? (
					<>
						<Text
							style={[styles.title, { color: palette.headerText }]}
							accessibilityRole="header"
						>
							Подсказки
						</Text>
						<Text
							style={[styles.subtitle, { color: palette.clueText }]}
						>
							Подсказки используют только логику — без угадывания.
						</Text>
						<HelpOption
							palette={palette}
							title="Подсказка"
							subtitle="Что сделать? — следующий логический ход"
							onPress={onRequestHint}
						/>
						<HelpOption
							palette={palette}
							title="Научи меня"
							subtitle="Почему это можно сделать? — объяснить правило"
							onPress={onRequestTeach}
						/>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel="Закрыть"
							onPress={onClose}
							style={styles.secondaryButton}
						>
							<Text
								style={[styles.secondaryText, { color: palette.clueText }]}
							>
								Закрыть
							</Text>
						</Pressable>
					</>
				) : null}

				{phase.kind === 'loading' ? (
					<Text style={[styles.body, { color: palette.headerText }]}>
						Ищу логический ход…
					</Text>
				) : null}

				{phase.kind === 'result' ? (
					<>
						<Text
							style={[styles.title, { color: palette.headerText }]}
							accessibilityRole="header"
						>
							{phase.title}
						</Text>

						{phase.mode === 'HINT' && phase.explanation !== null ? (
							<View style={styles.hintCard}>
								<Text
									style={[styles.lineMeta, { color: palette.controlSelected }]}
								>
									{phase.explanation.lineTitle}
								</Text>
								<Text
									style={[styles.actionLabel, { color: palette.headerText }]}
								>
									{phase.explanation.actionLabel}
								</Text>
							</View>
						) : null}

						{phase.mode === 'TEACH' && phase.explanation !== null ? (
							<View style={styles.teachCard}>
								{phase.explanation.whyAccent !== null ? (
									<Text
										style={[
											styles.whyAccent,
											{ color: palette.controlSelected },
										]}
									>
										{phase.explanation.whyAccent}
									</Text>
								) : null}
								<Text
									style={[styles.lineMeta, { color: palette.controlSelected }]}
								>
									{phase.explanation.lineTitle} · подсказка{' '}
									{phase.explanation.clueText}
								</Text>
								<Text style={[styles.body, { color: palette.headerText }]}>
									{phase.explanation.body}
								</Text>
							</View>
						) : null}

						{phase.explanation === null ? (
							<Text style={[styles.body, { color: palette.headerText }]}>
								{phase.body}
							</Text>
						) : null}

						<View style={styles.actions}>
							{phase.canApply ? (
								<Pressable
									accessibilityRole="button"
									accessibilityLabel="Применить"
									disabled={applying}
									onPress={onApply}
									style={[
										styles.primaryButton,
										{
											backgroundColor: palette.controlSelected,
											opacity: applying ? 0.6 : 1,
										},
									]}
								>
									<Text style={styles.primaryText}>Применить</Text>
								</Pressable>
							) : null}
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={
									phase.mode === 'TEACH' && phase.canApply
										? 'Понятно'
										: 'Закрыть'
								}
								onPress={
									phase.canApply && phase.mode === 'TEACH'
										? onUnderstood
										: onClose
								}
								style={styles.secondaryButton}
							>
								<Text
									style={[styles.secondaryText, { color: palette.clueText }]}
								>
									{phase.mode === 'TEACH' && phase.canApply
										? 'Понятно'
										: 'Закрыть'}
								</Text>
							</Pressable>
						</View>
					</>
				) : null}
			</View>
		</View>
	)
}

function HelpOption({
	palette,
	title,
	subtitle,
	onPress,
}: {
	readonly palette: BoardPalette
	readonly title: string
	readonly subtitle: string
	readonly onPress: () => void
}) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={title}
			onPress={onPress}
			style={[
				styles.option,
				{
					borderColor: palette.controlBorder,
					backgroundColor: palette.boardBackground,
				},
			]}
		>
			<Text style={[styles.optionTitle, { color: palette.headerText }]}>
				{title}
			</Text>
			<Text style={[styles.optionSub, { color: palette.clueText }]}>
				{subtitle}
			</Text>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	root: {
		...StyleSheet.absoluteFill,
		justifyContent: 'flex-end',
		zIndex: 20,
	},
	backdrop: {
		...StyleSheet.absoluteFill,
		backgroundColor: 'rgba(0,0,0,0.35)',
	},
	panel: {
		borderTopLeftRadius: 16,
		borderTopRightRadius: 16,
		borderWidth: 1,
		paddingHorizontal: 16,
		paddingTop: 16,
		gap: 10,
		maxHeight: '55%',
	},
	title: {
		fontSize: 18,
		fontWeight: '700',
	},
	subtitle: {
		fontSize: 13,
		lineHeight: 18,
		marginBottom: 4,
		fontWeight: '500',
	},
	hintCard: {
		gap: 8,
		paddingVertical: 4,
	},
	teachCard: {
		gap: 8,
		paddingVertical: 4,
	},
	whyAccent: {
		fontSize: 15,
		fontWeight: '800',
		letterSpacing: 0.2,
	},
	body: {
		fontSize: 15,
		lineHeight: 22,
	},
	lineMeta: {
		fontSize: 15,
		fontWeight: '700',
	},
	actionLabel: {
		fontSize: 17,
		fontWeight: '700',
		lineHeight: 24,
	},
	option: {
		borderWidth: 1,
		borderRadius: 12,
		paddingHorizontal: 14,
		paddingVertical: 12,
		minHeight: 52,
	},
	optionTitle: {
		fontSize: 16,
		fontWeight: '700',
	},
	optionSub: {
		fontSize: 13,
		marginTop: 2,
		lineHeight: 18,
	},
	actions: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		marginTop: 4,
	},
	primaryButton: {
		borderRadius: 12,
		paddingHorizontal: 16,
		paddingVertical: 12,
		minHeight: 44,
		justifyContent: 'center',
	},
	primaryText: {
		color: '#FFFFFF',
		fontWeight: '700',
		fontSize: 15,
	},
	secondaryButton: {
		paddingHorizontal: 12,
		paddingVertical: 12,
		minHeight: 44,
		justifyContent: 'center',
	},
	secondaryText: {
		fontSize: 15,
		fontWeight: '600',
	},
})
