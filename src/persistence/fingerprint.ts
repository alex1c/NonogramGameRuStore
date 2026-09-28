/**
 * Deterministic puzzle content fingerprint for active-game compatibility.
 * Depends on id + dimensions + clues (not unstable object identity).
 */

import type { Puzzle } from '../domain/nonogram/types'

function encodeClueLine(line: readonly number[]): string {
	return line.join('.')
}

/**
 * Build a stable fingerprint string for an active save.
 * If catalog content for the same ID changes, hydration must reset the party.
 */
export function buildPuzzleContentFingerprint(puzzle: Puzzle): string {
	const rowPart = puzzle.rowClues.map(encodeClueLine).join('|')
	const colPart = puzzle.columnClues.map(encodeClueLine).join('|')
	return [
		'v1',
		puzzle.id,
		String(puzzle.width),
		String(puzzle.height),
		`r:${rowPart}`,
		`c:${colPart}`,
	].join('#')
}
