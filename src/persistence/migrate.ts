/**
 * Save migration entry point.
 * Phase 6: v1 → v2 (Daily). Phase 7: v2 → v3 (Hints).
 * Phase 8B: v3 → v4 (sticky achievements).
 * Phase 9: v4 → v5 (tutorial).
 * Phase 9.1: v5 → v6 (daily help allowances).
 * Phase 9C: v6 → v7 (tutorialFirstRunSkipped). Chain v1 → v7 supported.
 */

import { localDayKey } from '../daily/dateUtils'
import { createDefaultSave } from './createDefaultSave'
import { CURRENT_SAVE_SCHEMA_VERSION, type SaveRoot } from './schema'
import {
	migrateV1DocumentToV2,
	migrateV2DocumentToV3,
	migrateV3DocumentToV4,
	migrateV4DocumentToV5,
	migrateV5DocumentToV6,
	migrateV6DocumentToV7,
	parseAndValidateSave,
	parseAndValidateSaveV1,
	parseAndValidateSaveV2,
	parseAndValidateSaveV3,
	parseAndValidateSaveV4,
	parseAndValidateSaveV5,
	parseAndValidateSaveV6,
	type SaveParseOutcome,
} from './validate'

/**
 * Load-result taxonomy. Callers MUST branch on `kind`; only `empty`, `ok`
 * and `recovered` (after a successful raw backup) are safe to overwrite.
 *
 * - `empty`        NO_DATA: storage had no payload (fresh install).
 * - `ok`           VALID: payload parsed; `migrated` is true when it was
 *                  upgraded from an older schema version.
 * - `recovered`    CORRUPT: payload is malformed / invalid. `save` is a safe
 *                  default; `rawPayload` carries the original text (when
 *                  known) so it can be backed up before any overwrite.
 * - `unsupported`  UNSUPPORTED_FUTURE_SCHEMA: written by a newer app version.
 *                  MUST NOT be overwritten (would destroy newer data).
 * - `io_error`     IO_READ_ERROR: storage read failed (state unknown).
 *                  MUST NOT be overwritten (existing data may be intact).
 */
export type MigrateSaveResult =
	| { readonly kind: 'empty'; readonly save: SaveRoot }
	| {
			readonly kind: 'ok'
			readonly save: SaveRoot
			/** True when the document was upgraded from an older schema. */
			readonly migrated: boolean
	  }
	| {
			readonly kind: 'recovered'
			readonly save: SaveRoot
			readonly reason: string
			/** Original raw text of the corrupt payload, when available. */
			readonly rawPayload?: string
	  }
	| {
			readonly kind: 'unsupported'
			readonly save: SaveRoot
			readonly reason: string
			/** Original raw text of the newer-schema payload, when available. */
			readonly rawPayload?: string
	  }
	| {
			readonly kind: 'io_error'
			readonly save: SaveRoot
			readonly reason: string
	  }

/** Build a `recovered` result carrying a safe default save. */
function recovered(reason: string): MigrateSaveResult {
	return { kind: 'recovered', save: createDefaultSave(), reason }
}

/**
 * Migrate raw storage payload into a validated SaveRoot (always schema v7).
 */
export function migrateSave(raw: unknown): MigrateSaveResult {
	const today = localDayKey()
	if (raw === null || raw === undefined) {
		return { kind: 'empty', save: createDefaultSave() }
	}

	if (typeof raw === 'object' && raw !== null) {
		const record = raw as Record<string, unknown>
		if (!('schemaVersion' in record)) {
			return recovered('Missing schemaVersion')
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
				return recovered(v1.reason)
			}
			return {
				kind: 'ok',
				save: migrateV1DocumentToV2(v1.save, today),
				migrated: true,
			}
		}

		if (record.schemaVersion === 2) {
			const v2 = parseAndValidateSaveV2(raw)
			if (!v2.ok) {
				return recovered(v2.reason)
			}
			return {
				kind: 'ok',
				save: migrateV6DocumentToV7(
					migrateV5DocumentToV6(
						migrateV4DocumentToV5(
							migrateV3DocumentToV4(migrateV2DocumentToV3(v2.save)),
						),
						today,
					),
				),
				migrated: true,
			}
		}

		if (record.schemaVersion === 3) {
			const v3 = parseAndValidateSaveV3(raw)
			if (!v3.ok) {
				return recovered(v3.reason)
			}
			return {
				kind: 'ok',
				save: migrateV6DocumentToV7(
					migrateV5DocumentToV6(
						migrateV4DocumentToV5(migrateV3DocumentToV4(v3.save)),
						today,
					),
				),
				migrated: true,
			}
		}

		if (record.schemaVersion === 4) {
			const v4 = parseAndValidateSaveV4(raw)
			if (!v4.ok) {
				return recovered(v4.reason)
			}
			return {
				kind: 'ok',
				save: migrateV6DocumentToV7(
					migrateV5DocumentToV6(migrateV4DocumentToV5(v4.save), today),
				),
				migrated: true,
			}
		}

		if (record.schemaVersion === 5) {
			const v5 = parseAndValidateSaveV5(raw)
			if (!v5.ok) {
				return recovered(v5.reason)
			}
			return {
				kind: 'ok',
				save: migrateV6DocumentToV7(migrateV5DocumentToV6(v5.save, today)),
				migrated: true,
			}
		}

		if (record.schemaVersion === 6) {
			const v6 = parseAndValidateSaveV6(raw)
			if (!v6.ok) {
				return recovered(v6.reason)
			}
			return {
				kind: 'ok',
				save: migrateV6DocumentToV7(v6.save),
				migrated: true,
			}
		}
	}

	const parsed: SaveParseOutcome = parseAndValidateSave(raw)
	if (parsed.ok) {
		return { kind: 'ok', save: parsed.save, migrated: false }
	}
	return recovered(parsed.reason)
}

/**
 * Parse + migrate a raw JSON string from storage.
 * Corrupt / unsupported results keep the original text in `rawPayload` so the
 * caller can preserve it (backup key) before any overwrite.
 */
export function migrateSaveJson(rawJson: string | null): MigrateSaveResult {
	if (rawJson === null || rawJson.trim() === '') {
		return { kind: 'empty', save: createDefaultSave() }
	}
	let parsed: unknown
	try {
		parsed = JSON.parse(rawJson)
	} catch {
		return { ...recovered('Malformed JSON'), rawPayload: rawJson } as
			MigrateSaveResult
	}
	const result = migrateSave(parsed)
	if (result.kind === 'recovered' || result.kind === 'unsupported') {
		return { ...result, rawPayload: rawJson }
	}
	return result
}
