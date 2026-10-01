/**
 * Runtime integration audit — B1000 production index integrity (no solvers).
 * npm run audit:runtime-content
 */

import {
	CAMPAIGN_ENTRIES,
	CAMPAIGN_SETS,
	SET_UNLOCK_AFTER_COMPLETIONS,
} from '../src/campaign/definition'
import {
	GALLERY_COLLECTIONS,
	GALLERY_ITEMS,
} from '../src/gallery/definitions'
import {
	getRuntimeCampaignSets,
	getRuntimeCatalogMeta,
	getRuntimeDailyEligibleIds,
	getRuntimePuzzleEntry,
	getRuntimePuzzleIds,
	PRODUCTION_CATALOG_CHECKSUM,
	PRODUCTION_PUZZLE_COUNT,
} from '../src/content/runtime'
import { getDailyPoolIndex, DAILY_SELECTION_VERSION } from '../src/daily/selector'
import { LEGACY_DEVELOPMENT_PUZZLE_IDS } from '../src/content/legacyCatalog'

function main(): void {
	const meta = getRuntimeCatalogMeta()
	const issues: string[] = []

	console.log('Runtime content integration audit (Phase 8D)')
	console.log(`catalog=${meta.catalogVersion}`)
	console.log(`generator=${meta.generatorVersion}`)
	console.log(`checksum=${meta.checksum}`)
	console.log(`puzzleCount=${meta.puzzleCount}`)
	console.log(`dailyVersion=${DAILY_SELECTION_VERSION}`)
	console.log(`campaignSets=${CAMPAIGN_SETS.length}`)
	console.log(`unlockAfter=${SET_UNLOCK_AFTER_COMPLETIONS}`)
	console.log(`galleryCollections=${GALLERY_COLLECTIONS.length}`)
	console.log(`galleryItems=${GALLERY_ITEMS.length}`)
	console.log(`dailyEligible=${getRuntimeDailyEligibleIds().length}`)
	console.log(`legacyCompatIds=${LEGACY_DEVELOPMENT_PUZZLE_IDS.length}`)

	if (meta.checksum !== PRODUCTION_CATALOG_CHECKSUM) {
		issues.push('checksum constant mismatch')
	}
	if (meta.puzzleCount !== 1000 || PRODUCTION_PUZZLE_COUNT !== 1000) {
		issues.push(`puzzleCount ${meta.puzzleCount}`)
	}
	if (CAMPAIGN_SETS.length !== 20) {
		issues.push(`sets ${CAMPAIGN_SETS.length}`)
	}
	if (CAMPAIGN_ENTRIES.length !== 1000) {
		issues.push(`campaign entries ${CAMPAIGN_ENTRIES.length}`)
	}
	if (SET_UNLOCK_AFTER_COMPLETIONS !== 35) {
		issues.push(`unlockAfter ${SET_UNLOCK_AFTER_COMPLETIONS}`)
	}
	if (getRuntimeCampaignSets().length !== 20) {
		issues.push('runtime campaign sets != 20')
	}
	for (const set of CAMPAIGN_SETS) {
		if (set.puzzleIds.length !== 50) {
			issues.push(`set ${set.setId} size ${set.puzzleIds.length}`)
		}
	}
	const ids = getRuntimePuzzleIds()
	if (new Set(ids).size !== ids.length) {
		issues.push('duplicate runtime ids')
	}
	for (const id of ids) {
		const entry = getRuntimePuzzleEntry(id)
		if (entry === null) {
			issues.push(`missing entry ${id}`)
			break
		}
		if (
			!entry.contentFingerprint ||
			entry.rowClues.length !== entry.height ||
			entry.columnClues.length !== entry.width
		) {
			issues.push(`bad metadata ${id}`)
			break
		}
	}
	if (GALLERY_COLLECTIONS.length !== 20) {
		issues.push('gallery collections != 20')
	}
	if (GALLERY_ITEMS.length !== 1000) {
		issues.push(`gallery items ${GALLERY_ITEMS.length}`)
	}
	const daily = getDailyPoolIndex()
	if (daily.version !== 'daily-v2') {
		issues.push(`daily version ${daily.version}`)
	}
	if (daily.entries.length !== getRuntimeDailyEligibleIds().length) {
		issues.push('daily pool size mismatch')
	}
	// Legacy IDs must not appear as production campaign entries.
	const campaignIds = new Set(CAMPAIGN_ENTRIES.map((e) => e.puzzleId))
	for (const legacyId of LEGACY_DEVELOPMENT_PUZZLE_IDS) {
		if (campaignIds.has(legacyId)) {
			issues.push(`legacy id retained in campaign: ${legacyId}`)
		}
	}

	if (issues.length > 0) {
		console.error('FAIL')
		for (const issue of issues) {
			console.error(` - ${issue}`)
		}
		process.exitCode = 1
		return
	}
	console.log('PASS')
	console.log(
		'startupStrategy=lazy-decode; no catalog-wide solver/difficulty audit',
	)
}

main()
