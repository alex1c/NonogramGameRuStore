/**
 * Campaign integrity audit — Phase 8D B1000 (no full solver run).
 */

import {
	CAMPAIGN_ENTRIES,
	CAMPAIGN_SETS,
	getCampaignPuzzleSize,
	getCampaignTotal,
	SET_UNLOCK_AFTER_COMPLETIONS,
} from './definition'
import { getRuntimePuzzleEntry } from '../content/runtime'

export interface CampaignAuditRow {
	readonly order: number
	readonly puzzleId: string
	readonly setId: string
	readonly size: string
	readonly tier: string
	readonly ok: boolean
	readonly reason?: string
}

export interface CampaignAuditResult {
	readonly total: number
	readonly pass: number
	readonly fail: number
	readonly duplicateIds: number
	readonly duplicateOrders: number
	readonly missing: number
	readonly setCount: number
	readonly unlockAfter: number
	readonly rows: readonly CampaignAuditRow[]
}

export function auditCampaign(): CampaignAuditResult {
	const seenIds = new Set<string>()
	const seenOrders = new Set<number>()
	let duplicateIds = 0
	let duplicateOrders = 0
	let missing = 0
	let pass = 0
	let fail = 0
	const rows: CampaignAuditRow[] = []

	if (CAMPAIGN_SETS.length !== 20) {
		fail += 1
	}
	for (const set of CAMPAIGN_SETS) {
		if (set.puzzleIds.length !== 50) {
			fail += 1
		}
	}

	for (const entry of CAMPAIGN_ENTRIES) {
		if (seenIds.has(entry.puzzleId)) {
			duplicateIds += 1
		}
		seenIds.add(entry.puzzleId)
		if (seenOrders.has(entry.order)) {
			duplicateOrders += 1
		}
		seenOrders.add(entry.order)

		const meta = getRuntimePuzzleEntry(entry.puzzleId)
		const size = getCampaignPuzzleSize(entry.puzzleId)
		const ok = meta !== null && size !== null
		if (!ok) {
			missing += 1
			fail += 1
		} else {
			pass += 1
		}
		rows.push({
			order: entry.order,
			puzzleId: entry.puzzleId,
			setId: entry.setId,
			size: size !== null ? `${size.width}x${size.height}` : '?',
			tier: meta?.tier ?? 'MISSING',
			ok,
			reason: ok ? undefined : 'missing_runtime_entry',
		})
	}

	return {
		total: getCampaignTotal(),
		pass,
		fail: fail + duplicateIds + duplicateOrders,
		duplicateIds,
		duplicateOrders,
		missing,
		setCount: CAMPAIGN_SETS.length,
		unlockAfter: SET_UNLOCK_AFTER_COMPLETIONS,
		rows,
	}
}
