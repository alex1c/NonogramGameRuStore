/**
 * Line candidate / overlap foundation tests.
 */

import {
	generateLineCandidates,
	intersectCandidates,
} from '../lineCandidates'

describe('generateLineCandidates', () => {
	it('returns a single empty candidate for []', () => {
		const candidates = generateLineCandidates(5, [])
		expect(candidates).toEqual([[false, false, false, false, false]])
	})

	it('lists placements for a single block', () => {
		const candidates = generateLineCandidates(4, [2])
		expect(candidates).toEqual([
			[true, true, false, false],
			[false, true, true, false],
			[false, false, true, true],
		])
	})

	it('respects known FILLED/EMPTY constraints', () => {
		const candidates = generateLineCandidates(4, [2], [
			'EMPTY',
			'UNKNOWN',
			'UNKNOWN',
			'UNKNOWN',
		])
		expect(candidates).toEqual([
			[false, true, true, false],
			[false, false, true, true],
		])
	})

	it('returns no candidates when the clue cannot fit', () => {
		expect(generateLineCandidates(3, [2, 2])).toEqual([])
	})
})

describe('intersectCandidates overlap', () => {
	it('forces the center overlap for clue [8] on length 10', () => {
		const candidates = generateLineCandidates(10, [8])
		const agreed = intersectCandidates(candidates, 10)
		expect(agreed).toEqual([
			null,
			null,
			true,
			true,
			true,
			true,
			true,
			true,
			null,
			null,
		])
	})
})
