/**
 * Production Campaign — Phase 8D B1000 (20 sets × 50).
 * Stable puzzle IDs are independent of set / position / display number.
 */

import {
	CAMPAIGN_SET_UNLOCK_AFTER,
	getRuntimeCampaignSets,
	getRuntimePuzzleById,
	getRuntimePuzzleEntry,
	PRODUCTION_PUZZLE_COUNT,
} from '../content/runtime'
import type { CatalogPuzzle } from '../content/types'
import type { DifficultyTier } from '../domain/difficulty/tiers'

export interface CampaignEntry {
	/** Global 1-based display number (1…1000). */
	readonly order: number
	readonly puzzleId: string
	readonly setId: string
	readonly setDisplayOrder: number
	/** 1-based index within the set. */
	readonly setSlot: number
}

export interface CampaignSetDef {
	readonly setId: string
	readonly titleRu: string
	readonly displayOrder: number
	readonly puzzleIds: readonly string[]
	/** Global display numbers for slots 1…50. */
	readonly firstOrder: number
	readonly lastOrder: number
}

/** Completions in set N required to unlock set N+1. */
export const SET_UNLOCK_AFTER_COMPLETIONS = CAMPAIGN_SET_UNLOCK_AFTER

/** First N levels of Set 1 open immediately (soft onboarding). */
export const INITIAL_UNLOCKED_COUNT = 5

function buildEntriesAndSets(): {
	readonly entries: readonly CampaignEntry[]
	readonly sets: readonly CampaignSetDef[]
} {
	const runtimeSets = getRuntimeCampaignSets()
	const entries: CampaignEntry[] = []
	const sets: CampaignSetDef[] = []
	let order = 1
	for (const set of runtimeSets) {
		const firstOrder = order
		let slot = 1
		for (const puzzleId of set.puzzleIds) {
			entries.push({
				order,
				puzzleId,
				setId: set.setId,
				setDisplayOrder: set.displayOrder,
				setSlot: slot,
			})
			order += 1
			slot += 1
		}
		sets.push({
			setId: set.setId,
			titleRu: set.titleRu,
			displayOrder: set.displayOrder,
			puzzleIds: set.puzzleIds,
			firstOrder,
			lastOrder: order - 1,
		})
	}
	return {
		entries: Object.freeze(entries),
		sets: Object.freeze(sets),
	}
}

const BUILT = buildEntriesAndSets()

export const CAMPAIGN_ENTRIES: readonly CampaignEntry[] = BUILT.entries
export const CAMPAIGN_SETS: readonly CampaignSetDef[] = BUILT.sets

/** @deprecated Alias — Phase 4 name retained for gradual test migration. */
export const PHASE4_CAMPAIGN_ENTRIES = CAMPAIGN_ENTRIES

export function getCampaignTotal(): number {
	return PRODUCTION_PUZZLE_COUNT
}

export function getCampaignSets(): readonly CampaignSetDef[] {
	return CAMPAIGN_SETS
}

export function getCampaignSetById(setId: string): CampaignSetDef | null {
	return CAMPAIGN_SETS.find((s) => s.setId === setId) ?? null
}

export function getCampaignEntryByOrder(
	order: number,
): CampaignEntry | null {
	return CAMPAIGN_ENTRIES.find((entry) => entry.order === order) ?? null
}

export function getCampaignEntryByPuzzleId(
	puzzleId: string,
): CampaignEntry | null {
	return (
		CAMPAIGN_ENTRIES.find((entry) => entry.puzzleId === puzzleId) ?? null
	)
}

export function resolveCampaignPuzzle(
	puzzleId: string,
): CatalogPuzzle | null {
	return getRuntimePuzzleById(puzzleId)
}

export function getCampaignPuzzleTier(
	puzzleId: string,
): DifficultyTier | 'UNRATED' {
	const entry = getRuntimePuzzleEntry(puzzleId)
	return entry?.tier ?? 'UNRATED'
}

export function getCampaignPuzzleSize(
	puzzleId: string,
): { readonly width: number; readonly height: number } | null {
	const entry = getRuntimePuzzleEntry(puzzleId)
	if (entry === null) {
		return null
	}
	return { width: entry.width, height: entry.height }
}

export function isProductionCampaignId(puzzleId: string): boolean {
	return getCampaignEntryByPuzzleId(puzzleId) !== null
}
