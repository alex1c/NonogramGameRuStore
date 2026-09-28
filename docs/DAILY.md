/**
 * Phase 6 Daily Challenge — offline deterministic dayKey → puzzle.
 *
 * ## System epoch
 * `DAILY_EPOCH_DAY = 2026-09-28` — constant start of Daily system.
 * Days before epoch are not missed and do not participate in streak.
 *
 * ## User participation start
 * `dailyStartedDay` is set on first Daily screen open (not on app update).
 * Migration v1→v2 sets `dailyStartedDay = null` so Phase 5 users do not
 * suddenly see a history of missed days.
 *
 * ## Local date
 * Daily uses device local calendar `YYYY-MM-DD`. No network time.
 * Timezone travel may change “today”; we do not anti-cheat.
 *
 * ## Selector
 * Version: `daily-v1`
 * Pool: all 21 Gallery productionReady puzzles (stable Gallery order).
 * Rhythm (Mon→Sun): EASY, MEDIUM, EASY, HARD, MEDIUM, HARD, EXPERT
 * Fallback: nearest available tier chain when desired tier empty.
 * Hard rule: no immediate repeat when pool > 1.
 * Soft: prefer avoiding last 7 days.
 * Bump `DAILY_SELECTION_VERSION` when pool order/rhythm/hash changes mapping.
 *
 * ## Dual active games
 * `activeGame` (Campaign) and `activeDailyGame` (Daily) coexist.
 * Single root save + serial write queue — no competing repositories.
 *
 * ## Midnight
 * Active Daily keeps its start `dayKey` until completion/exit.
 * Completing after midnight credits that start dayKey.
 * Stale yesterday active is discarded on hydrate/AppState active.
 *
 * ## Daily vs Campaign
 * Daily completion → `solvedPuzzleIds` + Daily record.
 * Does NOT add `completedPuzzleIds` / campaign unlock / campaign best time.
 * Gallery unlock source = `solvedPuzzleIds`.
 *
 * ## Streak
 * Derived from completed ∪ restored days.
 * Live streak: if today incomplete but yesterday covered, show yesterday’s run.
 *
 * ## Streak restore (implemented)
 * One free restore per calendar month of the missed day.
 * Only when exactly one gap and gap is in the current month (same as today).
 * Restored day is NOT a puzzle solve (no Gallery / totalCompletions / Daily count).
 *
 * ## Save
 * Schema v2. Storage key remains `nonogram.save.v1` (historical suffix).
 */

export {}
