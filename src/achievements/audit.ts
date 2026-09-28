/**
 * Achievement audit — fail-closed for unreachable / invalid definitions.
 */

import { analyzeDifficulty } from '../domain/difficulty/analyzer'
import { PHASE4_CAMPAIGN_ENTRIES } from '../campaign/definition'
import { getProductionPuzzleById } from '../content/playable'
import { GALLERY_ITEMS } from '../gallery/definitions'
import {
	ACHIEVEMENT_DEFINITIONS,
	type AchievementDefinition,
} from './definitions'

export interface AchievementAuditSummary {
	readonly total: number
	readonly reachable: number
	readonly unreachable: number
	readonly duplicateIds: number
	readonly duplicateOrders: number
	readonly invalidTargets: number
	readonly issues: readonly string[]
	readonly ok: boolean
}

function campaignCapacity(): {
	readonly unique: number
	readonly byTier: Record<string, number>
	readonly largeGrid: number
	readonly maxCollectionSize: number
	readonly collectionCount: number
} {
	const byTier: Record<string, number> = {
		BEGINNER: 0,
		EASY: 0,
		MEDIUM: 0,
		HARD: 0,
		EXPERT: 0,
	}
	let largeGrid = 0
	for (const entry of PHASE4_CAMPAIGN_ENTRIES) {
		const puzzle = getProductionPuzzleById(entry.puzzleId)
		if (puzzle === null) {
			continue
		}
		const tier = analyzeDifficulty(puzzle).tier
		if (tier !== 'UNRATED') {
			byTier[tier] = (byTier[tier] ?? 0) + 1
		}
		if (puzzle.width >= 15 || puzzle.height >= 15) {
			largeGrid += 1
		}
	}
	const byCollection = new Map<string, number>()
	for (const item of GALLERY_ITEMS) {
		byCollection.set(
			item.collectionId,
			(byCollection.get(item.collectionId) ?? 0) + 1,
		)
	}
	let maxCollectionSize = 0
	for (const size of byCollection.values()) {
		if (size > maxCollectionSize) {
			maxCollectionSize = size
		}
	}
	return {
		unique: PHASE4_CAMPAIGN_ENTRIES.length,
		byTier,
		largeGrid,
		maxCollectionSize,
		collectionCount: byCollection.size,
	}
}

function isReachable(
	def: AchievementDefinition,
	cap: ReturnType<typeof campaignCapacity>,
): boolean {
	const { condition } = def
	switch (condition.kind) {
		case 'unique_completed':
			return condition.target <= cap.unique
		case 'difficulty_count':
		case 'difficulty_any': {
			const avail = cap.byTier[condition.difficultyTier ?? ''] ?? 0
			return condition.target <= avail
		}
		case 'collection_complete_any':
			return cap.collectionCount >= condition.target && cap.maxCollectionSize > 0
		case 'total_completions':
			// Reachable via replay even if target > unique count.
			return condition.target > 0
		case 'large_grid':
			return cap.largeGrid >= condition.target
		default:
			return false
	}
}

export function auditAchievements(): AchievementAuditSummary {
	const issues: string[] = []
	let duplicateIds = 0
	let duplicateOrders = 0
	let invalidTargets = 0
	let reachable = 0
	let unreachable = 0

	const ids = new Set<string>()
	const orders = new Set<number>()
	const cap = campaignCapacity()

	for (const def of ACHIEVEMENT_DEFINITIONS) {
		if (ids.has(def.id)) {
			duplicateIds += 1
			issues.push(`Duplicate achievement id: ${def.id}`)
		}
		ids.add(def.id)

		if (orders.has(def.displayOrder)) {
			duplicateOrders += 1
			issues.push(`Duplicate displayOrder: ${def.displayOrder}`)
		}
		orders.add(def.displayOrder)

		if (!Number.isInteger(def.condition.target) || def.condition.target < 1) {
			invalidTargets += 1
			issues.push(`Invalid target for ${def.id}`)
		}

		if (!def.titleRu.trim() || !def.descriptionRu.trim()) {
			issues.push(`Missing copy for ${def.id}`)
		}

		if (isReachable(def, cap)) {
			reachable += 1
		} else {
			unreachable += 1
			issues.push(`Unreachable achievement: ${def.id}`)
		}
	}

	const ok = issues.length === 0 && unreachable === 0
	return {
		total: ACHIEVEMENT_DEFINITIONS.length,
		reachable,
		unreachable,
		duplicateIds,
		duplicateOrders,
		invalidTargets,
		issues,
		ok,
	}
}
