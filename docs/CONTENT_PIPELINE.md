# Content pipeline (Phase 8A / 8A.1 / 8B / 8B.1)

Offline deterministic tooling to produce **production candidate** nonogram packs.
Does **not** replace the runtime mini catalog (21 puzzles) until a later approved
integration phase.

## Versions

- `CONTENT_GENERATOR_VERSION` = `prod-v2.1`
- `CONTENT_CATALOG_VERSION` = `2026.1-b250-r2` (active Batch 250-R2)
- Status label: **candidate** (not production-approved)

## Content roles

| Role | Use |
| --- | --- |
| `PRODUCTION` | Campaign / Gallery collection rewards |
| `TUTORIAL` | May be primitive (line, corner, dash) |
| `DEV` | Fixtures / tests |

Batch 250 selects **PRODUCTION only**. Tutorial primitives are excluded from the
production pool.

## Reward-quality structural gate (8B.1)

`analyzeRewardQuality(bitmap, kind)` — **title-independent**. Structural heuristic
only — not AI recognizability.

### Metrics (exposed individually)

| Metric | Meaning | Warning / hard |
| --- | --- | --- |
| occupiedRows / occupiedCols | Axes with filled cells | low occupied axes → warning; extreme → hard with other signals |
| bboxArea / fillRatioInBbox | Bounding-box occupancy | high fill + low diversity → solid_blob |
| rowSignatureDiversity | Unique row patterns / occupied rows in bbox | low_row_diversity |
| columnSignatureDiversity | Unique column patterns / occupied cols | low_column_diversity |
| horizontalTransitions / verticalTransitions | EMPTY↔FILLED flips | low_transition_complexity |
| runCount / runLengthDiversity | Contiguous fill runs | supporting signal |
| perimeterComplexity | Boundary vs filled/bbox | supporting solid_blob / blob risk |
| holeCount | Enclosed negative space (practical) | richness; absence ≠ bad |
| componentCount / largestComponentRatio | Connectivity | excessive_components; solid blob support |

### Warnings (examples)

`low_row_diversity`, `low_column_diversity`, `low_transition_complexity`,
`solid_blob`, `corner_like`, `vertical_blob`, `tiny_box`, `line_like`,
`tiny_trivial`, `noise_like`, `low_bbox_usage`, `excessive_components`,
`simple_high_tier`.

### Hard reject (prefer multi-signal)

Single weak metric → usually warning. Combinations for non-SYMBOL, e.g.:

- low row + low column diversity + low transitions → hard reject
- `line_like` + low transitions → hard reject
- extreme solid_blob / corner_like / tiny_box (kind-aware)

SYMBOL uses lighter thresholds (arrow, heart, note, lightning, peace).
PATTERN is share-capped separately (≤10%).

`rewardQualityRiskScore` sorts Worst 20 only. It is **not** difficulty and
must not rescue or define tier.

Human review remains final.

## Pilot / batch history

### Pilot R1 — HUMAN REVIEW: NOT APPROVED

- Catalog: `2026.1-pilot`
- Checksum: `456c3b87cf32c3a617f37d8cd1f5ccf518c51df85095ec026ed001971b072bc9`

### Pilot R2 — human review improved, still not final

- Catalog: `2026.1-pilot-r2`
- Checksum: `d7c7c6fbe5838dec67ae8343d1169c814a9c302fc4954677e2f2f478f659f19c`

### Batch 250-R1 — human review: good direction, weak tail

- Catalog: `2026.1-b250-r1`
- Generator: `prod-v2`
- Checksum: `33d229c661ce7f2c4562bcd9ef825c049ca302e2bad85a6e86ff7b5b3bf2ead8`
- Path: `generated/content-b250/` (preserved baseline)
- Contact sheet: `review-artifacts/production-content/b250-r1/contact-sheet.html`

### Batch 250-R2 — READY FOR TAIL HUMAN REVIEW (candidate)

- Catalog: `2026.1-b250-r2`
- Generator: `prod-v2.1`
- Path: `generated/content-b250-r2/`
- Contact sheet:
  `review-artifacts/production-content/b250-r2/contact-sheet.html`
- Preserve-good + replace weak tail only (not full regeneration)
- Views: Worst 20 (default, blind) → Random 30 → Removed → Added → Near pairs
- Hard gates: 250 selected, concepts ≥220, patterns ≤10%, exact/transform dup 0,
  titles 0, reward-quality hard rejects 0, PRODUCTION role only
- Near-duplicate ≥0.92: soft warning (target ≤25)

## Layout

| Path | Role |
| --- | --- |
| `content-src/` | Human rejection list + content README |
| `scripts/content/` | Generator, validation, diversity, reward quality, contact sheets |
| `scripts/content/rewardQuality.ts` | Structural reward-quality gate + risk score |
| `scripts/content/generateB250R2.ts` | Preserve-good + tail replacement |
| `generated/content-b250/` | B250-R1 baseline (checksum pin) |
| `generated/content-b250-r2/` | Deterministic B250-R2 candidate |
| `review-artifacts/production-content/b250-r2/` | Gitignored HTML contact sheet |

## Commands

```bash
npm run content:generate-b250-r2   # preserve-good + replace weak tail → R2
npm run content:generate-b250      # full rebuild path (R1 tooling)
npm run content:contact-sheets     # regenerate HTML from existing report
npm run content:build              # fail-closed audit of active batch
npm run audit:production-content   # same gates as content:build
```

## Human review workflow (B250-R2)

1. Open `review-artifacts/production-content/b250-r2/contact-sheet.html`
2. **Worst 20** first (blind) → Random 30 → Removed → Added → Near pairs
3. Approve / Reject / Fix; export JSON includes R2 checksum
4. **STOP** — no 251–1000; no runtime Campaign/Gallery/Daily swap

## Selection stability (R2)

1. Rescore R1 with improved analyzer
2. Remove hard rejects + high-risk soft tail (bounded churn)
3. Fill tier quotas with new distinct concepts (deterministic priority)
4. Preserve good candidate IDs/solutions/metadata
5. Hard gates; shortage → `BLOCKED` (non-zero exit)

## Runtime isolation

- Campaign / Gallery remain 21 development puzzles
- Daily version unchanged
- Schema v4 sticky achievements unchanged
- Candidate B250-R2 is not imported by the app bundle
