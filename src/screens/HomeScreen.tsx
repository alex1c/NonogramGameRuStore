/**
 * Home shell — open curated production-ready puzzles.
 * Keeps reserved BannerSlot via App shell (not on Game).
 */

import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getHomePlayablePuzzles } from '../content/playable'
import { colors, spacing, typography } from '../theme'
import { analyzeDifficulty } from '../domain/difficulty/analyzer'
import type { CatalogPuzzle } from '../content/types'

interface HomeScreenProps {
	readonly onOpenPuzzle: (puzzleId: string) => void
	readonly darkMode: boolean
	readonly onToggleDarkMode: () => void
}

export function HomeScreen({
	onOpenPuzzle,
	darkMode,
	onToggleDarkMode,
}: HomeScreenProps) {
	const insets = useSafeAreaInsets()
	const [puzzles] = useState(() => getHomePlayablePuzzles())

	return (
		<View
			style={[styles.root, { paddingTop: insets.top + spacing.md }]}
			testID="home-screen"
		>
			<Text style={styles.title} accessibilityRole="header">
				Японские кроссворды
			</Text>
			<Text style={styles.subtitle}>NonogramGame</Text>
			<Text style={styles.badge} testID="boot-ok">
				BOOT_OK
			</Text>

			<Text style={styles.section}>Выберите уровень</Text>
			<View style={styles.list}>
				{puzzles.map((puzzle) => (
					<PuzzleButton
						key={puzzle.id}
						puzzle={puzzle}
						onPress={() => onOpenPuzzle(puzzle.id)}
					/>
				))}
			</View>

			{__DEV__ ? (
				<Pressable
					onPress={onToggleDarkMode}
					style={styles.devToggle}
					accessibilityRole="button"
				>
					<Text style={styles.devToggleText}>
						DEV: {darkMode ? 'Dark board' : 'Light board'}
					</Text>
				</Pressable>
			) : null}
		</View>
	)
}

function PuzzleButton({
	puzzle,
	onPress,
}: {
	puzzle: CatalogPuzzle
	onPress: () => void
}) {
	const difficulty = analyzeDifficulty(puzzle)
	return (
		<Pressable
			accessibilityRole="button"
			onPress={onPress}
			style={({ pressed }) => [
				styles.puzzleButton,
				{ opacity: pressed ? 0.85 : 1 },
			]}
		>
			<Text style={styles.puzzleTitle}>
				{puzzle.metadata.title ?? puzzle.id}
			</Text>
			<Text style={styles.puzzleMeta}>
				{puzzle.width}×{puzzle.height} · {difficulty.tier}
			</Text>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
		paddingHorizontal: spacing.lg,
		paddingTop: spacing.xl,
		backgroundColor: colors.background,
		gap: spacing.sm,
	},
	title: {
		...typography.title,
		color: colors.text,
		textAlign: 'center',
	},
	subtitle: {
		...typography.subtitle,
		color: colors.textMuted,
		textAlign: 'center',
	},
	badge: {
		...typography.badge,
		color: colors.accent,
		textAlign: 'center',
		marginTop: spacing.sm,
	},
	section: {
		marginTop: spacing.lg,
		fontSize: 15,
		fontWeight: '700',
		color: colors.text,
	},
	list: {
		gap: 10,
		marginTop: spacing.sm,
	},
	puzzleButton: {
		backgroundColor: '#FFFFFF',
		borderRadius: 14,
		borderWidth: 1,
		borderColor: colors.border,
		paddingHorizontal: 16,
		paddingVertical: 14,
		minHeight: 64,
		justifyContent: 'center',
	},
	puzzleTitle: {
		fontSize: 16,
		fontWeight: '700',
		color: colors.text,
	},
	puzzleMeta: {
		marginTop: 4,
		fontSize: 13,
		color: colors.textMuted,
	},
	devToggle: {
		marginTop: 'auto',
		marginBottom: spacing.md,
		alignSelf: 'center',
		minHeight: 44,
		justifyContent: 'center',
	},
	devToggleText: {
		color: colors.accent,
		fontWeight: '600',
	},
})
