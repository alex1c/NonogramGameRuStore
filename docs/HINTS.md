# Hints + Teach Me (Phase 7 / 7B)

## Architecture

```
PuzzleSpec + PlayerState
  → Logical Solver (enumerateLogicalSteps / findContradictoryLine)
  → Hint Engine (getHint)
  → Normalized HintStep
  → Explanation layer (compact Hint vs pedagogical Teach Me)
  → Game UI preview
  → Apply → one history transaction
```

Runtime Hint path never receives authored `solution` and never calls the
complete / backtracking solver.

## UX modes (Phase 7B)

| Mode | Answers | UI |
| --- | --- | --- |
| Подсказка | Что сделать? | line + action only |
| Научи меня | Почему это можно сделать? | «Почему так?» + clue + pedagogy |

Help entry: bottom controls lightbulb **Подсказка** (not header `?`).

## Statistics / schema

Unchanged from Phase 7 (schema v3). See previous docs.
