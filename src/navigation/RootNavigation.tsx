/**
 * Minimal navigation: Home (root) ↔ Game.
 * Reports whether Home is active so App can show the reserved BannerSlot.
 */

import { useCallback, useEffect, useState } from 'react'
import { HomeScreen } from '../screens/HomeScreen'
import { GameScreen } from '../screens/GameScreen'

type Route =
	| { readonly name: 'home' }
	| { readonly name: 'game'; readonly puzzleId: string }

interface RootNavigationProps {
	readonly onHomeActiveChange?: (isHome: boolean) => void
}

export function RootNavigation({ onHomeActiveChange }: RootNavigationProps) {
	const [route, setRoute] = useState<Route>({ name: 'home' })
	const [darkMode, setDarkMode] = useState(false)

	useEffect(() => {
		onHomeActiveChange?.(route.name === 'home')
	}, [onHomeActiveChange, route.name])

	const openPuzzle = useCallback((puzzleId: string) => {
		setRoute({ name: 'game', puzzleId })
	}, [])

	const exitGame = useCallback(() => {
		setRoute({ name: 'home' })
	}, [])

	if (route.name === 'game') {
		return (
			<GameScreen
				puzzleId={route.puzzleId}
				onExit={exitGame}
				darkMode={darkMode}
			/>
		)
	}

	return (
		<HomeScreen
			onOpenPuzzle={openPuzzle}
			darkMode={darkMode}
			onToggleDarkMode={() => setDarkMode((value) => !value)}
		/>
	)
}
