/**
 * Hint engine — PuzzleSpec + PlayerState → HintResult.
 * Must NEVER import or read authored solution / complete solver.
 */

import type { PlayerState, PuzzleSpec } from '../domain/nonogram/types'
import {
	enumerateLogicalSteps,
	findContradictoryLine,
} from '../solver/logicalSolver'
import { isPlayerBoardComplete, playerStateToSolverGrid } from './playerGrid'
import { selectPedagogicalStep } from './normalize'
import type { HintMode, HintResult } from './types'

export interface GetHintInput {
	readonly spec: PuzzleSpec
	readonly player: PlayerState
	readonly revision: number
	readonly mode?: HintMode
}

/**
 * Compute one Hint / Teach Me result from current player constraints.
 * Deterministic for identical (spec, player, mode).
 */
export function getHint(input: GetHintInput): HintResult {
	const mode = input.mode ?? 'HINT'
	const { spec, player, revision } = input

	if (
		player.width !== spec.width ||
		player.height !== spec.height ||
		player.cells.length !== spec.width * spec.height
	) {
		return { kind: 'STALLED' }
	}

	const grid = playerStateToSolverGrid(player)

	if (isPlayerBoardComplete(player)) {
		const enumerated = enumerateLogicalSteps(spec, grid)
		if (enumerated === 'INVALID') {
			const line = findContradictoryLine(spec, grid)
			return {
				kind: 'CONTRADICTION',
				orientation: line?.orientation ?? null,
				lineIndex: line?.lineIndex ?? null,
				clue: line?.clue ?? null,
			}
		}
		return { kind: 'COMPLETE' }
	}

	const enumerated = enumerateLogicalSteps(spec, grid)
	if (enumerated === 'INVALID') {
		const line = findContradictoryLine(spec, grid)
		return {
			kind: 'CONTRADICTION',
			orientation: line?.orientation ?? null,
			lineIndex: line?.lineIndex ?? null,
			clue: line?.clue ?? null,
		}
	}

	const step = selectPedagogicalStep(enumerated, revision, mode)
	if (step === null) {
		return { kind: 'STALLED' }
	}
	return { kind: 'STEP', step }
}
