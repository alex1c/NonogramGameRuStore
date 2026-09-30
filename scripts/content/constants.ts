/**
 * Phase 8C production content pipeline constants (scale-up to B1000).
 * Active catalog version points at the latest scale checkpoint target.
 */

export const CONTENT_GENERATOR_VERSION = 'prod-v2.2' as const
/** Active / final Phase 8C candidate catalog. */
export const CONTENT_CATALOG_VERSION = '2026.1-b1000-r1' as const

/** B250-R2 accepted baseline for additive scale-up (Phase 8B.1). */
export const B250_R2_CHECKSUM =
	'16390efd17651c127263833061b84442dfbe3947c15874cbc38513aab2d4d3b2' as const
export const B250_R2_CATALOG_VERSION = '2026.1-b250-r2' as const
export const B250_R2_GENERATOR_VERSION = 'prod-v2.1' as const

/** B250-R1 human-review baseline (Phase 8B) — do not overwrite. */
export const B250_R1_CHECKSUM =
	'33d229c661ce7f2c4562bcd9ef825c049ca302e2bad85a6e86ff7b5b3bf2ead8' as const

/** Rejected human-review baseline (Phase 8A Pilot R1). */
export const PILOT_R1_REJECTED_CHECKSUM =
	'456c3b87cf32c3a617f37d8cd1f5ccf518c51df85095ec026ed001971b072bc9' as const
export const PILOT_R1_HUMAN_STATUS = 'HUMAN REVIEW: NOT APPROVED' as const

/** R2 candidate baseline checksum for comparison reports. */
export const PILOT_R2_CHECKSUM =
	'd7c7c6fbe5838dec67ae8343d1169c814a9c302fc4954677e2f2f478f659f19c' as const

/** Soft near-duplicate report threshold (not auto-reject). */
export const NEAR_SIMILARITY_REPORT = 0.92
/** Soft near-duplicate absolute pair target for B250-R2 era (informational). */
export const NEAR_DUPLICATE_PAIR_TARGET = 25

export const B250_TARGET = 250 as const
export const B500_TARGET = 500 as const
export const B750_TARGET = 750 as const
export const B1000_TARGET = 1000 as const
/** Alias kept for older selection helpers / tests. */
export const PILOT_TARGET = B250_TARGET

export const B250_TIER_QUOTA = Object.freeze({
	BEGINNER: 25,
	EASY: 63,
	MEDIUM: 74,
	HARD: 63,
	EXPERT: 25,
})
export const B500_TIER_QUOTA = Object.freeze({
	BEGINNER: 50,
	EASY: 125,
	MEDIUM: 150,
	HARD: 125,
	EXPERT: 50,
})
export const B750_TIER_QUOTA = Object.freeze({
	BEGINNER: 75,
	EASY: 188,
	MEDIUM: 224,
	HARD: 188,
	EXPERT: 75,
})
export const B1000_TIER_QUOTA = Object.freeze({
	BEGINNER: 100,
	EASY: 250,
	MEDIUM: 300,
	HARD: 250,
	EXPERT: 100,
})
/** Alias kept for older selection helpers / tests. */
export const PILOT_TIER_QUOTA = B250_TIER_QUOTA

export const SCALE_CATALOG_VERSIONS = Object.freeze({
	b250r2: '2026.1-b250-r2',
	b500: '2026.1-b500-r1',
	b750: '2026.1-b750-r1',
	b1000: '2026.1-b1000-r1',
} as const)

export const MAX_CANDIDATE_ATTEMPTS = 12_000

/** Diversity hard gates — Batch 250 defaults (scale-up overrides via select options). */
export const MIN_DISTINCT_CONCEPTS = 220
export const MIN_DISTINCT_CONCEPTS_B1000 = 900
export const MAX_CONCEPT_FREQUENCY = 2
export const MAX_PATTERN_COUNT = 25
export const MAX_PATTERN_COUNT_B1000 = 100
export const MAX_PATTERN_SHARE = 0.1
export const MAX_EXPERT_PATTERN_COUNT = 8
export const MAX_EXPERT_PATTERN_COUNT_B1000 = 30
export const MAX_FAMILY_SHARE = 0.05
export const MAX_COLLECTION_SHARE_WARN = 0.15
export const MIN_ACTIVE_COLLECTION_SIZE = 3
export const MAX_COLLECTION_COUNT_SOFT = 25

/** B250-R2 risk baseline for scale-up regression checks (from 8B.1 report). */
export const B250_R2_RISK_BASELINE = Object.freeze({
	median: 0,
	p90: 0.27,
	p95: 0.48,
	max: 0.65,
})
/** Relative increase vs baseline that triggers STOP (8C.49). */
export const RISK_REGRESSION_RELATIVE = 0.3

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
