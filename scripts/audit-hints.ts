/**
 * Hint audit — npm run audit:hints
 * Sequential logical hints from clean state for every production puzzle.
 * Authored solution is audit oracle only (never passed to getHint).
 */

import { getProductionCatalog } from '../src/content/playable'
import { createEmptyPlayerState } from '../src/domain/nonogram/playerState'
import { PlayerCell, type PlayerState } from '../src/domain/nonogram/types'
import { applyHintStep, getHint } from '../src/hints'
import { puzzleToSpec } from '../src/solver/completeSolver'
import type { DeductionReason } from '../src/solver/logicalSolver'
import { buildPerf20 } from '../src/tests/fixtures/nonogramFixtures'

interface PuzzleAuditRow {
	readonly id: string
	readonly size: string
	readonly difficulty: string
	readonly steps: number
	readonly cells: number
	readonly maxHintMs: number
	readonly status: 'SOLVED' | 'STALLED' | 'CONTRADICTION' | 'UNSOUND' | 'FAIL'
	readonly reasons: Record<string, number>
}

function emptyReasons(): Record<string, number> {
	return {
		overlap: 0,
		completed_line: 0,
		impossible_positions_eliminated: 0,
		forced_filled: 0,
		forced_empty: 0,
	}
}

function bumpReason(
	bag: Record<string, number>,
	reason: DeductionReason,
): void {
	bag[reason] = (bag[reason] ?? 0) + 1
}

function applyToPlayer(
	player: PlayerState,
	mutations: readonly {
		readonly row: number
		readonly col: number
		readonly after: PlayerCell
	}[],
): PlayerState {
	const cells = player.cells.slice()
	for (const mutation of mutations) {
		cells[mutation.row * player.width + mutation.col] = mutation.after
	}
	return Object.freeze({
		width: player.width,
		height: player.height,
		cells: Object.freeze(cells),
	})
}

function auditPuzzle(puzzle: {
	readonly id: string
	readonly width: number
	readonly height: number
	readonly rowClues: readonly (readonly number[])[]
	readonly columnClues: readonly (readonly number[])[]
	readonly solution: readonly number[]
	readonly metadata?: { readonly difficulty?: string }
}): PuzzleAuditRow {
	const spec = puzzleToSpec(puzzle)
	let player = createEmptyPlayerState(puzzle.width, puzzle.height)
	let revision = 0
	let steps = 0
	let cells = 0
	let maxHintMs = 0
	const reasons = emptyReasons()
	const difficulty = puzzle.metadata?.difficulty ?? '—'

	const MAX_STEPS = puzzle.width * puzzle.height * 4 + 8

	while (steps < MAX_STEPS) {
		const t0 = performance.now()
		const result = getHint({
			spec,
			player,
			revision,
			mode: 'HINT',
		})
		const dt = performance.now() - t0
		if (dt > maxHintMs) {
			maxHintMs = dt
		}

		if (result.kind === 'COMPLETE') {
			return {
				id: puzzle.id,
				size: `${puzzle.width}×${puzzle.height}`,
				difficulty,
				steps,
				cells,
				maxHintMs,
				status: 'SOLVED',
				reasons,
			}
		}
		if (result.kind === 'CONTRADICTION') {
			return {
				id: puzzle.id,
				size: `${puzzle.width}×${puzzle.height}`,
				difficulty,
				steps,
				cells,
				maxHintMs,
				status: 'CONTRADICTION',
				reasons,
			}
		}
		if (result.kind === 'STALLED') {
			return {
				id: puzzle.id,
				size: `${puzzle.width}×${puzzle.height}`,
				difficulty,
				steps,
				cells,
				maxHintMs,
				status: 'STALLED',
				reasons,
			}
		}

		const step = result.step
		bumpReason(reasons, step.reason)

		// Oracle: every target must match authored solution
		for (const target of step.targets) {
			const index = target.row * puzzle.width + target.col
			const expected = puzzle.solution[index]
			if (step.action === 'FILLED' && expected !== 1) {
				return {
					id: puzzle.id,
					size: `${puzzle.width}×${puzzle.height}`,
					difficulty,
					steps: steps + 1,
					cells,
					maxHintMs,
					status: 'UNSOUND',
					reasons,
				}
			}
			if (step.action === 'CROSSED' && expected !== 0) {
				return {
					id: puzzle.id,
					size: `${puzzle.width}×${puzzle.height}`,
					difficulty,
					steps: steps + 1,
					cells,
					maxHintMs,
					status: 'UNSOUND',
					reasons,
				}
			}
		}

		const applied = applyHintStep(player, step, revision)
		if (!applied.ok) {
			return {
				id: puzzle.id,
				size: `${puzzle.width}×${puzzle.height}`,
				difficulty,
				steps,
				cells,
				maxHintMs,
				status: 'FAIL',
				reasons,
			}
		}
		player = applyToPlayer(player, applied.mutations)
		revision += 1
		steps += 1
		cells += applied.mutations.length
	}

	return {
		id: puzzle.id,
		size: `${puzzle.width}×${puzzle.height}`,
		difficulty,
		steps,
		cells,
		maxHintMs,
		status: 'FAIL',
		reasons,
	}
}

function run(): void {
	const catalog = getProductionCatalog()
	const totalStart = performance.now()
	const rows: PuzzleAuditRow[] = []
	const totalReasons = emptyReasons()

	for (const puzzle of catalog) {
		const row = auditPuzzle(puzzle)
		rows.push(row)
		for (const key of Object.keys(totalReasons)) {
			totalReasons[key] = (totalReasons[key] ?? 0) + (row.reasons[key] ?? 0)
		}
	}

	// Sanity: existing 20×20 fixture (not in campaign)
	const perfRow = auditPuzzle(buildPerf20())
	const totalTime = performance.now() - totalStart

	let solved = 0
	let stalled = 0
	let contradiction = 0
	let unsound = 0
	let fail = 0
	let totalSteps = 0
	let totalCells = 0
	let slowest: PuzzleAuditRow | null = null
	let maxHintMs = 0

	console.log('Puzzle | Size | Steps | Cells | MaxHintMs | Status')
	for (const row of rows) {
		console.log(
			`${row.id} | ${row.size} | ${row.steps} | ${row.cells} | ${row.maxHintMs.toFixed(1)} | ${row.status}`,
		)
		totalSteps += row.steps
		totalCells += row.cells
		if (row.maxHintMs > maxHintMs) {
			maxHintMs = row.maxHintMs
		}
		if (slowest === null || row.maxHintMs > slowest.maxHintMs) {
			slowest = row
		}
		if (row.status === 'SOLVED') {
			solved += 1
		} else if (row.status === 'STALLED') {
			stalled += 1
		} else if (row.status === 'CONTRADICTION') {
			contradiction += 1
		} else if (row.status === 'UNSOUND') {
			unsound += 1
		} else {
			fail += 1
		}
	}

	console.log('')
	console.log(`20×20 fixture: ${perfRow.id} → ${perfRow.status} steps=${perfRow.steps} maxHintMs=${perfRow.maxHintMs.toFixed(1)}`)
	console.log('')
	console.log('Reason distribution:')
	for (const [reason, count] of Object.entries(totalReasons)) {
		console.log(`  ${reason}: ${count}`)
	}
	console.log('')
	console.log(
		`Summary: puzzles=${rows.length} solved=${solved} stalled=${stalled} contradiction=${contradiction} unsound=${unsound} fail=${fail}`,
	)
	console.log(
		`Steps=${totalSteps} cells=${totalCells} avgSteps=${(totalSteps / Math.max(1, rows.length)).toFixed(1)} maxHintMs=${maxHintMs.toFixed(1)} slowest=${slowest?.id ?? '—'} totalMs=${totalTime.toFixed(0)}`,
	)

	const productionFail =
		stalled > 0 ||
		contradiction > 0 ||
		unsound > 0 ||
		fail > 0 ||
		solved !== rows.length

	if (productionFail) {
		console.error('audit:hints FAIL')
		process.exit(1)
	}
	console.log('audit:hints PASS')
}

run()
