/**
 * Tutorial content contract (version 1).
 * Interactive micro-boards teach absolute beginners; isolated from production save.
 */

import { CURRENT_TUTORIAL_VERSION } from '../persistence/schema'

export { CURRENT_TUTORIAL_VERSION }

export type TutorialChapterId =
	| 'basics'
	| 'crosses'
	| 'groups'
	| 'logic'
	| 'controls'

export type TutorialStepKind =
	| 'intro'
	| 'paint_line'
	| 'mark_crosses'
	| 'explain'
	| 'paint_forced'
	| 'multi_group'
	| 'order'
	| 'row_col'
	| 'complete_group'
	| 'complete_line'
	| 'undo'
	| 'tools'
	| 'drag'
	| 'zoom'
	| 'hint'
	| 'modes'
	| 'finale'

export interface TutorialCellTarget {
	readonly row: number
	readonly col: number
	/** Expected player mark: 1 = filled, 2 = cross, 0 = empty */
	readonly expect: 0 | 1 | 2
}

export interface TutorialStepDef {
	readonly id: string
	readonly chapterId: TutorialChapterId
	readonly kind: TutorialStepKind
	readonly title: string
	readonly body: string
	/** Optional single-line clue demo (row of N cells). */
	readonly lineLength?: number
	readonly lineClues?: readonly number[]
	/** Target cells the user must match (interactive). */
	readonly targets?: readonly TutorialCellTarget[]
	/** Soft wrong-action hint. */
	readonly softError?: string
	readonly ctaLabel?: string
}

export const TUTORIAL_CHAPTERS: readonly {
	readonly id: TutorialChapterId
	readonly titleRu: string
}[] = [
	{ id: 'basics', titleRu: 'Основы' },
	{ id: 'crosses', titleRu: 'Пустые клетки' },
	{ id: 'groups', titleRu: 'Несколько групп' },
	{ id: 'logic', titleRu: 'Логика' },
	{ id: 'controls', titleRu: 'Управление и помощь' },
]

/**
 * Ordered interactive curriculum.
 * One idea per step; chapters group presentation progress.
 */
export const TUTORIAL_STEPS: readonly TutorialStepDef[] = [
	{
		id: 'intro',
		chapterId: 'basics',
		kind: 'intro',
		title: 'Что это за игра',
		body:
			'В японском кроссворде числа слева и сверху показывают группы закрашенных клеток. Решая строки и столбцы, вы постепенно открываете картинку.',
		ctaLabel: 'Начать обучение',
	},
	{
		id: 'single_five',
		chapterId: 'basics',
		kind: 'paint_line',
		title: 'Одно число',
		body: 'Число 5 означает: в этой строке подряд закрашены 5 клеток. Закрасьте всю строку.',
		lineLength: 5,
		lineClues: [5],
		targets: [
			{ row: 0, col: 0, expect: 1 },
			{ row: 0, col: 1, expect: 1 },
			{ row: 0, col: 2, expect: 1 },
			{ row: 0, col: 3, expect: 1 },
			{ row: 0, col: 4, expect: 1 },
		],
		softError: 'Нужно закрасить все пять клеток подряд.',
	},
	{
		id: 'crosses_intro',
		chapterId: 'crosses',
		kind: 'mark_crosses',
		title: 'Крестики',
		body:
			'Если вы точно знаете, что клетка пустая, отметьте её крестиком. Крестик — помощник игрока, а не часть итоговой картинки.',
		lineLength: 5,
		lineClues: [3],
		// Pre-filled center block 1..3; user marks 0 and 4 as X.
		targets: [
			{ row: 0, col: 0, expect: 2 },
			{ row: 0, col: 1, expect: 1 },
			{ row: 0, col: 2, expect: 1 },
			{ row: 0, col: 3, expect: 1 },
			{ row: 0, col: 4, expect: 2 },
		],
		softError: 'Поставьте крестики в крайних клетках — они точно пустые.',
	},
	{
		id: 'clue_smaller',
		chapterId: 'logic',
		kind: 'explain',
		title: 'Число меньше длины строки',
		body:
			'В строке из 5 клеток число 3 означает блок из трёх закрашенных клеток подряд. Сначала мы ещё не всегда знаем, где именно он начинается — поэтому не угадываем.',
		lineLength: 5,
		lineClues: [3],
		ctaLabel: 'Понятно',
	},
	{
		id: 'overlap',
		chapterId: 'logic',
		kind: 'paint_forced',
		title: 'Пересечение вариантов',
		body:
			'Где бы ни стоял блок из трёх клеток в строке из пяти, средняя клетка всё равно будет закрашена. Значит её можно отметить уже сейчас.',
		lineLength: 5,
		lineClues: [3],
		targets: [{ row: 0, col: 2, expect: 1 }],
		softError: 'Закрасьте только среднюю клетку — она входит во все возможные варианты.',
	},
	{
		id: 'multi_2_1',
		chapterId: 'groups',
		kind: 'multi_group',
		title: 'Несколько чисел',
		body:
			'Каждое число — отдельная группа. Между соседними группами должна быть хотя бы одна пустая клетка. Для «2 1» это выглядит как ■■ × ■',
		lineLength: 5,
		lineClues: [2, 1],
		targets: [
			{ row: 0, col: 0, expect: 1 },
			{ row: 0, col: 1, expect: 1 },
			{ row: 0, col: 2, expect: 2 },
			{ row: 0, col: 3, expect: 1 },
			{ row: 0, col: 4, expect: 2 },
		],
		softError: 'Соберите две группы: две клетки, затем разделитель, затем одну клетку.',
	},
	{
		id: 'order',
		chapterId: 'groups',
		kind: 'order',
		title: 'Порядок групп',
		body:
			'Числа идут в том же порядке, что и блоки: слева направо для строк и сверху вниз для столбцов. «1 3» — это не то же самое, что «3 1».',
		ctaLabel: 'Понятно',
	},
	{
		id: 'row_col',
		chapterId: 'logic',
		kind: 'row_col',
		title: 'Строки и столбцы вместе',
		body:
			'Каждый найденный фрагмент помогает решить пересекающиеся строки и столбцы. Сначала используйте подсказку строки, затем столбца.',
		ctaLabel: 'Понятно',
	},
	{
		id: 'complete_group',
		chapterId: 'crosses',
		kind: 'complete_group',
		title: 'Завершённая группа',
		body:
			'Когда блок найден и его границы доказаны, соседние клетки не могут продолжать этот блок — их можно отметить крестиком. Ставьте крестики только там, где логика уже доказана.',
		ctaLabel: 'Понятно',
	},
	{
		id: 'complete_line',
		chapterId: 'crosses',
		kind: 'complete_line',
		title: 'Завершённая строка',
		body:
			'Когда все группы строки найдены, остальные клетки этой строки — крестики. Это безопасное правило завершённой линии.',
		lineLength: 5,
		lineClues: [2],
		targets: [
			{ row: 0, col: 0, expect: 2 },
			{ row: 0, col: 1, expect: 1 },
			{ row: 0, col: 2, expect: 1 },
			{ row: 0, col: 3, expect: 2 },
			{ row: 0, col: 4, expect: 2 },
		],
		softError: 'Дополните крестиками клетки вне найденного блока из двух.',
	},
	{
		id: 'undo',
		chapterId: 'controls',
		kind: 'undo',
		title: 'Ошибки и исправление',
		body:
			'Ластик убирает отметку в клетке. Отмена возвращает последнее действие. Повтор возвращает отменённое. Нажмите «Отмена» один раз на демо-доске.',
		ctaLabel: 'Я нажал Отмена',
	},
	{
		id: 'tools',
		chapterId: 'controls',
		kind: 'tools',
		title: 'Режимы ввода',
		body: 'Закрасить · Крестик · Ластик — выберите нужный инструмент перед действием.',
		ctaLabel: 'Понятно',
	},
	{
		id: 'drag',
		chapterId: 'controls',
		kind: 'drag',
		title: 'Проведение пальцем',
		body:
			'Можно провести по нескольким клеткам подряд. Движение фиксируется по первой оси — так проще закрашивать строки и столбцы.',
		ctaLabel: 'Понятно',
	},
	{
		id: 'zoom',
		chapterId: 'controls',
		kind: 'zoom',
		title: 'Масштаб',
		body:
			'На больших кроссвордах доступны увеличение, перемещение и кнопка «Вписать». Она возвращает поле целиком на экран.',
		ctaLabel: 'Понятно',
	},
	{
		id: 'hint',
		chapterId: 'controls',
		kind: 'hint',
		title: 'Подсказка',
		body:
			'«Подсказка» показывает следующий логически доказанный ход. Она не угадывает и не раскрывает всё решение.',
		ctaLabel: 'Понятно',
	},
	{
		id: 'teach',
		chapterId: 'controls',
		kind: 'hint',
		title: 'Научи меня',
		body:
			'«Подсказка» говорит, что сделать. «Научи меня» объясняет, почему этот ход правильный.',
		ctaLabel: 'Понятно',
	},
	{
		id: 'modes',
		chapterId: 'controls',
		kind: 'modes',
		title: 'Уровни, Галерея, День',
		body:
			'Уровни — 1000 кроссвордов в наборах. Галерея открывает решённые картинки. Кроссворд дня — новая ежедневная задача.',
		ctaLabel: 'Понятно',
	},
	{
		id: 'finale',
		chapterId: 'controls',
		kind: 'finale',
		title: 'Готово!',
		body:
			'Теперь вы знаете основные правила. Решайте только то, что можно доказать логикой — угадывать не нужно.',
		ctaLabel: 'Начать играть',
	},
]

export function getTutorialStepIndex(stepId: string): number {
	return TUTORIAL_STEPS.findIndex((step) => step.id === stepId)
}

export function getChapterProgress(stepIndex: number): {
	readonly chapterTitle: string
	readonly indexInChapter: number
	readonly chapterLength: number
} {
	const step = TUTORIAL_STEPS[stepIndex]
	if (step === undefined) {
		return { chapterTitle: '', indexInChapter: 0, chapterLength: 0 }
	}
	const chapterSteps = TUTORIAL_STEPS.filter(
		(item) => item.chapterId === step.chapterId,
	)
	const chapter = TUTORIAL_CHAPTERS.find((item) => item.id === step.chapterId)
	const indexInChapter = chapterSteps.findIndex((item) => item.id === step.id)
	return {
		chapterTitle: chapter?.titleRu ?? '',
		indexInChapter: indexInChapter + 1,
		chapterLength: chapterSteps.length,
	}
}

/** True when every target cell matches the player grid. */
export function tutorialTargetsMet(
	grid: readonly (readonly number[])[],
	targets: readonly TutorialCellTarget[],
): boolean {
	for (const target of targets) {
		const row = grid[target.row]
		if (row === undefined || row[target.col] !== target.expect) {
			return false
		}
	}
	return true
}

/**
 * Whether Home should soft-offer tutorial (existing progress, not completed).
 * Fresh installs (no progress) get a stronger first-run entry instead.
 */
export function shouldSoftOfferTutorial(save: {
	readonly tutorialVersionCompleted: number | null
	readonly tutorialOfferDismissed: boolean
	readonly completedPuzzleIds: readonly string[]
	readonly solvedPuzzleIds: readonly string[]
	readonly dailyCompletionRecords: readonly unknown[]
	readonly unlockedAchievementIds: readonly string[]
}): boolean {
	if (save.tutorialVersionCompleted !== null) {
		return false
	}
	if (save.tutorialOfferDismissed) {
		return false
	}
	return hasExistingProgress(save)
}

export function shouldFirstRunOfferTutorial(save: {
	readonly tutorialVersionCompleted: number | null
	readonly completedPuzzleIds: readonly string[]
	readonly solvedPuzzleIds: readonly string[]
	readonly dailyCompletionRecords: readonly unknown[]
	readonly unlockedAchievementIds: readonly string[]
}): boolean {
	if (save.tutorialVersionCompleted !== null) {
		return false
	}
	return !hasExistingProgress(save)
}

function hasExistingProgress(save: {
	readonly completedPuzzleIds: readonly string[]
	readonly solvedPuzzleIds: readonly string[]
	readonly dailyCompletionRecords: readonly unknown[]
	readonly unlockedAchievementIds: readonly string[]
}): boolean {
	return (
		save.completedPuzzleIds.length > 0 ||
		save.solvedPuzzleIds.length > 0 ||
		save.dailyCompletionRecords.length > 0 ||
		save.unlockedAchievementIds.length > 0
	)
}
