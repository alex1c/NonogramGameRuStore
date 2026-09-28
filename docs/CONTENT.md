# Content pipeline & difficulty (Phase 2)

ForestMusic DevTools: v1.1.0

## Validation flags

| Flag | Meaning |
| --- | --- |
| `valid` | Structure OK and at least one solution exists (low-level). |
| `unique` | Complete solver finds exactly one solution from clues. |
| `logicallySolvable` | Logical solver returns `SOLVED` with **no guessing**. |
| `productionReady` | Authored puzzle: `valid && unique && logicallySolvable` **and** authored solution matches the unique complete-solver grid. |

**Never publish with `if (result.valid)` alone.** Use:

```ts
validateProductionPuzzle(puzzle).productionReady
```

Clue-only `validatePuzzleSpec` always sets `productionReady: false` even when
unique+logical — there is no authored bitmap to gate.

## STALLED is not EXPERT

If the logical solver returns `STALLED`, the puzzle may still be unique under
search. Difficulty analysis returns `tier: 'UNRATED'`. We do **not** treat
“our techniques cannot finish” as “expert content”.

## Solution source of truth

For authored production content:

1. Author the **solution bitmap**.
2. `buildCatalogPuzzle` generates clues deterministically.
3. Validator rejects any stored clue mismatch.

Clues are derived, not hand-edited.

## Stable puzzle IDs

Catalog IDs are stable strings (e.g. `mini-easy-stairs`), never array indexes.
`validateCatalog` fails on duplicates.

## Difficulty model (`phase2-v1`)

Preliminary, deterministic, recalibratable thresholds in
`src/domain/difficulty/thresholds.ts`.

Factors (weighted):

- grid size (log scale, not sole driver)
- clue complexity (multi-run lines, run counts)
- logical effort (non-trivial steps, deductions, iterations; dampened when
  initial force is high)
- initial forced-cell gap (`1 - initialForcedRatio` from empty-grid line
  intersection only)
- share of harder reason labels among steps

Tiers: `BEGINNER` | `EASY` | `MEDIUM` | `HARD` | `EXPERT` | `UNRATED`

Russian UI labels are separate (`DIFFICULTY_LABEL_RU`) and not used by solvers.

## Reason label semantics

Logical `reason` values classify line-candidate intersection outcomes — they
are not independent human technique proofs. See `logicalSolver.ts` header.

## Audits

```bash
npm run audit:content   # mini production catalog gate
npm run audit:solver    # solver timing harness
npm run audit:random    # optional seeded random stress (not catalog)
```

`audit:content` exits non-zero on invalid / ambiguous / STALLED / duplicate ID /
authored mismatch for any catalog puzzle.
