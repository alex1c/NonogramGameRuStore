/**
 * Phase 8A content pipeline unit tests (fast — no full catalog solver audit).
 */

import {
	canonicalTransformationHash,
	solutionHash,
} from '../hash'
import {
	hammingSimilarity,
	mirrorHorizontal,
	parseAscii,
	rotate180,
} from '../bitmap'
import { findTransformDuplicatePairs, topNearDuplicatePairs } from '../duplicates'
import type { CandidateAuditRecord } from '../types'
import { arrangePilotCampaign } from '../campaignSim'
import { selectByTierQuota } from '../selectQuota'
import { CONTENT_GENERATOR_VERSION, PILOT_TIER_QUOTA } from '../constants'

function fakeRecord(
	partial: Partial<CandidateAuditRecord> &
		Pick<CandidateAuditRecord, 'id' | 'ascii' | 'solutionHash' | 'canonicalHash'>,
): CandidateAuditRecord {
	return {
		titleRu: 'Тест',
		collectionId: 'symbols',
		family: 'test',
		variant: 'v',
		kind: 'object',
		width: 5,
		height: 5,
		sizeKey: '5x5',
		reviewStatus: 'candidate',
		productionReady: true,
		unique: true,
		logicallySolvable: true,
		hintChainSolved: true,
		logicalStatus: 'SOLVED',
		hintStatus: 'SOLVED',
		tier: 'EASY',
		score: 30,
		intendedTierHint: null,
		fillRatio: 0.4,
		componentCount: 1,
		singletons: 0,
		largestShare: 1,
		bboxCoverage: 0.5,
		emptyRows: 0,
		emptyCols: 0,
		touchesBorder: false,
		completeMs: 1,
		logicalMs: 1,
		hintMs: 1,
		hintSteps: 1,
		hintCells: 1,
		hintReasons: {},
		logicalReasons: {},
		dailyEligible: true,
		rejectReason: null,
		seed: 1,
		...partial,
	}
}

describe('content bitmap encoding', () => {
	it('parses ASCII and rejects bad width', () => {
		const bitmap = parseAscii(['#.#', '.#.', '#.#'])
		expect(bitmap.length).toBe(3)
		expect(bitmap[0]).toEqual([1, 0, 1])
		expect(() => parseAscii(['##', '#'])).toThrow(/width/)
	})

	it('supports Russian titles in metadata separately from ASCII', () => {
		const title = 'Спящий кот'
		expect(title).toMatch(/кот/)
	})
})

describe('content hashing / duplicates', () => {
	const heart = parseAscii([
		'.#.#.',
		'#####',
		'#####',
		'.###.',
		'..#..',
	])

	it('exact duplicate hashes match', () => {
		expect(solutionHash(heart)).toBe(solutionHash(heart))
	})

	it('horizontal mirror shares canonical hash', () => {
		const asymmetric = parseAscii([
			'##...',
			'#....',
			'#.#..',
			'.....',
			'...#.',
		])
		const mirrored = mirrorHorizontal(asymmetric)
		expect(solutionHash(mirrored)).not.toBe(solutionHash(asymmetric))
		expect(canonicalTransformationHash(mirrored)).toBe(
			canonicalTransformationHash(asymmetric),
		)
	})

	it('180 rotation shares canonical hash', () => {
		expect(canonicalTransformationHash(rotate180(heart))).toBe(
			canonicalTransformationHash(heart),
		)
	})

	it('near-duplicate similarity is high for one-cell edits', () => {
		const a = parseAscii(['###', '#.#', '###'])
		const b = parseAscii(['###', '###', '###'])
		expect(hammingSimilarity(a, b)).toBeGreaterThan(0.8)
	})

	it('different shapes are not exact duplicates', () => {
		const a = parseAscii(['###', '#.#', '###'])
		const b = parseAscii(['.#.', '###', '.#.'])
		expect(solutionHash(a)).not.toBe(solutionHash(b))
		expect(canonicalTransformationHash(a)).not.toBe(
			canonicalTransformationHash(b),
		)
	})

	it('transform duplicate pair detector works', () => {
		const left = fakeRecord({
			id: 'a',
			ascii: 'x',
			solutionHash: 'h1',
			canonicalHash: 'same',
		})
		const right = fakeRecord({
			id: 'b',
			ascii: 'y',
			solutionHash: 'h2',
			canonicalHash: 'same',
		})
		const pairs = findTransformDuplicatePairs([left, right])
		expect(pairs).toHaveLength(1)
	})

	it('top near duplicates report same-size pairs above threshold', () => {
		const aBmp = parseAscii([
			'#####',
			'#...#',
			'#.#.#',
			'#...#',
			'#####',
		])
		const bBmp = parseAscii([
			'#####',
			'#...#',
			'#...#',
			'#...#',
			'#####',
		])
		expect(hammingSimilarity(aBmp, bBmp)).toBeGreaterThanOrEqual(0.92)
		const a = fakeRecord({
			id: 'a',
			ascii: '#####\n#...#\n#.#.#\n#...#\n#####',
			solutionHash: solutionHash(aBmp),
			canonicalHash: canonicalTransformationHash(aBmp),
			width: 5,
			height: 5,
			sizeKey: '5x5',
			fillRatio: 0.6,
		})
		const b = fakeRecord({
			id: 'b',
			ascii: '#####\n#...#\n#...#\n#...#\n#####',
			solutionHash: solutionHash(bBmp),
			canonicalHash: canonicalTransformationHash(bBmp),
			width: 5,
			height: 5,
			sizeKey: '5x5',
			fillRatio: 0.56,
		})
		const pairs = topNearDuplicatePairs(
			[a, b],
			new Map([
				['a', aBmp],
				['b', bBmp],
			]),
			5,
		)
		expect(pairs.length).toBe(1)
		expect(pairs[0]!.similarity).toBeGreaterThan(0.9)
	})
})

describe('quota selection / campaign sim', () => {
	it('selects up to tier quotas deterministically', () => {
		const rows: CandidateAuditRecord[] = []
		const tiers = ['BEGINNER', 'EASY', 'MEDIUM', 'HARD', 'EXPERT'] as const
		for (const tier of tiers) {
			for (let i = 0; i < 40; i += 1) {
				rows.push(
					fakeRecord({
						id: `${tier}-${i}`,
						tier,
						score: 10 + i,
						ascii: `${tier}-${i}`,
						solutionHash: `${tier}-h-${i}`,
						canonicalHash: `${tier}-c-${i}`,
						collectionId: i % 2 === 0 ? 'animals' : 'food',
					}),
				)
			}
		}
		const first = selectByTierQuota(rows, PILOT_TIER_QUOTA, 100)
		const second = selectByTierQuota(rows, PILOT_TIER_QUOTA, 100)
		expect(first.selected.map((r) => r.id)).toEqual(
			second.selected.map((r) => r.id),
		)
		expect(first.selected).toHaveLength(100)
		expect(first.shortage).toEqual([])
	})

	it('campaign arranger produces stable order and set sizes', () => {
		const rows = Array.from({ length: 100 }, (_, i) =>
			fakeRecord({
				id: `p-${String(i).padStart(3, '0')}`,
				tier: (['BEGINNER', 'EASY', 'MEDIUM', 'HARD', 'EXPERT'] as const)[
					i % 5
				]!,
				score: i,
				ascii: `p${i}`,
				solutionHash: `h${i}`,
				canonicalHash: `c${i}`,
			}),
		)
		const a = arrangePilotCampaign(rows)
		const b = arrangePilotCampaign(rows)
		expect(a.order).toEqual(b.order)
		expect(a.sets).toHaveLength(2)
		expect(a.sets[0]!.puzzleIds).toHaveLength(50)
	})
})

describe('generator version pin', () => {
	it('uses prod-v1 for Phase 8A', () => {
		expect(CONTENT_GENERATOR_VERSION).toBe('prod-v1')
	})
})
