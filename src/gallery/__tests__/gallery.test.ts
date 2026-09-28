/**
 * Gallery projection + locked privacy contract tests.
 */

import { SolutionCell } from '../../domain/nonogram/types'
import { createDefaultSave } from '../../persistence/createDefaultSave'
import { completePuzzle } from '../../persistence/progressReducers'
import { auditGallery } from '../audit'
import { cropSolutionBitmap, findFilledBounds } from '../crop'
import { buildGalleryDetail } from '../detail'
import { GALLERY_ITEMS } from '../definitions'
import {
	buildGalleryItemView,
	buildGalleryScreenView,
	countGalleryUnlocked,
} from '../viewModel'

describe('gallery audit', () => {
	it('passes structural quality gate for 21 items / 3 collections', () => {
		const summary = auditGallery()
		expect(summary.ok).toBe(true)
		expect(summary.collections).toBe(3)
		expect(summary.items).toBe(21)
		expect(summary.excluded).toBe(0)
		expect(summary.duplicateIds).toBe(0)
		expect(summary.missingPuzzles).toBe(0)
	})
})

describe('gallery locked privacy', () => {
	it('fresh progress → all locked without solution/title leak', () => {
		const view = buildGalleryScreenView(createDefaultSave())
		expect(view.unlockedCount).toBe(0)
		expect(view.totalCount).toBe(21)
		for (const collection of view.collections) {
			for (const item of collection.items) {
				expect(item.access).toBe('LOCKED')
				expect(item.preview).toBeNull()
				expect(item.secretTitle).toBeNull()
				expect(item.displayTitle).toMatch(/^Картинка \d+$/)
				expect(item.accessibilityLabel).not.toMatch(/Сердце|Лодка|Дерево/)
				expect(item.accessibilityLabel).toContain('не открыта')
			}
		}
	})

	it('completed puzzle unlocks only that item with solution', () => {
		let save = createDefaultSave()
		save = completePuzzle(save, {
			puzzleId: 'mini-medium-heart',
			activeTimeMs: 1000,
		})
		const view = buildGalleryScreenView(save)
		const heart = view.collections
			.flatMap((c) => c.items)
			.find((item) => item.puzzleId === 'mini-medium-heart')
		const bar = view.collections
			.flatMap((c) => c.items)
			.find((item) => item.puzzleId === 'mini-beginner-bar')
		expect(heart?.access).toBe('UNLOCKED')
		expect(heart?.displayTitle).toBe('Сердце')
		expect(heart?.preview).not.toBeNull()
		expect(heart?.preview?.cells.some((v) => v === 1)).toBe(true)
		expect(bar?.access).toBe('LOCKED')
		expect(bar?.preview).toBeNull()
		expect(bar?.secretTitle).toBeNull()
	})

	it('unknown completed IDs ignored for gallery totals', () => {
		const counts = countGalleryUnlocked(['ghost', 'mini-beginner-bar'])
		expect(counts.unlocked).toBe(1)
		expect(counts.total).toBe(21)
	})

	it('locked item view never carries solution payload', () => {
		const def = GALLERY_ITEMS[0]!
		const view = buildGalleryItemView(def, new Set(), [])
		expect(view?.access).toBe('LOCKED')
		if (view?.access === 'LOCKED') {
			expect(view.preview).toBeNull()
			expect(view.secretTitle).toBeNull()
			expect('preview' in view && view.preview).toBeNull()
		}
	})
})

describe('gallery detail guard', () => {
	it('direct locked detail call has no solution', () => {
		const detail = buildGalleryDetail(
			'mini-medium-heart',
			createDefaultSave(),
		)
		expect(detail.kind).toBe('locked')
		expect(detail.preview).toBeNull()
		expect(detail.canReplay).toBe(false)
	})

	it('unlocked detail exposes cropped preview', () => {
		let save = createDefaultSave()
		save = completePuzzle(save, {
			puzzleId: 'mini-medium-boat',
			activeTimeMs: 2000,
		})
		const detail = buildGalleryDetail('mini-medium-boat', save)
		expect(detail.kind).toBe('unlocked')
		if (detail.kind === 'unlocked') {
			expect(detail.titleRu).toBe('Лодка')
			expect(detail.preview.cells.length).toBeGreaterThan(0)
			expect(detail.canReplay).toBe(true)
		}
	})
})

describe('preview crop', () => {
	it('trims empty margins deterministically', () => {
		const solution = [
			0, 0, 0, 0, 0,
			0, 1, 1, 0, 0,
			0, 1, 1, 0, 0,
			0, 0, 0, 0, 0,
		]
		const bounds = findFilledBounds(5, 4, solution)
		expect(bounds).toEqual({ minRow: 1, maxRow: 2, minCol: 1, maxCol: 2 })
		const cropped = cropSolutionBitmap(5, 4, solution)
		expect(cropped.width).toBe(2)
		expect(cropped.height).toBe(2)
		expect(cropped.cells).toEqual([1, 1, 1, 1])
	})

	it('edge-touching object keeps edge cells', () => {
		const solution = [1, 0, 0, 0, 0, 0, 0, 0, 0]
		const cropped = cropSolutionBitmap(3, 3, solution)
		expect(cropped.width).toBe(1)
		expect(cropped.height).toBe(1)
		expect(cropped.cells).toEqual([1])
	})

	it('fully filled image keeps full size', () => {
		const solution = Array.from({ length: 9 }, () => SolutionCell.FILLED)
		const cropped = cropSolutionBitmap(3, 3, solution)
		expect(cropped.width).toBe(3)
		expect(cropped.height).toBe(3)
	})

	it('all-empty is safe', () => {
		const cropped = cropSolutionBitmap(3, 3, Array.from({ length: 9 }, () => 0))
		expect(cropped.width).toBe(1)
		expect(cropped.height).toBe(1)
		expect(cropped.bounds).toBeNull()
	})
})

describe('collection progress', () => {
	it('tracks 0 / partial / complete', () => {
		const empty = buildGalleryScreenView(createDefaultSave())
		const shapes = empty.collections.find((c) => c.collectionId === 'shapes')!
		expect(shapes.completed).toBe(0)
		expect(shapes.isComplete).toBe(false)

		let save = createDefaultSave()
		for (const item of GALLERY_ITEMS.filter((i) => i.collectionId === 'objects')) {
			save = completePuzzle(save, {
				puzzleId: item.puzzleId,
				activeTimeMs: 500,
			})
		}
		const view = buildGalleryScreenView(save)
		const objects = view.collections.find((c) => c.collectionId === 'objects')!
		expect(objects.completed).toBe(objects.total)
		expect(objects.isComplete).toBe(true)
	})
})
