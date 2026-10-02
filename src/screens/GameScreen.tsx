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
 * Game hosts a bottom BannerSlot (Banner 1). Tutorial never mounts Game.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { BannerSlot } from '../components/BannerSlot'
import { CompletionOverlay } from '../components/CompletionOverlay'
import { GameControls } from '../components/GameControls'
import {
	HelpOverlay,
	type HelpPanelPhase,
} from '../components/HelpOverlay'
import {
	getProductionPuzzleById,
	resolvePlayablePuzzleById,
} from '../content/playable'
import { resolvePuzzleDifficultyTier } from '../content/difficultyLookup'
import {
	applyHintToSession,
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
import {
	applyHintStep,
	explainHintResult,
	getHint,
	lineContextForStep,
	type HintResult,
	type HintStep,
} from '../hints'
import type { HintHighlight } from '../board/hintHighlight'
import { puzzleToSpec } from '../solver/completeSolver'
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
import type { GameSessionDescriptor } from '../navigation/RootNavigation'
import type {
	CompletionEventResult,
	DailyCompletionEventResult,
} from '../persistence/completionResult'
import { cropSolutionBitmap } from '../gallery/crop'
import { getGalleryItemDef } from '../gallery/definitions'
import { formatDayTitleRu, localDayKey } from '../daily/dateUtils'
import { formatDayPlural } from '../presentation/russianPlural'
import {
	REWARDED_USER_FACING_ENABLED,
	recordCompletionForAdPolicy,
	showRewarded,
} from '../ads'
import { trackEvent } from '../analytics'
import {
	analyticsPlayMode,
	planCompletionEvents,
	planPuzzleBindEvents,
	type PlannedAnalyticsEvent,
	type PuzzleAnalyticsContext,
} from '../analytics/payloads'
import { getCampaignEntryByPuzzleId } from '../campaign/definition'
import { shouldRunActiveTimer } from '../gameplay/activeTimerGate'
import { isDailyRolloverError, isDailySessionStale } from '../daily/rollover'
import {
	FREE_HINTS_PER_DAY,
	FREE_TEACH_ME_PER_DAY,
	canUseHintWithoutRewarded,
	canUseTeachMeWithoutRewarded,
	formatFreeRemainingLabel,
	freeHintsRemaining,
	freeTeachMeRemaining,
	rollHelpAllowanceToDay,
	willConsumeFreeHint,
	willConsumeFreeTeachMe,
	type HelpAllowanceState,
} from '../help'

export interface GameScreenProps {
	readonly session: GameSessionDescriptor
	readonly onExit: () => void
	/** Called when leaving after completion (Home / Calendar) — interstitial gate. */
	readonly onExitAfterCompletion?: () => void
	readonly onOpenGallery: () => void
	readonly onOpenDailyCalendar: (dayKey: string) => void
	readonly onNextPuzzle: (puzzleId: string) => void
	/**
	 * Called once when a DAILY session outlives its local day (midnight).
	 * The host shows an alert and routes to the Daily calendar.
	 */
	readonly onDailyExpired?: () => void
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

/** Monotonic counter making run identities unique within one app process. */
let runSerial = 0

/**
 * True when the active solve clock may run. Delegates to the pure
 * `shouldRunActiveTimer` gate: the app must be in the foreground
 * (`appState === 'active'`), the run must not be completed / persisting a
 * completion, no rewarded ad may be open, the Daily must not be expired, and
 * (when given) `callbackRunId` must still be the current run so a stale
 * interval / listener can never resume another run's timer.
 */
function isSolveClockRunnable(
	appState: AppStateStatus,
	callbackRunId?: string,
): boolean {
	if (liveGame.dailyExpired) {
		return false
	}
	return shouldRunActiveTimer({
		appState,
		completed:
			liveGame.completionPersisted ||
			liveGame.completionInFlight ||
			liveGame.session?.completed === true,
		rewardedOpen: liveGame.rewardedAdOpen,
		callbackRunId,
		currentRunId: liveGame.runId,
	})
}

/** Fire a planned analytics batch (names + scalar parameters only). */
function emitPlannedEvents(events: readonly PlannedAnalyticsEvent[]): void {
	for (const planned of events) {
		trackEvent(planned.name, planned.parameters)
	}
}

/** Create a unique identity for one solve run (bind / restart). */
function createRunId(): string {
	runSerial += 1
	return `run-${Date.now().toString(36)}-${runSerial}`
}

/** Completion UI payload tagged with the run that produced it. */
interface CompletionResultState {
	readonly runId: string
	readonly event: CompletionEventResult | DailyCompletionEventResult
}

/**
 * Mutable live snapshot for AppState / flush (updated in effects, not render).
 * Avoids react-hooks/refs and react-hooks/globals render reassignment rules.
 */
const liveGame = {
	session: null as GameSession | null,
	timer: createPausedTimer(0) as ActiveTimerState,
	restartCount: 0,
	completionPersisted: false,
	/**
	 * H6: set synchronously BEFORE the persist await so a second detection
	 * (StrictMode double updater, retry race) cannot start a second persist.
	 */
	completionInFlight: false,
	/** H6: identity of the current run — stale async callbacks compare to it. */
	runId: '',
	/** Elapsed solve time captured once at detection (reused by retries). */
	completionElapsedMs: 0,
	helpOpen: false,
	replayHintsUsedThisRun: 0,
	/** True while a rewarded ad is showing — keeps active solve timer paused. */
	rewardedAdOpen: false,
	/** Run id whose puzzle_complete analytics already fired ('' = none). */
	completionTrackedRunId: '',
	/** True once the Daily session was invalidated by a day rollover. */
	dailyExpired: false,
}

export function GameScreen({
	session: routeSession,
	onExit,
	onExitAfterCompletion,
	onOpenGallery,
	onOpenDailyCalendar,
	onNextPuzzle,
	onDailyExpired,
	darkMode = false,
}: GameScreenProps) {
	const insets = useSafeAreaInsets()
	/** Explicit AppState — the timer may only run while this is 'active'. */
	const appStateRef = useRef<AppStateStatus>(AppState.currentState)
	/** Bind key whose puzzle_start analytics already fired (StrictMode-safe). */
	const bindTrackedRef = useRef<string | null>(null)
	/**
	 * Latest host callbacks, read lazily so inline arrow props from the
	 * navigator never re-create timers / listeners on every render.
	 */
	const hostCallbacksRef = useRef({ onDailyExpired: onDailyExpired ?? onExit })
	useEffect(() => {
		hostCallbacksRef.current = { onDailyExpired: onDailyExpired ?? onExit }
	}, [onDailyExpired, onExit])
	const { service, refresh, save } = useProgress()
	const palette: BoardPalette = darkMode
		? DARK_BOARD_PALETTE
		: LIGHT_BOARD_PALETTE

	const puzzleId = routeSession.puzzleId
	const isDaily = routeSession.mode === 'DAILY'
	const isReplay = routeSession.mode === 'REPLAY'
	const dailyDayKey = routeSession.mode === 'DAILY' ? routeSession.dayKey : null

	/** Display-only roll — hydrate/service also rolls on real help mutations. */
	const helpAllowance: HelpAllowanceState = useMemo(
		() =>
			rollHelpAllowanceToDay(
				{
					helpAllowanceDay: save.helpAllowanceDay,
					freeHintsUsedToday: save.freeHintsUsedToday,
					freeTeachMeUsedToday: save.freeTeachMeUsedToday,
					pendingRewardedHints: save.pendingRewardedHints,
					pendingRewardedTeachMe: save.pendingRewardedTeachMe,
				},
				localDayKey(),
			),
		[
			save.helpAllowanceDay,
			save.freeHintsUsedToday,
			save.freeTeachMeUsedToday,
			save.pendingRewardedHints,
			save.pendingRewardedTeachMe,
		],
	)
	const hintFreeLeft = freeHintsRemaining(helpAllowance)
	const teachFreeLeft = freeTeachMeRemaining(helpAllowance)
	const hintRemainingLabel =
		REWARDED_USER_FACING_ENABLED && hintFreeLeft > 0
			? `Подсказки — ${formatFreeRemainingLabel(hintFreeLeft, FREE_HINTS_PER_DAY)}`
			: null
	const teachRemainingLabel =
		REWARDED_USER_FACING_ENABLED && teachFreeLeft > 0
			? `Научи меня — ${formatFreeRemainingLabel(teachFreeLeft, FREE_TEACH_ME_PER_DAY)}`
			: null

	const launchKind = routeSession.launch
	// H4: resuming an active Campaign / Daily party may reference a legacy
	// (mini-21) puzzle, so resolve through the compatibility lookup. NEW
	// selections (fresh Campaign / fresh Daily / Replay) stay production-only.
	const puzzle = useMemo(
		() =>
			launchKind === 'resume'
				? resolvePlayablePuzzleById(puzzleId)
				: getProductionPuzzleById(puzzleId),
		[launchKind, puzzleId],
	)
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
	/** H6: identity of the current run; regenerated on bind and restart. */
	const [runId, setRunId] = useState('')
	/**
	 * H6: completion result keyed by runId. A stale callback from a previous
	 * run can only write a result for ITS runId, which never matches the
	 * current run — so it cannot leak into the new run's UI.
	 */
	const [completionResult, setCompletionResult] =
		useState<CompletionResultState | null>(null)
	const completionPersisted =
		completionResult !== null && completionResult.runId === runId
	const completionEvent = completionPersisted ? completionResult.event : null
	const [dailySelectionVersion, setDailySelectionVersion] = useState('daily-v1')
	const [helpOpen, setHelpOpen] = useState(false)
	const [helpPhase, setHelpPhase] = useState<HelpPanelPhase>({ kind: 'menu' })
	const [hintStep, setHintStep] = useState<HintStep | null>(null)
	const [hintHighlight, setHintHighlight] = useState<HintHighlight | null>(
		null,
	)
	const [applyingHint, setApplyingHint] = useState(false)
	/** Replay-only in-memory run counter (Campaign/Daily use save). */
	const [replayHintsUsedThisRun, setReplayHintsUsed] = useState(0)

	const bindKey = `${routeSession.mode}:${puzzleId}:${dailyDayKey ?? ''}:${routeSession.launch}`

	useEffect(() => {
		liveGame.session = session
		liveGame.timer = timer
		liveGame.restartCount = restartCountThisRun
		liveGame.completionPersisted = completionPersisted
		liveGame.runId = runId
		liveGame.helpOpen = helpOpen
		liveGame.replayHintsUsedThisRun = replayHintsUsedThisRun
	}, [
		session,
		timer,
		restartCountThisRun,
		completionPersisted,
		runId,
		helpOpen,
		replayHintsUsedThisRun,
	])

	// H6: a new run starts with no completion persist in flight.
	useEffect(() => {
		liveGame.completionInFlight = false
		liveGame.completionElapsedMs = 0
		// M2: a new run (bind) starts with a valid Daily session.
		liveGame.dailyExpired = false
	}, [runId])

	// Bootstrap / restore session when route identity changes.
	if (puzzle !== null && boundKey !== bindKey) {
		if (routeSession.launch === 'resume') {
			if (isDaily) {
				const resumed = service.resumeActiveDaily()
				if (
					resumed !== null &&
					resumed.puzzle.id === puzzle.id &&
					resumed.dayKey === dailyDayKey
				) {
					setSession(
						restoreGameSession(puzzle, resumed.player, resumed.tool),
					)
					setTimer(createPausedTimer(resumed.accumulatedActiveMs))
					setRestartCountThisRun(resumed.restartCountThisRun)
					setDailySelectionVersion(resumed.selectionVersion)
				} else {
					setSession(createGameSession(puzzle))
					setTimer(createPausedTimer(0))
					setRestartCountThisRun(0)
				}
			} else {
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
			}
		} else {
			setSession(createGameSession(puzzle))
			setTimer(createPausedTimer(0))
			setRestartCountThisRun(0)
			if (isDaily && dailyDayKey !== null) {
				const active = service.getSave().activeDailyGame
				if (active !== null && active.dayKey === dailyDayKey) {
					setDailySelectionVersion(active.selectionVersion)
				}
			}
		}
		// H6: every bind is a new run — fresh identity, no completion carried over.
		setRunId(createRunId())
		setCompletionResult(null)
		setHelpOpen(false)
		setHelpPhase({ kind: 'menu' })
		setHintStep(null)
		setHintHighlight(null)
		setApplyingHint(false)
		setReplayHintsUsed(0)
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

	/**
	 * M4: scalar-only analytics facts for this puzzle (ids / sizes / tier).
	 * Never contains the board, player grid or solution.
	 */
	const analyticsContext: PuzzleAnalyticsContext | null = useMemo(() => {
		if (puzzle === null) {
			return null
		}
		return {
			mode: analyticsPlayMode(routeSession.mode),
			puzzleId: puzzle.id,
			width: puzzle.width,
			height: puzzle.height,
			difficulty: resolvePuzzleDifficultyTier(puzzle) ?? 'UNRATED',
			setNumber: getCampaignEntryByPuzzleId(puzzle.id)?.setDisplayOrder,
		}
	}, [puzzle, routeSession.mode])

	// M4: puzzle_start (+ daily_start for a fresh Daily) once per bound run.
	// bindTrackedRef keeps StrictMode double-effects from double-firing.
	useEffect(() => {
		if (
			boundKey === null ||
			analyticsContext === null ||
			bindTrackedRef.current === boundKey
		) {
			return
		}
		bindTrackedRef.current = boundKey
		emitPlannedEvents(
			planPuzzleBindEvents(analyticsContext, routeSession.launch),
		)
	}, [analyticsContext, boundKey, routeSession.launch])

	/**
	 * M2: invalidate a DAILY session whose local day has rolled over.
	 * Pauses the clock, blocks further resumes/persists, and lets the host
	 * alert + route to the Daily calendar. Idempotent per run.
	 */
	const handleDailyExpired = useCallback(() => {
		if (liveGame.dailyExpired) {
			return
		}
		liveGame.dailyExpired = true
		const paused = pauseTimer(liveGame.timer, Date.now())
		liveGame.timer = paused
		setTimer(paused)
		hostCallbacksRef.current.onDailyExpired()
	}, [])

	/** Returns true (and invalidates) when this DAILY session is stale. */
	const checkDailyRollover = useCallback((): boolean => {
		if (!isDaily || dailyDayKey === null) {
			return false
		}
		if (isDailySessionStale(dailyDayKey, service.todayDayKey())) {
			handleDailyExpired()
			return true
		}
		return false
	}, [dailyDayKey, handleDailyExpired, isDaily, service])

	const persistSnapshot = useCallback(
		async (nextSession: GameSession, nextTimer: ActiveTimerState) => {
			if (
				liveGame.completionPersisted ||
				nextSession.completed ||
				liveGame.dailyExpired
			) {
				return
			}
			const now = Date.now()
			const paused = pauseTimer(nextTimer, now)
			if (isDaily && dailyDayKey !== null) {
				try {
					await service.persistDailyState({
						dayKey: dailyDayKey,
						selectionVersion: dailySelectionVersion,
						puzzle: nextSession.puzzle,
						player: nextSession.player,
						accumulatedActiveMs: paused.accumulatedMs,
						tool: nextSession.tool,
						restartCountThisRun: liveGame.restartCount,
					})
				} catch (err) {
					// Midnight crossed: the service refuses stale-day writes.
					if (isDailyRolloverError(err)) {
						handleDailyExpired()
						return
					}
					throw err
				}
			} else if (!isReplay) {
				await service.persistGameState({
					puzzle: nextSession.puzzle,
					player: nextSession.player,
					accumulatedActiveMs: paused.accumulatedMs,
					tool: nextSession.tool,
					restartCountThisRun: liveGame.restartCount,
				})
			}
			// REPLAY is ephemeral — never overwrite Campaign activeGame.
			refresh()
		},
		[
			dailyDayKey,
			dailySelectionVersion,
			handleDailyExpired,
			isDaily,
			isReplay,
			refresh,
			service,
		],
	)

	/**
	 * Persist one confirmed completion for `completionRunId` (H6).
	 *
	 * - `completionInFlight` is raised synchronously before the first await.
	 * - A stale run (liveGame.runId changed) never touches liveGame / UI state;
	 *   the real solve is still counted for the ad policy (global, idempotent).
	 * - On failure the flag is released and `completionPersisted` stays false
	 *   so the user can retry from the Alert.
	 *
	 * Resolves true only when the result was durably saved.
	 */
	const persistCompletion = useCallback(
		async (
			completedSession: GameSession,
			completionRunId: string,
			elapsedMs: number,
		): Promise<boolean> => {
			if (
				liveGame.runId !== completionRunId ||
				liveGame.completionPersisted ||
				liveGame.completionInFlight
			) {
				return false
			}
			// Raise the guard BEFORE awaiting so concurrent detections no-op.
			liveGame.completionInFlight = true
			// M4: hint count must be read BEFORE completion clears active saves.
			const hintsUsedBefore = isReplay
				? liveGame.replayHintsUsedThisRun
				: isDaily
					? (service.getSave().activeDailyGame?.hintsUsedThisRun ?? 0)
					: (service.getSave().activeGame?.hintsUsedThisRun ?? 0)
			try {
				let event: CompletionEventResult | DailyCompletionEventResult
				if (isDaily && dailyDayKey !== null) {
					const result = await service.completeDailyPuzzle({
						dayKey: dailyDayKey,
						puzzleId: completedSession.puzzle.id,
						selectionVersion: dailySelectionVersion,
						activeTimeMs: elapsedMs,
					})
					event = result.event
				} else {
					const result = await service.completePuzzle({
						puzzleId: completedSession.puzzle.id,
						activeTimeMs: elapsedMs,
						isReplay,
					})
					event = result.event
				}
				// Confirmed completion — count once per run for interstitials.
				recordCompletionForAdPolicy({
					runId: completionRunId,
					isTutorial: false,
				})
				// M4: analytics exactly once per run, only after the confirmed
				// persist (never on hydrate, never on a failed attempt).
				if (
					analyticsContext !== null &&
					liveGame.completionTrackedRunId !== completionRunId
				) {
					liveGame.completionTrackedRunId = completionRunId
					emitPlannedEvents(
						planCompletionEvents({
							context: analyticsContext,
							event,
							hintsUsed: hintsUsedBefore,
							elapsedMs,
							galleryCollectionId:
								getGalleryItemDef(completedSession.puzzle.id)
									?.collectionId ?? null,
						}),
					)
				}
				if (liveGame.runId !== completionRunId) {
					// Stale run: persisted correctly, but the screen moved on.
					return true
				}
				liveGame.completionPersisted = true
				liveGame.completionInFlight = false
				setCompletionResult({ runId: completionRunId, event })
				setTimer(createPausedTimer(elapsedMs))
				refresh()
				return true
			} catch (err) {
				if (liveGame.runId === completionRunId) {
					liveGame.completionInFlight = false
					// M2: a Daily solved after midnight must not be credited.
					if (isDailyRolloverError(err)) {
						handleDailyExpired()
					}
				}
				return false
			}
		},
		[
			analyticsContext,
			dailyDayKey,
			dailySelectionVersion,
			handleDailyExpired,
			isDaily,
			isReplay,
			refresh,
			service,
		],
	)

	/**
	 * Run completion persistence and surface a retryable Alert on failure.
	 * Safe to call repeatedly: persistCompletion is guarded by runId + flags.
	 */
	const runCompletionPersist = useCallback(
		async (
			completedSession: GameSession,
			completionRunId: string,
			elapsedMs: number,
		): Promise<boolean> => {
			const alreadyDone =
				liveGame.runId === completionRunId && liveGame.completionPersisted
			if (alreadyDone) {
				return true
			}
			const attempt = async (): Promise<boolean> =>
				persistCompletion(completedSession, completionRunId, elapsedMs)

			const ok = await attempt()
			if (
				!ok &&
				liveGame.runId === completionRunId &&
				!liveGame.completionPersisted &&
				!liveGame.completionInFlight &&
				!liveGame.dailyExpired
			) {
				Alert.alert('Не удалось сохранить результат', undefined, [
					{ text: 'Отмена', style: 'cancel' },
					{
						text: 'Повторить',
						onPress: () => {
							void (async () => {
								const retried = await attempt()
								if (
									!retried &&
									liveGame.runId === completionRunId &&
									!liveGame.completionPersisted
								) {
									Alert.alert(
										'Не удалось сохранить результат',
										'Попробуйте ещё раз позже.',
									)
								}
							})()
						},
					},
				])
			}
			return ok
		},
		[persistCompletion],
	)

	/**
	 * Called OUTSIDE the setState updater when a transition into `completed`
	 * was detected. Freezes the solve timer once and starts persistence.
	 */
	const handleCompletionDetected = useCallback(
		(completedSession: GameSession, detectedRunId: string) => {
			if (
				liveGame.runId !== detectedRunId ||
				liveGame.completionPersisted ||
				liveGame.completionInFlight
			) {
				return
			}
			const now = Date.now()
			const paused = pauseTimer(liveGame.timer, now)
			liveGame.timer = paused
			liveGame.completionElapsedMs = readActiveElapsedMs(paused, now)
			// Stop the clock immediately; success re-pins the exact elapsed value.
			setTimer(paused)
			void runCompletionPersist(
				completedSession,
				detectedRunId,
				liveGame.completionElapsedMs,
			)
		},
		[runCompletionPersist],
	)

	const applySessionUpdate = useCallback(
		(
			updater: (current: GameSession) => GameSession,
			options?: { readonly recordUndo?: boolean; readonly recordRedo?: boolean },
		) => {
			// H6: capture the run identity at call time; deferred side effects
			// compare against it so they never act for a newer run.
			const callRunId = liveGame.runId
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

				// The updater must stay pure (StrictMode may invoke it twice):
				// only DETECT here and defer the side effect to a microtask.
				// Duplicate detections are idempotent via completionInFlight.
				if (!previousCompleted && next.completed) {
					queueMicrotask(() => {
						handleCompletionDetected(next, callRunId)
					})
				} else if (shouldPersist) {
					queueMicrotask(() => {
						if (liveGame.runId === callRunId) {
							void persistSnapshot(next, liveGame.timer)
						}
					})
				}

				return next
			})

			if (options?.recordUndo) {
				void service.recordUndo().then(() => refresh())
			}
			if (options?.recordRedo) {
				void service.recordRedo().then(() => refresh())
			}
		},
		[handleCompletionDetected, persistSnapshot, refresh, service],
	)

	// UI clock tick — resume active timer asynchronously (not sync in effect body).
	// M1: every resume goes through isSolveClockRunnable (AppState === 'active',
	// not completed, no rewarded ad) and is bound to this effect's runId, so a
	// stale interval can never resume another run or resume while inactive.
	useEffect(() => {
		const effectRunId = runId
		const applyNow = () => {
			if (liveGame.runId !== effectRunId) {
				return
			}
			const now = Date.now()
			setNowMs(now)
			if (checkDailyRollover()) {
				return
			}
			if (isSolveClockRunnable(appStateRef.current, effectRunId)) {
				setTimer((current) => {
					const resumed = startOrResumeTimer(current, now)
					liveGame.timer = resumed
					return resumed
				})
			}
		}
		const bootId = setTimeout(applyNow, 0)
		const id = setInterval(applyNow, 1000)
		return () => {
			clearTimeout(bootId)
			clearInterval(id)
			liveGame.timer = pauseTimer(liveGame.timer, Date.now())
		}
	}, [bindKey, checkDailyRollover, runId])

	useEffect(() => {
		const onChange = (state: AppStateStatus) => {
			// Always record the latest AppState first — the tick reads it.
			appStateRef.current = state
			if (state === 'active') {
				if (checkDailyRollover()) {
					return
				}
				if (isSolveClockRunnable(state, liveGame.runId)) {
					const now = Date.now()
					setNowMs(now)
					setTimer((current) => {
						const resumed = startOrResumeTimer(current, now)
						liveGame.timer = resumed
						return resumed
					})
				}
				return
			}
			// Pause + flush outside any state updater (updaters must stay pure).
			const paused = pauseTimer(liveGame.timer, Date.now())
			liveGame.timer = paused
			setTimer(paused)
			const currentSession = liveGame.session
			if (
				currentSession !== null &&
				!currentSession.completed &&
				!liveGame.completionPersisted
			) {
				void persistSnapshot(currentSession, paused)
			}
		}
		const sub = AppState.addEventListener('change', onChange)
		return () => sub.remove()
	}, [checkDailyRollover, persistSnapshot])

	const exitWithFlush = useCallback(() => {
		const currentSession = liveGame.session
		const now = Date.now()
		const paused = pauseTimer(liveGame.timer, now)
		if (
			currentSession !== null &&
			currentSession.completed &&
			!liveGame.completionPersisted
		) {
			// H6: never drop an unsaved solve — leave only after it is durable.
			if (liveGame.completionInFlight) {
				return
			}
			const exitRunId = liveGame.runId
			void runCompletionPersist(
				currentSession,
				exitRunId,
				liveGame.completionElapsedMs,
			).then((ok) => {
				if (ok && liveGame.runId === exitRunId) {
					refresh()
					onExit()
				}
			})
			return
		}
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
	}, [onExit, persistSnapshot, refresh, runCompletionPersist])

	useEffect(() => {
		const sub = BackHandler.addEventListener('hardwareBackPress', () => {
			if (liveGame.helpOpen) {
				setHelpOpen(false)
				setHelpPhase({ kind: 'menu' })
				setHintStep(null)
				setHintHighlight(null)
				return true
			}
			if (liveGame.session?.completed && liveGame.completionPersisted) {
				refresh()
				onExit()
				return true
			}
			// Completed-but-unsaved goes through exitWithFlush (retries persist).
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
			if (
				session === null ||
				layout === null ||
				session.completed ||
				liveGame.helpOpen
			) {
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
					const run = async () => {
						if (isDaily && dailyDayKey !== null) {
							try {
								await service.restartDaily({
									dayKey: dailyDayKey,
									puzzle,
									selectionVersion: dailySelectionVersion,
								})
							} catch (err) {
								// Midnight crossed: restart must not touch today's save.
								if (isDailyRolloverError(err)) {
									handleDailyExpired()
									return
								}
								throw err
							}
						} else if (!isReplay) {
							await service.restartPuzzle(puzzle)
						}
						// M4: puzzle_restart only after the restart succeeded.
						if (analyticsContext !== null) {
							trackEvent('puzzle_restart', {
								mode: analyticsContext.mode,
								puzzleId: analyticsContext.puzzleId,
							})
						}
						// H5: Replay restart is purely in-memory — restartPuzzle would
						// overwrite the unfinished Campaign activeGame.
						setSession(createGameSession(puzzle))
						// M1: the fresh run only starts ticking when the app is active.
						setTimer(
							appStateRef.current === 'active'
								? startOrResumeTimer(createPausedTimer(0), Date.now())
								: createPausedTimer(0),
						)
						setRestartCountThisRun((value) => value + 1)
						// H6: a restart is a new run — invalidate stale callbacks now.
						const restartedRunId = createRunId()
						liveGame.runId = restartedRunId
						liveGame.completionInFlight = false
						setRunId(restartedRunId)
						setCompletionResult(null)
						setReplayHintsUsed(0)
						setHelpOpen(false)
						setHelpPhase({ kind: 'menu' })
						setHintStep(null)
						setHintHighlight(null)
						setApplyingHint(false)
						refresh()
					}
					void run()
				},
			},
		])
	}, [
		analyticsContext,
		dailyDayKey,
		dailySelectionVersion,
		handleDailyExpired,
		isDaily,
		isReplay,
		puzzle,
		refresh,
		service,
		session,
	])

	const difficultyTier = useMemo(
		() => (puzzle === null ? null : resolvePuzzleDifficultyTier(puzzle)),
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

	const closeHelp = useCallback(() => {
		setHelpOpen(false)
		setHelpPhase({ kind: 'menu' })
		setHintStep(null)
		setHintHighlight(null)
		setApplyingHint(false)
	}, [])

	const pauseForRewarded = useCallback(() => {
		liveGame.rewardedAdOpen = true
		const now = Date.now()
		setTimer((current) => {
			const paused = pauseTimer(current, now)
			liveGame.timer = paused
			return paused
		})
	}, [])

	const resumeAfterRewarded = useCallback(() => {
		liveGame.rewardedAdOpen = false
		// M1: dismissing an ad must not resume while backgrounded / completed.
		if (isSolveClockRunnable(appStateRef.current, liveGame.runId)) {
			const now = Date.now()
			setNowMs(now)
			setTimer((current) => {
				const resumed = startOrResumeTimer(current, now)
				liveGame.timer = resumed
				return resumed
			})
		}
	}, [])

	const presentHintResult = useCallback(
		(result: HintResult, mode: 'HINT' | 'TEACH') => {
			const current = liveGame.session
			const lineCtx =
				result.kind === 'STEP' && current !== null
					? lineContextForStep(result.step, current.player)
					: null
			const explained = explainHintResult(result, mode, lineCtx)
			const branch: 'campaign' | 'daily' | 'none' = isDaily
				? 'daily'
				: isReplay
					? 'none'
					: 'campaign'
			if (result.kind === 'STEP') {
				setHintStep(result.step)
				setHintHighlight({
					orientation: result.step.orientation,
					lineIndex: result.step.lineIndex,
					action: result.step.action,
					targets: result.step.targets,
				})
				fitBoard()
				if (mode === 'TEACH') {
					// Teach Me benefit is the explanation itself — consume here.
					const before = rollHelpAllowanceToDay(
						{
							helpAllowanceDay: service.getSave().helpAllowanceDay,
							freeHintsUsedToday: service.getSave().freeHintsUsedToday,
							freeTeachMeUsedToday: service.getSave().freeTeachMeUsedToday,
							pendingRewardedHints: service.getSave().pendingRewardedHints,
							pendingRewardedTeachMe:
								service.getSave().pendingRewardedTeachMe,
						},
						service.todayDayKey(),
					)
					const consumingFree = willConsumeFreeTeachMe(before)
					void (async () => {
						await service.recordTeachMeView()
						if (REWARDED_USER_FACING_ENABLED) {
							const next = await service.consumeTeachMeRevealAllowance()
							if (next !== null && consumingFree) {
								trackEvent('teach_me_free_consumed', {
									remaining: freeTeachMeRemaining({
										helpAllowanceDay: next.helpAllowanceDay,
										freeHintsUsedToday: next.freeHintsUsedToday,
										freeTeachMeUsedToday: next.freeTeachMeUsedToday,
										pendingRewardedHints: next.pendingRewardedHints,
										pendingRewardedTeachMe: next.pendingRewardedTeachMe,
									}),
								})
							}
						}
						refresh()
					})()
				}
			} else {
				setHintStep(null)
				if (
					result.kind === 'CONTRADICTION' &&
					result.orientation !== null &&
					result.lineIndex !== null
				) {
					setHintHighlight({
						orientation: result.orientation,
						lineIndex: result.lineIndex,
						action: 'FILLED',
						targets: [],
					})
				} else {
					setHintHighlight(null)
				}
				if (result.kind === 'CONTRADICTION' || result.kind === 'STALLED') {
					void service
						.recordHintAssistanceUsed(branch)
						.then(() => refresh())
					if (isReplay) {
						setReplayHintsUsed((n) => n + 1)
					}
				}
			}
			setHelpPhase({
				kind: 'result',
				mode,
				title: explained.title,
				body: explained.body,
				canApply: explained.canApply,
				explanation: explained.explanation,
			})
		},
		[fitBoard, isDaily, isReplay, refresh, service],
	)

	const executeHintComputation = useCallback(
		(mode: 'HINT' | 'TEACH') => {
			if (session === null || session.completed || puzzle === null) {
				return
			}
			if (session.activeGesture !== null) {
				return
			}
			setHelpPhase({ kind: 'loading', mode })
			// Yield so loading text can paint before sync solver work.
			setTimeout(() => {
				const current = liveGame.session
				if (current === null || current.completed) {
					closeHelp()
					return
				}
				const result = getHint({
					spec: puzzleToSpec(puzzle),
					player: current.player,
					revision: current.revision,
					mode,
				})
				if (result.kind !== 'COMPLETE') {
					void service.recordHintRequest().then(() => refresh())
					// M4: a real Hint / Teach Me request was served (mode only).
					if (analyticsContext !== null) {
						trackEvent(mode === 'HINT' ? 'hint_open' : 'teach_me_open', {
							mode: analyticsContext.mode,
						})
					}
				}
				presentHintResult(result, mode)
			}, 0)
		},
		[
			analyticsContext,
			closeHelp,
			presentHintResult,
			puzzle,
			refresh,
			service,
			session,
		],
	)

	/**
	 * Offer the rewarded opt-in for `mode`.
	 *
	 * `afterReward`:
	 * - 'compute' → recompute a fresh Hint / Teach Me after the grant
	 *   (menu entry points).
	 * - 'keep'    → leave the revealed STEP on screen (Apply entry point, H3);
	 *   the pending entitlement is consumed by the next Apply tap, which
	 *   revalidates the STEP against the live board first.
	 */
	const requestRewardedHelp = useCallback(
		(mode: 'HINT' | 'TEACH', afterReward: 'compute' | 'keep' = 'compute') => {
			const helpType = mode === 'HINT' ? 'hint' : 'teach_me'
			const title =
				mode === 'HINT'
					? 'Бесплатные подсказки на сегодня закончились'
					: 'Бесплатные объяснения на сегодня закончились'
			const body =
				mode === 'HINT'
					? 'Получите ещё одну подсказку за просмотр рекламы или продолжите решать самостоятельно.\n\n1 просмотр = 1 подсказка'
					: 'Получите ещё одно подробное объяснение за просмотр рекламы или продолжите решать самостоятельно.\n\n1 просмотр = 1 объяснение'
			const confirmLabel =
				mode === 'HINT' ? 'Получить подсказку' : 'Получить объяснение'

			Alert.alert(title, body, [
				{ text: 'Закрыть', style: 'cancel' },
				{
					text: confirmLabel,
					onPress: () => {
						void (async () => {
							trackEvent('rewarded_requested', { helpType })
							pauseForRewarded()
							// Entitlement is granted INSIDE the SDK reward callback; keep
							// its promise so we can await durable persistence before
							// continuing (showRewarded does not await the callback).
							let grantSettled: Promise<boolean> = Promise.resolve(false)
							const outcome = await showRewarded(() => {
								trackEvent('rewarded_completed', { helpType })
								grantSettled = (async () => {
									try {
										if (mode === 'HINT') {
											await service.grantRewardedHintAllowance()
										} else {
											await service.grantRewardedTeachMeAllowance()
										}
										return true
									} catch {
										return false
									}
								})()
								return grantSettled.then(() => undefined)
							})
							resumeAfterRewarded()
							const granted = await grantSettled
							if (granted) {
								refresh()
							}
							if (
								outcome === 'not_available' ||
								outcome === 'failed'
							) {
								Alert.alert(
									'Реклама недоступна',
									'Реклама сейчас недоступна. Попробуйте позже.',
								)
								return
							}
							if (outcome !== 'rewarded_and_dismissed') {
								return
							}
							if (!granted) {
								Alert.alert(
									'Не удалось сохранить награду',
									'Попробуйте ещё раз.',
								)
								return
							}
							if (afterReward === 'keep') {
								return
							}
							// Recompute against current board after returning from ad.
							executeHintComputation(mode)
						})()
					},
				},
			])
		},
		[
			executeHintComputation,
			pauseForRewarded,
			refresh,
			resumeAfterRewarded,
			service,
		],
	)

	const runHintRequest = useCallback(
		(mode: 'HINT' | 'TEACH') => {
			if (session === null || session.completed || puzzle === null) {
				return
			}
			if (session.activeGesture !== null) {
				return
			}

			if (!REWARDED_USER_FACING_ENABLED) {
				executeHintComputation(mode)
				return
			}

			void (async () => {
				const rolled = await service.ensureHelpAllowanceDay()
				const state: HelpAllowanceState = {
					helpAllowanceDay: rolled.helpAllowanceDay,
					freeHintsUsedToday: rolled.freeHintsUsedToday,
					freeTeachMeUsedToday: rolled.freeTeachMeUsedToday,
					pendingRewardedHints: rolled.pendingRewardedHints,
					pendingRewardedTeachMe: rolled.pendingRewardedTeachMe,
				}
				refresh()
				const allowed =
					mode === 'HINT'
						? canUseHintWithoutRewarded(state)
						: canUseTeachMeWithoutRewarded(state)
				if (!allowed) {
					requestRewardedHelp(mode)
					return
				}
				executeHintComputation(mode)
			})()
		},
		[
			executeHintComputation,
			puzzle,
			refresh,
			requestRewardedHelp,
			service,
			session,
		],
	)

	const handleApplyHint = useCallback(() => {
		if (
			applyingHint ||
			hintStep === null ||
			session === null ||
			!liveGame.helpOpen
		) {
			return
		}
		const branch: 'campaign' | 'daily' | 'none' = isDaily
			? 'daily'
			: isReplay
				? 'none'
				: 'campaign'

		// Validate against the LIVE board (not a possibly stale render closure).
		const liveSession = liveGame.session ?? session
		if (liveSession.completed) {
			return
		}
		const outcome = applyHintStep(
			liveSession.player,
			hintStep,
			liveSession.revision,
		)
		if (!outcome.ok) {
			if (outcome.reason === 'STALE') {
				Alert.alert('Подсказка устарела', 'Запросите подсказку снова.')
			}
			// Failed Apply must not consume free or rewarded entitlement.
			closeHelp()
			return
		}

		// H3: Apply ALWAYS draws from the Hint allowance — even when this STEP
		// was revealed through Teach Me (which only spent Teach Me quota). When
		// Hint is exhausted the board is NOT mutated; offer the rewarded opt-in
		// and keep the STEP so the next Apply tap (after the grant) can proceed.
		let consumePromise: ReturnType<
			typeof service.consumeHintApplyAllowance
		> | null = null
		let consumingFree = false
		if (REWARDED_USER_FACING_ENABLED) {
			if (!service.canConsumeHintApplyAllowance()) {
				requestRewardedHelp('HINT', 'keep')
				return
			}
			const save = service.getSave()
			consumingFree = willConsumeFreeHint(
				rollHelpAllowanceToDay(
					{
						helpAllowanceDay: save.helpAllowanceDay,
						freeHintsUsedToday: save.freeHintsUsedToday,
						freeTeachMeUsedToday: save.freeTeachMeUsedToday,
						pendingRewardedHints: save.pendingRewardedHints,
						pendingRewardedTeachMe: save.pendingRewardedTeachMe,
					},
					service.todayDayKey(),
				),
			)
			// Consume-after-validate, BEFORE mutating: the service updates its
			// in-memory save synchronously (only the disk write is async), so no
			// rollback is needed — validation already passed above.
			consumePromise = service.consumeHintApplyAllowance()
		}

		// Close the overlay synchronously so a double tap cannot consume twice.
		liveGame.helpOpen = false
		applySessionUpdate((current) =>
			applyHintToSession(current, outcome.mutations, outcome.player),
		)
		// M4: hint_apply fires once the Apply really mutated the board.
		if (analyticsContext !== null) {
			trackEvent('hint_apply', {
				mode: analyticsContext.mode,
				reason: hintStep.reason,
			})
		}
		if (isReplay) {
			setReplayHintsUsed((n) => n + 1)
		}
		closeHelp()

		void (async () => {
			if (consumePromise !== null) {
				const next = await consumePromise
				if (next !== null && consumingFree) {
					trackEvent('hint_free_consumed', {
						remaining: freeHintsRemaining({
							helpAllowanceDay: next.helpAllowanceDay,
							freeHintsUsedToday: next.freeHintsUsedToday,
							freeTeachMeUsedToday: next.freeTeachMeUsedToday,
							pendingRewardedHints: next.pendingRewardedHints,
							pendingRewardedTeachMe: next.pendingRewardedTeachMe,
						}),
					})
				}
			}
			await service.recordHintApplied(branch)
			refresh()
		})()
	}, [
		analyticsContext,
		applyingHint,
		applySessionUpdate,
		closeHelp,
		hintStep,
		isDaily,
		isReplay,
		refresh,
		requestRewardedHelp,
		service,
		session,
	])

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
						{isDaily
							? 'Кроссворд дня'
							: `${puzzle.width}×${puzzle.height}`}
					</Text>
					<Text style={[styles.meta, { color: palette.clueTextDimmed }]}>
						{isDaily && dailyDayKey !== null
							? `${formatDayTitleRu(dailyDayKey)} · `
							: ''}
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
							hintHighlight={hintHighlight}
						/>
					) : null}
				</View>
			</GestureDetector>

			<View>
				<GameControls
					tool={session.tool}
					canUndo={sessionCanUndo(session)}
					canRedo={sessionCanRedo(session)}
					palette={palette}
					disabled={session.completed || helpOpen}
					helpDisabled={session.completed}
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
					onHelp={() => {
						if (session.completed || session.activeGesture !== null) {
							return
						}
						setHelpPhase({ kind: 'menu' })
						setHintStep(null)
						setHintHighlight(null)
						setHelpOpen(true)
					}}
				/>
			</View>

			{helpOpen ? (
				<HelpOverlay
					palette={palette}
					phase={helpPhase}
					applying={applyingHint}
					hintRemainingLabel={hintRemainingLabel}
					teachRemainingLabel={teachRemainingLabel}
					onClose={closeHelp}
					onRequestHint={() => runHintRequest('HINT')}
					onRequestTeach={() => runHintRequest('TEACH')}
					onApply={handleApplyHint}
					onUnderstood={closeHelp}
				/>
			) : null}

			{session.completed && completionEvent !== null ? (
			<CompletionOverlay
				visible={session.completed}
				headline={
					isDaily ? 'Кроссворд дня пройден' : 'Готово'
				}
				title={
					session.completed
						? (getGalleryItemDef(puzzle.id)?.titleRu ??
							(isDaily ? 'Кроссворд дня' : `${puzzle.width}×${puzzle.height}`))
						: `${puzzle.width}×${puzzle.height}`
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
				streakLabel={
					completionEvent !== null && completionEvent.mode === 'DAILY'
						? `Серия: ${formatDayPlural(completionEvent.streakAfter)}`
						: null
				}
				onHome={() => {
					refresh()
					if (onExitAfterCompletion !== undefined) {
						onExitAfterCompletion()
					} else {
						onExit()
					}
				}}
				onGallery={onOpenGallery}
				onCalendar={
					isDaily && dailyDayKey !== null
						? () => {
								refresh()
								if (onExitAfterCompletion !== undefined) {
									onExitAfterCompletion()
								} else {
									onOpenDailyCalendar(dailyDayKey)
								}
							}
						: null
				}
				onNext={
					!isDaily &&
					completionEvent !== null &&
					completionEvent.mode !== 'DAILY' &&
					completionEvent.nextCampaignPuzzleId
						? () =>
								onNextPuzzle(
									completionEvent.nextCampaignPuzzleId as string,
								)
						: null
				}
			/>
			) : null}
			{/* Banner 1 below controls; system inset below banner — never overlay. */}
			<BannerSlot placement="game" />
			<View
				style={{ height: Math.max(insets.bottom, 0) }}
				testID="game-banner-safe-area"
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
