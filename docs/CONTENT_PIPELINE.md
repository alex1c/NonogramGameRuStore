# Content pipeline (Phase 8A → 8C)

Offline deterministic tooling for **production candidate** nonogram packs.
Does **not** replace the runtime mini catalog (21 puzzles) until a later
approved integration phase.

## Active versions (Phase 8C)

- `CONTENT_GENERATOR_VERSION` = `prod-v2.2`
- `CONTENT_CATALOG_VERSION` = `2026.1-b1000-r1`
- Status: **candidate** (not production-approved)

## Ancestry chain

| Checkpoint | Count | Catalog | Parent |
| --- | ---: | --- | --- |
| B250-R2 | 250 | `2026.1-b250-r2` | — |
| B500 | 500 | `2026.1-b500-r1` | B250-R2 |
| B750 | 750 | `2026.1-b750-r1` | B500 |
| B1000 | 1000 | `2026.1-b1000-r1` | B750 |

Additive only: each checkpoint preserves all parent puzzle IDs.

## Scale-up commands

```bash
npm run content:generate-b500
npm run content:generate-b750
npm run content:generate-b1000
npm run content:generate-scale   # all three in order
npm run audit:production-content
```

## Final tier target (B1000)

| Tier | Count |
| --- | ---: |
| BEGINNER | 100 |
| EASY | 250 |
| MEDIUM | 300 |
| HARD | 250 |
| EXPERT | 100 |

## Quality (frozen from 8B.1)

Structural `analyzeRewardQuality` remains title-independent.
Selected production: hard primitive flags = 0.
Human recognizability is **not** automatic — sample Worst 30 + Random 50.

## Human review (B1000)

1. `review-artifacts/production-content/b1000-r1/contact-sheet.html`
2. Worst 30 (blind) → Random 50 → Near pairs → Expert → Collections
3. **STOP** — no runtime Campaign/Gallery/Daily swap

## Runtime isolation

Campaign / Gallery 21, Daily unchanged, schema v4 sticky achievements unchanged,
B1000 candidate not imported.
