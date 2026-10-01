/**
 * Build-time export: B1000 candidate manifest → compact runtime catalog JSON.
 * Does NOT run solvers. Consumed by src/content/runtime only.
 *
 * npm run content:export-runtime
 */

import fs from 'node:fs'
import path from 'node:path'
import { COLLECTIONS } from './constants'
import { arrangePilotCampaign } from './campaignSim'
import type { CandidateAuditRecord, PilotManifest } from './types'
import { buildPuzzleContentFingerprint } from '../../src/persistence/fingerprint'
import { SolutionCell } from '../../src/domain/nonogram/types'
import type { Puzzle } from '../../src/domain/nonogram/types'
import {
	generateColumnClues,
	generateRowClues,
	gridFromMatrix,
} from '../../src/domain/nonogram/clues'
import { parseAscii } from './bitmap'

const ROOT = path.resolve(__dirname, '../..')
const MANIFEST = path.join(ROOT, 'generated', 'content-b1000', 'manifest.json')
const OUT_DIR = path.join(ROOT, 'src', 'content', 'runtime')
const OUT_FILE = path.join(OUT_DIR, 'b1000Catalog.json')

function asciiToSolution(
	ascii: string,
	width: number,
	height: number,
): SolutionCell[] {
	const rows = ascii.split('\n')
	const out: SolutionCell[] = []
	for (let r = 0; r < height; r += 1) {
		const line = rows[r] ?? ''
		for (let c = 0; c < width; c += 1) {
			out.push(line[c] === '#' ? SolutionCell.FILLED : SolutionCell.EMPTY)
		}
	}
	return out
}

function fingerprintFor(
	id: string,
	width: number,
	height: number,
	rowClues: readonly (readonly number[])[],
	columnClues: readonly (readonly number[])[],
): string {
	const puzzle: Puzzle = {
		id,
		width,
		height,
		solution: [],
		rowClues,
		columnClues,
		metadata: {},
	}
	return buildPuzzleContentFingerprint(puzzle)
}

function toAuditRecord(
	p: PilotManifest['puzzles'][number],
): CandidateAuditRecord {
	return {
		id: p.id,
		titleRu: p.titleRu,
		collectionId: p.collectionId,
		conceptId: p.conceptId,
		compositionId: p.compositionId,
		family: p.family,
		variant: p.variant,
		kind: p.kind,
		sourceKind: p.sourceKind,
		contentRole: p.contentRole,
		width: p.width,
		height: p.height,
		sizeKey: `${p.width}x${p.height}`,
		ascii: p.ascii,
		solutionHash: p.solutionHash,
		canonicalHash: p.canonicalHash,
		tier: p.tier,
		score: p.score,
		dailyEligible: p.dailyEligible,
		reviewStatus: p.reviewStatus,
		seed: p.seed,
		warnings: p.warnings,
		rowClues: p.rowClues,
		columnClues: p.columnClues,
		productionReady: true,
		unique: true,
		logicallySolvable: true,
		hintChainSolved: true,
		logicalStatus: 'SOLVED',
		hintStatus: 'SOLVED',
		intendedTierHint: null,
		fillRatio: 0,
		componentCount: 1,
		singletons: 0,
		largestShare: 1,
		bboxCoverage: 1,
		emptyRows: 0,
		emptyCols: 0,
		touchesBorder: false,
		completeMs: 0,
		logicalMs: 0,
		hintMs: 0,
		hintSteps: 0,
		hintCells: 0,
		hintReasons: {},
		logicalReasons: {},
		rejectReason: null,
		needsHumanRecognizabilityReview: false,
		rewardQualityStructuralPass: true,
		rewardQualityFlags: [],
		rewardQualityRiskScore: 0,
		notSelectedReason: null,
	}
}

function main(): void {
	if (!fs.existsSync(MANIFEST)) {
		throw new Error(`Missing B1000 manifest: ${MANIFEST}`)
	}
	const manifest = JSON.parse(
		fs.readFileSync(MANIFEST, 'utf8'),
	) as PilotManifest
	if (manifest.puzzleCount !== 1000 || manifest.puzzles.length !== 1000) {
		throw new Error(
			`Expected 1000 puzzles, got count=${manifest.puzzleCount} len=${manifest.puzzles.length}`,
		)
	}

	const records = manifest.puzzles.map(toAuditRecord)
	const campaign = arrangePilotCampaign(records)
	if (campaign.sets.length !== 20) {
		throw new Error(`Expected 20 campaign sets, got ${campaign.sets.length}`)
	}
	for (const set of campaign.sets) {
		if (set.puzzleIds.length !== 50) {
			throw new Error(
				`Set ${set.setId} expected 50 puzzles, got ${set.puzzleIds.length}`,
			)
		}
	}

	const MAX_DAILY_CELLS = 20 * 20

	const puzzles = manifest.puzzles.map((p) => {
		// Always derive clues from ascii at export — Phase 8C manifest stored
		// empty clue arrays (checksum still authoritative for content identity).
		const matrix = parseAscii(p.ascii.split('\n'))
		const grid = gridFromMatrix(matrix as readonly (readonly number[])[])
		const rowClues = generateRowClues(grid, p.width, p.height)
		const columnClues = generateColumnClues(grid, p.width, p.height)
		if (rowClues.length !== p.height || columnClues.length !== p.width) {
			throw new Error(`Clue size mismatch for ${p.id}`)
		}
		const contentFingerprint = fingerprintFor(
			p.id,
			p.width,
			p.height,
			rowClues,
			columnClues,
		)
		// Verify ascii decodes cleanly (no solver).
		const solution = asciiToSolution(p.ascii, p.width, p.height)
		if (solution.length !== p.width * p.height) {
			throw new Error(`Bad ascii length for ${p.id}`)
		}
		const hasWarn = p.warnings.some(
			(w) => w !== 'needs_human_recognizability_review',
		)
		const tooLarge = p.width * p.height > MAX_DAILY_CELLS
		// Match Phase 8C daily simulation eligibility (not raw manifest flag alone).
		const dailyEligible =
			p.dailyEligible &&
			p.contentRole === 'production' &&
			p.tier !== 'UNRATED' &&
			!tooLarge &&
			!hasWarn
		return {
			id: p.id,
			titleRu: p.titleRu,
			collectionId: p.collectionId,
			width: p.width,
			height: p.height,
			ascii: p.ascii,
			rowClues,
			columnClues,
			tier: p.tier,
			score: p.score,
			dailyEligible,
			contentFingerprint,
		}
	})

	const dailyEligibleIds = puzzles
		.filter((p) => p.dailyEligible)
		.map((p) => p.id)
		.sort((a, b) => a.localeCompare(b))

	const artifact = {
		schemaVersion: 1 as const,
		catalogVersion: manifest.catalogVersion,
		generatorVersion: manifest.generatorVersion,
		checksum: manifest.checksum,
		puzzleCount: 1000,
		unlockAfterCompletions: campaign.unlockAfterCompletions,
		collections: COLLECTIONS.map((c) => ({
			id: c.id,
			titleRu: c.titleRu,
			displayOrder: c.displayOrder,
		})),
		campaignSets: campaign.sets.map((s) => ({
			setId: s.setId,
			titleRu: s.titleRu,
			displayOrder: s.displayOrder,
			puzzleIds: s.puzzleIds,
		})),
		dailyEligibleIds,
		puzzles,
	}

	fs.mkdirSync(OUT_DIR, { recursive: true })
	fs.writeFileSync(OUT_FILE, `${JSON.stringify(artifact)}\n`)
	const bytes = fs.statSync(OUT_FILE).size
	console.log(
		`Exported runtime catalog → ${path.relative(ROOT, OUT_FILE)} ` +
			`(${(bytes / 1024 / 1024).toFixed(2)} MiB) ` +
			`puzzles=${artifact.puzzleCount} sets=${artifact.campaignSets.length} ` +
			`dailyEligible=${dailyEligibleIds.length} checksum=${artifact.checksum.slice(0, 16)}…`,
	)
}

main()
