/**
 * Campaign quality gate — fails hard on structural issues.
 */

import { analyzeDifficulty } from '../domain/difficulty/analyzer'
import { getProductionPuzzleById } from '../content/playable'
import {
	PHASE4_CAMPAIGN_ENTRIES,
	type CampaignEntry,
} from './definition'

export interface CampaignAuditIssue {
	readonly code: string
	readonly message: string
	readonly puzzleId?: string
	readonly order?: number
}

export interface CampaignAuditSummary {
	readonly total: number
	readonly pass: number
	readonly fail: number
	readonly duplicateIds: number
	readonly duplicateOrders: number
	readonly missing: number
	readonly notProductionReady: number
	readonly issues: readonly CampaignAuditIssue[]
}

export function auditCampaign(
	entries: readonly CampaignEntry[] = PHASE4_CAMPAIGN_ENTRIES,
): CampaignAuditSummary {
	const issues: CampaignAuditIssue[] = []
	const seenIds = new Set<string>()
	const seenOrders = new Set<number>()
	let duplicateIds = 0
	let duplicateOrders = 0
	let missing = 0
	let notProductionReady = 0
	let pass = 0

	for (const entry of entries) {
		if (seenIds.has(entry.puzzleId)) {
			duplicateIds += 1
			issues.push({
				code: 'DUPLICATE_ID',
				message: `Duplicate campaign puzzleId: ${entry.puzzleId}`,
				puzzleId: entry.puzzleId,
				order: entry.order,
			})
		} else {
			seenIds.add(entry.puzzleId)
		}

		if (seenOrders.has(entry.order)) {
			duplicateOrders += 1
			issues.push({
				code: 'DUPLICATE_ORDER',
				message: `Duplicate campaign order: ${entry.order}`,
				puzzleId: entry.puzzleId,
				order: entry.order,
			})
		} else {
			seenOrders.add(entry.order)
		}

		if (!Number.isInteger(entry.order) || entry.order < 1) {
			issues.push({
				code: 'INVALID_ORDER',
				message: `Invalid order ${entry.order}`,
				puzzleId: entry.puzzleId,
				order: entry.order,
			})
		}

		const puzzle = getProductionPuzzleById(entry.puzzleId)
		if (puzzle === null) {
			missing += 1
			notProductionReady += 1
			issues.push({
				code: 'MISSING_OR_NOT_READY',
				message: `Puzzle missing or not productionReady: ${entry.puzzleId}`,
				puzzleId: entry.puzzleId,
				order: entry.order,
			})
			continue
		}

		// Touch difficulty once to ensure metadata is analyzable.
		const difficulty = analyzeDifficulty(puzzle)
		if (difficulty.tier === 'UNRATED') {
			issues.push({
				code: 'UNRATED',
				message: `Campaign puzzle is UNRATED: ${entry.puzzleId}`,
				puzzleId: entry.puzzleId,
				order: entry.order,
			})
			continue
		}

		pass += 1
	}

	const fail = issues.length
	return {
		total: entries.length,
		pass,
		fail,
		duplicateIds,
		duplicateOrders,
		missing,
		notProductionReady,
		issues,
	}
}

export function assertCampaignValid(): void {
	const summary = auditCampaign()
	if (summary.fail > 0 || summary.pass !== summary.total) {
		const detail = summary.issues
			.map((issue) => `${issue.code}: ${issue.message}`)
			.join('; ')
		throw new Error(`Campaign audit failed: ${detail}`)
	}
}
