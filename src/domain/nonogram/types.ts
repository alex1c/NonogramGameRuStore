/**
 * Core nonogram domain types.
 *
 * Player cell state is intentionally separate from solution cells so that
 * UI / persistence never confuse "what the player marked" with "what is true".
 */

/** Player-facing cell marks on the working grid. */
export enum PlayerCell {
	UNKNOWN = 'UNKNOWN',
	FILLED = 'FILLED',
	CROSSED = 'CROSSED',
}

/**
 * Solution bitmap cell.
 * CROSSED is never part of a solution — empty solution cells are EMPTY.
 */
export enum SolutionCell {
	EMPTY = 0,
	FILLED = 1,
}

/** Row-major solution bitmap. Length must equal width * height. */
export type SolutionGrid = readonly SolutionCell[]

/** Canonical clue for one line (row or column). */
export type ClueLine = readonly number[]

/**
 * Empty-line convention:
 * A line with zero filled cells is represented as `[]` (empty array), NOT `[0]`.
 *
 * Rationale:
 * - Sum(clues) equals the number of filled cells; `[]` sums to 0 naturally.
 * - `[0]` invents a phantom "block of length 0" and complicates candidate generation.
 * - Display layers may still render `0` for empty clues without changing the model.
 */
export const EMPTY_LINE_CLUE: ClueLine = Object.freeze([])

/** Extensible puzzle metadata reserved for later product features. */
export interface PuzzleMetadata {
	readonly title?: string
	readonly category?: string
	readonly difficulty?: string
	readonly collection?: string
	/**
	 * Reserved for future color nonograms. Black-and-white puzzles leave this unset.
	 * Color mode is NOT implemented in Phase 1.
	 */
	readonly colorMode?: 'bw' | 'color'
	readonly source?: string
	readonly notes?: string
}

/**
 * Production puzzle model.
 * Supports rectangular boards (width may differ from height).
 */
export interface Puzzle {
	readonly id: string
	readonly width: number
	readonly height: number
	/** Row-major solution bitmap used for authoring / checking — not consulted by validation solvers. */
	readonly solution: SolutionGrid
	readonly rowClues: readonly ClueLine[]
	readonly columnClues: readonly ClueLine[]
	readonly metadata: PuzzleMetadata
}

/** Dimensions + clues only — input for complete / logical solvers and uniqueness checks. */
export interface PuzzleSpec {
	readonly width: number
	readonly height: number
	readonly rowClues: readonly ClueLine[]
	readonly columnClues: readonly ClueLine[]
}

/** Mutable-looking but immutable player grid snapshot. */
export interface PlayerState {
	readonly width: number
	readonly height: number
	readonly cells: readonly PlayerCell[]
}

/** Versioned serialization envelope for safe persistence. */
export interface SerializedPlayerState {
	readonly version: 1
	readonly width: number
	readonly height: number
	readonly cells: readonly PlayerCell[]
}
