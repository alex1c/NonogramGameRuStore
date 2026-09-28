/**
 * Deterministic difficulty analysis (Phase 2 calibration model).
 *
 * Does not invent precision: raw score is an explicit weighted mix of observable
 * solver/content factors. STALLED / INVALID / non-unique puzzles are UNRATED.
 */

import { SolutionCell, type Puzzle, type PuzzleSpec } from '../nonogram/types'
import { puzzleToSpec, solveComplete } from '../../solver/completeSolver'
import {
	solveLogically,
	type DeductionReason,
	type LogicalStatus,
	type ReasonCounts,
} from '../../solver/logicalSolver'
import { analyzeInitialForced } from './initialForced'
import {
	DIFFICULTY_MODEL_VERSION,
	DIFFICULTY_THRESHOLDS_V1,
	DIFFICULTY_WEIGHTS_V1,
} from './thresholds'
import type { DifficultyRating, DifficultyTier } from './tiers'

export interface ClueComplexityStats {
	readonly totalRuns: number
	readonly multiRunLines: number
	readonly multiRunLineRatio: number
	readonly maxRunsOnLine: number
	readonly averageRunsPerLine: number
}

export interface DifficultyFactorScores {
	readonly size: number
	readonly clue: number
	readonly effort: number
	readonly initialGap: number
	readonly hardReason: number
}

export interface DifficultyAnalysis {
	readonly modelVersion: typeof DIFFICULTY_MODEL_VERSION
	readonly score: number | null
	readonly tier: DifficultyRating
	readonly width: number
	readonly height: number
	readonly cellCount: number
	readonly filledRatio: number
	readonly clueComplexity: ClueComplexityStats
	readonly logicalStatus: LogicalStatus | 'SKIPPED'
	readonly logicalSteps: number
	readonly deductionCount: number
	readonly iterations: number
	readonly reasonCounts: ReasonCounts
	readonly hardestReason: DeductionReason | null
	readonly initialForcedCells: number
	readonly initialForcedRatio: number
	readonly initialLinesWithForce: number
	readonly factors: DifficultyFactorScores | null
	readonly unique: boolean
	readonly notes: string
}

function clamp01(value: number): number {
	if (value < 0) {
		return 0
	}
	if (value > 1) {
		return 1
	}
	return value
}

function collectClueComplexity(spec: PuzzleSpec): ClueComplexityStats {
	const lines = [...spec.rowClues, ...spec.columnClues]
	let totalRuns = 0
	let multiRunLines = 0
	let maxRunsOnLine = 0
	for (const clue of lines) {
		totalRuns += clue.length
		if (clue.length > 1) {
			multiRunLines += 1
		}
		if (clue.length > maxRunsOnLine) {
			maxRunsOnLine = clue.length
		}
	}
	return {
		totalRuns,
		multiRunLines,
		multiRunLineRatio: lines.length === 0 ? 0 : multiRunLines / lines.length,
		maxRunsOnLine,
		averageRunsPerLine: lines.length === 0 ? 0 : totalRuns / lines.length,
	}
}

function filledRatioOf(puzzle: Puzzle): number {
	let filled = 0
	for (const cell of puzzle.solution) {
		if (cell === SolutionCell.FILLED) {
			filled += 1
		}
	}
	return puzzle.solution.length === 0
		? 0
		: filled / puzzle.solution.length
}

function filledRatioFromSpec(spec: PuzzleSpec, uniqueSolution: readonly number[] | undefined): number {
	if (uniqueSolution !== undefined) {
		const filled = uniqueSolution.reduce((sum, cell) => sum + cell, 0)
		return uniqueSolution.length === 0 ? 0 : filled / uniqueSolution.length
	}
	const lineCells = spec.width * spec.height
	const filled = spec.rowClues.reduce(
		(sum, clue) => sum + clue.reduce((inner, run) => inner + run, 0),
		0,
	)
	return lineCells === 0 ? 0 : filled / lineCells
}

function pickHardestReason(counts: ReasonCounts): DeductionReason | null {
	const order: DeductionReason[] = [
		'impossible_positions_eliminated',
		'overlap',
		'forced_filled',
		'forced_empty',
		'completed_line',
	]
	for (const reason of order) {
		if (counts[reason] > 0) {
			return reason
		}
	}
	return null
}

function scoreFromFactors(factors: DifficultyFactorScores): number {
	const w = DIFFICULTY_WEIGHTS_V1
	const raw =
		100 *
		(w.size * factors.size +
			w.clue * factors.clue +
			w.effort * factors.effort +
			w.initialGap * factors.initialGap +
			w.hardReason * factors.hardReason)
	return Math.round(raw * 100) / 100
}

function tierFromScore(score: number): DifficultyTier {
	if (score >= DIFFICULTY_THRESHOLDS_V1.EXPERT) {
		return 'EXPERT'
	}
	if (score >= DIFFICULTY_THRESHOLDS_V1.HARD) {
		return 'HARD'
	}
	if (score >= DIFFICULTY_THRESHOLDS_V1.MEDIUM) {
		return 'MEDIUM'
	}
	if (score >= DIFFICULTY_THRESHOLDS_V1.EASY) {
		return 'EASY'
	}
	return 'BEGINNER'
}

function unrated(
	partial: Omit<
		DifficultyAnalysis,
		| 'modelVersion'
		| 'score'
		| 'tier'
		| 'factors'
		| 'notes'
	> & { notes: string },
): DifficultyAnalysis {
	return {
		modelVersion: DIFFICULTY_MODEL_VERSION,
		score: null,
		tier: 'UNRATED',
		factors: null,
		...partial,
	}
}

/**
 * Analyze difficulty for an authored puzzle.
 * Uses clue-derived logical solve; solution bitmap only for filled-ratio stats
 * when unique/logical path is available (never to force cells).
 */
export function analyzeDifficulty(puzzle: Puzzle): DifficultyAnalysis {
	return analyzeDifficultySpec(puzzleToSpec(puzzle), {
		filledRatio: filledRatioOf(puzzle),
	})
}

export function analyzeDifficultySpec(
	spec: PuzzleSpec,
	options: { readonly filledRatio?: number } = {},
): DifficultyAnalysis {
	const cellCount = spec.width * spec.height
	const clueComplexity = collectClueComplexity(spec)
	const initial = analyzeInitialForced(spec)

	let complete
	let logical
	try {
		complete = solveComplete(spec, { maxSolutions: 2 })
		logical = solveLogically(spec)
	} catch (error) {
		return unrated({
			width: spec.width,
			height: spec.height,
			cellCount,
			filledRatio: options.filledRatio ?? 0,
			clueComplexity,
			logicalStatus: 'SKIPPED',
			logicalSteps: 0,
			deductionCount: 0,
			iterations: 0,
			reasonCounts: {
				overlap: 0,
				completed_line: 0,
				impossible_positions_eliminated: 0,
				forced_filled: 0,
				forced_empty: 0,
			},
			hardestReason: null,
			initialForcedCells: initial.forcedCells,
			initialForcedRatio: initial.forcedRatio,
			initialLinesWithForce: initial.linesWithForce,
			unique: false,
			notes:
				error instanceof Error
					? error.message
					: 'Difficulty analysis failed',
		})
	}

	const filledRatio =
		options.filledRatio ??
		filledRatioFromSpec(spec, complete.solutions[0])

	const base = {
		width: spec.width,
		height: spec.height,
		cellCount,
		filledRatio,
		clueComplexity,
		logicalStatus: logical.status,
		logicalSteps: logical.steps.length,
		deductionCount: logical.deductionCount,
		iterations: logical.iterations,
		reasonCounts: logical.telemetry.reasonCounts,
		hardestReason: pickHardestReason(logical.telemetry.reasonCounts),
		initialForcedCells: initial.forcedCells,
		initialForcedRatio: initial.forcedRatio,
		initialLinesWithForce: initial.linesWithForce,
		unique: complete.unique,
	}

	if (complete.solutionCount === 0 || logical.status === 'INVALID') {
		return unrated({
			...base,
			notes: 'Invalid or contradictory puzzle — UNRATED',
		})
	}

	if (!complete.unique) {
		return unrated({
			...base,
			notes: 'Ambiguous puzzle — UNRATED (not production)',
		})
	}

	if (logical.status === 'STALLED') {
		return unrated({
			...base,
			notes:
				'Logical solver STALLED — UNRATED (not EXPERT; needs stronger techniques or is production-ineligible)',
		})
	}

	const sizeFactor = clamp01(Math.log2(Math.max(cellCount, 2)) / Math.log2(225))
	const clueFactor = clamp01(
		0.45 * clueComplexity.multiRunLineRatio +
			0.35 * Math.min(clueComplexity.averageRunsPerLine / 3, 1) +
			0.2 * Math.min(clueComplexity.maxRunsOnLine / 4, 1),
	)

	// Prefer non-trivial deductions over sheer completed_line painting volume.
	const nonTrivialSteps =
		logical.steps.length -
		logical.telemetry.reasonCounts.completed_line
	const stepsPerCell = Math.max(nonTrivialSteps, 0) / Math.max(cellCount, 1)
	const deductionsPerCell =
		logical.deductionCount / Math.max(cellCount, 1)
	const iterationDepth = logical.iterations / Math.max(cellCount, 1)
	const rawEffort = clamp01(
		0.45 * Math.min(stepsPerCell / 0.35, 1) +
			0.3 * Math.min(deductionsPerCell / 1.0, 1) +
			0.25 * Math.min(iterationDepth / 0.45, 1),
	)
	// High initial information dampens effort — otherwise tiny full-clue
	// puzzles look artificially hard from completed_line churn.
	const effortFactor = clamp01(
		rawEffort * (0.35 + 0.65 * (1 - initial.forcedRatio)),
	)
	const initialGap = clamp01(1 - initial.forcedRatio)
	const hardSteps =
		logical.telemetry.reasonCounts.overlap +
		logical.telemetry.reasonCounts.impossible_positions_eliminated +
		logical.telemetry.reasonCounts.forced_filled
	const hardReasonFactor = clamp01(
		logical.steps.length === 0 ? 0 : hardSteps / logical.steps.length,
	)

	const factors: DifficultyFactorScores = {
		size: sizeFactor,
		clue: clueFactor,
		effort: effortFactor,
		initialGap,
		hardReason: hardReasonFactor,
	}
	const score = scoreFromFactors(factors)

	return {
		modelVersion: DIFFICULTY_MODEL_VERSION,
		score,
		tier: tierFromScore(score),
		factors,
		notes: 'Rated under phase2-v1 preliminary calibration',
		...base,
	}
}
