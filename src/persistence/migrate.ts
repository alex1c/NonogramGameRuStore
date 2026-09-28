/**
 * Save migration entry point.
 * Phase 4 ships schema v1 only — foundation for future versions.
 */

import { createDefaultSave } from './createDefaultSave'
import { CURRENT_SAVE_SCHEMA_VERSION, type SaveRoot } from './schema'
import { parseAndValidateSave, type SaveParseOutcome } from './validate'

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
 * Migrate raw storage payload into a validated SaveRoot.
 * - null / missing → default
 * - valid current schema → load
 * - malformed → recovered default
 * - unknown future schema → fail safely with recovered default
 */
export function migrateSave(raw: unknown): MigrateSaveResult {
	if (raw === null || raw === undefined) {
		return { kind: 'empty', save: createDefaultSave() }
	}

	// Legacy / unstructured payloads without schemaVersion.
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
