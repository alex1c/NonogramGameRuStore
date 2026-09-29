/**
 * Phase 8A content pipeline constants.
 */

export const CONTENT_GENERATOR_VERSION = 'prod-v1' as const
export const CONTENT_CATALOG_VERSION = '2026.1-pilot' as const
export const PILOT_TARGET = 100 as const

export const PILOT_TIER_QUOTA = Object.freeze({
	BEGINNER: 10,
	EASY: 25,
	MEDIUM: 30,
	HARD: 25,
	EXPERT: 10,
})

/** Soft near-duplicate report threshold (not auto-reject). */
export const NEAR_SIMILARITY_REPORT = 0.92

export const MAX_CANDIDATE_ATTEMPTS = 1200

export const COLLECTIONS = Object.freeze([
	{ id: 'animals', titleRu: 'Животные', displayOrder: 1 },
	{ id: 'birds', titleRu: 'Птицы', displayOrder: 2 },
	{ id: 'sea', titleRu: 'Море', displayOrder: 3 },
	{ id: 'plants', titleRu: 'Растения', displayOrder: 4 },
	{ id: 'food', titleRu: 'Еда', displayOrder: 5 },
	{ id: 'drinks', titleRu: 'Напитки', displayOrder: 6 },
	{ id: 'home', titleRu: 'Дом', displayOrder: 7 },
	{ id: 'objects', titleRu: 'Предметы', displayOrder: 8 },
	{ id: 'transport', titleRu: 'Транспорт', displayOrder: 9 },
	{ id: 'nature', titleRu: 'Природа', displayOrder: 10 },
	{ id: 'space', titleRu: 'Космос', displayOrder: 11 },
	{ id: 'symbols', titleRu: 'Символы', displayOrder: 12 },
	{ id: 'patterns', titleRu: 'Узоры', displayOrder: 13 },
] as const)

export type CollectionId = (typeof COLLECTIONS)[number]['id']
