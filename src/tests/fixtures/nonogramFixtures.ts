/**
 * Hand-checked Phase 1 fixtures for nonogram domain / solver tests.
 *
 * Letters A–I match the Phase 1 checklist in the project brief.
 */

import {
	createPuzzleFromSolution,
	gridFromMatrix,
} from '../../domain/nonogram/clues'
import type { Puzzle, PuzzleSpec } from '../../domain/nonogram/types'

/** A — simplest 5×5 heart-like blob (unique + logically solvable). */
export const FIXTURE_A_SIMPLE_5X5: Puzzle = createPuzzleFromSolution({
	id: 'fixture-a-simple-5x5',
	width: 5,
	height: 5,
	solution: gridFromMatrix([
		[0, 1, 1, 1, 0],
		[1, 1, 1, 1, 1],
		[1, 1, 1, 1, 1],
		[0, 1, 1, 1, 0],
		[0, 0, 1, 0, 0],
	]),
	metadata: { title: 'Simple 5x5', difficulty: 'easy' },
})

/** B — multiple blocks appear in at least one row and column. */
export const FIXTURE_B_MULTI_BLOCK: Puzzle = createPuzzleFromSolution({
	id: 'fixture-b-multi-block',
	width: 7,
	height: 5,
	solution: gridFromMatrix([
		[1, 1, 0, 1, 0, 1, 1],
		[1, 0, 0, 0, 0, 0, 1],
		[1, 1, 1, 0, 1, 1, 1],
		[0, 0, 1, 0, 1, 0, 0],
		[1, 0, 1, 0, 1, 0, 1],
	]),
	metadata: { title: 'Multi-block rectangular' },
})

/** C — contains a fully empty row and a fully empty column. */
export const FIXTURE_C_EMPTY_LINE: Puzzle = createPuzzleFromSolution({
	id: 'fixture-c-empty-line',
	width: 4,
	height: 4,
	solution: gridFromMatrix([
		[1, 1, 0, 1],
		[0, 0, 0, 0],
		[1, 0, 0, 1],
		[1, 1, 0, 0],
	]),
	metadata: { title: 'Empty row and column', notes: 'row1 empty, col2 empty' },
})

/** D — contains a fully filled row (and column where applicable). */
export const FIXTURE_D_FULL_LINE: Puzzle = createPuzzleFromSolution({
	id: 'fixture-d-full-line',
	width: 5,
	height: 4,
	solution: gridFromMatrix([
		[1, 1, 1, 1, 1],
		[1, 0, 1, 0, 1],
		[1, 1, 1, 1, 1],
		[0, 1, 0, 1, 0],
	]),
	metadata: { title: 'Fully filled rows' },
})

/** E — unique solution (also used as a uniqueness positive case). */
export const FIXTURE_E_UNIQUE: Puzzle = FIXTURE_A_SIMPLE_5X5

/**
 * F — intentionally ambiguous clue set (multiple solutions).
 * Spec only — no single authored solution is claimed.
 */
export const FIXTURE_F_AMBIGUOUS: PuzzleSpec = {
	width: 2,
	height: 2,
	rowClues: [[1], [1]],
	columnClues: [[1], [1]],
}

/**
 * G — contradictory / impossible clue set (sums match, zero solutions).
 * Full top/bottom rows force every column to already have 2 filled cells.
 * Column clues [3]/[1]/[3] then force the middle row to be 1 0 1, which is
 * [1,1], contradicting middle-row clue [1].
 */
export const FIXTURE_G_IMPOSSIBLE: PuzzleSpec = {
	width: 3,
	height: 3,
	rowClues: [[3], [1], [3]],
	columnClues: [[3], [1], [3]],
}

/** G2 — structurally invalid clue that cannot fit the line length. */
export const FIXTURE_G_STRUCTURALLY_INVALID: PuzzleSpec = {
	width: 2,
	height: 2,
	rowClues: [[3], []],
	columnClues: [[1], [1]],
}

/** H — logical solver must fully solve without guessing. */
export const FIXTURE_H_LOGICAL: Puzzle = createPuzzleFromSolution({
	id: 'fixture-h-logical',
	width: 5,
	height: 5,
	solution: gridFromMatrix([
		[1, 1, 1, 1, 1],
		[1, 0, 0, 0, 1],
		[1, 0, 1, 0, 1],
		[1, 0, 0, 0, 1],
		[1, 1, 1, 1, 1],
	]),
	metadata: { title: 'Frame logically solvable' },
})

/**
 * I — unique puzzle that Phase 1 logical techniques leave STALLED.
 *
 * Enumerated and verified: complete solver finds exactly one solution, while
 * line-candidate intersection reaches a fixed point with unknowns remaining.
 */
export const FIXTURE_I_STALLED_UNIQUE: Puzzle = createPuzzleFromSolution({
	id: 'fixture-i-stalled-unique',
	width: 4,
	height: 4,
	solution: gridFromMatrix([
		[1, 0, 0, 1],
		[0, 1, 1, 0],
		[0, 0, 0, 0],
		[0, 0, 0, 0],
	]),
	metadata: {
		title: 'Unique but logically stalled',
		notes: 'Requires search beyond Phase 1 line-forcing techniques',
	},
})

/** 10×10 logically easy rectangle for the performance harness. */
export const FIXTURE_PERF_10: Puzzle = createPuzzleFromSolution({
	id: 'perf-10x10-diamond',
	width: 10,
	height: 10,
	solution: gridFromMatrix([
		[0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
		[0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
		[0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
		[0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
		[1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
		[1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
		[0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
		[0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
		[0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
		[0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
	]),
	metadata: { title: 'Perf 10x10' },
})

/** 15×15 solid border + cross — unique and typically logical. */
export function buildPerf15(): Puzzle {
	const size = 15
	const matrix: number[][] = Array.from({ length: size }, () =>
		Array.from({ length: size }, () => 0),
	)
	for (let i = 0; i < size; i += 1) {
		matrix[0]![i] = 1
		matrix[size - 1]![i] = 1
		matrix[i]![0] = 1
		matrix[i]![size - 1] = 1
		matrix[7]![i] = 1
		matrix[i]![7] = 1
	}
	return createPuzzleFromSolution({
		id: 'perf-15x15-frame-cross',
		width: size,
		height: size,
		solution: gridFromMatrix(matrix),
		metadata: { title: 'Perf 15x15' },
	})
}

/** 20×20 checker-band pattern for optional perf coverage. */
export function buildPerf20(): Puzzle {
	const size = 20
	const matrix: number[][] = Array.from({ length: size }, (_, row) =>
		Array.from({ length: size }, (_, col) => {
			if (row < 2 || row >= size - 2 || col < 2 || col >= size - 2) {
				return 1
			}
			return row % 4 === 0 || col % 4 === 0 ? 1 : 0
		}),
	)
	return createPuzzleFromSolution({
		id: 'perf-20x20-bands',
		width: size,
		height: size,
		solution: gridFromMatrix(matrix),
		metadata: { title: 'Perf 20x20' },
	})
}

export const ALL_SOLUTION_FIXTURES: readonly Puzzle[] = [
	FIXTURE_A_SIMPLE_5X5,
	FIXTURE_B_MULTI_BLOCK,
	FIXTURE_C_EMPTY_LINE,
	FIXTURE_D_FULL_LINE,
	FIXTURE_H_LOGICAL,
]
