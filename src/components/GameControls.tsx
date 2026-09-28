/**
 * Game tool / undo controls — large touch targets, text + selected state.
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
	readonly disabled?: boolean
}

function ControlButton({
	label,
	symbol,
	selected,
	disabled,
	palette,
	onPress,
}: {
	label: string
	symbol: string
	selected?: boolean
	disabled?: boolean
	palette: BoardPalette
	onPress: () => void
}) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
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
			<Text
				style={[
					styles.symbol,
					{ color: selected ? '#FFFFFF' : palette.controlText },
				]}
			>
				{symbol}
			</Text>
			<Text
				style={[
					styles.label,
					{ color: selected ? '#FFFFFF' : palette.controlText },
				]}
			>
				{label}
			</Text>
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
	disabled = false,
}: GameControlsProps) {
	return (
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
				label="Вписать"
				symbol="⛶"
				disabled={false}
				palette={palette}
				onPress={onFit}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	row: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'center',
		gap: 8,
		paddingHorizontal: 8,
		paddingTop: 8,
		paddingBottom: 4,
	},
	button: {
		minWidth: 72,
		minHeight: 56,
		borderRadius: 12,
		borderWidth: 1,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 8,
		paddingVertical: 6,
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
})
