/**
 * Persistence contracts (Phase 4–8B).
 *
 * ## Schema
 * - Key: `nonogram.save.v1` (historical suffix — schemaVersion inside is authoritative)
 * - `CURRENT_SAVE_SCHEMA_VERSION = 4`
 * - One versioned root object (atomic write)
 *
 * ## Field semantics
 * ### v1
 * Campaign progress baseline (completed / started / best times / activeGame).
 * ### v2
 * Daily + `solvedPuzzleIds` + dual active Campaign/Daily.
 * ### v3
 * Hint statistics + `hintsUsedThisRun` on active Campaign/Daily.
 * ### v4
 * Sticky `unlockedAchievementIds` — authoritative unlock history that never
 * shrinks when Gallery taxonomy / targets change. Display state =
 * sticky ∪ currently derived. Migration v3→v4 seeds sticky IDs from a
 * **frozen legacy Phase 7/8A 21-puzzle gallery evaluator**, not future catalogs.
 *
 * - `completedPuzzleIds` — Campaign completions only
 * - `solvedPuzzleIds` — unique puzzles solved in any mode (Gallery unlock source)
 * - `startedPuzzleIds` — Campaign starts (Phase 4 semantics preserved)
 * - `activeGame` — unfinished Campaign party (+ `hintsUsedThisRun`)
 * - `activeDailyGame` — unfinished Daily party (may coexist with Campaign)
 * - `dailyCompletionRecords` — `{ dayKey, puzzleId, selectionVersion, activeTimeMs }[]`
 * - `restoredDailyDays` — streak bridges (not puzzle solves)
 * - `dailyStartedDay` — user participation start (`null` until first Daily screen open)
 * - `statistics.hintRequests` / `hintsApplied` / `teachMeViews` — global help counters
 * - `unlockedAchievementIds` — sticky achievement history (v4+)
 *
 * ## Migration
 * `migrateSave` / `migrateSaveJson`:
 * - no save → default v4
 * - valid v4 → load (normalize/dedupe sticky IDs)
 * - valid v3 → migrate to v4 (seed sticky from legacy v3 achievement snapshot)
 * - valid v2 → migrate to v3 then v4
 * - valid v1 → migrate v2 → v3 → v4
 * - malformed / invalid → recovered default
 * - future schema → unsupported + recovered default
 *
 * Migration does **not** celebrate unlocks and does **not** alter counters.
 *
 * ## Active game
 * Stores puzzleId, contentFingerprint, serialized player cells, tool,
 * accumulatedActiveMs, timestamps, hintsUsedThisRun. Does **not** store
 * undo/redo history, pinch/pan, Help overlay, hint preview, or solution/clues.
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
 * Campaign: atomic completed + solved + stats + best time + activeGame=null
 *   + newly unlocked sticky achievement IDs.
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
