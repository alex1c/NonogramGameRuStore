/**
 * Nonogram solver performance / diagnostic harness.
 *
 * Run: npm run audit:solver
 * Not part of the Jest gate — diagnostic only.
 */

import {
	FIXTURE_A_SIMPLE_5X5,
	FIXTURE_PERF_10,
	buildPerf15,
	buildPerf20,
} from '../src/tests/fixtures/nonogramFixtures'
import { puzzleToSpec, solveComplete } from '../src/solver/completeSolver'
import { solveLogically } from '../src/solver/logicalSolver'
import type { Puzzle } from '../src/domain/nonogram/types'

interface Row {
	name: string
	size: string
	completeMs: number
	logicalMs: number
	solutions: number
	logicalStatus: string
	deductions: number
	iterations: number
}

function measure(puzzle: Puzzle): Row {
	const spec = puzzleToSpec(puzzle)

	const completeStarted = performance.now()
	const complete = solveComplete(spec, { maxSolutions: 2 })
	const completeMs = performance.now() - completeStarted

	const logicalStarted = performance.now()
	const logical = solveLogically(spec)
	const logicalMs = performance.now() - logicalStarted

	return {
		name: puzzle.id,
		size: `${puzzle.width}x${puzzle.height}`,
		completeMs,
		logicalMs,
		solutions: complete.solutionCount,
		logicalStatus: logical.status,
		deductions: logical.deductionCount,
		iterations: logical.iterations,
	}
}

function main(): void {
	const puzzles: Puzzle[] = [
		FIXTURE_A_SIMPLE_5X5,
		FIXTURE_PERF_10,
		buildPerf15(),
		buildPerf20(),
	]

	const rows = puzzles.map(measure)

	console.log('Nonogram solver audit')
	console.log(
		'Puzzle | Size | Complete(ms) | Logical(ms) | Solutions<=2 | Logical status | Deductions | Iterations',
	)
	for (const row of rows) {
		console.log(
			[
				row.name,
				row.size,
				row.completeMs.toFixed(2),
				row.logicalMs.toFixed(2),
				String(row.solutions),
				row.logicalStatus,
				String(row.deductions),
				String(row.iterations),
			].join(' | '),
		)
	}
}

main()
