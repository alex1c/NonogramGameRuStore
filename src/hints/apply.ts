/**
 * Apply a HintStep as one paint transaction (pure).
 */

import {
	PlayerCell,
	type PlayerState,
} from '../domain/nonogram/types'
import type { CellMutation } from '../gameplay/history'
import type { HintStep } from './types'

export type ApplyHintOutcome =
	| {
			readonly ok: true
			readonly player: PlayerState
			readonly mutations: readonly CellMutation[]
	  }
	| {
			readonly ok: false
			readonly reason: 'STALE' | 'INVALID_TARGET' | 'NO_OP' | 'EMPTY'
	  }

/**
 * Build mutations for a hint step against the current player board.
 * Rejects stale revision and out-of-bounds targets.
 */
export function applyHintStep(
	player: PlayerState,
	step: HintStep,
	currentRevision: number,
): ApplyHintOutcome {
	if (step.revision !== currentRevision) {
		return { ok: false, reason: 'STALE' }
	}
	if (step.targets.length === 0) {
		return { ok: false, reason: 'EMPTY' }
	}

	const afterCell =
		step.action === 'FILLED' ? PlayerCell.FILLED : PlayerCell.CROSSED
	const mutations: CellMutation[] = []
	const seen = new Set<string>()

	for (const target of step.targets) {
		if (
			target.row < 0 ||
			target.col < 0 ||
			target.row >= player.height ||
			target.col >= player.width
		) {
			return { ok: false, reason: 'INVALID_TARGET' }
		}
		const key = `${target.row},${target.col}`
		if (seen.has(key)) {
			continue
		}
		seen.add(key)
		const index = target.row * player.width + target.col
		const before = player.cells[index] ?? PlayerCell.UNKNOWN
		if (before === afterCell) {
			continue
		}
		mutations.push(
			Object.freeze({
				row: target.row,
				col: target.col,
				before,
				after: afterCell,
			}),
		)
	}

	if (mutations.length === 0) {
		return { ok: false, reason: 'NO_OP' }
	}

	const cells = player.cells.slice()
	for (const mutation of mutations) {
		cells[mutation.row * player.width + mutation.col] = mutation.after
	}

	return {
		ok: true,
		player: Object.freeze({
			width: player.width,
			height: player.height,
			cells: Object.freeze(cells),
		}),
		mutations: Object.freeze(mutations),
	}
}
