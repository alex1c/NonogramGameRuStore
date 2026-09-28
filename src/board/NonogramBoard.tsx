/**
 * Skia nonogram board renderer + shared transform hit-testing.
 * Single source of truth: layout + ViewTransform from geometry.ts.
 *
 * Phase 3B: larger clue glyphs, measured horizontal centering, explicit
 * gap between the last row clue and the grid edge.
 */

import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import {
	Canvas,
	Group,
	Line,
	Rect,
	Text as SkiaText,
	matchFont,
	vec,
	type SkFont,
} from '@shopify/react-native-skia'
import { PlayerCell, type Puzzle, type PlayerState } from '../domain/nonogram/types'
import {
	GROUP_SEPARATOR_EVERY,
	clueFontSize,
	type BoardLayout,
	type ViewTransform,
	cellRect,
} from './geometry'
import type { BoardPalette } from './palette'
import type { PaintGestureState } from '../gameplay/paintGesture'

interface NonogramBoardProps {
	readonly puzzle: Puzzle
	readonly player: PlayerState
	readonly layout: BoardLayout
	readonly transform: ViewTransform
	readonly palette: BoardPalette
	readonly satisfiedRows: readonly boolean[]
	readonly satisfiedColumns: readonly boolean[]
	readonly activeGesture: PaintGestureState | null
	readonly viewportWidth: number
	readonly viewportHeight: number
}

function CrossMark({
	rect,
	color,
	stroke,
}: {
	rect: { x: number; y: number; width: number; height: number }
	color: string
	stroke: number
}) {
	const inset = rect.width * 0.22
	return (
		<>
			<Line
				p1={vec(rect.x + inset, rect.y + inset)}
				p2={vec(rect.x + rect.width - inset, rect.y + rect.height - inset)}
				color={color}
				strokeWidth={stroke}
			/>
			<Line
				p1={vec(rect.x + rect.width - inset, rect.y + inset)}
				p2={vec(rect.x + inset, rect.y + rect.height - inset)}
				color={color}
				strokeWidth={stroke}
			/>
		</>
	)
}

/** Measured text width; falls back to a digit-count estimate if measure fails. */
function measureClueWidth(font: SkFont | null, text: string, fontSize: number): number {
	if (font !== null) {
		try {
			return font.measureText(text).width
		} catch {
			// Fall through to estimate when the native font path is unavailable.
		}
	}
	return text.length * fontSize * 0.62
}

/**
 * Skia text uses baseline Y. Center the glyph box on `centerY` when metrics
 * are available; otherwise use a stable fraction of the font size.
 */
function baselineForCenter(font: SkFont | null, centerY: number, fontSize: number): number {
	if (font !== null) {
		try {
			const metrics = font.getMetrics()
			// Skia ascent is typically negative; descent positive.
			return centerY - (metrics.ascent + metrics.descent) / 2
		} catch {
			// Fall through.
		}
	}
	return centerY + fontSize * 0.35
}

export function NonogramBoard({
	puzzle,
	player,
	layout,
	transform,
	palette,
	satisfiedRows,
	satisfiedColumns,
	activeGesture,
	viewportWidth,
	viewportHeight,
}: NonogramBoardProps) {
	const fontSize = clueFontSize(layout.cellSize)
	const font = useMemo(
		() =>
			matchFont({
				fontFamily: 'sans-serif',
				fontSize,
			}),
		[fontSize],
	)

	const highlight = activeGesture

	return (
		<View style={{ width: viewportWidth, height: viewportHeight }}>
			<Canvas style={StyleSheet.absoluteFill}>
				<Group
					transform={[
						{ translateX: transform.tx },
						{ translateY: transform.ty },
						{ scale: transform.scale },
					]}
				>
					<Rect
						x={0}
						y={0}
						width={layout.totalWidth}
						height={layout.totalHeight}
						color={palette.boardBackground}
					/>
					{/* Clue backgrounds */}
					<Rect
						x={0}
						y={layout.gridOriginY}
						width={layout.clueColWidth}
						height={layout.gridHeight}
						color={palette.clueBackground}
					/>
					<Rect
						x={layout.gridOriginX}
						y={0}
						width={layout.gridWidth}
						height={layout.clueRowHeight}
						color={palette.clueBackground}
					/>

					{/* Cells */}
					{Array.from({ length: puzzle.height }, (_, row) =>
						Array.from({ length: puzzle.width }, (_, col) => {
							const rect = cellRect(layout, row, col)
							const cell = player.cells[row * puzzle.width + col]
							return (
								<Group key={`c-${row}-${col}`}>
									<Rect
										x={rect.x}
										y={rect.y}
										width={rect.width}
										height={rect.height}
										color={
											cell === PlayerCell.FILLED
												? palette.cellFilled
												: palette.cellEmpty
										}
									/>
									{cell === PlayerCell.CROSSED ? (
										<CrossMark
											rect={rect}
											color={palette.cross}
											stroke={Math.max(1.5, layout.cellSize * 0.08)}
										/>
									) : null}
								</Group>
							)
						}),
					)}

					{/* Active line highlight */}
					{highlight !== null && highlight.lock === 'row' ? (
						<Rect
							x={layout.gridOriginX}
							y={layout.gridOriginY + highlight.start.row * layout.cellSize}
							width={layout.gridWidth}
							height={layout.cellSize}
							color={palette.highlight}
						/>
					) : null}
					{highlight !== null && highlight.lock === 'column' ? (
						<Rect
							x={layout.gridOriginX + highlight.start.col * layout.cellSize}
							y={layout.gridOriginY}
							width={layout.cellSize}
							height={layout.gridHeight}
							color={palette.highlight}
						/>
					) : null}
					{highlight !== null && highlight.lock === 'none' ? (
						<Rect
							{...cellRect(
								layout,
								highlight.lastCell.row,
								highlight.lastCell.col,
							)}
							color={palette.highlight}
						/>
					) : null}

					{/* Grid lines */}
					{Array.from({ length: puzzle.width + 1 }, (_, i) => {
						const x = layout.gridOriginX + i * layout.cellSize
						const strong = i % GROUP_SEPARATOR_EVERY === 0 || i === puzzle.width
						return (
							<Line
								key={`v-${i}`}
								p1={vec(x, layout.gridOriginY)}
								p2={vec(x, layout.gridOriginY + layout.gridHeight)}
								color={strong ? palette.gridLineStrong : palette.gridLine}
								strokeWidth={strong ? 2 : 1}
							/>
						)
					})}
					{Array.from({ length: puzzle.height + 1 }, (_, i) => {
						const y = layout.gridOriginY + i * layout.cellSize
						const strong = i % GROUP_SEPARATOR_EVERY === 0 || i === puzzle.height
						return (
							<Line
								key={`h-${i}`}
								p1={vec(layout.gridOriginX, y)}
								p2={vec(layout.gridOriginX + layout.gridWidth, y)}
								color={strong ? palette.gridLineStrong : palette.gridLine}
								strokeWidth={strong ? 2 : 1}
							/>
						)
					})}

					{/* Row clues — last number closest to the grid, with explicit gap */}
					{puzzle.rowClues.map((clue, row) => {
						const dimmed = satisfiedRows[row] === true
						const numbers = clue.length === 0 ? [0] : [...clue]
						const rowCenterY =
							layout.gridOriginY + row * layout.cellSize + layout.cellSize / 2
						const baselineY = baselineForCenter(font, rowCenterY, fontSize)
						return numbers.map((value, indexFromLeft) => {
							const indexFromRight = numbers.length - 1 - indexFromLeft
							const text = String(value)
							const textWidth = measureClueWidth(font, text, fontSize)
							const slotCenterX =
								layout.gridOriginX -
								layout.rowClueGridGap -
								(indexFromRight + 0.5) * layout.rowClueSlotWidth
							const x = slotCenterX - textWidth / 2
							return (
								<SkiaText
									key={`rc-${row}-${indexFromLeft}`}
									x={x}
									y={baselineY}
									text={text}
									font={font}
									color={dimmed ? palette.clueTextDimmed : palette.clueText}
								/>
							)
						})
					})}

					{/* Column clues — last number closest to the grid */}
					{puzzle.columnClues.map((clue, col) => {
						const dimmed = satisfiedColumns[col] === true
						const numbers = clue.length === 0 ? [0] : [...clue]
						const colCenterX =
							layout.gridOriginX + col * layout.cellSize + layout.cellSize / 2
						return numbers.map((value, indexFromTop) => {
							const indexFromBottom = numbers.length - 1 - indexFromTop
							const text = String(value)
							const textWidth = measureClueWidth(font, text, fontSize)
							const slotCenterY =
								layout.gridOriginY -
								layout.colClueGridGap -
								(indexFromBottom + 0.5) * layout.colClueSlotHeight
							const x = colCenterX - textWidth / 2
							const y = baselineForCenter(font, slotCenterY, fontSize)
							return (
								<SkiaText
									key={`cc-${col}-${indexFromTop}`}
									x={x}
									y={y}
									text={text}
									font={font}
									color={dimmed ? palette.clueTextDimmed : palette.clueText}
								/>
							)
						})
					})}
				</Group>
			</Canvas>
		</View>
	)
}
