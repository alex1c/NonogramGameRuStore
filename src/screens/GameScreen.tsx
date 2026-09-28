/**
 * Game screen — playable nonogram board with paint / zoom / pan.
 *
 * Gesture contract:
 * - 1 finger → paint (tap / drag + line lock)
 * - 2 fingers → pan / pinch zoom (does not mutate player state)
 * - Fit button restores fit-to-screen transform
 *
 * No BannerSlot on Game (product decision).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
	BackHandler,
	LayoutChangeEvent,
	Pressable,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { NonogramBoard } from '../board/NonogramBoard'
import {
	clampTranslation,
	computeBoardLayout,
	fitTransform,
	identityTransform,
	pointerToCell,
	scaleAroundFocal,
	type ViewTransform,
} from '../board/geometry'
import {
	DARK_BOARD_PALETTE,
	LIGHT_BOARD_PALETTE,
	type BoardPalette,
} from '../board/palette'
import { CompletionOverlay } from '../components/CompletionOverlay'
import { GameControls } from '../components/GameControls'
import { getProductionPuzzleById } from '../content/playable'
import {
	continueGesture,
	createGameSession,
	elapsedMs,
	endGesture,
	redo,
	sessionCanRedo,
	sessionCanUndo,
	sessionSatisfiedColumns,
	sessionSatisfiedRows,
	setTool,
	tapCell,
	undo,
	type GameSession,
} from '../gameplay/session'
import { analyzeDifficulty } from '../domain/difficulty/analyzer'

export interface GameScreenProps {
	readonly puzzleId: string
	readonly onExit: () => void
	readonly darkMode?: boolean
}

function formatElapsed(ms: number): string {
	const totalSec = Math.floor(ms / 1000)
	const min = Math.floor(totalSec / 60)
	const sec = totalSec % 60
	return `${min}:${sec.toString().padStart(2, '0')}`
}

/**
 * Ephemeral pinch/pan gesture bookkeeping.
 * Kept outside React refs so RNGH builders + react-hooks/refs stay compatible;
 * GameScreen is a single active instance so module scope is safe.
 */
let pinchBaseScale = 1
let panLastX = 0
let panLastY = 0

export function GameScreen({
	puzzleId,
	onExit,
	darkMode = false,
}: GameScreenProps) {
	const insets = useSafeAreaInsets()
	const palette: BoardPalette = darkMode
		? DARK_BOARD_PALETTE
		: LIGHT_BOARD_PALETTE

	const puzzle = useMemo(() => getProductionPuzzleById(puzzleId), [puzzleId])
	const loadError =
		puzzle === null
			? `Puzzle unavailable or not productionReady: ${puzzleId}`
			: null

	const [session, setSession] = useState<GameSession | null>(null)
	const [boundPuzzleId, setBoundPuzzleId] = useState<string | null>(null)
	const [viewport, setViewport] = useState({ width: 0, height: 0 })
	const [transform, setTransform] = useState<ViewTransform>(identityTransform())
	const [fitKey, setFitKey] = useState('')
	const [tick, setTick] = useState(0)

	// Adjust session when the opened puzzle identity changes (render-time sync).
	if (puzzle !== null && boundPuzzleId !== puzzle.id) {
		setSession(createGameSession(puzzle))
		setBoundPuzzleId(puzzle.id)
	} else if (puzzle === null && boundPuzzleId !== null) {
		setSession(null)
		setBoundPuzzleId(null)
	}

	const layout = useMemo(() => {
		if (puzzle === null || viewport.width <= 0 || viewport.height <= 0) {
			return null
		}
		return computeBoardLayout({
			puzzleWidth: puzzle.width,
			puzzleHeight: puzzle.height,
			rowClues: puzzle.rowClues,
			columnClues: puzzle.columnClues,
			viewportWidth: viewport.width,
			viewportHeight: viewport.height,
		})
	}, [puzzle, viewport.height, viewport.width])

	const nextFitKey =
		layout === null
			? ''
			: `${puzzle?.id}:${viewport.width}x${viewport.height}:${layout.cellSize}`
	if (layout !== null && nextFitKey !== fitKey) {
		setTransform(fitTransform(layout, viewport.width, viewport.height))
		setFitKey(nextFitKey)
	}

	useEffect(() => {
		const id = setInterval(() => setTick((value) => value + 1), 1000)
		return () => clearInterval(id)
	}, [])

	useEffect(() => {
		const sub = BackHandler.addEventListener('hardwareBackPress', () => {
			onExit()
			return true
		})
		return () => sub.remove()
	}, [onExit])

	const handleViewportLayout = useCallback((event: LayoutChangeEvent) => {
		const { width, height } = event.nativeEvent.layout
		setViewport({ width, height })
	}, [])

	const fitBoard = useCallback(() => {
		if (layout === null) {
			return
		}
		setTransform(fitTransform(layout, viewport.width, viewport.height))
	}, [layout, viewport.height, viewport.width])

	const onPaintStart = useCallback(
		(x: number, y: number) => {
			if (session === null || layout === null || session.completed) {
				return
			}
			const cell = pointerToCell(x, y, layout, transform)
			if (cell === null) {
				return
			}
			setSession(tapCell(session, cell, { x, y }))
		},
		[layout, session, transform],
	)

	const onPaintMove = useCallback(
		(x: number, y: number) => {
			if (session === null || layout === null || session.activeGesture === null) {
				return
			}
			const cell = pointerToCell(x, y, layout, transform)
			setSession(continueGesture(session, cell, { x, y }))
		},
		[layout, session, transform],
	)

	const onPaintEnd = useCallback(() => {
		setSession((current) => {
			if (current === null || current.activeGesture === null) {
				return current
			}
			return endGesture(current)
		})
	}, [])

	const beginPinch = useCallback(() => {
		setTransform((current) => {
			pinchBaseScale = current.scale
			return current
		})
	}, [])

	const applyPinch = useCallback(
		(cumulativeScale: number, focalX: number, focalY: number) => {
			if (layout === null) {
				return
			}
			const nextScale = pinchBaseScale * cumulativeScale
			setTransform((current) =>
				clampTranslation(
					scaleAroundFocal(current, focalX, focalY, nextScale),
					layout,
					viewport.width,
					viewport.height,
				),
			)
		},
		[layout, viewport.height, viewport.width],
	)

	const beginTwoFingerPan = useCallback((x: number, y: number) => {
		panLastX = x
		panLastY = y
	}, [])

	const moveTwoFingerPan = useCallback(
		(x: number, y: number) => {
			if (layout === null) {
				return
			}
			const dx = x - panLastX
			const dy = y - panLastY
			panLastX = x
			panLastY = y
			setTransform((current) =>
				clampTranslation(
					{
						scale: current.scale,
						tx: current.tx + dx,
						ty: current.ty + dy,
					},
					layout,
					viewport.width,
					viewport.height,
				),
			)
		},
		[layout, viewport.height, viewport.width],
	)

	const difficultyTier = useMemo(
		() => (puzzle === null ? null : analyzeDifficulty(puzzle).tier),
		[puzzle],
	)

	const composed = useMemo(
		() =>
			Gesture.Simultaneous(
				Gesture.Pan()
					.maxPointers(1)
					.minDistance(0)
					.onBegin((event) => {
						runOnJS(onPaintStart)(event.x, event.y)
					})
					.onUpdate((event) => {
						runOnJS(onPaintMove)(event.x, event.y)
					})
					.onFinalize(() => {
						runOnJS(onPaintEnd)()
					}),
				Gesture.Simultaneous(
					Gesture.Pinch()
						.onBegin(() => {
							runOnJS(beginPinch)()
						})
						.onUpdate((event) => {
							runOnJS(applyPinch)(
								event.scale,
								event.focalX,
								event.focalY,
							)
						}),
					Gesture.Pan()
						.minPointers(2)
						.onBegin((event) => {
							runOnJS(beginTwoFingerPan)(
								event.translationX,
								event.translationY,
							)
						})
						.onUpdate((event) => {
							runOnJS(moveTwoFingerPan)(
								event.translationX,
								event.translationY,
							)
						}),
				),
			),
		[
			applyPinch,
			beginPinch,
			beginTwoFingerPan,
			moveTwoFingerPan,
			onPaintEnd,
			onPaintMove,
			onPaintStart,
		],
	)

	if (loadError !== null) {
		return (
			<View
				style={[
					styles.root,
					{
						backgroundColor: palette.screenBackground,
						paddingTop: insets.top,
						paddingBottom: insets.bottom,
					},
				]}
			>
				<Text style={[styles.error, { color: palette.headerText }]}>
					{loadError}
				</Text>
				<Pressable onPress={onExit} style={styles.backLink}>
					<Text style={{ color: palette.controlSelected, fontWeight: '700' }}>
						На главную
					</Text>
				</Pressable>
			</View>
		)
	}

	if (session === null || puzzle === null) {
		return (
			<View
				style={[styles.root, { backgroundColor: palette.screenBackground }]}
			/>
		)
	}

	const elapsed = formatElapsed(elapsedMs(session))
	void tick

	return (
		<View
			style={[
				styles.root,
				{
					backgroundColor: palette.screenBackground,
					paddingTop: insets.top,
				},
			]}
		>
			<View style={styles.header}>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Назад"
					onPress={onExit}
					hitSlop={12}
					style={styles.backButton}
				>
					<Text style={[styles.backText, { color: palette.controlSelected }]}>
						← Назад
					</Text>
				</Pressable>
				<View style={styles.headerCenter}>
					<Text
						style={[styles.title, { color: palette.headerText }]}
						numberOfLines={1}
					>
						{puzzle.metadata.title ?? puzzle.id}
					</Text>
					<Text style={[styles.meta, { color: palette.clueTextDimmed }]}>
						{puzzle.width}×{puzzle.height} · {difficultyTier ?? '—'} ·{' '}
						{elapsed}
					</Text>
				</View>
			</View>

			<GestureDetector gesture={composed}>
				<View style={styles.boardViewport} onLayout={handleViewportLayout}>
					{layout !== null ? (
						<NonogramBoard
							puzzle={puzzle}
							player={session.player}
							layout={layout}
							transform={transform}
							palette={palette}
							satisfiedRows={sessionSatisfiedRows(session)}
							satisfiedColumns={sessionSatisfiedColumns(session)}
							activeGesture={session.activeGesture}
							viewportWidth={viewport.width}
							viewportHeight={viewport.height}
						/>
					) : null}
				</View>
			</GestureDetector>

			<View style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
				<GameControls
					tool={session.tool}
					canUndo={sessionCanUndo(session)}
					canRedo={sessionCanRedo(session)}
					palette={palette}
					disabled={session.completed}
					onTool={(tool) => setSession(setTool(session, tool))}
					onUndo={() => setSession(undo(session))}
					onRedo={() => setSession(redo(session))}
					onFit={fitBoard}
				/>
			</View>

			<CompletionOverlay
				visible={session.completed}
				title={puzzle.metadata.title ?? puzzle.id}
				sizeLabel={`${puzzle.width}×${puzzle.height}`}
				elapsedLabel={elapsed}
				palette={palette}
				onDone={onExit}
				onPlayAgain={() => setSession(createGameSession(puzzle))}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 12,
		paddingVertical: 8,
		gap: 8,
	},
	backButton: {
		minWidth: 72,
		minHeight: 44,
		justifyContent: 'center',
	},
	backText: {
		fontSize: 16,
		fontWeight: '700',
	},
	headerCenter: {
		flex: 1,
	},
	title: {
		fontSize: 18,
		fontWeight: '700',
	},
	meta: {
		fontSize: 12,
		marginTop: 2,
	},
	boardViewport: {
		flex: 1,
		overflow: 'hidden',
	},
	error: {
		margin: 24,
		fontSize: 16,
	},
	backLink: {
		marginHorizontal: 24,
		minHeight: 44,
		justifyContent: 'center',
	},
})
