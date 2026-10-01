/**
 * Production B1000 runtime index — loads compact artifact without solvers.
 * Solutions decode lazily on puzzle open.
 */

import { SolutionCell, type Puzzle } from '../../domain/nonogram/types'
import type { CatalogPuzzle } from '../types'
import { CONTENT_SCHEMA_VERSION } from '../types'
import type {
	RuntimeCampaignSetDef,
	RuntimeCatalogArtifact,
	RuntimeCollectionDef,
	RuntimePuzzleEntry,
} from './types'
import artifactJson from './b1000Catalog.json'

const artifact = artifactJson as RuntimeCatalogArtifact

/** Pinned Phase 8C / 8D production baseline. */
export const PRODUCTION_CATALOG_VERSION = artifact.catalogVersion
export const PRODUCTION_GENERATOR_VERSION = artifact.generatorVersion
export const PRODUCTION_CATALOG_CHECKSUM = artifact.checksum
export const PRODUCTION_PUZZLE_COUNT = artifact.puzzleCount
export const CAMPAIGN_SET_UNLOCK_AFTER = artifact.unlockAfterCompletions

let entryById: ReadonlyMap<string, RuntimePuzzleEntry> | null = null
/** Lazy CatalogPuzzle cache — only puzzles the player actually opens. */
const decodedCache = new Map<string, CatalogPuzzle>()

function getEntryMap(): ReadonlyMap<string, RuntimePuzzleEntry> {
	if (entryById !== null) {
		return entryById
	}
	const map = new Map<string, RuntimePuzzleEntry>()
	for (const entry of artifact.puzzles) {
		map.set(entry.id, entry)
	}
	entryById = map
	return map
}

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

function entryToCatalogPuzzle(entry: RuntimePuzzleEntry): CatalogPuzzle {
	const cached = decodedCache.get(entry.id)
	if (cached !== undefined) {
		return cached
	}
	const solution = Object.freeze(
		asciiToSolution(entry.ascii, entry.width, entry.height),
	) as Puzzle['solution']
	const puzzle: CatalogPuzzle = Object.freeze({
		id: entry.id,
		width: entry.width,
		height: entry.height,
		solution,
		rowClues: entry.rowClues,
		columnClues: entry.columnClues,
		metadata: Object.freeze({
			title: entry.titleRu,
			category: entry.collectionId,
			collection: entry.collectionId,
			difficulty: entry.tier,
			colorMode: 'bw' as const,
			source: 'b1000-runtime',
		}),
		schemaVersion: CONTENT_SCHEMA_VERSION,
		title: entry.titleRu,
		category: entry.collectionId,
		collection: entry.collectionId,
		tags: Object.freeze([entry.tier]),
		provenance: '2026.1-b1000-r1',
		assignedDifficulty: entry.tier,
	})
	decodedCache.set(entry.id, puzzle)
	return puzzle
}

export function getRuntimeCatalogMeta(): {
	readonly catalogVersion: string
	readonly generatorVersion: string
	readonly checksum: string
	readonly puzzleCount: number
} {
	return {
		catalogVersion: artifact.catalogVersion,
		generatorVersion: artifact.generatorVersion,
		checksum: artifact.checksum,
		puzzleCount: artifact.puzzleCount,
	}
}

export function getRuntimePuzzleEntry(
	id: string,
): RuntimePuzzleEntry | null {
	return getEntryMap().get(id) ?? null
}

/** Decode one production puzzle — no catalog-wide solver audit. */
export function getRuntimePuzzleById(id: string): CatalogPuzzle | null {
	const entry = getEntryMap().get(id)
	if (entry === undefined) {
		return null
	}
	return entryToCatalogPuzzle(entry)
}

export function getRuntimeCampaignSets(): readonly RuntimeCampaignSetDef[] {
	return artifact.campaignSets
}

export function getRuntimeCollections(): readonly RuntimeCollectionDef[] {
	return artifact.collections
}

export function getRuntimeDailyEligibleIds(): readonly string[] {
	return artifact.dailyEligibleIds
}

export function isRuntimeProductionId(id: string): boolean {
	return getEntryMap().has(id)
}

export function getRuntimePuzzleIds(): readonly string[] {
	return artifact.puzzles.map((p) => p.id)
}

export function getDecodedPuzzleCacheSize(): number {
	return decodedCache.size
}

/** Test helper — clear lazy decode cache between suites if needed. */
export function resetRuntimeDecodeCache(): void {
	decodedCache.clear()
}
