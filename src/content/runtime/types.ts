/**
 * Compact B1000 runtime catalog types (build-time artifact).
 * No generator / audit / solver imports.
 */

import type { DifficultyTier } from '../../domain/difficulty/tiers'

export interface RuntimeCollectionDef {
	readonly id: string
	readonly titleRu: string
	readonly displayOrder: number
}

export interface RuntimeCampaignSetDef {
	readonly setId: string
	readonly titleRu: string
	readonly displayOrder: number
	readonly puzzleIds: readonly string[]
}

export interface RuntimePuzzleEntry {
	readonly id: string
	readonly titleRu: string
	readonly collectionId: string
	readonly width: number
	readonly height: number
	/** Compact solution bitmap — decode on open, not at startup for all 1000. */
	readonly ascii: string
	readonly rowClues: readonly (readonly number[])[]
	readonly columnClues: readonly (readonly number[])[]
	readonly tier: DifficultyTier
	readonly score: number
	readonly dailyEligible: boolean
	readonly contentFingerprint: string
}

export interface RuntimeCatalogArtifact {
	readonly schemaVersion: 1
	readonly catalogVersion: string
	readonly generatorVersion: string
	readonly checksum: string
	readonly puzzleCount: number
	readonly unlockAfterCompletions: number
	readonly collections: readonly RuntimeCollectionDef[]
	readonly campaignSets: readonly RuntimeCampaignSetDef[]
	readonly dailyEligibleIds: readonly string[]
	readonly puzzles: readonly RuntimePuzzleEntry[]
}
