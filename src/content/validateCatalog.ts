/**
 * Catalog-level validation: duplicate IDs + per-puzzle production gate.
 */

import { analyzeDifficulty } from '../domain/difficulty/analyzer'
import { puzzleToSpec, solveComplete } from '../solver/completeSolver'
import { solveLogically } from '../solver/logicalSolver'
import { validateProductionPuzzle } from '../solver/validator'
import type {
	CatalogAuditRow,
	CatalogPuzzle,
	CatalogValidationIssue,
} from './types'

export interface CatalogValidationResult {
	readonly ok: boolean
	readonly issues: readonly CatalogValidationIssue[]
	readonly duplicateIds: readonly string[]
	readonly rows: readonly CatalogAuditRow[]
	readonly summary: CatalogAuditSummary
}

export interface CatalogAuditSummary {
	readonly total: number
	readonly pass: number
	readonly fail: number
	readonly duplicateIds: number
	readonly bySize: Readonly<Record<string, number>>
	readonly byDifficulty: Readonly<Record<string, number>>
	readonly worstId: string | null
	readonly maxCompleteMs: number
	readonly maxLogicalMs: number
	readonly slowestCompleteId: string | null
	readonly slowestLogicalId: string | null
}

function findDuplicateIds(puzzles: readonly CatalogPuzzle[]): string[] {
	const seen = new Map<string, number>()
	for (const puzzle of puzzles) {
		seen.set(puzzle.id, (seen.get(puzzle.id) ?? 0) + 1)
	}
	return [...seen.entries()]
		.filter(([, count]) => count > 1)
		.map(([id]) => id)
		.sort()
}

export function validateCatalog(
	puzzles: readonly CatalogPuzzle[],
): CatalogValidationResult {
	const issues: CatalogValidationIssue[] = []
	const duplicateIds = findDuplicateIds(puzzles)
	for (const id of duplicateIds) {
		issues.push({
			code: 'DUPLICATE_ID',
			message: `Duplicate catalog puzzle id: ${id}`,
			puzzleId: id,
		})
	}

	const rows: CatalogAuditRow[] = []
	const bySize: Record<string, number> = {}
	const byDifficulty: Record<string, number> = {}
	let pass = 0
	let maxCompleteMs = 0
	let maxLogicalMs = 0
	let slowestCompleteId: string | null = null
	let slowestLogicalId: string | null = null
	let worstId: string | null = null
	let worstScore = -1

	for (const puzzle of puzzles) {
		const spec = puzzleToSpec(puzzle)

		const completeStarted = performance.now()
		solveComplete(spec, { maxSolutions: 2 })
		const completeMs = performance.now() - completeStarted

		const logicalStarted = performance.now()
		solveLogically(spec)
		const logicalMs = performance.now() - logicalStarted

		const validation = validateProductionPuzzle(puzzle)
		const difficulty = analyzeDifficulty(puzzle)

		if (!validation.productionReady) {
			issues.push({
				code: 'NOT_PRODUCTION_READY',
				message: `Puzzle ${puzzle.id} failed production gate: ${validation.issues
					.map((issue) => issue.code)
					.join(',')}`,
				puzzleId: puzzle.id,
			})
		} else {
			pass += 1
		}

		const sizeKey = `${puzzle.width}x${puzzle.height}`
		bySize[sizeKey] = (bySize[sizeKey] ?? 0) + 1
		const tierKey = difficulty.tier
		byDifficulty[tierKey] = (byDifficulty[tierKey] ?? 0) + 1

		if (completeMs >= maxCompleteMs) {
			maxCompleteMs = completeMs
			slowestCompleteId = puzzle.id
		}
		if (logicalMs >= maxLogicalMs) {
			maxLogicalMs = logicalMs
			slowestLogicalId = puzzle.id
		}
		if (difficulty.score !== null && difficulty.score >= worstScore) {
			worstScore = difficulty.score
			worstId = puzzle.id
		}

		rows.push({
			id: puzzle.id,
			size: sizeKey,
			tier: difficulty.tier,
			score: difficulty.score,
			unique: validation.unique,
			logicallySolvable: validation.logicallySolvable,
			productionReady: validation.productionReady,
			completeMs,
			logicalMs,
		})
	}

	const notReady = puzzles.length - pass

	return {
		ok: issues.length === 0,
		issues,
		duplicateIds,
		rows,
		summary: {
			total: puzzles.length,
			pass,
			fail: notReady,
			duplicateIds: duplicateIds.length,
			bySize,
			byDifficulty,
			worstId,
			maxCompleteMs,
			maxLogicalMs,
			slowestCompleteId,
			slowestLogicalId,
		},
	}
}
