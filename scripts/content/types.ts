/**
 * Phase 8A / 8A.1 candidate / report shared types.
 */

import type { DifficultyTier } from '../../src/domain/difficulty/tiers'
import type { DeductionReason } from '../../src/solver/logicalSolver'
import type { Bitmap } from './bitmap'
import type { CollectionId } from './constants'

export type ReviewStatus = 'candidate' | 'approved' | 'rejected'
export type ContentKind = 'object' | 'pattern' | 'scene' | 'symbol'
export type SourceKind = 'authored' | 'procedural'
export type ContentRole = 'production' | 'tutorial' | 'dev'

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
	| 'missing_concept'
	| 'invalid_composition'
	| 'reward_quality'
	| 'wrong_role'

export type StructuralWarning =
	| 'tiny_bbox'
	| 'extreme_fill'
	| 'singleton_heavy'
	| 'many_components'
	| 'simple_high_tier'
	| 'large_easy_tier'
	| 'needs_human_recognizability_review'
	| 'line_like'
	| 'tiny_trivial'
	| 'noise_like'

export interface RawCandidate {
	readonly id: string
	readonly titleRu: string
	readonly collectionId: CollectionId
	readonly conceptId: string
	readonly compositionId: string
	readonly family: string
	readonly variant: string
	readonly kind: ContentKind
	readonly sourceKind: SourceKind
	readonly contentRole: ContentRole
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
	readonly conceptId: string
	readonly compositionId: string
	readonly family: string
	readonly variant: string
	readonly kind: ContentKind
	readonly sourceKind: SourceKind
	readonly contentRole: ContentRole
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
	readonly warnings: readonly StructuralWarning[]
	readonly needsHumanRecognizabilityReview: boolean
	readonly rewardQualityStructuralPass: boolean
	readonly rewardQualityFlags: readonly string[]
	/** Selection skip reason when valid but not chosen. */
	readonly notSelectedReason: string | null
}

export interface SimilarityPair {
	readonly idA: string
	readonly titleA: string
	readonly conceptA: string
	readonly idB: string
	readonly titleB: string
	readonly conceptB: string
	readonly sizeKey: string
	readonly similarity: number
}

export interface PilotManifestPuzzle {
	readonly id: string
	readonly titleRu: string
	readonly collectionId: CollectionId
	readonly conceptId: string
	readonly compositionId: string
	readonly family: string
	readonly variant: string
	readonly kind: ContentKind
	readonly sourceKind: SourceKind
	readonly contentRole: ContentRole
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
	readonly warnings: readonly StructuralWarning[]
	readonly rowClues: readonly (readonly number[])[]
	readonly columnClues: readonly (readonly number[])[]
}

export interface PilotManifest {
	readonly catalogVersion: string
	readonly generatorVersion: string
	readonly reportVersion: 2
	readonly reviewStatus: 'candidate'
	readonly puzzleCount: number
	readonly checksum: string
	readonly puzzles: readonly PilotManifestPuzzle[]
}

export type HintReasonMap = Readonly<Partial<Record<DeductionReason, number>>>
