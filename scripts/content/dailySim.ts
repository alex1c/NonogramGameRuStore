/**
 * Candidate Daily pool simulation for Phase 8C B1000.
 * Uses the same selector algorithm as runtime daily-v1, but against the
 * candidate catalog — does NOT bump or replace current daily-v1.
 */

import {
	buildDailyPoolIndex,
	selectDailyPuzzle,
	type DailyPoolEntry,
} from '../../src/daily/selector'
import { nextDayKey, type DayKey } from '../../src/daily/dateUtils'
import type { CandidateAuditRecord } from './types'

/** Advance a DayKey by N calendar days (DST-safe via nextDayKey). */
function addDaysToDayKey(dayKey: DayKey, days: number): DayKey {
	let cursor = dayKey
	for (let i = 0; i < days; i += 1) {
		cursor = nextDayKey(cursor)
	}
	return cursor
}

export interface DailyRhythmProposal {
	readonly monday: string
	readonly tuesday: string
	readonly wednesday: string
	readonly thursday: string
	readonly friday: string
	readonly saturday: string
	readonly sunday: string
	readonly note: string
}

export interface DailySimulation {
	readonly eligibleCount: number
	readonly excludedCount: number
	readonly yearsSimulated: number
	readonly days: number
	readonly immediateRepeats: number
	readonly repeatWithin7Days: number
	readonly minFrequency: number
	readonly maxFrequency: number
	readonly distributionByTier: Readonly<Record<string, number>>
	readonly distributionBySize: Readonly<Record<string, number>>
	readonly rhythmProposal: DailyRhythmProposal
}

const MAX_DAILY_CELLS = 20 * 20

/**
 * Eligible Daily candidates: production, dailyEligible flag, not oversized.
 */
export function buildCandidateDailyEntries(
	records: readonly CandidateAuditRecord[],
): {
	readonly eligible: readonly DailyPoolEntry[]
	readonly excludedCount: number
} {
	const eligible: DailyPoolEntry[] = []
	let excluded = 0
	const sorted = [...records].sort((a, b) => a.id.localeCompare(b.id))
	for (const row of sorted) {
		const cells = row.width * row.height
		const tooLarge = cells > MAX_DAILY_CELLS
		const hasWarn = row.warnings.some(
			(w) => w !== 'needs_human_recognizability_review',
		)
		if (
			!row.dailyEligible ||
			row.contentRole !== 'production' ||
			row.tier === 'UNRATED' ||
			tooLarge ||
			hasWarn
		) {
			excluded += 1
			continue
		}
		eligible.push({
			puzzleId: row.id,
			tier: row.tier,
			width: row.width,
			height: row.height,
		})
	}
	return { eligible, excludedCount: excluded }
}

/**
 * Simulate Daily selection for N years on the candidate pool.
 */
export function simulateDailyPool(
	records: readonly CandidateAuditRecord[],
	years = 3,
	epoch: DayKey = '2026-09-28',
): DailySimulation {
	const { eligible, excludedCount } = buildCandidateDailyEntries(records)
	const index = buildDailyPoolIndex(eligible)
	const days = Math.round(years * 365.25)
	const freq = new Map<string, number>()
	const byTier: Record<string, number> = {}
	const bySize: Record<string, number> = {}
	let immediateRepeats = 0
	let repeatWithin7Days = 0
	let prevId: string | null = null
	const recent: string[] = []
	const memo = new Map<string, ReturnType<typeof selectDailyPuzzle>>()

	for (let i = 0; i < days; i += 1) {
		const day = addDaysToDayKey(epoch, i)
		const sel = selectDailyPuzzle(day, index, memo)
		const id = sel.puzzleId
		freq.set(id, (freq.get(id) ?? 0) + 1)
		const entry = eligible.find((e) => e.puzzleId === id)
		if (entry !== undefined) {
			byTier[entry.tier] = (byTier[entry.tier] ?? 0) + 1
			const sizeKey = `${entry.width}x${entry.height}`
			bySize[sizeKey] = (bySize[sizeKey] ?? 0) + 1
		}
		if (prevId !== null && prevId === id) {
			immediateRepeats += 1
		}
		if (recent.includes(id)) {
			repeatWithin7Days += 1
		}
		recent.push(id)
		if (recent.length > 7) {
			recent.shift()
		}
		prevId = id
	}

	const frequencies = [...freq.values()]
	const minFrequency =
		frequencies.length === 0 ? 0 : Math.min(...frequencies)
	const maxFrequency =
		frequencies.length === 0 ? 0 : Math.max(...frequencies)

	return {
		eligibleCount: eligible.length,
		excludedCount,
		yearsSimulated: years,
		days,
		immediateRepeats,
		repeatWithin7Days,
		minFrequency,
		maxFrequency,
		distributionByTier: byTier,
		distributionBySize: bySize,
		rhythmProposal: {
			monday: 'EASY',
			tuesday: 'MEDIUM',
			wednesday: 'EASY/MEDIUM',
			thursday: 'HARD',
			friday: 'MEDIUM',
			saturday: 'HARD',
			sunday: 'HARD/EXPERT featured',
			note: 'Proposal only — current runtime remains daily-v1; future daily-v2 may adopt this rhythm against B1000.',
		},
	}
}
