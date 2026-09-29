/**
 * Game tool / undo / hint controls — two rows, large touch targets.
 *
 * Row 1: paint tools
 * Row 2: history + Подсказка + Fit
 */

import { Pressable, StyleSheet, Text, View } from 'react-native'
import { PaintTool } from '../gameplay/tools'
import type { BoardPalette } from '../board/palette'

interface GameControlsProps {
	readonly tool: PaintTool
	readonly canUndo: boolean
	readonly canRedo: boolean
	readonly palette: BoardPalette
	readonly onTool: (tool: PaintTool) => void
	readonly onUndo: () => void
	readonly onRedo: () => void
	readonly onFit: () => void
	readonly onHelp: () => void
	readonly helpDisabled?: boolean
	readonly disabled?: boolean
}

/** Simple geometric lightbulb — no emoji, no new icon package. */
function LightbulbGlyph({ color }: { readonly color: string }) {
	return (
		<View style={styles.bulbRoot} accessibilityElementsHidden>
			<View style={[styles.bulbGlow, { borderColor: color }]} />
			<View style={[styles.bulbBody, { backgroundColor: color }]} />
			<View style={[styles.bulbBase, { backgroundColor: color }]} />
			<View style={[styles.bulbScrew, { backgroundColor: color }]} />
		</View>
	)
}

function ControlButton({
	label,
	symbol,
	selected,
	disabled,
	palette,
	onPress,
	glyph,
}: {
	label: string
	symbol?: string
	selected?: boolean
	disabled?: boolean
	palette: BoardPalette
	onPress: () => void
	glyph?: 'lightbulb'
}) {
	const fg = selected ? '#FFFFFF' : palette.controlText
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label === 'Подсказка' ? 'Подсказки' : label}
			accessibilityState={{ selected: !!selected, disabled: !!disabled }}
			disabled={disabled}
			onPress={onPress}
			style={({ pressed }) => [
				styles.button,
				{
					backgroundColor: selected
						? palette.controlSelected
						: palette.controlBackground,
					borderColor: palette.controlBorder,
					opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
				},
			]}
		>
			{glyph === 'lightbulb' ? (
				<LightbulbGlyph color={fg} />
			) : (
				<Text style={[styles.symbol, { color: fg }]}>{symbol}</Text>
			)}
			<Text style={[styles.label, { color: fg }]}>{label}</Text>
		</Pressable>
	)
}

export function GameControls({
	tool,
	canUndo,
	canRedo,
	palette,
	onTool,
	onUndo,
	onRedo,
	onFit,
	onHelp,
	helpDisabled = false,
	disabled = false,
}: GameControlsProps) {
	return (
		<View style={styles.root}>
			<View style={styles.row}>
				<ControlButton
					label="Закрасить"
					symbol="■"
					selected={tool === PaintTool.FILLED}
					disabled={disabled}
					palette={palette}
					onPress={() => onTool(PaintTool.FILLED)}
				/>
				<ControlButton
					label="Крестик"
					symbol="×"
					selected={tool === PaintTool.CROSSED}
					disabled={disabled}
					palette={palette}
					onPress={() => onTool(PaintTool.CROSSED)}
				/>
				<ControlButton
					label="Ластик"
					symbol="⌫"
					selected={tool === PaintTool.ERASE}
					disabled={disabled}
					palette={palette}
					onPress={() => onTool(PaintTool.ERASE)}
				/>
			</View>
			<View style={styles.row}>
				<ControlButton
					label="Отмена"
					symbol="↶"
					disabled={disabled || !canUndo}
					palette={palette}
					onPress={onUndo}
				/>
				<ControlButton
					label="Повтор"
					symbol="↷"
					disabled={disabled || !canRedo}
					palette={palette}
					onPress={onRedo}
				/>
				<ControlButton
					label="Подсказка"
					glyph="lightbulb"
					disabled={disabled || helpDisabled}
					palette={palette}
					onPress={onHelp}
				/>
				<ControlButton
					label="Вписать"
					symbol="⛶"
					disabled={false}
					palette={palette}
					onPress={onFit}
				/>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	root: {
		paddingHorizontal: 8,
		paddingTop: 6,
		paddingBottom: 4,
		gap: 6,
	},
	row: {
		flexDirection: 'row',
		justifyContent: 'center',
		gap: 8,
	},
	button: {
		flex: 1,
		maxWidth: 96,
		minWidth: 64,
		minHeight: 52,
		borderRadius: 12,
		borderWidth: 1,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 4,
		paddingVertical: 5,
	},
	symbol: {
		fontSize: 18,
		fontWeight: '700',
		lineHeight: 22,
	},
	label: {
		fontSize: 11,
		fontWeight: '600',
		marginTop: 2,
	},
	bulbRoot: {
		width: 18,
		height: 20,
		alignItems: 'center',
		justifyContent: 'flex-start',
	},
	bulbGlow: {
		position: 'absolute',
		top: 0,
		width: 16,
		height: 16,
		borderRadius: 8,
		borderWidth: 1.5,
		opacity: 0.35,
	},
	bulbBody: {
		width: 12,
		height: 12,
		borderRadius: 6,
		marginTop: 1,
	},
	bulbBase: {
		width: 8,
		height: 3,
		borderBottomLeftRadius: 1,
		borderBottomRightRadius: 1,
		marginTop: 1,
		opacity: 0.9,
	},
	bulbScrew: {
		width: 6,
		height: 2,
		marginTop: 1,
		opacity: 0.75,
	},
})
