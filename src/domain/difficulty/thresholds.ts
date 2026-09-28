/**
 * Centralized preliminary difficulty thresholds (Phase 2 calibration v1).
 *
 * Scores are raw composite values from `analyzeDifficulty`. Thresholds may be
 * recalibrated later without changing puzzle content format / IDs.
 *
 * IMPORTANT: these are not objective truth — they are a documented first pass
 * against the Phase 2 calibration fixture set under current line-forcing logic.
 */

import type { DifficultyTier } from './tiers'

export const DIFFICULTY_MODEL_VERSION = 'phase2-v1' as const

/** Weights for the composite raw score (sum ≈ 1). */
export const DIFFICULTY_WEIGHTS_V1 = Object.freeze({
	size: 0.1,
	clue: 0.15,
	effort: 0.33,
	initialGap: 0.3,
	hardReason: 0.12,
})

/**
 * Inclusive lower bounds for each tier (score >= bound).
 * BEGINNER is the residual below EASY.
 *
 * Preliminary — calibrated against Phase 2 fixture/catalog scores under
 * line-candidate intersection only. Expect recalibration when techniques grow.
 */
export const DIFFICULTY_THRESHOLDS_V1: Readonly<
	Record<Exclude<DifficultyTier, 'BEGINNER'>, number>
> = Object.freeze({
	EASY: 28,
	MEDIUM: 42,
	HARD: 55,
	EXPERT: 65,
})
