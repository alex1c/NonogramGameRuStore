/**
 * Phase 8A candidate / report shared types.
 */

import type { DifficultyTier } from '../../src/domain/difficulty/tiers'
import type { DeductionReason } from '../../src/solver/logicalSolver'
import type { Bitmap } from './bitmap'
import type { CollectionId } from './constants'

export type ReviewStatus = 'candidate' | 'approved' | 'rejected'
export type ContentKind = 'object' | 'pattern' | 'scene'

export type RejectReason =
	| 'invalid'
	| 'empty_or_full'
	| 'fill_ratio'
	| 'duplicate_id'
	| 'exact_duplicate'
	| 'transform_duplicate'
	| 'not_unique'
	| 'stalled'
	| 'contradiction'
	| 'hint_chain'
	| 'unsound'
	| 'performance'
	| 'structural'
	| 'quota_overflow'
	| 'human_rejected'

export interface RawCandidate {
	readonly id: string
	readonly titleRu: string
	readonly collectionId: CollectionId
	readonly family: string
	readonly variant: string
	readonly kind: ContentKind
	readonly bitmap: Bitmap
	readonly seed: number
	readonly intendedTierHint?: DifficultyTier
}

export interface VisualMetrics {
	readonly fillRatio: number
	readonly filledCells: number
	readonly componentCount: number
	readonly singletons: number
	readonly largestShare: number
	readonly bboxCoverage: number
	readonly emptyRows: number
	readonly emptyCols: number
	readonly touchesBorder: boolean
}

export interface CandidateAuditRecord {
	readonly id: string
	readonly titleRu: string
	readonly collectionId: CollectionId
	readonly family: string
	readonly variant: string
	readonly kind: ContentKind
	readonly width: number
	readonly height: number
	readonly sizeKey: string
	readonly solutionHash: string
	readonly canonicalHash: string
	readonly ascii: string
	readonly reviewStatus: ReviewStatus
	readonly productionReady: boolean
	readonly unique: boolean
	readonly logicallySolvable: boolean
	readonly hintChainSolved: boolean
	readonly logicalStatus: string
	readonly hintStatus: string
	readonly tier: DifficultyTier | 'UNRATED'
	readonly score: number | null
	readonly intendedTierHint: DifficultyTier | null
	readonly fillRatio: number
	readonly componentCount: number
	readonly singletons: number
	readonly largestShare: number
	readonly bboxCoverage: number
	readonly emptyRows: number
	readonly emptyCols: number
	readonly touchesBorder: boolean
	readonly completeMs: number
	readonly logicalMs: number
	readonly hintMs: number
	readonly hintSteps: number
	readonly hintCells: number
	readonly hintReasons: Readonly<Record<string, number>>
	readonly logicalReasons: Readonly<Record<string, number>>
	readonly dailyEligible: boolean
	readonly rejectReason: RejectReason | null
	readonly seed: number
}

export interface SimilarityPair {
	readonly idA: string
	readonly titleA: string
	readonly idB: string
	readonly titleB: string
	readonly sizeKey: string
	readonly similarity: number
}

export interface PilotManifestPuzzle {
	readonly id: string
	readonly titleRu: string
	readonly collectionId: CollectionId
	readonly family: string
	readonly variant: string
	readonly kind: ContentKind
	readonly width: number
	readonly height: number
	readonly ascii: string
	readonly solutionHash: string
	readonly canonicalHash: string
	readonly tier: DifficultyTier
	readonly score: number
	readonly difficultyModelVersion: string
	readonly dailyEligible: boolean
	readonly reviewStatus: ReviewStatus
	readonly seed: number
	readonly rowClues: readonly (readonly number[])[]
	readonly columnClues: readonly (readonly number[])[]
}

export interface PilotManifest {
	readonly catalogVersion: string
	readonly generatorVersion: string
	readonly reportVersion: 1
	readonly reviewStatus: 'candidate'
	readonly puzzleCount: number
	readonly checksum: string
	readonly puzzles: readonly PilotManifestPuzzle[]
}

export type HintReasonMap = Readonly<Partial<Record<DeductionReason, number>>>
