/**
 * PlayerState ↔ solver grid adapter.
 * FILLED → filled constraint; CROSSED → empty constraint; UNKNOWN free.
 */

import { PlayerCell, type PlayerState } from '../domain/nonogram/types'
import type { SolverCell } from '../solver/completeSolver'

/** Convert player marks into solver constraints (never reads authored solution). */
export function playerStateToSolverGrid(
	player: PlayerState,
): readonly SolverCell[] {
	return Object.freeze(
		player.cells.map((cell): SolverCell => {
			if (cell === PlayerCell.FILLED) {
				return 1
			}
			if (cell === PlayerCell.CROSSED) {
				return -1
			}
			return 0
		}),
	)
}

export function isPlayerBoardComplete(player: PlayerState): boolean {
	return player.cells.every((cell) => cell !== PlayerCell.UNKNOWN)
}
