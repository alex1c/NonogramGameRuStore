/**
 * Daily selector audit — npm run audit:daily
 * Uses a fixed reference range (not wall-clock "today").
 */

import { getGalleryItemDef } from '../src/gallery/definitions'
import { getProductionPuzzleById } from '../src/content/playable'
import { DAILY_EPOCH_DAY, nextDayKey, type DayKey } from '../src/daily/dateUtils'
import {
	DAILY_KNOWN_VECTORS,
	DAILY_SELECTION_VERSION,
	desiredTierForDay,
	getDailyPoolIndex,
	selectDailyPuzzle,
} from '../src/daily/selector'

const AUDIT_START: DayKey = DAILY_EPOCH_DAY
const AUDIT_DAYS = 365

function run(): void {
	const index = getDailyPoolIndex()
	const poolSize = index.entries.length
	let invalid = 0
	let missing = 0
	let notProductionReady = 0
	let immediateRepeats = 0
	let missingGalleryDefinition = 0
	let knownVectorMismatch = 0
	let repeatWithin7Days = 0
	let rhythmMismatch = 0

	const byPuzzle = new Map<string, number>()
	const byDifficulty = new Map<string, number>()
	const sequence: string[] = []

	let day = AUDIT_START
	for (let i = 0; i < AUDIT_DAYS; i += 1) {
		let selection
		try {
			selection = selectDailyPuzzle(day, index)
		} catch {
			invalid += 1
			day = nextDayKey(day)
			continue
		}
		const puzzle = getProductionPuzzleById(selection.puzzleId)
		if (puzzle === null) {
			missing += 1
			notProductionReady += 1
		}
		// getProductionPuzzleById only returns productionReady catalog entries.
		if (getGalleryItemDef(selection.puzzleId) === null) {
			missingGalleryDefinition += 1
		}
		if (
			sequence.length > 0 &&
			sequence[sequence.length - 1] === selection.puzzleId &&
			poolSize > 1
		) {
			immediateRepeats += 1
		}
		const window = sequence.slice(-7)
		if (window.includes(selection.puzzleId)) {
			repeatWithin7Days += 1
		}
		if (selection.desiredTier !== selection.actualTier) {
			// Fallback used — count separately, not a hard fail if pool sparse
			rhythmMismatch += 1
		}
		// Soft rhythm check: when desired tier exists in pool, actual should match
		const desiredPool = index.byTier.get(desiredTierForDay(day)) ?? []
		if (
			desiredPool.length > 0 &&
			selection.actualTier !== selection.desiredTier
		) {
			invalid += 1
		}

		byPuzzle.set(
			selection.puzzleId,
			(byPuzzle.get(selection.puzzleId) ?? 0) + 1,
		)
		byDifficulty.set(
			selection.actualTier,
			(byDifficulty.get(selection.actualTier) ?? 0) + 1,
		)
		sequence.push(selection.puzzleId)
		day = nextDayKey(day)
	}

	for (const vector of DAILY_KNOWN_VECTORS) {
		const got = selectDailyPuzzle(vector.dayKey, index)
		if (got.puzzleId !== vector.puzzleId) {
			knownVectorMismatch += 1
			console.error(
				`known-vector mismatch ${vector.dayKey}: expected ${vector.puzzleId}, got ${got.puzzleId}`,
			)
		}
	}

	const frequencies = [...byPuzzle.values()]
	const minFrequency = frequencies.length === 0 ? 0 : Math.min(...frequencies)
	const maxFrequency = frequencies.length === 0 ? 0 : Math.max(...frequencies)

	const endDay = day
	const lines = [
		`version=${DAILY_SELECTION_VERSION}`,
		`epoch=${DAILY_EPOCH_DAY}`,
		`range=${AUDIT_START}..${endDay}`,
		`days=${AUDIT_DAYS}`,
		`pool=${poolSize}`,
		`invalid=${invalid}`,
		`missing=${missing}`,
		`notProductionReady=${notProductionReady}`,
		`missingGalleryDefinition=${missingGalleryDefinition}`,
		`immediateRepeats=${immediateRepeats}`,
		`repeatWithin7Days=${repeatWithin7Days}`,
		`rhythmFallbackDays=${rhythmMismatch}`,
		`knownVectorMismatch=${knownVectorMismatch}`,
		`minFrequency=${minFrequency}`,
		`maxFrequency=${maxFrequency}`,
		`distributionByDifficulty=${[...byDifficulty.entries()]
			.map(([k, v]) => `${k}:${v}`)
			.join(',')}`,
	]
	console.log(lines.join('\n'))

	const critical =
		invalid > 0 ||
		missing > 0 ||
		notProductionReady > 0 ||
		missingGalleryDefinition > 0 ||
		immediateRepeats > 0 ||
		knownVectorMismatch > 0 ||
		poolSize < 1

	if (critical) {
		process.exitCode = 1
	}
}

run()
