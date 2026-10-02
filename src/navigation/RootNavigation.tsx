/**
 * Minimal navigation: Home ↔ Levels / Gallery / Achievements / Statistics /
 * Daily / Game / Tutorial / Settings / About.
 * Banner placement reported to App shell (Game/Tutorial host their own / none).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
	Alert,
	AppState,
	BackHandler,
	type AppStateStatus,
} from 'react-native'
import { HomeScreen } from '../screens/HomeScreen'
import { LevelsScreen, type LevelOpenIntent } from '../screens/LevelsScreen'
import { StatisticsScreen } from '../screens/StatisticsScreen'
import { GalleryScreen } from '../screens/GalleryScreen'
import { GalleryCollectionScreen } from '../screens/GalleryCollectionScreen'
import { GalleryDetailScreen } from '../screens/GalleryDetailScreen'
import { AchievementsScreen } from '../screens/AchievementsScreen'
import { DailyScreen } from '../screens/DailyScreen'
import { GameScreen } from '../screens/GameScreen'
import { TutorialScreen } from '../screens/TutorialScreen'
import { SettingsScreen } from '../screens/SettingsScreen'
import { AboutScreen } from '../screens/AboutScreen'
import { useProgress } from '../progress/ProgressProvider'
import { isGalleryPuzzleUnlocked } from '../gallery'
import { resolvePlayablePuzzleById } from '../content/playable'
import type { DayKey } from '../daily/dateUtils'
import type { BannerPlacement } from '../ads'
import { maybeShowInterstitial } from '../ads'
import { trackEvent } from '../analytics'
import {
	CURRENT_TUTORIAL_VERSION,
	shouldFirstRunOfferTutorial,
} from '../tutorial/definition'
import { isDailySessionStale } from '../daily/rollover'
import { placementForShellRoute } from './bannerPlacement'
import {
	resolveAndroidBackAction,
	type BackPolicyAction,
	type BackPolicyRouteName,
} from './androidBackPolicy'
import { createTransitionGuard } from './transitionGuard'

/** Explicit game session mode — never overlapping booleans. */
export type GameSessionDescriptor =
	| {
			readonly mode: 'CAMPAIGN'
			readonly puzzleId: string
			readonly launch: 'resume' | 'fresh'
	  }
	| {
			readonly mode: 'REPLAY'
			readonly puzzleId: string
			readonly launch: 'replay'
	  }
	| {
			readonly mode: 'DAILY'
			readonly puzzleId: string
			readonly dayKey: DayKey
			readonly launch: 'resume' | 'fresh'
	  }

/** @deprecated Prefer GameSessionDescriptor — kept for internal GameScreen props. */
export type GameLaunchMode = 'resume' | 'fresh' | 'replay' | 'daily'

type TutorialSource = 'first_run' | 'settings' | 'home_offer'

type Route =
	| { readonly name: 'home' }
	| { readonly name: 'levels' }
	| { readonly name: 'statistics' }
	| { readonly name: 'gallery' }
	| { readonly name: 'galleryCollection'; readonly collectionId: string }
	| { readonly name: 'galleryDetail'; readonly puzzleId: string; readonly collectionId: string }
	| { readonly name: 'achievements' }
	| { readonly name: 'daily'; readonly focusDayKey?: DayKey }
	| { readonly name: 'game'; readonly session: GameSessionDescriptor }
	| { readonly name: 'tutorial'; readonly source: TutorialSource }
	| { readonly name: 'settings' }
	| { readonly name: 'about' }

/**
 * Maps a parameter-free Back target to a concrete route.
 * Targets that need params (collection / detail) never come through here —
 * the policy returns dedicated actions for them — so they fall back to Home.
 */
function routeForBackTarget(target: BackPolicyRouteName): Route {
	switch (target) {
		case 'levels':
		case 'statistics':
		case 'gallery':
		case 'achievements':
		case 'daily':
		case 'settings':
		case 'about':
			return { name: target }
		default:
			return { name: 'home' }
	}
}

interface RootNavigationProps {
	readonly onBannerPlacementChange?: (placement: BannerPlacement | null) => void
}

export function RootNavigation({ onBannerPlacementChange }: RootNavigationProps) {
	const { save, service, refresh } = useProgress()
	const [route, setRoute] = useState<Route>(() =>
		shouldFirstRunOfferTutorial(save)
			? { name: 'tutorial', source: 'first_run' }
			: { name: 'home' },
	)
	const [darkMode, setDarkMode] = useState(false)

	/** Latest route for listeners registered once (BackHandler / AppState). */
	const routeRef = useRef<Route>(route)
	/** Route name seen by the previous commit (analytics entry detection). */
	const previousRouteNameRef = useRef<Route['name'] | null>(null)
	/** Tutorial's confirm-exit handler (same one as its "Закрыть" button). */
	const tutorialExitRequestRef = useRef<(() => void) | null>(null)
	/** Blocks stacked interstitial + navigation after repeated CTA taps. */
	const transitionGuard = useMemo(() => createTransitionGuard(), [])

	useEffect(() => {
		routeRef.current = route
	}, [route])

	useEffect(() => {
		onBannerPlacementChange?.(placementForShellRoute(route.name))
	}, [onBannerPlacementChange, route])

	// M4: daily_open when entering Daily; gallery_open when entering the
	// Gallery root (not when popping back from a collection / detail).
	useEffect(() => {
		const previous = previousRouteNameRef.current
		previousRouteNameRef.current = route.name
		if (previous === route.name) {
			return
		}
		if (route.name === 'daily') {
			trackEvent('daily_open', {})
		}
		if (
			route.name === 'gallery' &&
			previous !== 'galleryCollection' &&
			previous !== 'galleryDetail'
		) {
			trackEvent('gallery_open', {})
		}
	}, [route])

	const handleTutorialExitRegistration = useCallback(
		(request: (() => void) | null) => {
			tutorialExitRequestRef.current = request
		},
		[],
	)

	useEffect(() => {
		if (route.name === 'tutorial' && route.source === 'first_run') {
			trackEvent('tutorial_start', { source: 'first_run' })
		}
		// Fire once for initial first-run entry.
		// eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only
	}, [])

	const goHome = useCallback(() => {
		refresh()
		setRoute({ name: 'home' })
	}, [refresh])

	const goDaily = useCallback(
		(focusDayKey?: DayKey) => {
			refresh()
			setRoute({ name: 'daily', focusDayKey })
		},
		[refresh],
	)

	/**
	 * M2: the running DAILY session outlived its local day. Drop the stale
	 * save, tell the user, and route to the Daily calendar (today's puzzle).
	 * Idempotent: routeRef flips synchronously so a second trigger in the same
	 * tick (GameScreen + AppState) is a no-op.
	 */
	const handleDailyExpired = useCallback(() => {
		const current = routeRef.current
		if (current.name !== 'game' || current.session.mode !== 'DAILY') {
			return
		}
		routeRef.current = { name: 'daily' }
		void service
			.discardStaleDailyIfNeeded()
			.catch(() => undefined)
			.then(() => refresh())
		goDaily()
		Alert.alert(
			'Наступил новый день',
			'Кроссворд дня обновился. Прогресс вчерашнего кроссворда не засчитан — откройте календарь, чтобы начать сегодняшний.',
		)
	}, [goDaily, refresh, service])

	// Midnight / focus refresh: on AppState active, invalidate a stale DAILY
	// game session, discard stale Daily saves and refresh the Home card.
	useEffect(() => {
		const onActive = (state: AppStateStatus) => {
			if (state !== 'active') {
				return
			}
			const current = routeRef.current
			if (
				current.name === 'game' &&
				current.session.mode === 'DAILY' &&
				isDailySessionStale(current.session.dayKey, service.todayDayKey())
			) {
				handleDailyExpired()
				return
			}
			void service.discardStaleDailyIfNeeded().then(() => refresh())
		}
		const sub = AppState.addEventListener('change', onActive)
		return () => sub.remove()
	}, [handleDailyExpired, refresh, service])

	/**
	 * M5: apply a resolved Android Back action. Returns true when handled;
	 * false lets React Native's default behaviour (exit app) run.
	 */
	const applyBackAction = useCallback(
		(action: BackPolicyAction): boolean => {
			switch (action.kind) {
				case 'exit_app':
					// Home: let RN default exit the app.
					return false
				case 'go': {
					const target = routeForBackTarget(action.route)
					if (target.name === 'home') {
						goHome()
					} else {
						setRoute(target)
					}
					return true
				}
				case 'go_gallery_collection':
					setRoute({
						name: 'galleryCollection',
						collectionId: action.collectionId,
					})
					return true
				case 'tutorial_confirm_exit':
					// Same confirm dialog as the on-screen "Закрыть" button.
					tutorialExitRequestRef.current?.()
					return true
				case 'game_flush_exit':
				case 'consume_help_overlay':
					// GameScreen owns these (flush / help overlay); consume Back here
					// so a stray press can never exit the app mid-solve.
					return true
				default:
					return true
			}
		},
		[goHome],
	)

	// Registered once so screen-level handlers (Levels set detail, Daily day
	// detail, Game help) registered later keep priority; this is the policy
	// fallback for every route without local back state.
	const applyBackActionRef = useRef(applyBackAction)
	useEffect(() => {
		applyBackActionRef.current = applyBackAction
	}, [applyBackAction])

	useEffect(() => {
		const sub = BackHandler.addEventListener('hardwareBackPress', () => {
			const current = routeRef.current
			return applyBackActionRef.current(
				resolveAndroidBackAction({
					routeName: current.name,
					collectionId:
						current.name === 'galleryDetail'
							? current.collectionId
							: undefined,
				}),
			)
		})
		return () => sub.remove()
	}, [])

	const openSession = useCallback((session: GameSessionDescriptor) => {
		setRoute({ name: 'game', session })
	}, [])

	const runPostCompletionInterstitial = useCallback(async () => {
		// Completions are counted at persist time via recordCompletionForAdPolicy.
		// This only decides/show — always settles (C1).
		try {
			await maybeShowInterstitial({ isTutorial: false })
		} catch {
			// An ad failure must never trap the user on the completion screen.
		}
	}, [])

	const handleContinue = useCallback(() => {
		const activeId = save.activeGame?.puzzleId
		if (activeId === undefined) {
			setRoute({ name: 'levels' })
			return
		}
		if (resolvePlayablePuzzleById(activeId) === null) {
			setRoute({ name: 'levels' })
			return
		}
		openSession({
			mode: 'CAMPAIGN',
			puzzleId: activeId,
			launch: 'resume',
		})
	}, [openSession, save.activeGame?.puzzleId])

	const handleDailyCard = useCallback(() => {
		const today = service.todayDayKey()
		const completed = save.dailyCompletionRecords.some(
			(r) => r.dayKey === today,
		)
		if (completed || save.dailyStartedDay === null) {
			goDaily()
			return
		}
		const active = save.activeDailyGame
		if (active !== null && active.dayKey === today) {
			openSession({
				mode: 'DAILY',
				puzzleId: active.puzzleId,
				dayKey: today,
				launch: 'resume',
			})
			return
		}
		void service.startOrResumeDaily(today).then((result) => {
			refresh()
			if (result.kind === 'started' || result.kind === 'resumed') {
				openSession({
					mode: 'DAILY',
					puzzleId: result.puzzleId,
					dayKey: result.dayKey,
					launch: result.kind === 'resumed' ? 'resume' : 'fresh',
				})
			} else {
				goDaily()
			}
		})
	}, [
		goDaily,
		openSession,
		refresh,
		save.activeDailyGame,
		save.dailyCompletionRecords,
		save.dailyStartedDay,
		service,
	])

	const handleLevelOpen = useCallback(
		(intent: LevelOpenIntent) => {
			const active = save.activeGame
			if (intent.kind === 'resume') {
				openSession({
					mode: 'CAMPAIGN',
					puzzleId: intent.puzzleId,
					launch: 'resume',
				})
				return
			}

			const replacingOther =
				active !== null &&
				active.puzzleId !== intent.puzzleId &&
				!save.completedPuzzleIds.includes(active.puzzleId)

			const launch = () => {
				if (intent.kind === 'replay') {
					// Ephemeral replay — never overwrite Campaign active save.
					openSession({
						mode: 'REPLAY',
						puzzleId: intent.puzzleId,
						launch: 'replay',
					})
					return
				}
				const session: GameSessionDescriptor = {
					mode: 'CAMPAIGN',
					puzzleId: intent.puzzleId,
					launch: 'fresh',
				}
				void service.replaceActivePuzzle(intent.puzzleId).then(() => {
					refresh()
					openSession(session)
				})
			}

			if (replacingOther) {
				Alert.alert(
					'Начать другой кроссворд?',
					'Текущий незавершённый прогресс будет заменён.',
					[
						{ text: 'Отмена', style: 'cancel' },
						{ text: 'Начать', onPress: launch },
					],
				)
				return
			}

			if (active !== null && active.puzzleId === intent.puzzleId) {
				openSession({
					mode: 'CAMPAIGN',
					puzzleId: intent.puzzleId,
					launch: 'resume',
				})
				return
			}

			launch()
		},
		[openSession, refresh, save.activeGame, save.completedPuzzleIds, service],
	)

	const handleGalleryReplay = useCallback(
		(puzzleId: string) => {
			if (!isGalleryPuzzleUnlocked(puzzleId, save.solvedPuzzleIds)) {
				return
			}
			// REPLAY is ephemeral — must not replace unfinished Campaign activeGame.
			openSession({
				mode: 'REPLAY',
				puzzleId,
				launch: 'replay',
			})
		},
		[openSession, save.solvedPuzzleIds],
	)

	const handleCompletionNext = useCallback(
		(puzzleId: string) => {
			// Shared in-flight guard: repeated Next / Home taps after completion
			// must not stack interstitial + navigation operations.
			void transitionGuard
				.run(async () => {
					await runPostCompletionInterstitial()
					await service.replaceActivePuzzle(puzzleId)
					refresh()
					openSession({
						mode: 'CAMPAIGN',
						puzzleId,
						launch: 'fresh',
					})
				})
				.catch(() => undefined)
		},
		[
			openSession,
			refresh,
			runPostCompletionInterstitial,
			service,
			transitionGuard,
		],
	)

	const handleGameExit = useCallback(
		(session: GameSessionDescriptor, fromCompletion: boolean) => {
			const navigate = () => {
				if (session.mode === 'DAILY') {
					goDaily(session.dayKey)
				} else {
					goHome()
				}
			}
			if (!fromCompletion) {
				// Plain exits show no interstitial — nothing to debounce.
				navigate()
				return
			}
			// Same guard as Next: the interstitial + navigation run at most once.
			void transitionGuard
				.run(async () => {
					await runPostCompletionInterstitial()
					navigate()
				})
				.catch(() => undefined)
		},
		[goDaily, goHome, runPostCompletionInterstitial, transitionGuard],
	)

	if (route.name === 'tutorial') {
		return (
			<TutorialScreen
				source={route.source}
				onFinished={goHome}
				onExitEarly={() => {
					void (async () => {
						// Persist the first-run skip so the tutorial does not reopen
						// on every cold start. Settings / Home replays are not
						// persisted as skips.
						if (route.source === 'first_run') {
							try {
								await service.markTutorialFirstRunSkipped()
							} catch {
								// Persist failure must never trap the user in the tutorial.
							}
							refresh()
						}
						goHome()
					})()
				}}
				onPersistComplete={async () => {
					await service.markTutorialCompleted(CURRENT_TUTORIAL_VERSION)
					refresh()
				}}
				onRegisterExitRequest={handleTutorialExitRegistration}
			/>
		)
	}

	if (route.name === 'settings') {
		return (
			<SettingsScreen
				onBack={goHome}
				onOpenAbout={() => setRoute({ name: 'about' })}
				onReplayTutorial={() => {
					trackEvent('tutorial_replay', { source: 'settings' })
					trackEvent('tutorial_start', { source: 'settings' })
					setRoute({ name: 'tutorial', source: 'settings' })
				}}
				onResetTutorialDev={
					__DEV__
						? () => {
								void service.resetTutorialProgressDevOnly().then(() => {
									refresh()
								})
							}
						: undefined
				}
			/>
		)
	}

	if (route.name === 'about') {
		return (
			<AboutScreen onBack={() => setRoute({ name: 'settings' })} />
		)
	}

	if (route.name === 'game') {
		const session = route.session
		return (
			<GameScreen
				session={session}
				onExit={() => handleGameExit(session, false)}
				onExitAfterCompletion={() => handleGameExit(session, true)}
				onOpenGallery={() => {
					refresh()
					setRoute({ name: 'gallery' })
				}}
				onOpenDailyCalendar={(dayKey) => goDaily(dayKey)}
				onNextPuzzle={handleCompletionNext}
				onDailyExpired={handleDailyExpired}
				darkMode={darkMode}
			/>
		)
	}

	if (route.name === 'daily') {
		return (
			<DailyScreen
				onBack={goHome}
				focusDayKey={route.focusDayKey}
				onStartDaily={(puzzleId, dayKey) =>
					openSession({
						mode: 'DAILY',
						puzzleId,
						dayKey,
						launch: 'fresh',
					})
				}
				onResumeDaily={(puzzleId, dayKey) =>
					openSession({
						mode: 'DAILY',
						puzzleId,
						dayKey,
						launch: 'resume',
					})
				}
			/>
		)
	}

	if (route.name === 'levels') {
		return (
			<LevelsScreen onBack={goHome} onOpenLevel={handleLevelOpen} />
		)
	}

	if (route.name === 'statistics') {
		return <StatisticsScreen onBack={goHome} />
	}

	if (route.name === 'gallery') {
		return (
			<GalleryScreen
				onBack={goHome}
				onOpenCollection={(collectionId) =>
					setRoute({ name: 'galleryCollection', collectionId })
				}
			/>
		)
	}

	if (route.name === 'galleryCollection') {
		return (
			<GalleryCollectionScreen
				collectionId={route.collectionId}
				onBack={() => setRoute({ name: 'gallery' })}
				onOpenDetail={(puzzleId) =>
					setRoute({
						name: 'galleryDetail',
						puzzleId,
						collectionId: route.collectionId,
					})
				}
			/>
		)
	}

	if (route.name === 'galleryDetail') {
		return (
			<GalleryDetailScreen
				puzzleId={route.puzzleId}
				onBack={() =>
					setRoute({
						name: 'galleryCollection',
						collectionId: route.collectionId,
					})
				}
				onReplay={handleGalleryReplay}
			/>
		)
	}

	if (route.name === 'achievements') {
		return <AchievementsScreen onBack={goHome} />
	}

	return (
		<HomeScreen
			onContinue={handleContinue}
			onPlay={() => setRoute({ name: 'levels' })}
			onOpenDaily={handleDailyCard}
			onOpenLevels={() => setRoute({ name: 'levels' })}
			onOpenGallery={() => setRoute({ name: 'gallery' })}
			onOpenAchievements={() => setRoute({ name: 'achievements' })}
			onOpenStatistics={() => setRoute({ name: 'statistics' })}
			onOpenSettings={() => setRoute({ name: 'settings' })}
			onStartTutorial={() => {
				trackEvent('tutorial_start', { source: 'home_offer' })
				setRoute({ name: 'tutorial', source: 'home_offer' })
			}}
			onDismissTutorialOffer={() => {
				void service.dismissTutorialOffer().then(() => refresh())
			}}
			darkMode={darkMode}
			onToggleDarkMode={() => setDarkMode((value) => !value)}
		/>
	)
}
