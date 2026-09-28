/**
 * Gallery + Achievements (Phase 5–6).
 *
 * ## Save
 * Schema v2. Gallery unlock source = `solvedPuzzleIds` (any mode).
 * Campaign progress remains `completedPuzzleIds`.
 * Migration v1→v2: `solvedPuzzleIds = completedPuzzleIds`.
 *
 * ## Gallery privacy
 * Locked view-models never include authored solution or revealing titles.
 * Gallery Detail re-checks solve unlock before exposing preview.
 *
 * ## Achievements
 * Unique / difficulty / collection / large_grid use `solvedPuzzleIds`.
 * Daily achievements use Daily completions + streak.
 * See achievement source table in DAILY.md / evaluator comments.
 *
 * ## Fingerprint
 * Presentation title/collection metadata must not change active-game fingerprint.
 *
 * Temporary development collections over the 21-puzzle baseline — not final
 * RuStore themed packs.
 */

export {}
