/**
 * Game screen — playable nonogram board with paint / zoom / pan + persistence.
 *
 * Gesture contract (unchanged from Phase 3):
 * - 1 finger → paint (tap / drag + line lock)
 * - 2 fingers → pan / pinch zoom (does not mutate player state)
 * - Fit button restores fit-to-screen transform
 *
 * Persistence:
 * - Save after completed paint / undo / redo transactions (not mid-drag)
 * - Flush on Back and AppState background
 * - Active timer pauses while backgrounded / away from Game
 * - Undo history is NOT persisted across relaunch
 * - Completion is persisted at solve time (not when overlay is dismissed)
 *
 * No BannerSlot on Game (product decision).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
	Alert,
	AppState,
	type AppStateStatus,
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
	endGesture,
	redo,
	restoreGameSession,
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
import { difficultyLabelRu } from '../presentation/difficultyLabels'
import { formatGameElapsed } from '../presentation/timeFormat'
import {
	createPausedTimer,
	pauseTimer,
	readActiveElapsedMs,
	startOrResumeTimer,
	type ActiveTimerState,
} from '../persistence/timer'
import { useProgress } from '../progress/ProgressProvider'
import type { GameLaunchMode } from '../navigation/RootNavigation'
import type { CompletionEventResult } from '../persistence/completionResult'
import { cropSolutionBitmap } from '../gallery/crop'
import { getGalleryItemDef } from '../gallery/definitions'

export interface GameScreenProps {
	readonly puzzleId: string
	readonly mode: GameLaunchMode
	readonly onExit: () => void
	readonly onOpenGallery: () => void
	readonly onNextPuzzle: (puzzleId: string) => void
	readonly darkMode?: boolean
}

/**
 * Ephemeral pinch/pan gesture bookkeeping.
 * Kept outside React refs so RNGH builders + react-hooks/refs stay compatible;
 * GameScreen is a single active instance so module scope is safe.
 */
let pinchBaseScale = 1
let panLastX = 0
let panLastY = 0

/**
 * Mutable live snapshot for AppState / flush (updated in effects, not render).
 * Avoids react-hooks/refs and react-hooks/globals render reassignment rules.
 */
const liveGame = {
	session: null as GameSession | null,
	timer: createPausedTimer(0) as ActiveTimerState,
	restartCount: 0,
	completionPersisted: false,
}

export function GameScreen({
	puzzleId,
	mode,
	onExit,
	onOpenGallery,
	onNextPuzzle,
	darkMode = false,
}: GameScreenProps) {
	const insets = useSafeAreaInsets()
	const { service, refresh } = useProgress()
	const palette: BoardPalette = darkMode
		? DARK_BOARD_PALETTE
		: LIGHT_BOARD_PALETTE

	const puzzle = useMemo(() => getProductionPuzzleById(puzzleId), [puzzleId])
	const loadError =
		puzzle === null
			? `Puzzle unavailable or not productionReady: ${puzzleId}`
			: null

	const [session, setSession] = useState<GameSession | null>(null)
	const [boundKey, setBoundKey] = useState<string | null>(null)
	const [viewport, setViewport] = useState({ width: 0, height: 0 })
	const [transform, setTransform] = useState<ViewTransform>(identityTransform())
	const [fitKey, setFitKey] = useState('')
	const [nowMs, setNowMs] = useState(0)
	const [timer, setTimer] = useState<ActiveTimerState>(createPausedTimer(0))
	const [restartCountThisRun, setRestartCountThisRun] = useState(0)
	const [completionPersisted, setCompletionPersisted] = useState(false)
	const [completionEvent, setCompletionEvent] =
		useState<CompletionEventResult | null>(null)

	const bindKey = `${puzzleId}:${mode}`

	useEffect(() => {
		liveGame.session = session
		liveGame.timer = timer
		liveGame.restartCount = restartCountThisRun
		liveGame.completionPersisted = completionPersisted
	}, [session, timer, restartCountThisRun, completionPersisted])

	// Bootstrap / restore session when route identity changes.
	if (puzzle !== null && boundKey !== bindKey) {
		if (mode === 'resume') {
			const resumed = service.resumeActivePuzzle()
			if (resumed !== null && resumed.puzzle.id === puzzle.id) {
				setSession(
					restoreGameSession(puzzle, resumed.player, resumed.tool),
				)
				setTimer(createPausedTimer(resumed.accumulatedActiveMs))
				setRestartCountThisRun(resumed.restartCountThisRun)
			} else {
				setSession(createGameSession(puzzle))
				setTimer(createPausedTimer(0))
				setRestartCountThisRun(0)
			}
		} else {
			setSession(createGameSession(puzzle))
			setTimer(createPausedTimer(0))
			setRestartCountThisRun(0)
		}
		setCompletionPersisted(false)
		setCompletionEvent(null)
		setBoundKey(bindKey)
	} else if (puzzle === null && boundKey !== null) {
		setSession(null)
		setBoundKey(null)
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

	const persistSnapshot = useCallback(
		async (nextSession: GameSession, nextTimer: ActiveTimerState) => {
			if (liveGame.completionPersisted || nextSession.completed) {
				return
			}
			const now = Date.now()
			const paused = pauseTimer(nextTimer, now)
			await service.persistGameState({
				puzzle: nextSession.puzzle,
				player: nextSession.player,
				accumulatedActiveMs: paused.accumulatedMs,
				tool: nextSession.tool,
				restartCountThisRun: liveGame.restartCount,
			})
			refresh()
		},
		[refresh, service],
	)

	const persistCompletion = useCallback(
		async (nextSession: GameSession, nextTimer: ActiveTimerState) => {
			if (liveGame.completionPersisted) {
				return
			}
			const now = Date.now()
			const elapsed = readActiveElapsedMs(pauseTimer(nextTimer, now), now)
			const { event } = await service.completePuzzle({
				puzzleId: nextSession.puzzle.id,
				activeTimeMs: elapsed,
			})
			liveGame.completionPersisted = true
			setCompletionPersisted(true)
			setCompletionEvent(event)
			setTimer(createPausedTimer(elapsed))
			refresh()
		},
		[refresh, service],
	)

	const applySessionUpdate = useCallback(
		(
			updater: (current: GameSession) => GameSession,
			options?: { readonly recordUndo?: boolean; readonly recordRedo?: boolean },
		) => {
			setSession((current) => {
				if (current === null) {
					return current
				}
				const previousCompleted = current.completed
				const next = updater(current)
				const gestureEnded =
					current.activeGesture !== null && next.activeGesture === null
				const historyChanged =
					next.history !== current.history && next.activeGesture === null
				const shouldPersist =
					!next.completed && (gestureEnded || historyChanged)

				if (!previousCompleted && next.completed) {
					void persistCompletion(next, liveGame.timer)
				} else if (shouldPersist) {
					void persistSnapshot(next, liveGame.timer)
				}

				if (options?.recordUndo) {
					void service.recordUndo().then(() => refresh())
				}
				if (options?.recordRedo) {
					void service.recordRedo().then(() => refresh())
				}

				return next
			})
		},
		[persistCompletion, persistSnapshot, refresh, service],
	)

	// UI clock tick — resume active timer asynchronously (not sync in effect body).
	useEffect(() => {
		const applyNow = () => {
			const now = Date.now()
			setNowMs(now)
			if (!liveGame.completionPersisted) {
				setTimer((current) => startOrResumeTimer(current, now))
			}
		}
		const bootId = setTimeout(applyNow, 0)
		const id = setInterval(applyNow, 1000)
		return () => {
			clearTimeout(bootId)
			clearInterval(id)
			liveGame.timer = pauseTimer(liveGame.timer, Date.now())
		}
	}, [bindKey])

	useEffect(() => {
		const onChange = (state: AppStateStatus) => {
			if (state === 'active') {
				if (!liveGame.completionPersisted) {
					const now = Date.now()
					setNowMs(now)
					setTimer((current) => startOrResumeTimer(current, now))
				}
				return
			}
			setTimer((current) => {
				const paused = pauseTimer(current, Date.now())
				liveGame.timer = paused
				const currentSession = liveGame.session
				if (
					currentSession !== null &&
					!currentSession.completed &&
					!liveGame.completionPersisted
				) {
					void persistSnapshot(currentSession, paused)
				}
				return paused
			})
		}
		const sub = AppState.addEventListener('change', onChange)
		return () => sub.remove()
	}, [persistSnapshot])

	const exitWithFlush = useCallback(() => {
		const currentSession = liveGame.session
		const now = Date.now()
		const paused = pauseTimer(liveGame.timer, now)
		setTimer(paused)
		liveGame.timer = paused
		if (
			currentSession !== null &&
			!currentSession.completed &&
			!liveGame.completionPersisted
		) {
			void persistSnapshot(currentSession, paused).finally(() => {
				refresh()
				onExit()
			})
			return
		}
		refresh()
		onExit()
	}, [onExit, persistSnapshot, refresh])

	useEffect(() => {
		const sub = BackHandler.addEventListener('hardwareBackPress', () => {
			if (liveGame.session?.completed) {
				refresh()
				onExit()
				return true
			}
			exitWithFlush()
			return true
		})
		return () => sub.remove()
	}, [exitWithFlush, onExit, refresh])

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
			applySessionUpdate((current) => tapCell(current, cell, { x, y }))
		},
		[applySessionUpdate, layout, session, transform],
	)

	const onPaintMove = useCallback(
		(x: number, y: number) => {
			if (session === null || layout === null || session.activeGesture === null) {
				return
			}
			const cell = pointerToCell(x, y, layout, transform)
			applySessionUpdate((current) =>
				continueGesture(current, cell, { x, y }),
			)
		},
		[applySessionUpdate, layout, session, transform],
	)

	const onPaintEnd = useCallback(() => {
		applySessionUpdate((current) => {
			if (current.activeGesture === null) {
				return current
			}
			return endGesture(current)
		})
	}, [applySessionUpdate])

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

	const handleRestart = useCallback(() => {
		if (puzzle === null || session === null || session.completed) {
			return
		}
		Alert.alert('Начать этот кроссворд заново?', undefined, [
			{ text: 'Отмена', style: 'cancel' },
			{
				text: 'Начать заново',
				style: 'destructive',
				onPress: () => {
					void service.restartPuzzle(puzzle).then(() => {
						setSession(createGameSession(puzzle))
						setTimer(startOrResumeTimer(createPausedTimer(0), Date.now()))
						setRestartCountThisRun((value) => value + 1)
						setCompletionPersisted(false)
						setCompletionEvent(null)
						refresh()
					})
				},
			},
		])
	}, [puzzle, refresh, service, session])

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

	const elapsedMs = readActiveElapsedMs(
		timer,
		nowMs > 0 ? nowMs : timer.accumulatedMs,
	)
	const elapsed = formatGameElapsed(elapsedMs)

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
					onPress={exitWithFlush}
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
						{puzzle.width}×{puzzle.height}
					</Text>
					<Text style={[styles.meta, { color: palette.clueTextDimmed }]}>
						{difficultyTier === null
							? '—'
							: difficultyLabelRu(difficultyTier)}{' '}
						· {elapsed}
					</Text>
				</View>
				{!session.completed ? (
					<Pressable
						accessibilityRole="button"
						accessibilityLabel="Начать заново"
						onPress={handleRestart}
						hitSlop={8}
						style={styles.restartButton}
					>
						<Text
							style={[styles.restartText, { color: palette.clueTextDimmed }]}
						>
							Заново
						</Text>
					</Pressable>
				) : (
					<View style={styles.restartButton} />
				)}
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
					onTool={(tool) =>
						applySessionUpdate((current) => setTool(current, tool))
					}
					onUndo={() =>
						applySessionUpdate((current) => undo(current), {
							recordUndo: true,
						})
					}
					onRedo={() =>
						applySessionUpdate((current) => redo(current), {
							recordRedo: true,
						})
					}
					onFit={fitBoard}
				/>
			</View>

			<CompletionOverlay
				visible={session.completed}
				title={
					getGalleryItemDef(puzzle.id)?.titleRu ??
					`${puzzle.width}×${puzzle.height}`
				}
				sizeLabel={
					difficultyTier === null
						? `${puzzle.width}×${puzzle.height}`
						: `${puzzle.width}×${puzzle.height} · ${difficultyLabelRu(difficultyTier)}`
				}
				elapsedLabel={elapsed}
				palette={palette}
				preview={
					session.completed
						? cropSolutionBitmap(
								puzzle.width,
								puzzle.height,
								puzzle.solution,
							)
						: null
				}
				event={completionEvent}
				onHome={() => {
					refresh()
					onExit()
				}}
				onGallery={onOpenGallery}
				onNext={
					completionEvent?.nextCampaignPuzzleId
						? () =>
								onNextPuzzle(completionEvent.nextCampaignPuzzleId as string)
						: null
				}
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
	restartButton: {
		minWidth: 64,
		minHeight: 44,
		justifyContent: 'center',
		alignItems: 'flex-end',
	},
	restartText: {
		fontSize: 13,
		fontWeight: '600',
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
