/**
 * Phase 8A.1 Pilot R2 content pipeline constants.
 */

export const CONTENT_GENERATOR_VERSION = 'prod-v1.1' as const
export const CONTENT_CATALOG_VERSION = '2026.1-pilot-r2' as const

/** Rejected human-review baseline (Phase 8A Pilot R1). */
export const PILOT_R1_REJECTED_CHECKSUM =
	'456c3b87cf32c3a617f37d8cd1f5ccf518c51df85095ec026ed001971b072bc9' as const
export const PILOT_R1_HUMAN_STATUS = 'HUMAN REVIEW: NOT APPROVED' as const

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
/** Soft review target for near-duplicate pairs. */
export const NEAR_DUPLICATE_PAIR_TARGET = 5

export const MAX_CANDIDATE_ATTEMPTS = 2000

/** Diversity hard gates (Pilot R2). */
export const MIN_DISTINCT_CONCEPTS = 80
export const MAX_CONCEPT_FREQUENCY = 2
export const MAX_PATTERN_COUNT = 10
export const MAX_PATTERN_SHARE = 0.1
export const MAX_EXPERT_PATTERN_COUNT = 3
export const MAX_FAMILY_SHARE = 0.05
export const MAX_COLLECTION_SHARE_WARN = 0.18
export const MIN_ACTIVE_COLLECTION_SIZE = 3
export const MAX_COLLECTION_COUNT_SOFT = 15

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
	{ id: 'city', titleRu: 'Город', displayOrder: 10 },
	{ id: 'nature', titleRu: 'Природа', displayOrder: 11 },
	{ id: 'space', titleRu: 'Космос', displayOrder: 12 },
	{ id: 'sport', titleRu: 'Спорт', displayOrder: 13 },
	{ id: 'music', titleRu: 'Музыка', displayOrder: 14 },
	{ id: 'clothing', titleRu: 'Одежда', displayOrder: 15 },
	{ id: 'symbols', titleRu: 'Символы', displayOrder: 16 },
	{ id: 'patterns', titleRu: 'Узоры', displayOrder: 17 },
] as const)

export type CollectionId = (typeof COLLECTIONS)[number]['id']

/**
 * Normalize alternate concept slug spellings to a single semantic id.
 * Not NLP — explicit developer aliases only.
 */
export const CONCEPT_ALIASES: Readonly<Record<string, string>> = Object.freeze({
	kitty: 'cat',
	kitten: 'cat',
	cats: 'cat',
	puppy: 'dog',
	dogs: 'dog',
	ship: 'boat',
	sailboat: 'sailboat',
	mug: 'mug',
	cup: 'cup',
	house: 'house',
	home: 'house',
})

export function normalizeConceptId(raw: string): string {
	const slug = raw.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-')
	return CONCEPT_ALIASES[slug] ?? slug
}
