/**
 * Interactive tutorial session — isolated from production Campaign/Gallery/Daily.
 * No ads. No statistics / achievement pollution.
 */

import { useCallback, useMemo, useState } from 'react'
import {
	Alert,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing, typography } from '../theme'
import {
	CURRENT_TUTORIAL_VERSION,
	TUTORIAL_STEPS,
	getChapterProgress,
	tutorialTargetsMet,
	type TutorialStepDef,
} from '../tutorial/definition'
import { trackEvent } from '../analytics'

type Tool = 'fill' | 'cross' | 'erase'

interface TutorialScreenProps {
	readonly source: 'first_run' | 'settings' | 'home_offer'
	readonly onFinished: () => void
	readonly onExitEarly: () => void
	readonly onPersistComplete: () => Promise<void>
}

function createEmptyLine(length: number): number[] {
	return Array.from({ length }, () => 0)
}

function initialGridForStep(step: TutorialStepDef): number[][] {
	const length = step.lineLength ?? 5
	const row = createEmptyLine(length)
	// Pre-seed known filled cells for crosses / complete-line demos.
	if (step.id === 'crosses_intro') {
		row[1] = 1
		row[2] = 1
		row[3] = 1
	}
	if (step.id === 'complete_line') {
		row[1] = 1
		row[2] = 1
	}
	return [row]
}

export function TutorialScreen({
	source,
	onFinished,
	onExitEarly,
	onPersistComplete,
}: TutorialScreenProps) {
	const insets = useSafeAreaInsets()
	const [stepIndex, setStepIndex] = useState(0)
	const [tool, setTool] = useState<Tool>('fill')
	const [grid, setGrid] = useState(() =>
		initialGridForStep(TUTORIAL_STEPS[0] as TutorialStepDef),
	)
	const [feedback, setFeedback] = useState<string | null>(null)
	const [undoDone, setUndoDone] = useState(false)
	const [, setHistory] = useState<number[][][]>([])

	const step = TUTORIAL_STEPS[stepIndex] as TutorialStepDef
	const chapter = getChapterProgress(stepIndex)

	const advance = useCallback(
		async (nextIndex: number) => {
			if (nextIndex >= TUTORIAL_STEPS.length) {
				trackEvent('tutorial_complete', { source })
				await onPersistComplete()
				onFinished()
				return
			}
			const next = TUTORIAL_STEPS[nextIndex] as TutorialStepDef
			trackEvent('tutorial_step', {
				chapterId: next.chapterId,
				stepId: next.id,
			})
			setStepIndex(nextIndex)
			setGrid(initialGridForStep(next))
			setFeedback(null)
			setHistory([])
			setUndoDone(false)
			setTool('fill')
		},
		[onFinished, onPersistComplete, source],
	)

	const handleContinue = useCallback(() => {
		const needsInteraction =
			step.targets !== undefined && step.targets.length > 0
		if (needsInteraction) {
			if (!tutorialTargetsMet(grid, step.targets ?? [])) {
				setFeedback(step.softError ?? 'Попробуйте ещё раз.')
				return
			}
		}
		if (step.kind === 'undo' && !undoDone) {
			setFeedback('Сначала нажмите «Отмена» на демо-доске.')
			return
		}
		void advance(stepIndex + 1)
	}, [advance, grid, step, stepIndex, undoDone])

	const paintCell = useCallback(
		(col: number) => {
			setHistory((prev) => [...prev, grid.map((r) => [...r])])
			setGrid((prev) => {
				const next = prev.map((row) => [...row])
				const row = next[0]
				if (row === undefined) {
					return prev
				}
				if (tool === 'fill') {
					row[col] = 1
				} else if (tool === 'cross') {
					row[col] = 2
				} else {
					row[col] = 0
				}
				return next
			})
			setFeedback(null)
		},
		[grid, tool],
	)

	const handleUndo = useCallback(() => {
		setHistory((prev) => {
			if (prev.length === 0) {
				// Still count as undo practice if grid was painted.
				setUndoDone(true)
				return prev
			}
			const last = prev[prev.length - 1]
			if (last !== undefined) {
				setGrid(last)
			}
			setUndoDone(true)
			return prev.slice(0, -1)
		})
		setFeedback(null)
	}, [])

	const requestExit = useCallback(() => {
		Alert.alert(
			'Выйти из обучения?',
			'Вы сможете продолжить его позже в настройках.',
			[
				{ text: 'Продолжить обучение', style: 'cancel' },
				{
					text: 'Выйти',
					style: 'destructive',
					onPress: () => {
						trackEvent('tutorial_skip', {
							source,
							chapterId: step.chapterId,
						})
						onExitEarly()
					},
				},
			],
		)
	}, [onExitEarly, source, step.chapterId])

	const showBoard = step.lineLength !== undefined
	const clueLabel = useMemo(() => {
		if (step.lineClues === undefined) {
			return null
		}
		return step.lineClues.join(' ')
	}, [step.lineClues])

	return (
		<View
			style={[
				styles.root,
				{
					paddingTop: insets.top + spacing.sm,
					paddingBottom: insets.bottom + spacing.md,
				},
			]}
			testID="tutorial-screen"
		>
			<View style={styles.topBar}>
				<Text style={styles.progress}>
					{chapter.chapterTitle} · {chapter.indexInChapter} из{' '}
					{chapter.chapterLength}
				</Text>
				<Pressable
					onPress={requestExit}
					accessibilityRole="button"
					accessibilityLabel="Закрыть обучение"
					hitSlop={8}
				>
					<Text style={styles.close}>Закрыть</Text>
				</Pressable>
			</View>

			<ScrollView
				contentContainerStyle={styles.scroll}
				keyboardShouldPersistTaps="handled"
			>
				<Text style={styles.title} accessibilityRole="header">
					{step.title}
				</Text>
				<Text style={styles.body}>{step.body}</Text>

				{showBoard ? (
					<View style={styles.boardBlock}>
						{clueLabel !== null ? (
							<Text style={styles.clue}>Числа: {clueLabel}</Text>
						) : null}
						<View style={styles.row}>
							{(grid[0] ?? []).map((cell, col) => (
								<Pressable
									key={`c-${col}`}
									onPress={() => paintCell(col)}
									style={[
										styles.cell,
										cell === 1 ? styles.cellFilled : null,
										cell === 2 ? styles.cellCross : null,
									]}
									accessibilityRole="button"
									accessibilityLabel={
										cell === 1
											? `Клетка ${col + 1}, закрашена`
											: cell === 2
												? `Клетка ${col + 1}, крестик`
												: `Клетка ${col + 1}, пустая`
									}
								>
									{cell === 2 ? (
										<Text style={styles.crossMark}>×</Text>
									) : null}
								</Pressable>
							))}
						</View>
						<View style={styles.tools}>
							{(
								[
									['fill', 'Закрасить'],
									['cross', 'Крестик'],
									['erase', 'Ластик'],
								] as const
							).map(([id, label]) => (
								<Pressable
									key={id}
									onPress={() => setTool(id)}
									style={[
										styles.toolBtn,
										tool === id ? styles.toolActive : null,
									]}
								>
									<Text
										style={[
											styles.toolText,
											tool === id ? styles.toolTextActive : null,
										]}
									>
										{label}
									</Text>
								</Pressable>
							))}
							{step.kind === 'undo' ? (
								<Pressable onPress={handleUndo} style={styles.toolBtn}>
									<Text style={styles.toolText}>Отмена</Text>
								</Pressable>
							) : null}
						</View>
					</View>
				) : null}

				{feedback !== null ? (
					<Text style={styles.feedback}>{feedback}</Text>
				) : null}
			</ScrollView>

			<Pressable
				accessibilityRole="button"
				accessibilityLabel={step.ctaLabel ?? 'Далее'}
				onPress={handleContinue}
				style={({ pressed }) => [
					styles.cta,
					{ opacity: pressed ? 0.9 : 1 },
				]}
				testID="tutorial-cta"
			>
				<Text style={styles.ctaText}>
					{step.ctaLabel ??
						(step.targets !== undefined ? 'Проверить и далее' : 'Далее')}
				</Text>
			</Pressable>

			<Pressable
				onPress={() => {
					trackEvent('tutorial_skip', {
						source,
						chapterId: step.chapterId,
					})
					onExitEarly()
				}}
				accessibilityRole="button"
				style={styles.skip}
			>
				<Text style={styles.skipText}>Пропустить обучение</Text>
			</Pressable>

			{/* Version stamp for audits — not user-facing chrome */}
			<Text style={styles.versionHidden} accessible={false}>
				tutorial-v{CURRENT_TUTORIAL_VERSION}
			</Text>
		</View>
	)
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
		backgroundColor: colors.background,
		paddingHorizontal: spacing.lg,
	},
	topBar: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: spacing.sm,
	},
	progress: {
		...typography.caption,
		color: colors.textMuted,
	},
	close: {
		...typography.caption,
		color: colors.accent,
		fontWeight: '600',
	},
	scroll: {
		paddingBottom: spacing.md,
		gap: spacing.sm,
	},
	title: {
		...typography.title,
		fontSize: 24,
		color: colors.text,
	},
	body: {
		...typography.subtitle,
		color: colors.text,
		lineHeight: 22,
	},
	boardBlock: {
		marginTop: spacing.md,
		gap: spacing.sm,
		alignItems: 'center',
	},
	clue: {
		...typography.badge,
		color: colors.accent,
	},
	row: {
		flexDirection: 'row',
		gap: 4,
	},
	cell: {
		width: 44,
		height: 44,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: '#fff',
		alignItems: 'center',
		justifyContent: 'center',
	},
	cellFilled: {
		backgroundColor: colors.text,
	},
	cellCross: {
		backgroundColor: colors.surface,
	},
	crossMark: {
		fontSize: 22,
		color: colors.textMuted,
		fontWeight: '700',
	},
	tools: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.sm,
		justifyContent: 'center',
	},
	toolBtn: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.surface,
	},
	toolActive: {
		borderColor: colors.accent,
		backgroundColor: colors.accent,
	},
	toolText: {
		...typography.caption,
		color: colors.text,
	},
	toolTextActive: {
		color: '#fff',
		fontWeight: '700',
	},
	feedback: {
		...typography.caption,
		color: '#8A4B2E',
		marginTop: spacing.sm,
	},
	cta: {
		backgroundColor: colors.accent,
		borderRadius: 12,
		paddingVertical: 14,
		alignItems: 'center',
		marginTop: spacing.sm,
	},
	ctaText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '700',
	},
	skip: {
		alignItems: 'center',
		paddingVertical: spacing.sm,
	},
	skipText: {
		...typography.caption,
		color: colors.textMuted,
	},
	versionHidden: {
		height: 0,
		opacity: 0,
	},
})
