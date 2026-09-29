/**
 * Normalize raw logical deductions into one pedagogical HintStep.
 * Mixed FILLED+EMPTY on one line → split into two atomic steps.
 */

import type { LogicalStep } from '../solver/logicalSolver'
import type { HintMode, HintStep } from './types'

/** Lower = higher priority (Hint preference). */
function reasonPriority(reason: LogicalStep['reason']): number {
	switch (reason) {
		case 'completed_line':
			return 0
		case 'forced_empty':
			return 1
		case 'overlap':
			return 2
		case 'forced_filled':
			return 3
		case 'impossible_positions_eliminated':
			return 4
		default:
			return 9
	}
}

/** Teach Me prefers reasons with richer explanations. */
function teachPriority(reason: LogicalStep['reason']): number {
	switch (reason) {
		case 'overlap':
			return 0
		case 'completed_line':
			return 1
		case 'forced_filled':
			return 2
		case 'forced_empty':
			return 3
		case 'impossible_positions_eliminated':
			return 4
		default:
			return 9
	}
}

function compareSteps(
	a: HintStep,
	b: HintStep,
	mode: HintMode,
): number {
	const pa =
		mode === 'TEACH'
			? teachPriority(a.reason)
			: reasonPriority(a.reason)
	const pb =
		mode === 'TEACH'
			? teachPriority(b.reason)
			: reasonPriority(b.reason)
	if (pa !== pb) {
		return pa - pb
	}
	// Deterministic secondary: row before column, then index, then action.
	const oa = a.orientation === 'row' ? 0 : 1
	const ob = b.orientation === 'row' ? 0 : 1
	if (oa !== ob) {
		return oa - ob
	}
	if (a.lineIndex !== b.lineIndex) {
		return a.lineIndex - b.lineIndex
	}
	const aa = a.action === 'FILLED' ? 0 : 1
	const ab = b.action === 'FILLED' ? 0 : 1
	if (aa !== ab) {
		return aa - ab
	}
	return b.targets.length - a.targets.length
}

function runLengthForOverlap(step: LogicalStep): number | null {
	if (step.reason !== 'overlap') {
		return null
	}
	if (step.clue.length === 1 && step.clue[0] !== undefined) {
		return step.clue[0]
	}
	return null
}

/**
 * Split a raw solver step into single-action pedagogical candidates.
 */
export function normalizeLogicalStep(
	raw: LogicalStep,
	revision: number,
): readonly HintStep[] {
	const filled = raw.cells.filter((c) => c.action === 'FILLED')
	const empty = raw.cells.filter((c) => c.action === 'EMPTY')
	const out: HintStep[] = []

	if (filled.length > 0) {
		const filledReason: HintStep['reason'] =
			raw.reason === 'impossible_positions_eliminated' ||
			raw.reason === 'forced_empty'
				? 'forced_filled'
				: raw.reason
		out.push(
			Object.freeze({
				orientation: raw.orientation,
				lineIndex: raw.lineIndex,
				clue: Object.freeze([...raw.clue]),
				action: 'FILLED' as const,
				targets: Object.freeze(
					filled.map((c) =>
						Object.freeze({ row: c.row, col: c.col }),
					),
				),
				reason: filledReason,
				proof: Object.freeze({
					reason: filledReason,
					candidateCount: raw.candidateCountBefore,
					forcedCount: filled.length,
					runLength: runLengthForOverlap(raw),
				}),
				revision,
			}),
		)
	}

	if (empty.length > 0) {
		const reason =
			raw.reason === 'completed_line'
				? 'completed_line'
				: raw.reason === 'impossible_positions_eliminated'
					? 'forced_empty'
					: raw.reason === 'forced_filled' || raw.reason === 'overlap'
						? 'forced_empty'
						: raw.reason
		out.push(
			Object.freeze({
				orientation: raw.orientation,
				lineIndex: raw.lineIndex,
				clue: Object.freeze([...raw.clue]),
				action: 'CROSSED' as const,
				targets: Object.freeze(
					empty.map((c) =>
						Object.freeze({ row: c.row, col: c.col }),
					),
				),
				reason,
				proof: Object.freeze({
					reason,
					candidateCount: raw.candidateCountBefore,
					forcedCount: empty.length,
					runLength: null,
				}),
				revision,
			}),
		)
	}

	return Object.freeze(out)
}

export function selectPedagogicalStep(
	rawSteps: readonly LogicalStep[],
	revision: number,
	mode: HintMode,
): HintStep | null {
	const candidates: HintStep[] = []
	for (const raw of rawSteps) {
		candidates.push(...normalizeLogicalStep(raw, revision))
	}
	if (candidates.length === 0) {
		return null
	}
	const sorted = [...candidates].sort((a, b) => compareSteps(a, b, mode))
	return sorted[0] ?? null
}
