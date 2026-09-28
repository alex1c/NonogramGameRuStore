# Architecture — NonogramGame (Японские кроссворды)

ForestMusic DevTools: v1.1.0  
Package: `com.calculatorplatform.nonogram`  
Scheme: `nonogram`

## Layering

| Area | Role |
| --- | --- |
| `src/domain/nonogram` | Pure TypeScript puzzle / player models. No React Native. |
| `src/solver` | Complete solver, logical solver, validator. No UI / Android. |
| `src/navigation`, `src/screens`, `src/components` | Minimal UI shell (not Expo Router). |
| `src/theme`, `src/storage`, `src/services` | Foundations for later phases. |
| `src/tests/fixtures` | Hand-checked puzzles for gates and audits. |

Game logic must never live inside React components.

## Complete solver

**Purpose:** prove how many black-and-white solutions a clue set admits.

- Input: dimensions + row/column clues only (never the authored bitmap).
- Algorithm: line-candidate generation → constraint propagation → search on the
  line with the fewest remaining candidates.
- Uniqueness: `maxSolutions: 2` with early stop after the second solution.
- Outcomes of interest: `0`, `1`, or `>1` solutions.

The complete solver may use controlled backtracking. That is intentional and
does **not** mean a puzzle is logically solvable.

## Logical solver

**Purpose:** apply only deductions that are forced without guessing.

Phase 1 techniques:

- generate legal line candidates under current known cells;
- paint cells that are identical in every candidate (overlap / forced filled /
  forced empty / completed line / impossible positions eliminated);
- repeat to a fixed point.

Statuses:

- `SOLVED` — every cell forced;
- `STALLED` — no further forced move (may still be unique under search);
- `INVALID` — contradiction (a line has zero candidates).

### NO GUESSING contract

`solveLogically` must never silently switch to search/backtracking and then
return `SOLVED`. `STALLED` stays `STALLED`. Production quality gate
`logicallySolvable` is true only when the logical solver returns `SOLVED`.

## Unique solution vs logically solvable

- **Unique** — complete solver finds exactly one grid for the clues.
- **Logically solvable** — logical solver finishes without guessing.

A puzzle can be unique and still `STALLED` under the current technique set
(see fixture I). Those puzzles are not Phase 1 production-ready content.

## «Научи меня» foundation

`nextLogicalStep(spec, grid)` returns one machine-readable deduction:

- affected line orientation + index;
- clue;
- cell actions (`FILLED` / `EMPTY`);
- reason (`overlap`, `completed_line`, `forced_filled`, `forced_empty`,
  `impossible_positions_eliminated`).

UI copy can be layered later; the solver already returns structured reasons.

## Empty-line clue convention

Empty lines use `[]`, never `[0]`. Sum of clue runs equals filled-cell count,
and candidate generation stays simpler.

## Out of scope (later phases)

Ads, AppMetrica, Skia board, campaign/Daily, color nonograms, mass generation,
RuStore screenshots, release signing secrets.
