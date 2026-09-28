/**
 * Player progress percentage — determined cells only (no solution peeking).
 */

import { PlayerCell } from '../domain/nonogram/types'

/**
 * Share of cells that are FILLED or CROSSED (0..100, floored).
 * Does not measure correctness against the authored solution.
 */
export function determinedProgressPercent(
	cells: readonly PlayerCell[] | readonly string[],
): number {
	if (cells.length === 0) {
		return 0
	}
	let determined = 0
	for (const cell of cells) {
		if (cell === PlayerCell.FILLED || cell === PlayerCell.CROSSED) {
			determined += 1
		}
	}
	return Math.floor((determined / cells.length) * 100)
}

/** Russian copy: "Отмечено" avoids promising correctness. */
export function formatMarkedPercent(percent: number): string {
	const safe = Math.max(0, Math.min(100, Math.floor(percent)))
	return `Отмечено ${safe}%`
}
