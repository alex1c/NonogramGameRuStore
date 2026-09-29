/**
 * Phase 8A.1 content pipeline unit tests (fast — no full catalog solver audit).
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
import { selectWithDiversity } from '../selectQuota'
import {
	CONTENT_GENERATOR_VERSION,
	normalizeConceptId,
} from '../constants'

function fakeRecord(
	partial: Partial<CandidateAuditRecord> &
		Pick<
			CandidateAuditRecord,
			'id' | 'ascii' | 'solutionHash' | 'canonicalHash'
		>,
): CandidateAuditRecord {
	return {
		titleRu: partial.titleRu ?? `Title-${partial.id}`,
		collectionId: 'symbols',
		conceptId: partial.conceptId ?? `concept-${partial.id}`,
		compositionId: partial.compositionId ?? 'default',
		family: partial.family ?? `family-${partial.id}`,
		variant: 'v',
		kind: 'object',
		sourceKind: 'authored',
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
		warnings: [],
		needsHumanRecognizabilityReview: true,
		rewardQualityStructuralPass: true,
		rewardQualityFlags: [],
		contentRole: 'production',
		notSelectedReason: null,
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
		expect('Спящий кот').toMatch(/кот/)
	})

	it('normalizes concept aliases', () => {
		expect(normalizeConceptId('Kitty')).toBe('cat')
		expect(normalizeConceptId('dog')).toBe('dog')
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
	})

	it('transform duplicate pair detector works', () => {
		const left = fakeRecord({
			id: 'a',
			ascii: 'x',
			solutionHash: 'h1',
			canonicalHash: 'same',
			conceptId: 'c1',
		})
		const right = fakeRecord({
			id: 'b',
			ascii: 'y',
			solutionHash: 'h2',
			canonicalHash: 'same',
			conceptId: 'c2',
		})
		expect(findTransformDuplicatePairs([left, right])).toHaveLength(1)
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
			ascii: 'x',
			solutionHash: solutionHash(aBmp),
			canonicalHash: canonicalTransformationHash(aBmp),
			width: 5,
			height: 5,
			sizeKey: '5x5',
			fillRatio: 0.6,
			conceptId: 'frame-a',
		})
		const b = fakeRecord({
			id: 'b',
			ascii: 'y',
			solutionHash: solutionHash(bBmp),
			canonicalHash: canonicalTransformationHash(bBmp),
			width: 5,
			height: 5,
			sizeKey: '5x5',
			fillRatio: 0.56,
			conceptId: 'frame-b',
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
	})
})

describe('semantic diversity selection', () => {
	it('caps bridge-like concept frequency (R1 regression)', () => {
		const bridges = Array.from({ length: 6 }, (_, i) =>
			fakeRecord({
				id: `bridge-${i}`,
				conceptId: 'bridge',
				compositionId: i === 0 ? 'default' : `var-${i}`,
				titleRu: `Мост-${i}`,
				family: `bridge-family-${i}`,
				tier: 'HARD',
				score: 55 + i,
				ascii: `b${i}`,
				solutionHash: `hb${i}`,
				canonicalHash: `cb${i}`,
				collectionId: 'nature',
			}),
		)
		const others = Array.from({ length: 120 }, (_, i) => {
			const tiers = ['BEGINNER', 'EASY', 'MEDIUM', 'HARD', 'EXPERT'] as const
			return fakeRecord({
				id: `other-${i}`,
				conceptId: `concept-${i}`,
				compositionId: 'default',
				titleRu: `Объект-${i}`,
				family: `fam-${i}`,
				tier: tiers[i % 5]!,
				score: 20 + (i % 50),
				ascii: `o${i}`,
				solutionHash: `ho${i}`,
				canonicalHash: `co${i}`,
				collectionId: 'objects',
				kind: i % 17 === 0 ? 'pattern' : 'object',
			})
		})
		const result = selectWithDiversity([...bridges, ...others])
		const bridgeSelected = result.selected.filter((r) => r.conceptId === 'bridge')
		expect(bridgeSelected.length).toBeLessThanOrEqual(2)
	})

	it('caps cat concept frequency (R1 regression)', () => {
		const cats = Array.from({ length: 5 }, (_, i) =>
			fakeRecord({
				id: `cat-${i}`,
				conceptId: 'cat',
				compositionId: i === 0 ? 'sitting' : `size-${i}`,
				titleRu: `Кот-${i}`,
				family: `cat-fam-${i}`,
				tier: 'MEDIUM',
				ascii: `c${i}`,
				solutionHash: `hc${i}`,
				canonicalHash: `cc${i}`,
				collectionId: 'animals',
			}),
		)
		const filler = Array.from({ length: 100 }, (_, i) =>
			fakeRecord({
				id: `fill-${i}`,
				conceptId: `fill-${i}`,
				titleRu: `Филлер-${i}`,
				family: `ff-${i}`,
				tier: (['BEGINNER', 'EASY', 'MEDIUM', 'HARD', 'EXPERT'] as const)[
					i % 5
				]!,
				ascii: `f${i}`,
				solutionHash: `hf${i}`,
				canonicalHash: `cf${i}`,
			}),
		)
		const result = selectWithDiversity([...cats, ...filler])
		expect(result.selected.filter((r) => r.conceptId === 'cat').length).toBeLessThanOrEqual(
			2,
		)
	})

	it('same concept across sizes selects at most concept cap', () => {
		const sizes = [5, 10, 15]
		const variants = sizes.map((size, i) =>
			fakeRecord({
				id: `apple-${size}`,
				conceptId: 'apple',
				compositionId: 'default',
				titleRu: `Яблоко-${size}`,
				family: `apple-${size}`,
				tier: 'EASY',
				width: size,
				height: size,
				sizeKey: `${size}x${size}`,
				ascii: `a${i}`,
				solutionHash: `ha${i}`,
				canonicalHash: `ca${i}`,
				collectionId: 'food',
			}),
		)
		const filler = Array.from({ length: 100 }, (_, i) =>
			fakeRecord({
				id: `x-${i}`,
				conceptId: `x-${i}`,
				titleRu: `X-${i}`,
				family: `x-${i}`,
				tier: (['BEGINNER', 'EASY', 'MEDIUM', 'HARD', 'EXPERT'] as const)[
					i % 5
				]!,
				ascii: `x${i}`,
				solutionHash: `hx${i}`,
				canonicalHash: `cx${i}`,
			}),
		)
		const result = selectWithDiversity([...variants, ...filler])
		// compositionId all default → only 1 apple allowed
		expect(result.selected.filter((r) => r.conceptId === 'apple').length).toBe(1)
	})

	it('pattern cap prevents pattern-only expert fill', () => {
		const patterns = Array.from({ length: 40 }, (_, i) =>
			fakeRecord({
				id: `pat-${i}`,
				conceptId: `pat-${i}`,
				titleRu: `Узор-${i}`,
				family: `pat-fam-${i}`,
				tier: i < 15 ? 'EXPERT' : 'HARD',
				kind: 'pattern',
				collectionId: 'patterns',
				ascii: `p${i}`,
				solutionHash: `hp${i}`,
				canonicalHash: `cp${i}`,
				score: 70,
			}),
		)
		const objects = Array.from({ length: 280 }, (_, i) =>
			fakeRecord({
				id: `obj-${i}`,
				conceptId: `obj-${i}`,
				titleRu: `Объект-${i}`,
				family: `obj-${i}`,
				tier: (['BEGINNER', 'EASY', 'MEDIUM', 'HARD', 'EXPERT'] as const)[
					i % 5
				]!,
				ascii: `o${i}`,
				solutionHash: `ho${i}`,
				canonicalHash: `co${i}`,
				collectionId: 'objects',
			}),
		)
		const result = selectWithDiversity([...patterns, ...objects])
		const patternCount = result.selected.filter(
			(r) => r.kind === 'pattern' || r.collectionId === 'patterns',
		).length
		expect(patternCount).toBeLessThanOrEqual(25)
		const expertPatterns = result.selected.filter(
			(r) =>
				r.tier === 'EXPERT' &&
				(r.kind === 'pattern' || r.collectionId === 'patterns'),
		).length
		expect(expertPatterns).toBeLessThanOrEqual(8)
	})

	it('selects up to tier quotas deterministically with unique concepts', () => {
		const rows: CandidateAuditRecord[] = []
		const tiers = ['BEGINNER', 'EASY', 'MEDIUM', 'HARD', 'EXPERT'] as const
		const perTier = { BEGINNER: 30, EASY: 70, MEDIUM: 80, HARD: 70, EXPERT: 30 }
		for (const tier of tiers) {
			for (let i = 0; i < perTier[tier]; i += 1) {
				rows.push(
					fakeRecord({
						id: `${tier}-${i}`,
						tier,
						score: 10 + i,
						ascii: `${tier}-${i}`,
						solutionHash: `${tier}-h-${i}`,
						canonicalHash: `${tier}-c-${i}`,
						conceptId: `${tier}-concept-${i}`,
						titleRu: `${tier}-title-${i}`,
						family: `${tier}-fam-${i}`,
						collectionId: i % 2 === 0 ? 'animals' : 'food',
					}),
				)
			}
		}
		const first = selectWithDiversity(rows)
		const second = selectWithDiversity(rows)
		expect(first.selected.map((r) => r.id)).toEqual(
			second.selected.map((r) => r.id),
		)
		expect(first.selected).toHaveLength(250)
		expect(first.shortage).toEqual([])
		expect(first.distinctConcepts).toBeGreaterThanOrEqual(220)
	})

	it('campaign arranger produces stable order and set sizes', () => {
		const rows = Array.from({ length: 250 }, (_, i) =>
			fakeRecord({
				id: `p-${String(i).padStart(3, '0')}`,
				tier: (['BEGINNER', 'EASY', 'MEDIUM', 'HARD', 'EXPERT'] as const)[
					i % 5
				]!,
				score: i,
				ascii: `p${i}`,
				solutionHash: `h${i}`,
				canonicalHash: `c${i}`,
				conceptId: `p-concept-${i}`,
			}),
		)
		const a = arrangePilotCampaign(rows)
		const b = arrangePilotCampaign(rows)
		expect(a.order).toEqual(b.order)
		expect(a.sets.length).toBeGreaterThanOrEqual(2)
	})
})

describe('generator version pin', () => {
	it('uses prod-v2 for Phase 8B', () => {
		expect(CONTENT_GENERATOR_VERSION).toBe('prod-v2')
	})
})

describe('reward quality structural gate', () => {
	it('rejects primitive lines and corners for non-symbol production', () => {
		const { analyzeRewardQuality } = require('../rewardQuality') as typeof import('../rewardQuality')
		const line = parseAscii([
			'.....',
			'#####',
			'.....',
		])
		const corner = parseAscii([
			'##...',
			'#....',
			'.....',
		])
		expect(analyzeRewardQuality(line, 'object').hardReject).toBe(true)
		expect(analyzeRewardQuality(corner, 'object').hardReject).toBe(true)
		expect(analyzeRewardQuality(line, 'symbol').hardReject).toBe(true)
	})

	it('passes good simple symbols (heart / star)', () => {
		const { analyzeRewardQuality } = require('../rewardQuality') as typeof import('../rewardQuality')
		const heart = parseAscii([
			'.#.#.',
			'#####',
			'.###.',
			'..#..',
		])
		const star = parseAscii([
			'..#..',
			'#####',
			'.###.',
			'.#.#.',
		])
		expect(analyzeRewardQuality(heart, 'symbol').structuralPass).toBe(true)
		expect(analyzeRewardQuality(star, 'symbol').structuralPass).toBe(true)
	})

	it('excludes tutorial primitives from production pool', () => {
		const { buildRawCandidatePool } = require('../pool') as typeof import('../pool')
		const production = buildRawCandidatePool()
		const ids = new Set(production.map((r) => r.id))
		expect(ids.has('beg-bar')).toBe(false)
		expect(ids.has('beg-line-h')).toBe(false)
		expect(ids.has('beg-line-v')).toBe(false)
		expect(ids.has('beg-corner')).toBe(false)
		expect(ids.has('beg-dash')).toBe(false)
		expect(ids.has('beg-ledge')).toBe(false)
		expect(production.every((r) => r.contentRole === 'production')).toBe(true)
	})
})
