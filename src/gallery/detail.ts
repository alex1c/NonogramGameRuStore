/**
 * Gallery Detail guard — re-checks completion before exposing solution.
 */

import { getProductionPuzzleById } from '../content/playable'
import type { SaveRoot } from '../persistence/schema'
import { cropSolutionBitmap, type CroppedBitmap } from './crop'
import { getGalleryCollectionDef, getGalleryItemDef } from './definitions'
import { difficultyLabelRu } from '../presentation/difficultyLabels'
import { analyzeDifficulty } from '../domain/difficulty/analyzer'
import { formatBestTime } from '../presentation/timeFormat'

export type GalleryDetailResult =
	| {
			readonly kind: 'unlocked'
			readonly puzzleId: string
			readonly titleRu: string
			readonly collectionTitleRu: string
			readonly sizeLabel: string
			readonly difficultyLabel: string
			readonly bestTimeLabel: string | null
			readonly preview: CroppedBitmap
			readonly canReplay: true
	  }
	| {
			readonly kind: 'locked'
			readonly puzzleId: string
			readonly displayTitle: string
			readonly message: string
			readonly preview: null
			readonly canReplay: false
	  }
	| {
			readonly kind: 'missing'
			readonly puzzleId: string
			readonly message: string
			readonly preview: null
			readonly canReplay: false
	  }

/**
 * Build detail view. Locked / missing never include solution bitmap.
 */
export function buildGalleryDetail(
	puzzleId: string,
	save: SaveRoot,
): GalleryDetailResult {
	const def = getGalleryItemDef(puzzleId)
	const puzzle = getProductionPuzzleById(puzzleId)
	if (def === null || puzzle === null) {
		return {
			kind: 'missing',
			puzzleId,
			message: 'Картинка недоступна',
			preview: null,
			canReplay: false,
		}
	}

	if (!save.completedPuzzleIds.includes(puzzleId)) {
		return {
			kind: 'locked',
			puzzleId,
			displayTitle: `Картинка ${def.galleryOrder}`,
			message: 'Сначала пройдите этот кроссворд',
			preview: null,
			canReplay: false,
		}
	}

	const collection = getGalleryCollectionDef(def.collectionId)
	const best = save.bestTimes.find((item) => item.puzzleId === puzzleId)
	return {
		kind: 'unlocked',
		puzzleId,
		titleRu: def.titleRu,
		collectionTitleRu: collection?.titleRu ?? '',
		sizeLabel: `${puzzle.width}×${puzzle.height}`,
		difficultyLabel: difficultyLabelRu(analyzeDifficulty(puzzle).tier),
		bestTimeLabel:
			best !== undefined ? formatBestTime(best.bestActiveTimeMs) : null,
		preview: cropSolutionBitmap(puzzle.width, puzzle.height, puzzle.solution),
		canReplay: true,
	}
}
