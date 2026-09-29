/**
 * Hint engine types — UI-independent, clue-only (no authored solution).
 */

import type { DeductionReason, LineOrientation } from '../solver/logicalSolver'

export type HintAction = 'FILLED' | 'CROSSED'

export interface HintTargetCell {
	readonly row: number
	readonly col: number
}

export interface HintProofSummary {
	readonly reason: DeductionReason
	readonly candidateCount: number
	readonly forcedCount: number
	/** Single-run length when reason is classic overlap; otherwise null. */
	readonly runLength: number | null
}

/**
 * One pedagogical logical step (single action, one line, one reason).
 * Immutable contract — UI must not mutate.
 */
export interface HintStep {
	readonly orientation: LineOrientation
	readonly lineIndex: number
	readonly clue: readonly number[]
	readonly action: HintAction
	readonly targets: readonly HintTargetCell[]
	readonly reason: DeductionReason
	readonly proof: HintProofSummary
	/** Session revision when this step was computed (stale guard). */
	readonly revision: number
}

export type HintResult =
	| {
			readonly kind: 'STEP'
			readonly step: HintStep
	  }
	| {
			readonly kind: 'CONTRADICTION'
			readonly orientation: LineOrientation | null
			readonly lineIndex: number | null
			readonly clue: readonly number[] | null
	  }
	| { readonly kind: 'STALLED' }
	| { readonly kind: 'COMPLETE' }

/** Prefer simpler pedagogy for ordinary Hint vs Teach Me. */
export type HintMode = 'HINT' | 'TEACH'
