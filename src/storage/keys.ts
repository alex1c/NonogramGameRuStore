/**
 * Stable storage key namespace.
 * One versioned save blob — related progress fields stay atomic.
 */

/** Single root save key for Phase 4 persistence. */
export const SAVE_STORAGE_KEY = 'nonogram.save.v1' as const
