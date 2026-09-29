/**
 * Phase 8B production content pipeline constants (Batch 250).
 */

export const CONTENT_GENERATOR_VERSION = 'prod-v2' as const
export const CONTENT_CATALOG_VERSION = '2026.1-b250-r1' as const

/** Rejected human-review baseline (Phase 8A Pilot R1). */
export const PILOT_R1_REJECTED_CHECKSUM =
	'456c3b87cf32c3a617f37d8cd1f5ccf518c51df85095ec026ed001971b072bc9' as const
export const PILOT_R1_HUMAN_STATUS = 'HUMAN REVIEW: NOT APPROVED' as const

/** R2 candidate baseline checksum for comparison reports. */
export const PILOT_R2_CHECKSUM =
	'd7c7c6fbe5838dec67ae8343d1169c814a9c302fc4954677e2f2f478f659f19c' as const

export const B250_TARGET = 250 as const
/** Alias kept for older selection helpers / tests. */
export const PILOT_TARGET = B250_TARGET

export const B250_TIER_QUOTA = Object.freeze({
	BEGINNER: 25,
	EASY: 63,
	MEDIUM: 74,
	HARD: 63,
	EXPERT: 25,
})
/** Alias kept for older selection helpers / tests. */
export const PILOT_TIER_QUOTA = B250_TIER_QUOTA

/** Soft near-duplicate report threshold (not auto-reject). */
export const NEAR_SIMILARITY_REPORT = 0.92
/** Soft review target for near-duplicate pairs (B250). */
export const NEAR_DUPLICATE_PAIR_TARGET = 12

export const MAX_CANDIDATE_ATTEMPTS = 4000

/** Diversity hard gates (Batch 250). */
export const MIN_DISTINCT_CONCEPTS = 220
export const MAX_CONCEPT_FREQUENCY = 2
export const MAX_PATTERN_COUNT = 25
export const MAX_PATTERN_SHARE = 0.1
export const MAX_EXPERT_PATTERN_COUNT = 8
export const MAX_FAMILY_SHARE = 0.05
export const MAX_COLLECTION_SHARE_WARN = 0.15
export const MIN_ACTIVE_COLLECTION_SIZE = 3
export const MAX_COLLECTION_COUNT_SOFT = 20

export type ContentRole = 'production' | 'tutorial' | 'dev'

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
	{ id: 'tools', titleRu: 'Инструменты', displayOrder: 18 },
	{ id: 'weather', titleRu: 'Погода', displayOrder: 19 },
	{ id: 'travel', titleRu: 'Путешествия', displayOrder: 20 },
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
