/**
 * Unified puzzle validation pipeline for production quality gates.
 *
 * Gates of interest:
 * - valid (structure + clues match solution when present)
 * - unique (exactly one solution from clues alone)
 * - logicallySolvable (logical solver reaches SOLVED without guessing)
 */

import {
	generateColumnClues,
	generateRowClues,
} from '../domain/nonogram/clues'
import { assertValidSpec, clueFilledCount } from '../domain/nonogram/grid'
import type { Puzzle, PuzzleSpec } from '../domain/nonogram/types'
import { solveComplete, puzzleToSpec } from './completeSolver'
import { solveLogically, type LogicalStatus } from './logicalSolver'

export interface ValidationIssue {
	readonly code: string
	readonly message: string
}

export interface ValidationResult {
	readonly valid: boolean
	readonly unique: boolean
	readonly logicallySolvable: boolean
	readonly hasSolution: boolean
	readonly solutionCount: number
	readonly logicalStatus: LogicalStatus | 'SKIPPED'
	readonly issues: readonly ValidationIssue[]
}

function cluesEqual(
	a: readonly (readonly number[])[],
	b: readonly (readonly number[])[],
): boolean {
	if (a.length !== b.length) {
		return false
	}
	for (let i = 0; i < a.length; i += 1) {
		const left = a[i]
		const right = b[i]
		if (left === undefined || right === undefined) {
			return false
		}
		if (left.length !== right.length) {
			return false
		}
		for (let j = 0; j < left.length; j += 1) {
			if (left[j] !== right[j]) {
				return false
			}
		}
	}
	return true
}

function validateSpecStructure(spec: PuzzleSpec): ValidationIssue[] {
	const issues: ValidationIssue[] = []
	try {
		assertValidSpec(spec)
	} catch (error) {
		issues.push({
			code: 'INVALID_SPEC',
			message: error instanceof Error ? error.message : String(error),
		})
		return issues
	}

	const rowFilled = spec.rowClues.reduce(
		(sum, clue) => sum + clueFilledCount(clue),
		0,
	)
	const colFilled = spec.columnClues.reduce(
		(sum, clue) => sum + clueFilledCount(clue),
		0,
	)
	if (rowFilled !== colFilled) {
		issues.push({
			code: 'CLUE_SUM_MISMATCH',
			message: `Row filled sum ${rowFilled} !== column filled sum ${colFilled}`,
		})
	}

	return issues
}

/** Validate a clue-only puzzle specification (no authored solution required). */
export function validatePuzzleSpec(spec: PuzzleSpec): ValidationResult {
	const issues = validateSpecStructure(spec)
	if (issues.length > 0) {
		return {
			valid: false,
			unique: false,
			logicallySolvable: false,
			hasSolution: false,
			solutionCount: 0,
			logicalStatus: 'SKIPPED',
			issues,
		}
	}

	const complete = solveComplete(spec, { maxSolutions: 2 })
	const logical = solveLogically(spec)

	if (complete.solutionCount === 0) {
		issues.push({
			code: 'NO_SOLUTION',
			message: 'Clue set admits zero solutions',
		})
	} else if (complete.solutionCount > 1) {
		issues.push({
			code: 'NOT_UNIQUE',
			message: 'Clue set admits more than one solution',
		})
	}

	if (logical.status === 'INVALID') {
		issues.push({
			code: 'LOGICAL_INVALID',
			message: 'Logical solver detected a contradiction',
		})
	} else if (logical.status === 'STALLED') {
		issues.push({
			code: 'NOT_LOGICALLY_SOLVABLE',
			message:
				'Logical solver stalled; puzzle requires guessing beyond Phase 1 techniques',
		})
	}

	const unique = complete.unique
	const logicallySolvable = logical.status === 'SOLVED'

	// Production quality gate: valid structure with at least one solution.
	// unique / logicallySolvable are explicit separate characteristics.
	return {
		valid:
			issues.find((issue) =>
				['INVALID_SPEC', 'CLUE_SUM_MISMATCH', 'NO_SOLUTION', 'LOGICAL_INVALID'].includes(
					issue.code,
				),
			) === undefined && complete.solutionCount >= 1,
		unique,
		logicallySolvable,
		hasSolution: complete.solutionCount >= 1,
		solutionCount: complete.solutionCount,
		logicalStatus: logical.status,
		issues,
	}
}

/**
 * Validate a full authored puzzle (solution + clues).
 * Checks that clues match the solution bitmap, then runs the clue-only pipeline.
 */
export function validatePuzzle(puzzle: Puzzle): ValidationResult {
	const issues: ValidationIssue[] = []

	if (puzzle.width < 1 || puzzle.height < 1) {
		issues.push({
			code: 'INVALID_DIMENSIONS',
			message: `Invalid dimensions ${puzzle.width}x${puzzle.height}`,
		})
	}

	if (puzzle.solution.length !== puzzle.width * puzzle.height) {
		issues.push({
			code: 'SOLUTION_SIZE',
			message: `Solution length ${puzzle.solution.length} !== ${puzzle.width}*${puzzle.height}`,
		})
	}

	if (puzzle.rowClues.length !== puzzle.height) {
		issues.push({
			code: 'ROW_CLUE_COUNT',
			message: 'rowClues length does not match height',
		})
	}

	if (puzzle.columnClues.length !== puzzle.width) {
		issues.push({
			code: 'COLUMN_CLUE_COUNT',
			message: 'columnClues length does not match width',
		})
	}

	if (issues.length === 0) {
		const expectedRows = generateRowClues(
			puzzle.solution,
			puzzle.width,
			puzzle.height,
		)
		const expectedCols = generateColumnClues(
			puzzle.solution,
			puzzle.width,
			puzzle.height,
		)

		if (!cluesEqual(puzzle.rowClues, expectedRows)) {
			issues.push({
				code: 'ROW_CLUES_MISMATCH',
				message: 'rowClues do not match the solution bitmap',
			})
		}
		if (!cluesEqual(puzzle.columnClues, expectedCols)) {
			issues.push({
				code: 'COLUMN_CLUES_MISMATCH',
				message: 'columnClues do not match the solution bitmap',
			})
		}
	}

	if (issues.length > 0) {
		return {
			valid: false,
			unique: false,
			logicallySolvable: false,
			hasSolution: false,
			solutionCount: 0,
			logicalStatus: 'SKIPPED',
			issues,
		}
	}

	const specResult = validatePuzzleSpec(puzzleToSpec(puzzle))

	// When unique, confirm the complete solver's solution matches the authored one.
	if (specResult.unique && specResult.solutionCount === 1) {
		const solved = specResult
		void solved
		const complete = solveComplete(puzzleToSpec(puzzle), { maxSolutions: 2 })
		const only = complete.solutions[0]
		if (only !== undefined) {
			for (let i = 0; i < puzzle.solution.length; i += 1) {
				if (only[i] !== puzzle.solution[i]) {
					return {
						...specResult,
						valid: false,
						issues: [
							...specResult.issues,
							{
								code: 'SOLUTION_MISMATCH',
								message:
									'Unique solver result does not match authored solution',
							},
						],
					}
				}
			}
		}
	}

	return {
		...specResult,
		valid: specResult.valid,
		issues: [...issues, ...specResult.issues],
	}
}
