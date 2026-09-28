/**
 * Achievement definitions — code/content only, unlock is derived.
 * All Phase 5 targets are reachable with the current 21-puzzle campaign.
 */

export type AchievementIconKey =
	| 'first'
	| 'star'
	| 'five'
	| 'ten'
	| 'collector'
	| 'beginner'
	| 'easy'
	| 'medium'
	| 'hard'
	| 'expert'
	| 'collection'
	| 'replay'
	| 'grid'
	| 'daily'
	| 'streak'
	| 'fallback'

export type AchievementConditionKind =
	| 'unique_solved'
	| 'difficulty_count'
	| 'difficulty_any'
	| 'collection_complete_any'
	| 'total_completions'
	| 'large_grid'
	| 'daily_completions'
	| 'daily_streak'

export interface AchievementDefinition {
	readonly id: string
	readonly titleRu: string
	readonly descriptionRu: string
	readonly displayOrder: number
	readonly iconKey: AchievementIconKey
	readonly condition: {
		readonly kind: AchievementConditionKind
		readonly target: number
		readonly difficultyTier?: 'BEGINNER' | 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT'
		/** large_grid: min side length (width >= N || height >= N) */
		readonly minSide?: number
	}
}

export const ACHIEVEMENT_DEFINITIONS: readonly AchievementDefinition[] =
	Object.freeze([
		{
			id: 'first_picture',
			titleRu: 'Первый рисунок',
			descriptionRu: 'Завершите первый кроссворд',
			displayOrder: 1,
			iconKey: 'first',
			condition: { kind: 'unique_solved', target: 1 },
		},
		{
			id: 'collection_start',
			titleRu: 'Начало коллекции',
			descriptionRu: 'Откройте 3 разные картинки',
			displayOrder: 2,
			iconKey: 'star',
			condition: { kind: 'unique_solved', target: 3 },
		},
		{
			id: 'five_pictures',
			titleRu: 'Пять картинок',
			descriptionRu: 'Откройте 5 разных картинок',
			displayOrder: 3,
			iconKey: 'five',
			condition: { kind: 'unique_solved', target: 5 },
		},
		{
			id: 'ten_pictures',
			titleRu: 'Десятка',
			descriptionRu: 'Откройте 10 разных картинок',
			displayOrder: 4,
			iconKey: 'ten',
			condition: { kind: 'unique_solved', target: 10 },
		},
		{
			id: 'collector',
			titleRu: 'Коллекционер',
			descriptionRu: 'Откройте 20 разных картинок',
			displayOrder: 5,
			iconKey: 'collector',
			condition: { kind: 'unique_solved', target: 20 },
		},
		{
			id: 'beginner_master',
			titleRu: 'Новичок освоен',
			descriptionRu: 'Пройдите 3 кроссворда уровня «Новичок»',
			displayOrder: 6,
			iconKey: 'beginner',
			condition: {
				kind: 'difficulty_count',
				target: 3,
				difficultyTier: 'BEGINNER',
			},
		},
		{
			id: 'easy_warmup',
			titleRu: 'Лёгкая разминка',
			descriptionRu: 'Пройдите 3 кроссворда уровня «Легко»',
			displayOrder: 7,
			iconKey: 'easy',
			condition: {
				kind: 'difficulty_count',
				target: 3,
				difficultyTier: 'EASY',
			},
		},
		{
			id: 'medium_level',
			titleRu: 'Средний уровень',
			descriptionRu: 'Пройдите 2 кроссворда уровня «Средне»',
			displayOrder: 8,
			iconKey: 'medium',
			condition: {
				kind: 'difficulty_count',
				target: 2,
				difficultyTier: 'MEDIUM',
			},
		},
		{
			id: 'first_hard',
			titleRu: 'Сложная задача',
			descriptionRu: 'Пройдите первый кроссворд уровня «Сложно»',
			displayOrder: 9,
			iconKey: 'hard',
			condition: {
				kind: 'difficulty_any',
				target: 1,
				difficultyTier: 'HARD',
			},
		},
		{
			id: 'first_expert',
			titleRu: 'Эксперт',
			descriptionRu: 'Пройдите первый кроссворд уровня «Эксперт»',
			displayOrder: 10,
			iconKey: 'expert',
			condition: {
				kind: 'difficulty_any',
				target: 1,
				difficultyTier: 'EXPERT',
			},
		},
		{
			id: 'first_collection',
			titleRu: 'Первая коллекция',
			descriptionRu: 'Соберите любую коллекцию целиком',
			displayOrder: 11,
			iconKey: 'collection',
			condition: { kind: 'collection_complete_any', target: 1 },
		},
		{
			id: 'persistence',
			titleRu: 'Упорство',
			descriptionRu: 'Завершите кроссворды 15 раз (включая повторы)',
			displayOrder: 12,
			iconKey: 'replay',
			condition: { kind: 'total_completions', target: 15 },
		},
		{
			id: 'large_grid',
			titleRu: 'Большая сетка',
			descriptionRu: 'Пройдите кроссворд размером 15×15 или больше',
			displayOrder: 13,
			iconKey: 'grid',
			condition: { kind: 'large_grid', target: 1, minSide: 15 },
		},
		{
			id: 'daily_first',
			titleRu: 'Первый день',
			descriptionRu: 'Завершите первый кроссворд дня',
			displayOrder: 14,
			iconKey: 'daily',
			condition: { kind: 'daily_completions', target: 1 },
		},
		{
			id: 'daily_streak_3',
			titleRu: 'Три дня подряд',
			descriptionRu: 'Соберите серию из 3 дней',
			displayOrder: 15,
			iconKey: 'streak',
			condition: { kind: 'daily_streak', target: 3 },
		},
		{
			id: 'daily_streak_7',
			titleRu: 'Неделя',
			descriptionRu: 'Соберите серию из 7 дней',
			displayOrder: 16,
			iconKey: 'streak',
			condition: { kind: 'daily_streak', target: 7 },
		},
		{
			id: 'daily_ten',
			titleRu: 'Десять кроссвордов дня',
			descriptionRu: 'Завершите 10 кроссвордов дня',
			displayOrder: 17,
			iconKey: 'daily',
			condition: { kind: 'daily_completions', target: 10 },
		},
	])
