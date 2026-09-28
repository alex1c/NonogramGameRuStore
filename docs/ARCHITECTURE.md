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
| `src/gameplay` | UI-independent session, history, paint gestures, clue satisfaction. |
| `src/board` | Geometry / hit-testing / palettes + Skia `NonogramBoard` renderer. |
| `src/navigation`, `src/screens`, `src/components` | Minimal UI shell (not Expo Router). |
| `src/theme`, `src/storage`, `src/services` | Foundations for later phases. |
| `src/tests/fixtures` | Hand-checked puzzles for gates and calibration. |

Game logic must never live inside React components. Session / history /
paint-gesture / geometry are pure TypeScript and unit-tested without React,
Skia, or Android.

## Phase 3 — playable board

### Session

`createGameSession` owns puzzle, player grid, selected tool (`FILLED` /
`CROSSED` / `ERASE`), undo/redo stacks, active drag gesture, completion, and a
simple wall-clock timer. Mutations go through `tapCell` / `continueGesture` /
`endGesture` / `undo` / `redo` / `setTool`.

- One finger drag = one history transaction (unique visited cells).
- New mutation after undo clears the redo branch.
- Completion uses domain `isComplete` (FILLED set vs authored solution).
- After completion, paint mutations are blocked.

### Geometry

`computeBoardLayout` sizes clue areas from real clue depth, then fit-to-screen
cell size. `pointerToCell` / `cellRect` share one `ViewTransform`
(`scale`, `tx`, `ty`) with the Skia renderer — single source of truth for
zoom/pan hit-testing.

### Gesture contract

| Fingers | Behavior |
| --- | --- |
| 1 | Paint (tap / drag). Line lock after movement threshold. Fast-drag Bresenham-style interpolation along the locked axis. |
| 2 | Pinch zoom (focal-point anchored) + pan. Does not mutate player state. |

Fit/reset restores the opening fit-to-screen transform via an explicit control.

### Clue satisfaction

Dimmed clues use player FILLED runs only (never the hidden solution). Phase 3
contract: dim when runs exactly match the clue **and** every non-FILLED cell on
that line is already `CROSSED`.

### Rendering

Skia canvas draws background, cells, grid (thicker every 5), row/column clues,
gesture preview, and X marks. No hundreds of React `View` cells. Game screen
has **no** `BannerSlot`.

### Native stack

- `@shopify/react-native-skia` 2.6.2
- `react-native-gesture-handler` ~2.32
- `react-native-reanimated` 4.5.1 (+ `react-native-worklets` peer)
- `expo-dev-client` (Skia requires a native/dev client, not Expo Go)

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

Game opens puzzles only via `getProductionPuzzleById` (re-checks
`productionReady`). Invalid IDs fail safely back toward Home.

## Difficulty

`analyzeDifficulty` produces a preliminary `phase2-v1` score and tier.
STALLED / ambiguous / invalid → `UNRATED` (never fake EXPERT).

Difficulty analysis is **not** on the paint/input path (header label only).

## Content

- Solution bitmap is source of truth; clues are generated at build time.
- Stable string puzzle IDs; duplicate detection in `validateCatalog`.
- Mini catalog (~20) exercises the pipeline — not the future 1000-level set.

## Empty-line clue convention

Empty lines use `[]`, never `[0]`.

## Out of scope (later phases)

Persistence, campaign/Daily, hints / «Научи меня», lives/error mode, ads,
AppMetrica, mass generator, color nonograms, RuStore screenshots, release
signing secrets.
