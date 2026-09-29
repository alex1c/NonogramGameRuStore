# Hints + Teach Me (Phase 7)

## Architecture

```
PuzzleSpec + PlayerState
  → Logical Solver (enumerateLogicalSteps / findContradictoryLine)
  → Hint Engine (getHint)
  → Normalized HintStep
  → Explanation layer (Russian templates)
  → Game UI preview
  → Apply → one history transaction
```

Runtime Hint path never receives authored `solution` and never calls the
complete / backtracking solver. Authored solution is used only as an audit
oracle in `npm run audit:hints` and unit tests.

## HintResult

- `STEP` — one pedagogical logical idea (single action)
- `CONTRADICTION` — player constraints conflict with clues
- `STALLED` — no forced cell with current techniques (NO GUESSING)
- `COMPLETE` — no UNKNOWN cells remain

## Statistics

| Metric | When | Persisted |
| --- | --- | --- |
| `hintRequests` | User asked Hint/Teach Me and got STEP/CONTRADICTION/STALLED | global |
| `hintsApplied` | User pressed Применить | global |
| `teachMeViews` | Teach Me opened a STEP explanation | global |
| `hintsUsedThisRun` | Apply, or CONTRADICTION/STALLED diagnostic | active Campaign/Daily |

Undo/Redo do not change counters. Restart resets `hintsUsedThisRun` only.
UI shows **Подсказок применено** (`hintsApplied`).

## Schema

Save schema **v3** adds the counters above. Storage key remains
`nonogram.save.v1`. Transient Help overlay / highlight are never persisted.
