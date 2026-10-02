/**
 * Minimal navigation: Home ↔ Levels / Gallery / Achievements / Statistics /
 * Daily / Game / Tutorial / Settings / About.
 * Banner placement reported to App shell (Game/Tutorial host their own / none).
 */

import { useCallback, useEffect, useState } from 'react'
import { Alert, AppState, type AppStateStatus } from 'react-native'
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
import { maybeShowInterstitialAfterCompletion } from '../ads'
import { trackEvent } from '../analytics'
import {
	CURRENT_TUTORIAL_VERSION,
	shouldFirstRunOfferTutorial,
} from '../tutorial/definition'
import { placementForShellRoute } from './bannerPlacement'

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

	useEffect(() => {
		onBannerPlacementChange?.(placementForShellRoute(route.name))
	}, [onBannerPlacementChange, route])

	useEffect(() => {
		if (route.name === 'tutorial' && route.source === 'first_run') {
			trackEvent('tutorial_start', { source: 'first_run' })
		}
		// Fire once for initial first-run entry.
		// eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only
	}, [])

	// Midnight / focus refresh: discard stale Daily + refresh Home card.
	useEffect(() => {
		const onActive = (state: AppStateStatus) => {
			if (state !== 'active') {
				return
			}
			void service.discardStaleDailyIfNeeded().then(() => refresh())
		}
		const sub = AppState.addEventListener('change', onActive)
		return () => sub.remove()
	}, [refresh, service])

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

	const openSession = useCallback((session: GameSessionDescriptor) => {
		setRoute({ name: 'game', session })
	}, [])

	const runPostCompletionInterstitial = useCallback(async () => {
		const shown = await maybeShowInterstitialAfterCompletion({
			isTutorial: false,
		})
		if (shown) {
			trackEvent('interstitial_shown')
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
				const session: GameSessionDescriptor =
					intent.kind === 'replay'
						? {
								mode: 'REPLAY',
								puzzleId: intent.puzzleId,
								launch: 'replay',
							}
						: {
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
			void service.replaceActivePuzzle(puzzleId).then(() => {
				refresh()
				openSession({
					mode: 'REPLAY',
					puzzleId,
					launch: 'replay',
				})
			})
		},
		[openSession, refresh, save.solvedPuzzleIds, service],
	)

	const handleCompletionNext = useCallback(
		(puzzleId: string) => {
			void (async () => {
				await runPostCompletionInterstitial()
				await service.replaceActivePuzzle(puzzleId)
				refresh()
				openSession({
					mode: 'CAMPAIGN',
					puzzleId,
					launch: 'fresh',
				})
			})()
		},
		[openSession, refresh, runPostCompletionInterstitial, service],
	)

	const handleGameExit = useCallback(
		(session: GameSessionDescriptor, fromCompletion: boolean) => {
			void (async () => {
				if (fromCompletion) {
					await runPostCompletionInterstitial()
				}
				if (session.mode === 'DAILY') {
					goDaily(session.dayKey)
				} else {
					goHome()
				}
			})()
		},
		[goDaily, goHome, runPostCompletionInterstitial],
	)

	if (route.name === 'tutorial') {
		return (
			<TutorialScreen
				source={route.source}
				onFinished={goHome}
				onExitEarly={goHome}
				onPersistComplete={async () => {
					await service.markTutorialCompleted(CURRENT_TUTORIAL_VERSION)
					refresh()
				}}
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
