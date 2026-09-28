# Architecture — NonogramGame (Японские кроссворды)

ForestMusic DevTools: v1.1.0  
Package: `com.calculatorplatform.nonogram`  
Scheme: `nonogram`

## Layering

| Area | Role |
| --- | --- |
| `src/domain/nonogram` | Pure TypeScript puzzle / player models. No React Native. |
| `src/domain/difficulty` | Difficulty score / tiers / initial-forced analysis. |
| `src/solver` | Complete solver, logical solver, validator. No UI / Android. |
| `src/content` | Catalog model, build-from-solution, mini catalog, audit helpers. |
| `src/navigation`, `src/screens`, `src/components` | Minimal UI shell (not Expo Router). |
| `src/theme`, `src/storage`, `src/services` | Foundations for later phases. |
| `src/tests/fixtures` | Hand-checked puzzles for gates and calibration. |

Game logic must never live inside React components.

## Complete solver

**Purpose:** prove how many black-and-white solutions a clue set admits.

- Input: dimensions + row/column clues only (never the authored bitmap).
- Algorithm: line-candidate generation → constraint propagation → search on the
  line with the fewest remaining candidates.
- Uniqueness: `maxSolutions: 2` with early stop after the second solution.

The complete solver may use controlled backtracking. That is intentional and
does **not** mean a puzzle is logically solvable.

## Logical solver

**Purpose:** apply only deductions that are forced without guessing.

Phase 1–2 techniques:

- generate legal line candidates under current known cells;
- paint cells identical in every candidate;
- repeat to a fixed point;
- full-grid consistency check before claiming `SOLVED`.

Statuses: `SOLVED` | `STALLED` | `INVALID`.

### NO GUESSING contract

`solveLogically` never switches to search/backtracking. `STALLED` stays
`STALLED`. Telemetry (`reasonCounts`, first-step stats) is diagnostic only.

### Reason semantics

Reasons classify intersection outcomes (`overlap`, `completed_line`,
`forced_filled`, `forced_empty`, `impossible_positions_eliminated`). They are
not stronger independent proofs — see `docs/CONTENT.md`.

## Production gate

| Flag | Role |
| --- | --- |
| `valid` | Low-level: structure + ≥1 solution |
| `unique` | Exactly one solution |
| `logicallySolvable` | Logical `SOLVED` |
| `productionReady` | Full authored gate — use `validateProductionPuzzle` |

Details: [CONTENT.md](CONTENT.md).

## Difficulty

`analyzeDifficulty` produces a preliminary `phase2-v1` score and tier.
STALLED / ambiguous / invalid → `UNRATED` (never fake EXPERT).

## Content

- Solution bitmap is source of truth; clues are generated at build time.
- Stable string puzzle IDs; duplicate detection in `validateCatalog`.
- Mini catalog (~20) exercises the pipeline — not the future 1000-level set.

## Empty-line clue convention

Empty lines use `[]`, never `[0]`.

## Out of scope (later phases)

Skia board, campaign UI, Daily, ads, AppMetrica, mass generator, color
nonograms, RuStore screenshots, release signing secrets.
