/**
 * User-facing difficulty tiers (internal English IDs).
 * Russian labels belong in UI i18n, not in the domain model.
 */

export const DIFFICULTY_TIERS = [
	'BEGINNER',
	'EASY',
	'MEDIUM',
	'HARD',
	'EXPERT',
] as const

export type DifficultyTier = (typeof DIFFICULTY_TIERS)[number]

/**
 * UNRATED — puzzle is not production-rateable (invalid, ambiguous, stalled,
 * or otherwise not logically solved by our no-guessing solver).
 * Never map STALLED → EXPERT.
 */
export type DifficultyRating = DifficultyTier | 'UNRATED'

/** Future UI copy keys — not used by solvers. */
export const DIFFICULTY_LABEL_RU: Readonly<Record<DifficultyTier, string>> =
	Object.freeze({
		BEGINNER: 'Новичок',
		EASY: 'Легко',
		MEDIUM: 'Средне',
		HARD: 'Сложно',
		EXPERT: 'Эксперт',
	})
