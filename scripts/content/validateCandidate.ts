/**
 * Per-candidate mathematical + hint-chain validation (build-time only).
 */

import { CONTENT_SCHEMA_VERSION } from '../../src/content/types'
import { buildCatalogPuzzle } from '../../src/content/buildPuzzle'
import { analyzeDifficulty } from '../../src/domain/difficulty/analyzer'
import { DIFFICULTY_MODEL_VERSION } from '../../src/domain/difficulty/thresholds'
import { createEmptyPlayerState } from '../../src/domain/nonogram/playerState'
import type { PlayerState } from '../../src/domain/nonogram/types'
import { PlayerCell } from '../../src/domain/nonogram/types'
import { applyHintStep, getHint } from '../../src/hints'
import { puzzleToSpec } from '../../src/solver/completeSolver'
import type { DeductionReason } from '../../src/solver/logicalSolver'
import { validateProductionPuzzle } from '../../src/solver/validator'
import { toAscii, type Bitmap } from './bitmap'
import { normalizeConceptId } from './constants'
import { canonicalTransformationHash, solutionHash } from './hash'
import { computeVisualMetrics, structuralRejectReason } from './metrics'
import { analyzeRewardQuality } from './rewardQuality'
import type {
	CandidateAuditRecord,
	RawCandidate,
	RejectReason,
	StructuralWarning,
} from './types'

const COMPLETE_MS_BUDGET = 8_000
const LOGICAL_MS_BUDGET = 4_000
const HINT_MS_BUDGET = 6_000
const HINT_STEP_CELL_BUDGET_FACTOR = 4

function emptyReasonBag(): Record<string, number> {
	return {
		overlap: 0,
		completed_line: 0,
		impossible_positions_eliminated: 0,
		forced_filled: 0,
		forced_empty: 0,
	}
}

function bump(
	bag: Record<string, number>,
	reason: DeductionReason,
): void {
	bag[reason] = (bag[reason] ?? 0) + 1
}

function applyMutations(
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

function auditHintChain(puzzle: {
	readonly id: string
	readonly width: number
	readonly height: number
	readonly rowClues: readonly (readonly number[])[]
	readonly columnClues: readonly (readonly number[])[]
	readonly solution: readonly number[]
}): {
	readonly status: 'SOLVED' | 'STALLED' | 'CONTRADICTION' | 'UNSOUND' | 'TIMEOUT'
	readonly steps: number
	readonly cells: number
	readonly maxHintMs: number
	readonly totalMs: number
	readonly reasons: Record<string, number>
} {
	const spec = puzzleToSpec(puzzle)
	let player = createEmptyPlayerState(puzzle.width, puzzle.height)
	let revision = 0
	let steps = 0
	let cells = 0
	let maxHintMs = 0
	const reasons = emptyReasonBag()
	const maxSteps =
		puzzle.width * puzzle.height * HINT_STEP_CELL_BUDGET_FACTOR + 8
	const started = performance.now()

	while (steps < maxSteps) {
		if (performance.now() - started > HINT_MS_BUDGET) {
			return {
				status: 'TIMEOUT',
				steps,
				cells,
				maxHintMs,
				totalMs: performance.now() - started,
				reasons,
			}
		}
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
				status: 'SOLVED',
				steps,
				cells,
				maxHintMs,
				totalMs: performance.now() - started,
				reasons,
			}
		}
		if (result.kind === 'CONTRADICTION') {
			return {
				status: 'CONTRADICTION',
				steps,
				cells,
				maxHintMs,
				totalMs: performance.now() - started,
				reasons,
			}
		}
		if (result.kind === 'STALLED') {
			return {
				status: 'STALLED',
				steps,
				cells,
				maxHintMs,
				totalMs: performance.now() - started,
				reasons,
			}
		}

		const step = result.step
		// Authored solution oracle — never passed into getHint.
		for (const target of step.targets) {
			const idx = target.row * puzzle.width + target.col
			const expected = puzzle.solution[idx]
			if (step.action === 'FILLED' && expected !== 1) {
				return {
					status: 'UNSOUND',
					steps,
					cells,
					maxHintMs,
					totalMs: performance.now() - started,
					reasons,
				}
			}
			if (step.action === 'CROSSED' && expected !== 0) {
				return {
					status: 'UNSOUND',
					steps,
					cells,
					maxHintMs,
					totalMs: performance.now() - started,
					reasons,
				}
			}
		}

		const applied = applyHintStep(player, step, revision)
		if (!applied.ok) {
			return {
				status: 'UNSOUND',
				steps,
				cells,
				maxHintMs,
				totalMs: performance.now() - started,
				reasons,
			}
		}

		bump(reasons, step.reason)
		player = applyMutations(player, applied.mutations)
		revision += 1
		steps += 1
		cells += step.targets.length
	}

	return {
		status: 'TIMEOUT',
		steps,
		cells,
		maxHintMs,
		totalMs: performance.now() - started,
		reasons,
	}
}

function dailyEligibleFor(
	width: number,
	height: number,
	tier: string,
	kind: string,
): boolean {
	if (tier === 'BEGINNER') {
		return false
	}
	if (Math.max(width, height) >= 25) {
		return false
	}
	if (kind === 'pattern' && tier === 'EXPERT') {
		return false
	}
	return true
}

function collectWarnings(
	visual: ReturnType<typeof computeVisualMetrics>,
	width: number,
	height: number,
	tier: string,
): StructuralWarning[] {
	const warnings: StructuralWarning[] = []
	if (visual.bboxCoverage < 0.18) {
		warnings.push('tiny_bbox')
	}
	if (visual.fillRatio < 0.06 || visual.fillRatio > 0.88) {
		warnings.push('extreme_fill')
	}
	if (visual.singletons >= 5) {
		warnings.push('singleton_heavy')
	}
	if (visual.componentCount >= 8) {
		warnings.push('many_components')
	}
	const small = Math.max(width, height) <= 5
	const simple =
		visual.componentCount <= 2 &&
		visual.bboxCoverage > 0.35 &&
		visual.fillRatio > 0.2 &&
		visual.fillRatio < 0.7
	if (small && simple && (tier === 'HARD' || tier === 'EXPERT')) {
		warnings.push('simple_high_tier')
	}
	if (
		Math.max(width, height) >= 15 &&
		(tier === 'BEGINNER' || tier === 'EASY')
	) {
		warnings.push('large_easy_tier')
	}
	warnings.push('needs_human_recognizability_review')
	return warnings
}

export function validateRawCandidate(
	raw: RawCandidate,
	opts?: {
		readonly knownExactHashes?: ReadonlySet<string>
		readonly knownCanonicalHashes?: ReadonlySet<string>
		readonly knownIds?: ReadonlySet<string>
	},
): CandidateAuditRecord {
	const width = raw.bitmap[0]?.length ?? 0
	const height = raw.bitmap.length
	const sizeKey = `${width}x${height}`
	const ascii = toAscii(raw.bitmap)
	const solHash = solutionHash(raw.bitmap)
	const canonHash = canonicalTransformationHash(raw.bitmap)
	const visual = computeVisualMetrics(raw.bitmap)
	const conceptId = normalizeConceptId(raw.conceptId)
	const compositionId = raw.compositionId.trim() || 'default'

	const base = {
		id: raw.id,
		titleRu: raw.titleRu,
		collectionId: raw.collectionId,
		conceptId,
		compositionId,
		family: raw.family,
		variant: raw.variant,
		kind: raw.kind,
		sourceKind: raw.sourceKind,
		contentRole: raw.contentRole ?? 'production',
		width,
		height,
		sizeKey,
		solutionHash: solHash,
		canonicalHash: canonHash,
		ascii,
		reviewStatus: 'candidate' as const,
		intendedTierHint: raw.intendedTierHint ?? null,
		fillRatio: visual.fillRatio,
		componentCount: visual.componentCount,
		singletons: visual.singletons,
		largestShare: visual.largestShare,
		bboxCoverage: visual.bboxCoverage,
		emptyRows: visual.emptyRows,
		emptyCols: visual.emptyCols,
		touchesBorder: visual.touchesBorder,
		seed: raw.seed,
		hintReasons: emptyReasonBag(),
		logicalReasons: emptyReasonBag(),
		warnings: [] as StructuralWarning[],
		needsHumanRecognizabilityReview: true,
		rewardQualityStructuralPass: true,
		rewardQualityFlags: [] as string[],
		rewardQualityRiskScore: 0,
		notSelectedReason: null as string | null,
	}

	const fail = (
		reason: RejectReason,
		extra?: Partial<CandidateAuditRecord>,
	): CandidateAuditRecord => ({
		...base,
		productionReady: false,
		unique: false,
		logicallySolvable: false,
		hintChainSolved: false,
		logicalStatus: 'SKIPPED',
		hintStatus: 'SKIPPED',
		tier: 'UNRATED',
		score: null,
		completeMs: 0,
		logicalMs: 0,
		hintMs: 0,
		hintSteps: 0,
		hintCells: 0,
		dailyEligible: false,
		rejectReason: reason,
		rewardQualityStructuralPass: false,
		...extra,
	})

	if (!raw.id.trim() || !raw.titleRu.trim()) {
		return fail('invalid')
	}
	if (!conceptId) {
		return fail('missing_concept')
	}
	if (!compositionId) {
		return fail('invalid_composition')
	}
	if (opts?.knownIds?.has(raw.id)) {
		return fail('duplicate_id')
	}
	if (opts?.knownExactHashes?.has(solHash)) {
		return fail('exact_duplicate')
	}
	if (opts?.knownCanonicalHashes?.has(canonHash)) {
		return fail('transform_duplicate')
	}

	const structural = structuralRejectReason(raw.bitmap)
	if (structural !== null) {
		return fail(structural)
	}

	const reward = analyzeRewardQuality(raw.bitmap, raw.kind)
	const role = raw.contentRole ?? 'production'
	if (role === 'production' && reward.hardReject) {
		return fail('reward_quality', {
			rewardQualityStructuralPass: false,
			rewardQualityFlags: [...reward.flags],
			rewardQualityRiskScore: reward.riskScore,
			warnings: reward.flags as StructuralWarning[],
		})
	}

	const puzzle = buildCatalogPuzzle({
		schemaVersion: CONTENT_SCHEMA_VERSION,
		id: raw.id,
		title: raw.titleRu,
		category: raw.collectionId,
		collection: raw.collectionId,
		tags: [raw.family, raw.kind, conceptId, compositionId],
		width,
		height,
		solutionMatrix: raw.bitmap as readonly (readonly number[])[],
		provenance: `content-pipeline:${raw.family}:${raw.variant}`,
	})

	const completeStarted = performance.now()
	const validation = validateProductionPuzzle(puzzle)
	const completeMs = performance.now() - completeStarted

	const logicalStarted = performance.now()
	const difficulty = analyzeDifficulty(puzzle)
	const logicalMs = performance.now() - logicalStarted
	const warnings = [
		...collectWarnings(visual, width, height, difficulty.tier),
		...(reward.flags as StructuralWarning[]),
	]

	if (completeMs > COMPLETE_MS_BUDGET || logicalMs > LOGICAL_MS_BUDGET) {
		return fail('performance', {
			completeMs,
			logicalMs,
			unique: validation.unique,
			logicallySolvable: validation.logicallySolvable,
			logicalStatus: String(validation.logicalStatus),
			productionReady: false,
			warnings,
		})
	}

	if (!validation.unique) {
		return fail('not_unique', {
			completeMs,
			logicalMs,
			unique: false,
			logicalStatus: String(validation.logicalStatus),
			warnings,
		})
	}

	if (validation.logicalStatus === 'CONTRADICTION') {
		return fail('contradiction', {
			completeMs,
			logicalMs,
			unique: true,
			logicalStatus: 'CONTRADICTION',
			warnings,
		})
	}

	if (!validation.logicallySolvable) {
		return fail('stalled', {
			completeMs,
			logicalMs,
			unique: true,
			logicalStatus: String(validation.logicalStatus),
			warnings,
		})
	}

	const hint = auditHintChain(puzzle)
	if (hint.status === 'TIMEOUT') {
		return fail('performance', {
			completeMs,
			logicalMs,
			hintMs: hint.totalMs,
			hintSteps: hint.steps,
			hintCells: hint.cells,
			hintReasons: hint.reasons,
			unique: true,
			logicallySolvable: true,
			logicalStatus: String(validation.logicalStatus),
			hintStatus: 'TIMEOUT',
			productionReady: validation.productionReady,
			tier: difficulty.tier === 'UNRATED' ? 'UNRATED' : difficulty.tier,
			score: difficulty.score,
			warnings,
		})
	}
	if (hint.status !== 'SOLVED') {
		const mapped: RejectReason =
			hint.status === 'STALLED'
				? 'hint_chain'
				: hint.status === 'CONTRADICTION'
					? 'contradiction'
					: 'unsound'
		return fail(mapped, {
			completeMs,
			logicalMs,
			hintMs: hint.totalMs,
			hintSteps: hint.steps,
			hintCells: hint.cells,
			hintReasons: hint.reasons,
			unique: true,
			logicallySolvable: true,
			logicalStatus: String(validation.logicalStatus),
			hintStatus: hint.status,
			hintChainSolved: false,
			productionReady: false,
			tier: difficulty.tier === 'UNRATED' ? 'UNRATED' : difficulty.tier,
			score: difficulty.score,
			warnings,
		})
	}

	if (!validation.productionReady || difficulty.tier === 'UNRATED') {
		return fail('stalled', {
			completeMs,
			logicalMs,
			hintMs: hint.totalMs,
			hintSteps: hint.steps,
			hintCells: hint.cells,
			hintReasons: hint.reasons,
			unique: validation.unique,
			logicallySolvable: validation.logicallySolvable,
			logicalStatus: String(validation.logicalStatus),
			hintStatus: hint.status,
			hintChainSolved: true,
			tier: difficulty.tier,
			score: difficulty.score,
			productionReady: false,
			warnings,
		})
	}

	return {
		...base,
		productionReady: true,
		unique: true,
		logicallySolvable: true,
		hintChainSolved: true,
		logicalStatus: String(validation.logicalStatus),
		hintStatus: 'SOLVED',
		tier: difficulty.tier,
		score: difficulty.score,
		completeMs,
		logicalMs,
		hintMs: hint.totalMs,
		hintSteps: hint.steps,
		hintCells: hint.cells,
		hintReasons: hint.reasons,
		logicalReasons: emptyReasonBag(),
		dailyEligible: dailyEligibleFor(
			width,
			height,
			difficulty.tier,
			raw.kind,
		),
		rejectReason: null,
		warnings,
		needsHumanRecognizabilityReview: true,
		rewardQualityStructuralPass: reward.structuralPass,
		rewardQualityFlags: [...reward.flags],
		rewardQualityRiskScore: reward.riskScore,
		notSelectedReason: null,
	}
}

export { DIFFICULTY_MODEL_VERSION }

/** Encode bitmap rows for manifest packing (human-readable). */
export function bitmapToMatrix(bitmap: Bitmap): readonly (readonly number[])[] {
	return bitmap.map((row) => row.map((cell) => cell))
}
