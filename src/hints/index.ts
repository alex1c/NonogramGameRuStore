/**
 * Hints barrel — engine / explain / apply (no React, no solution).
 */

export { getHint } from './engine'
export type { GetHintInput } from './engine'
export { explainHintCompact, explainTeachMe, explainHintResult, formatHintAction, lineContextForStep } from './explain'
export type { HintExplanation, LinePlayerContext } from './explain'
export { applyHintStep } from './apply'
export type { ApplyHintOutcome } from './apply'
export { playerStateToSolverGrid } from './playerGrid'
export type {
	HintAction,
	HintMode,
	HintResult,
	HintStep,
	HintTargetCell,
	HintProofSummary,
} from './types'
export { normalizeLogicalStep, selectPedagogicalStep } from './normalize'
