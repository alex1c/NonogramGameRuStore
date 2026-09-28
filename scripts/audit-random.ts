/**
 * Optional seeded random bitmap stress for solver/validator.
 * Not part of the production catalog.
 *
 * Run: npm run audit:random
 */

import {
	createPuzzleFromSolution,
	gridFromMatrix,
} from '../src/domain/nonogram/clues'
import { puzzleToSpec, solveComplete } from '../src/solver/completeSolver'
import { validatePuzzle } from '../src/solver/validator'

/** Small deterministic LCG — no Math.random(). */
function createSeededRng(seed: number): () => number {
	let state = seed >>> 0
	return () => {
		state = (1664525 * state + 1013904223) >>> 0
		return state / 0x100000000
	}
}

function main(): void {
	const seed = 20260928
	const rng = createSeededRng(seed)
	const sizes = [5, 6, 7, 8]
	let checked = 0
	let uniqueLogical = 0

	console.log(`Seeded random audit seed=${seed}`)

	for (let n = 0; n < 24; n += 1) {
		const size = sizes[n % sizes.length]!
		const matrix: number[][] = []
		for (let row = 0; row < size; row += 1) {
			const line: number[] = []
			for (let col = 0; col < size; col += 1) {
				line.push(rng() < 0.45 ? 1 : 0)
			}
			matrix.push(line)
		}

		const puzzle = createPuzzleFromSolution({
			id: `random-${seed}-${n}`,
			width: size,
			height: size,
			solution: gridFromMatrix(matrix),
		})
		const complete = solveComplete(puzzleToSpec(puzzle), { maxSolutions: 2 })
		const validation = validatePuzzle(puzzle)
		checked += 1
		if (validation.unique && validation.logicallySolvable) {
			uniqueLogical += 1
		}

		// Invariant: clues regenerated from solution always match stored clues.
		if (!validation.valid && validation.issues.some((i) => i.code.includes('CLUES_MISMATCH'))) {
			throw new Error(`Clue mismatch on ${puzzle.id}`)
		}

		console.log(
			`${puzzle.id} ${size}x${size} unique=${complete.unique} logical=${validation.logicallySolvable} ready=${validation.productionReady}`,
		)
	}

	console.log(`checked=${checked} unique+logical=${uniqueLogical}`)
}

main()
