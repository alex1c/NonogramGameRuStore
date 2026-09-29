/**
 * Sticky achievement ID helpers — normalize, dedupe, merge.
 */

/** Normalize a candidate sticky ID; return null if unusable. */
export function normalizeAchievementId(raw: unknown): string | null {
	if (typeof raw !== 'string') {
		return null
	}
	const trimmed = raw.trim()
	if (trimmed.length === 0) {
		return null
	}
	return trimmed
}

/**
 * Parse persisted sticky IDs with safe recovery:
 * non-arrays → []; malformed entries dropped; unique stable order preserved.
 */
export function normalizeStickyAchievementIds(
	raw: unknown,
): readonly string[] {
	if (!Array.isArray(raw)) {
		return Object.freeze([])
	}
	const seen = new Set<string>()
	const out: string[] = []
	for (const item of raw) {
		const id = normalizeAchievementId(item)
		if (id === null || seen.has(id)) {
			continue
		}
		seen.add(id)
		out.push(id)
	}
	return Object.freeze(out)
}

/** Deterministic union: existing order first, then new IDs in input order. */
export function mergeStickyAchievementIds(
	existing: readonly string[],
	extra: readonly string[],
): readonly string[] {
	const seen = new Set<string>()
	const out: string[] = []
	for (const raw of [...existing, ...extra]) {
		const id = normalizeAchievementId(raw)
		if (id === null || seen.has(id)) {
			continue
		}
		seen.add(id)
		out.push(id)
	}
	return Object.freeze(out)
}
