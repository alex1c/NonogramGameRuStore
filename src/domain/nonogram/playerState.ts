/**
 * Player working-grid operations.
 *
 * Victory rule: the set of FILLED cells must exactly match the solution FILLED
 * set. CROSSED marks are never required; UNKNOWN/CROSSED on EMPTY solution
 * cells are both acceptable for a correct finished puzzle.
 */

import {
	PlayerCell,
	SolutionCell,
	type PlayerState,
	type Puzzle,
	type SerializedPlayerState,
} from './types'

const SERIALIZATION_VERSION = 1 as const

/** Create an all-UNKNOWN player grid matching puzzle dimensions. */
export function createEmptyPlayerState(
	width: number,
	height: number,
): PlayerState {
	if (width < 1 || height < 1) {
		throw new Error(`Invalid player grid size: ${width}x${height}`)
	}
	return Object.freeze({
		width,
		height,
		cells: Object.freeze(
			Array.from({ length: width * height }, () => PlayerCell.UNKNOWN),
		),
	})
}

function assertInBounds(state: PlayerState, row: number, col: number): number {
	if (
		row < 0 ||
		col < 0 ||
		row >= state.height ||
		col >= state.width
	) {
		throw new Error(
			`Cell out of bounds: (${row},${col}) for ${state.width}x${state.height}`,
		)
	}
	return row * state.width + col
}

function withCell(
	state: PlayerState,
	row: number,
	col: number,
	value: PlayerCell,
): PlayerState {
	const index = assertInBounds(state, row, col)
	if (state.cells[index] === value) {
		return state
	}
	const next = state.cells.slice()
	next[index] = value
	return Object.freeze({
		width: state.width,
		height: state.height,
		cells: Object.freeze(next),
	})
}

export function setFilled(
	state: PlayerState,
	row: number,
	col: number,
): PlayerState {
	return withCell(state, row, col, PlayerCell.FILLED)
}

export function setCrossed(
	state: PlayerState,
	row: number,
	col: number,
): PlayerState {
	return withCell(state, row, col, PlayerCell.CROSSED)
}

export function clearCell(
	state: PlayerState,
	row: number,
	col: number,
): PlayerState {
	return withCell(state, row, col, PlayerCell.UNKNOWN)
}

/**
 * True when every solution FILLED cell is player FILLED and no extra FILLED
 * marks exist. CROSSED / UNKNOWN on EMPTY solution cells do not block completion.
 */
export function isSolutionMatched(
	state: PlayerState,
	puzzle: Puzzle,
): boolean {
	if (state.width !== puzzle.width || state.height !== puzzle.height) {
		return false
	}
	if (state.cells.length !== puzzle.solution.length) {
		return false
	}

	for (let i = 0; i < puzzle.solution.length; i += 1) {
		const solutionCell = puzzle.solution[i]
		const playerCell = state.cells[i]
		if (solutionCell === undefined || playerCell === undefined) {
			return false
		}

		if (solutionCell === SolutionCell.FILLED) {
			if (playerCell !== PlayerCell.FILLED) {
				return false
			}
		} else if (playerCell === PlayerCell.FILLED) {
			return false
		}
	}

	return true
}

/**
 * "Completed" means the player has settled every cell that must be FILLED and
 * has not marked any EMPTY solution cell as FILLED. Remaining EMPTY solution
 * cells may stay UNKNOWN or CROSSED.
 */
export function isPuzzleComplete(
	state: PlayerState,
	puzzle: Puzzle,
): boolean {
	return isSolutionMatched(state, puzzle)
}

/** Alias emphasizing correctness of the filled set vs the authored solution. */
export function isFilledSetCorrect(
	state: PlayerState,
	puzzle: Puzzle,
): boolean {
	return isSolutionMatched(state, puzzle)
}

/** Serialize player state into a versioned plain object safe for JSON storage. */
export function serializePlayerState(
	state: PlayerState,
): SerializedPlayerState {
	return Object.freeze({
		version: SERIALIZATION_VERSION,
		width: state.width,
		height: state.height,
		cells: Object.freeze(Array.from(state.cells)),
	})
}

const PLAYER_CELL_VALUES: ReadonlySet<string> = new Set(
	Object.values(PlayerCell),
)

/**
 * Restore player state from a serialized envelope.
 * Rejects unknown versions, dimension mismatches, and invalid cell tokens.
 */
export function deserializePlayerState(
	raw: unknown,
): PlayerState {
	if (raw === null || typeof raw !== 'object') {
		throw new Error('Player state must be an object')
	}

	const record = raw as Record<string, unknown>
	if (record.version !== SERIALIZATION_VERSION) {
		throw new Error(`Unsupported player state version: ${String(record.version)}`)
	}

	const width = record.width
	const height = record.height
	const cells = record.cells

	if (typeof width !== 'number' || typeof height !== 'number') {
		throw new Error('Player state dimensions must be numbers')
	}
	if (!Number.isInteger(width) || !Number.isInteger(height)) {
		throw new Error('Player state dimensions must be integers')
	}
	if (width < 1 || height < 1) {
		throw new Error('Player state dimensions must be positive')
	}
	if (!Array.isArray(cells)) {
		throw new Error('Player state cells must be an array')
	}
	if (cells.length !== width * height) {
		throw new Error(
			`Player state cells length ${cells.length} !== ${width}*${height}`,
		)
	}

	const parsed: PlayerCell[] = []
	for (const cell of cells) {
		if (typeof cell !== 'string' || !PLAYER_CELL_VALUES.has(cell)) {
			throw new Error(`Invalid player cell token: ${String(cell)}`)
		}
		parsed.push(cell as PlayerCell)
	}

	return Object.freeze({
		width,
		height,
		cells: Object.freeze(parsed),
	})
}
