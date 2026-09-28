/**
 * Save migration entry point.
 * Phase 6: schema v1 → v2 (Daily fields + solvedPuzzleIds).
 */

import { createDefaultSave } from './createDefaultSave'
import { CURRENT_SAVE_SCHEMA_VERSION, type SaveRoot } from './schema'
import {
	migrateV1DocumentToV2,
	parseAndValidateSave,
	parseAndValidateSaveV1,
	type SaveParseOutcome,
} from './validate'

export type MigrateSaveResult =
	| { readonly kind: 'empty'; readonly save: SaveRoot }
	| { readonly kind: 'ok'; readonly save: SaveRoot }
	| { readonly kind: 'recovered'; readonly save: SaveRoot; readonly reason: string }
	| {
			readonly kind: 'unsupported'
			readonly save: SaveRoot
			readonly reason: string
	  }

/**
 * Migrate raw storage payload into a validated SaveRoot (always schema v2).
 * - null / missing → default
 * - valid v2 → load
 * - valid v1 → migrate to v2 (solvedPuzzleIds = completedPuzzleIds)
 * - malformed → recovered default
 * - unknown future schema → fail safely with recovered default
 */
export function migrateSave(raw: unknown): MigrateSaveResult {
	if (raw === null || raw === undefined) {
		return { kind: 'empty', save: createDefaultSave() }
	}

	if (typeof raw === 'object' && raw !== null) {
		const record = raw as Record<string, unknown>
		if (!('schemaVersion' in record)) {
			return {
				kind: 'recovered',
				save: createDefaultSave(),
				reason: 'Missing schemaVersion',
			}
		}
		if (
			typeof record.schemaVersion === 'number' &&
			record.schemaVersion > CURRENT_SAVE_SCHEMA_VERSION
		) {
			return {
				kind: 'unsupported',
				save: createDefaultSave(),
				reason: `Future schemaVersion ${record.schemaVersion}`,
			}
		}

		// Phase 5 → Phase 6: migrate v1 document.
		if (record.schemaVersion === 1) {
			const v1 = parseAndValidateSaveV1(raw)
			if (!v1.ok) {
				return {
					kind: 'recovered',
					save: createDefaultSave(),
					reason: v1.reason,
				}
			}
			return { kind: 'ok', save: migrateV1DocumentToV2(v1.save) }
		}
	}

	const parsed: SaveParseOutcome = parseAndValidateSave(raw)
	if (parsed.ok) {
		return { kind: 'ok', save: parsed.save }
	}
	return {
		kind: 'recovered',
		save: createDefaultSave(),
		reason: parsed.reason,
	}
}

/**
 * Parse a JSON string from storage.
 * Malformed JSON recovers to default without throwing.
 */
export function migrateSaveJson(rawJson: string | null): MigrateSaveResult {
	if (rawJson === null || rawJson.trim() === '') {
		return { kind: 'empty', save: createDefaultSave() }
	}
	try {
		const parsed: unknown = JSON.parse(rawJson)
		return migrateSave(parsed)
	} catch {
		return {
			kind: 'recovered',
			save: createDefaultSave(),
			reason: 'Malformed JSON',
		}
	}
}
