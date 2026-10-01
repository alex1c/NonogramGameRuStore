/**
 * Gallery projection + locked privacy contract tests (Phase 8D B1000).
 */

import { SolutionCell } from '../../domain/nonogram/types'
import { createDefaultSave } from '../../persistence/createDefaultSave'
import { completePuzzle } from '../../persistence/progressReducers'
import { auditGallery } from '../audit'
import { cropSolutionBitmap, findFilledBounds } from '../crop'
import { buildGalleryDetail } from '../detail'
import { GALLERY_ITEMS } from '../definitions'
import {
	buildGalleryCollectionDetailView,
	buildGalleryItemView,
	buildGalleryScreenView,
	countGalleryUnlocked,
} from '../viewModel'

describe('gallery audit', () => {
	it('passes structural quality gate for 1000 items / 20 collections', () => {
		const summary = auditGallery()
		expect(summary.collections).toBe(20)
		expect(summary.items).toBe(1000)
		expect(summary.excluded).toBe(0)
		expect(summary.duplicateIds).toBe(0)
		expect(summary.missingPuzzles).toBe(0)
		expect(summary.campaignCoverageMissing).toBe(0)
	})
})

describe('gallery locked privacy', () => {
	it('fresh progress → collections locked without item leaks on root', () => {
		const view = buildGalleryScreenView(createDefaultSave())
		expect(view.unlockedCount).toBe(0)
		expect(view.totalCount).toBe(1000)
		expect(view.collections).toHaveLength(20)
		for (const collection of view.collections) {
			expect(collection.items).toHaveLength(0)
			expect(collection.completed).toBe(0)
		}
	})

	it('collection detail locked cards never leak title/solution', () => {
		const collectionId = GALLERY_ITEMS[0]!.collectionId
		const detail = buildGalleryCollectionDetailView(
			collectionId,
			createDefaultSave(),
		)
		expect(detail).not.toBeNull()
		expect(detail!.items.length).toBeGreaterThan(0)
		for (const item of detail!.items) {
			expect(item.access).toBe('LOCKED')
			expect(item.preview).toBeNull()
			expect(item.secretTitle).toBeNull()
			expect(item.displayTitle).toMatch(/^Картинка \d+$/)
			expect(item.accessibilityLabel).toContain('не открыта')
		}
	})

	it('completed puzzle unlocks only that item with solution', () => {
		const target = GALLERY_ITEMS[0]!
		let save = createDefaultSave()
		save = completePuzzle(save, {
			puzzleId: target.puzzleId,
			activeTimeMs: 1000,
		})
		const detail = buildGalleryCollectionDetailView(target.collectionId, save)
		const unlocked = detail!.items.find((i) => i.puzzleId === target.puzzleId)
		const lockedOther = detail!.items.find((i) => i.puzzleId !== target.puzzleId)
		expect(unlocked?.access).toBe('UNLOCKED')
		expect(unlocked?.displayTitle).toBe(target.titleRu)
		expect(unlocked?.preview).not.toBeNull()
		expect(unlocked?.preview?.cells.some((v) => v === 1)).toBe(true)
		if (lockedOther !== undefined) {
			expect(lockedOther.access).toBe('LOCKED')
			expect(lockedOther.preview).toBeNull()
			expect(lockedOther.secretTitle).toBeNull()
		}
	})

	it('unknown completed IDs ignored for gallery totals', () => {
		const sample = GALLERY_ITEMS[0]!.puzzleId
		const counts = countGalleryUnlocked(['ghost', sample])
		expect(counts.unlocked).toBe(1)
		expect(counts.total).toBe(1000)
	})

	it('locked item view never carries solution payload', () => {
		const def = GALLERY_ITEMS[0]!
		const view = buildGalleryItemView(def, new Set(), [])
		expect(view?.access).toBe('LOCKED')
		if (view?.access === 'LOCKED') {
			expect(view.preview).toBeNull()
			expect(view.secretTitle).toBeNull()
		}
	})
})

describe('gallery detail guard', () => {
	it('direct locked detail call has no solution', () => {
		const def = GALLERY_ITEMS[0]!
		const detail = buildGalleryDetail(def.puzzleId, createDefaultSave())
		expect(detail.kind).toBe('locked')
		expect(detail.preview).toBeNull()
		expect(detail.canReplay).toBe(false)
	})

	it('unlocked detail exposes cropped preview', () => {
		const def = GALLERY_ITEMS[0]!
		let save = createDefaultSave()
		save = completePuzzle(save, {
			puzzleId: def.puzzleId,
			activeTimeMs: 1000,
		})
		const detail = buildGalleryDetail(def.puzzleId, save)
		expect(detail.kind).toBe('unlocked')
		expect(detail.preview).not.toBeNull()
		expect(detail.canReplay).toBe(true)
	})
})

describe('crop helpers', () => {
	it('finds filled bounds and crops', () => {
		const solution = [
			SolutionCell.EMPTY,
			SolutionCell.EMPTY,
			SolutionCell.EMPTY,
			SolutionCell.EMPTY,
			SolutionCell.FILLED,
			SolutionCell.EMPTY,
			SolutionCell.EMPTY,
			SolutionCell.EMPTY,
			SolutionCell.EMPTY,
		]
		const bounds = findFilledBounds(3, 3, solution)
		expect(bounds).toEqual({ minRow: 1, maxRow: 1, minCol: 1, maxCol: 1 })
		const cropped = cropSolutionBitmap(3, 3, solution)
		expect(cropped.width).toBe(1)
		expect(cropped.height).toBe(1)
		expect(cropped.cells).toEqual([1])
	})
})
