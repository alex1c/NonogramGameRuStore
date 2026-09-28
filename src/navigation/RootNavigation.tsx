/**
 * Minimal navigation: Home ↔ Levels ↔ Statistics ↔ Game.
 * BannerSlot visibility reported for Home / Levels / Statistics (not Game).
 */

import { useCallback, useEffect, useState } from 'react'
import { Alert } from 'react-native'
import { HomeScreen } from '../screens/HomeScreen'
import { LevelsScreen, type LevelOpenIntent } from '../screens/LevelsScreen'
import { StatisticsScreen } from '../screens/StatisticsScreen'
import { GameScreen } from '../screens/GameScreen'
import { useProgress } from '../progress/ProgressProvider'

export type GameLaunchMode = 'resume' | 'fresh' | 'replay'

type Route =
	| { readonly name: 'home' }
	| { readonly name: 'levels' }
	| { readonly name: 'statistics' }
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

			// Same active puzzle reopened as available → continue, do not reset.
			if (active !== null && active.puzzleId === intent.puzzleId) {
				openGame(intent.puzzleId, 'resume')
				return
			}

			launch()
		},
		[openGame, refresh, save.activeGame, save.completedPuzzleIds, service],
	)

	if (route.name === 'game') {
		return (
			<GameScreen
				puzzleId={route.puzzleId}
				mode={route.mode}
				onExit={goHome}
				darkMode={darkMode}
			/>
		)
	}

	if (route.name === 'levels') {
		return (
			<LevelsScreen
				onBack={goHome}
				onOpenLevel={handleLevelOpen}
			/>
		)
	}

	if (route.name === 'statistics') {
		return <StatisticsScreen onBack={goHome} />
	}

	return (
		<HomeScreen
			onContinue={handleContinue}
			onPlay={() => setRoute({ name: 'levels' })}
			onOpenLevels={() => setRoute({ name: 'levels' })}
			onOpenStatistics={() => setRoute({ name: 'statistics' })}
			darkMode={darkMode}
			onToggleDarkMode={() => setDarkMode((value) => !value)}
		/>
	)
}
