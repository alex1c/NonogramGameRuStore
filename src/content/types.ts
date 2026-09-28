/**
 * Production content model (Phase 2).
 *
 * Source of truth: the solution bitmap. Clues are generated deterministically
 * at build/import time via `buildCatalogPuzzle`. Manual clue edits are not a
 * supported authoring path — validator still rejects mismatches if present.
 */

import type { DifficultyTier } from '../domain/difficulty/tiers'
import type { Puzzle, PuzzleMetadata, SolutionGrid } from '../domain/nonogram/types'

export const CONTENT_SCHEMA_VERSION = 1 as const

/** Authoring input — solution is required; clues are not accepted as SoT. */
export interface CatalogPuzzleDraft {
	readonly id: string
	readonly schemaVersion: typeof CONTENT_SCHEMA_VERSION
	readonly title: string
	readonly category?: string
	readonly collection?: string
	readonly tags?: readonly string[]
	readonly width: number
	readonly height: number
	/** Row-major 0/1 matrix — source of truth. */
	readonly solutionMatrix: readonly (readonly number[])[]
	readonly provenance?: string
	readonly notes?: string
}

/**
 * Built catalog entry ready for validation / gameplay.
 * `assignedDifficulty` may be filled by content audit after analysis.
 */
export interface CatalogPuzzle extends Puzzle {
	readonly schemaVersion: typeof CONTENT_SCHEMA_VERSION
	readonly title: string
	readonly category: string
	readonly collection: string
	readonly tags: readonly string[]
	readonly provenance?: string
	readonly assignedDifficulty?: DifficultyTier
}

export interface CatalogValidationIssue {
	readonly code: string
	readonly message: string
	readonly puzzleId?: string
}

export interface CatalogAuditRow {
	readonly id: string
	readonly size: string
	readonly tier: string
	readonly score: number | null
	readonly unique: boolean
	readonly logicallySolvable: boolean
	readonly productionReady: boolean
	readonly completeMs: number
	readonly logicalMs: number
}

export type CatalogMetadata = PuzzleMetadata
export type { SolutionGrid }
