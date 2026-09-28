/**
 * Minimal navigation: Home ↔ Levels / Gallery / Achievements / Statistics / Game.
 * BannerSlot on non-Game routes.
 */

import { useCallback, useEffect, useState } from 'react'
import { Alert } from 'react-native'
import { HomeScreen } from '../screens/HomeScreen'
import { LevelsScreen, type LevelOpenIntent } from '../screens/LevelsScreen'
import { StatisticsScreen } from '../screens/StatisticsScreen'
import { GalleryScreen } from '../screens/GalleryScreen'
import { GalleryDetailScreen } from '../screens/GalleryDetailScreen'
import { AchievementsScreen } from '../screens/AchievementsScreen'
import { GameScreen } from '../screens/GameScreen'
import { useProgress } from '../progress/ProgressProvider'
import { isGalleryPuzzleUnlocked } from '../gallery'

export type GameLaunchMode = 'resume' | 'fresh' | 'replay'

type Route =
	| { readonly name: 'home' }
	| { readonly name: 'levels' }
	| { readonly name: 'statistics' }
	| { readonly name: 'gallery' }
	| { readonly name: 'galleryDetail'; readonly puzzleId: string }
	| { readonly name: 'achievements' }
	| {
			readonly name: 'game'
			readonly puzzleId: string
			readonly mode: GameLaunchMode
	  }

interface RootNavigationProps {
	readonly onBannerHostChange?: (showBanner: boolean) => void
}

export function RootNavigation({ onBannerHostChange }: RootNavigationProps) {
	const [route, setRoute] = useState<Route>({ name: 'home' })
	const [darkMode, setDarkMode] = useState(false)
	const { save, service, refresh } = useProgress()

	const showBanner = route.name !== 'game'
	useEffect(() => {
		onBannerHostChange?.(showBanner)
	}, [onBannerHostChange, showBanner])

	const goHome = useCallback(() => {
		refresh()
		setRoute({ name: 'home' })
	}, [refresh])

	const openGame = useCallback(
		(puzzleId: string, mode: GameLaunchMode) => {
			setRoute({ name: 'game', puzzleId, mode })
		},
		[],
	)

	const handleContinue = useCallback(() => {
		const activeId = save.activeGame?.puzzleId
		if (activeId === undefined) {
			setRoute({ name: 'levels' })
			return
		}
		openGame(activeId, 'resume')
	}, [openGame, save.activeGame?.puzzleId])

	const handleLevelOpen = useCallback(
		(intent: LevelOpenIntent) => {
			const active = save.activeGame
			if (intent.kind === 'resume') {
				openGame(intent.puzzleId, 'resume')
				return
			}

			const replacingOther =
				active !== null &&
				active.puzzleId !== intent.puzzleId &&
				!save.completedPuzzleIds.includes(active.puzzleId)

			const launch = () => {
				const mode: GameLaunchMode =
					intent.kind === 'replay' ? 'replay' : 'fresh'
				void service
					.replaceActivePuzzle(intent.puzzleId)
					.then(() => {
						refresh()
						openGame(intent.puzzleId, mode)
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
				openGame(intent.puzzleId, 'resume')
				return
			}

			launch()
		},
		[openGame, refresh, save.activeGame, save.completedPuzzleIds, service],
	)

	const handleGalleryReplay = useCallback(
		(puzzleId: string) => {
			if (!isGalleryPuzzleUnlocked(puzzleId, save.completedPuzzleIds)) {
				return
			}
			void service.replaceActivePuzzle(puzzleId).then(() => {
				refresh()
				openGame(puzzleId, 'replay')
			})
		},
		[openGame, refresh, save.completedPuzzleIds, service],
	)

	const handleCompletionNext = useCallback(
		(puzzleId: string) => {
			void service.replaceActivePuzzle(puzzleId).then(() => {
				refresh()
				openGame(puzzleId, 'fresh')
			})
		},
		[openGame, refresh, service],
	)

	if (route.name === 'game') {
		return (
			<GameScreen
				puzzleId={route.puzzleId}
				mode={route.mode}
				onExit={goHome}
				onOpenGallery={() => {
					refresh()
					setRoute({ name: 'gallery' })
				}}
				onNextPuzzle={handleCompletionNext}
				darkMode={darkMode}
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
				onOpenDetail={(puzzleId) =>
					setRoute({ name: 'galleryDetail', puzzleId })
				}
			/>
		)
	}

	if (route.name === 'galleryDetail') {
		return (
			<GalleryDetailScreen
				puzzleId={route.puzzleId}
				onBack={() => setRoute({ name: 'gallery' })}
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
			onOpenLevels={() => setRoute({ name: 'levels' })}
			onOpenGallery={() => setRoute({ name: 'gallery' })}
			onOpenAchievements={() => setRoute({ name: 'achievements' })}
			onOpenStatistics={() => setRoute({ name: 'statistics' })}
			darkMode={darkMode}
			onToggleDarkMode={() => setDarkMode((value) => !value)}
		/>
	)
}
