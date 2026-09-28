/**
 * Persistence contracts (Phase 4–6).
 *
 * ## Schema
 * - Key: `nonogram.save.v1` (historical suffix — schemaVersion inside is authoritative)
 * - `CURRENT_SAVE_SCHEMA_VERSION = 2`
 * - One versioned root object (atomic write)
 *
 * ## Field semantics (v2)
 * - `completedPuzzleIds` — Campaign completions only
 * - `solvedPuzzleIds` — unique puzzles solved in any mode (Gallery unlock source)
 * - `startedPuzzleIds` — Campaign starts (Phase 4 semantics preserved)
 * - `activeGame` — unfinished Campaign party
 * - `activeDailyGame` — unfinished Daily party (may coexist with Campaign)
 * - `dailyCompletionRecords` — `{ dayKey, puzzleId, selectionVersion, activeTimeMs }[]`
 * - `restoredDailyDays` — streak bridges (not puzzle solves)
 * - `dailyStartedDay` — user participation start (`null` until first Daily screen open)
 *
 * ## Migration
 * `migrateSave` / `migrateSaveJson`:
 * - no save → default v2
 * - valid v2 → load
 * - valid v1 → migrate to v2 (`solvedPuzzleIds = completedPuzzleIds`, Daily empty)
 * - malformed / invalid → recovered default
 * - future schema → unsupported + recovered default
 *
 * ## Active game
 * Stores puzzleId, contentFingerprint, serialized player cells, tool,
 * accumulatedActiveMs, timestamps. Does **not** store undo/redo history,
 * pinch/pan, overlays, or solution/clues.
 * Daily active additionally stores `dayKey` + `selectionVersion`.
 *
 * ## Timer
 * Active solve time only. Pause on leaving Game / AppState background.
 * Wall time while closed must not accumulate. Campaign and Daily timers are separate.
 *
 * ## Undo history
 * Live session keeps Undo/Redo. After Continue / kill-relaunch history is empty.
 *
 * ## Fingerprint
 * Deterministic from id + dimensions + clues. Mismatch → clear that branch’s active game.
 *
 * ## Completion
 * Campaign: atomic completed + solved + stats + best time + activeGame=null.
 * Daily: atomic Daily record + solved + stats + activeDailyGame=null
 *   (does NOT touch campaign completed / best times / activeGame).
 * Persisted at solve time, not when the overlay is dismissed.
 *
 * ## Write queue
 * `SaveRepository` serializes writes; single root authority for Campaign + Daily.
 * Failures do not permanently block the chain.
 *
 * ## Campaign
 * Temporary 21-puzzle development baseline (not final RuStore pack).
 * Unlock: levels 1–5 open; then sequential N after N−1 completed.
 *
 * ## Daily
 * See [docs/DAILY.md](./DAILY.md).
 */
