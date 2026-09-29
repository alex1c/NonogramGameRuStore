/**
 * Save migration entry point.
 * Phase 6: v1 → v2 (Daily). Phase 7: v2 → v3 (Hints).
 * Phase 8B: v3 → v4 (sticky achievements). Chain v1 → v4 supported.
 */

import { createDefaultSave } from './createDefaultSave'
import { CURRENT_SAVE_SCHEMA_VERSION, type SaveRoot } from './schema'
import {
	migrateV1DocumentToV2,
	migrateV2DocumentToV3,
	migrateV3DocumentToV4,
	parseAndValidateSave,
	parseAndValidateSaveV1,
	parseAndValidateSaveV2,
	parseAndValidateSaveV3,
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
 * Migrate raw storage payload into a validated SaveRoot (always schema v4).
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

		if (record.schemaVersion === 2) {
			const v2 = parseAndValidateSaveV2(raw)
			if (!v2.ok) {
				return {
					kind: 'recovered',
					save: createDefaultSave(),
					reason: v2.reason,
				}
			}
			return {
				kind: 'ok',
				save: migrateV3DocumentToV4(migrateV2DocumentToV3(v2.save)),
			}
		}

		if (record.schemaVersion === 3) {
			const v3 = parseAndValidateSaveV3(raw)
			if (!v3.ok) {
				return {
					kind: 'recovered',
					save: createDefaultSave(),
					reason: v3.reason,
				}
			}
			return { kind: 'ok', save: migrateV3DocumentToV4(v3.save) }
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
