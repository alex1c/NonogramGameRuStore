/**
 * Persistence contracts (Phase 4).
 *
 * ## Schema
 * - Key: `nonogram.save.v1`
 * - `CURRENT_SAVE_SCHEMA_VERSION = 1`
 * - One versioned root object (atomic write)
 *
 * ## Migration
 * `migrateSave` / `migrateSaveJson`:
 * - no save → default
 * - valid v1 → load
 * - malformed / invalid → recovered default
 * - future schema → unsupported + recovered default
 *
 * ## Active game
 * Stores puzzleId, contentFingerprint, serialized player cells, tool,
 * accumulatedActiveMs, timestamps. Does **not** store undo/redo history,
 * pinch/pan, overlays, or solution/clues.
 *
 * ## Timer
 * Active solve time only. Pause on leaving Game / AppState background.
 * Wall time while closed must not accumulate.
 *
 * ## Undo history
 * Live session keeps Undo/Redo. After Continue / kill-relaunch history is empty.
 *
 * ## Fingerprint
 * Deterministic from id + dimensions + clues. Mismatch → clear active game.
 *
 * ## Completion
 * Atomic single root save: completed IDs + stats + best time + activeGame=null.
 * Persisted at solve time, not when the overlay is dismissed.
 *
 * ## Write queue
 * `SaveRepository` serializes writes; failures do not permanently block the chain.
 *
 * ## Campaign
 * Temporary 21-puzzle development baseline (not final RuStore pack).
 * Unlock: levels 1–5 open; then sequential N after N−1 completed.
 */

export {}
