/**
 * User-facing time formatters (no raw milliseconds).
 */

function pad2(value: number): string {
	return value.toString().padStart(2, '0')
}

/**
 * Puzzle / game elapsed and best times.
 * < 1 hour → MM:SS (03:42)
 * ≥ 1 hour → H:MM:SS (1:03:42)
 */
export function formatBestTime(ms: number): string {
	const totalSec = Math.max(0, Math.floor(ms / 1000))
	const hours = Math.floor(totalSec / 3600)
	const minutes = Math.floor((totalSec % 3600) / 60)
	const seconds = totalSec % 60
	if (hours > 0) {
		return `${hours}:${pad2(minutes)}:${pad2(seconds)}`
	}
	return `${pad2(minutes)}:${pad2(seconds)}`
}

/** Alias for in-game timer display — same contract as best time. */
export function formatGameElapsed(ms: number): string {
	return formatBestTime(ms)
}

/**
 * Aggregate statistics duration.
 * Examples: 37 мин · 2 ч 18 мин · 45 сек
 */
export function formatTotalActiveTime(ms: number): string {
	const totalSec = Math.max(0, Math.floor(ms / 1000))
	if (totalSec < 60) {
		return `${totalSec} сек`
	}
	const hours = Math.floor(totalSec / 3600)
	const minutes = Math.floor((totalSec % 3600) / 60)
	if (hours === 0) {
		return `${minutes} мин`
	}
	if (minutes === 0) {
		return `${hours} ч`
	}
	return `${hours} ч ${minutes} мин`
}
