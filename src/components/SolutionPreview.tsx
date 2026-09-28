/**
 * Lightweight Skia solution/preview renderer — no clues, gestures, or X marks.
 * Pixel-perfect fill (no smoothing). Locked content must never call this.
 */

import { Canvas, Rect } from '@shopify/react-native-skia'
import { StyleSheet, View } from 'react-native'
import type { CroppedBitmap } from '../gallery/crop'

interface SolutionPreviewProps {
	readonly bitmap: CroppedBitmap
	readonly maxSize: number
	readonly filledColor?: string
	readonly emptyColor?: string
	readonly backgroundColor?: string
}

export function SolutionPreview({
	bitmap,
	maxSize,
	filledColor = '#1F2A24',
	emptyColor = '#F7F9F6',
	backgroundColor = '#E7EEE4',
}: SolutionPreviewProps) {
	const aspect = bitmap.width / Math.max(1, bitmap.height)
	let drawW = maxSize
	let drawH = maxSize
	if (aspect >= 1) {
		drawH = Math.max(1, Math.floor(maxSize / aspect))
	} else {
		drawW = Math.max(1, Math.floor(maxSize * aspect))
	}
	const cell = Math.max(
		1,
		Math.floor(Math.min(drawW / bitmap.width, drawH / bitmap.height)),
	)
	const canvasW = cell * bitmap.width
	const canvasH = cell * bitmap.height

	return (
		<View
			style={[
				styles.frame,
				{
					width: canvasW + 8,
					height: canvasH + 8,
					backgroundColor,
				},
			]}
		>
			<Canvas style={{ width: canvasW, height: canvasH }}>
				<Rect
					x={0}
					y={0}
					width={canvasW}
					height={canvasH}
					color={emptyColor}
				/>
				{bitmap.cells.map((value, index) => {
					if (value !== 1) {
						return null
					}
					const col = index % bitmap.width
					const row = Math.floor(index / bitmap.width)
					return (
						<Rect
							key={`${row}-${col}`}
							x={col * cell}
							y={row * cell}
							width={cell}
							height={cell}
							color={filledColor}
						/>
					)
				})}
			</Canvas>
		</View>
	)
}

const styles = StyleSheet.create({
	frame: {
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: 10,
		overflow: 'hidden',
	},
})
