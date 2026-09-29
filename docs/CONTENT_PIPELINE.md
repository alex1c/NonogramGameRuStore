# Content pipeline (Phase 8A / 8A.1 / 8B)

Offline deterministic tooling to produce **production candidate** nonogram packs.
Does **not** replace the runtime mini catalog (21 puzzles) until a later approved
integration phase.

## Versions

- `CONTENT_GENERATOR_VERSION` = `prod-v2`
- `CONTENT_CATALOG_VERSION` = `2026.1-b250-r1` (active Batch 250)
- Status label: **candidate** (not production-approved / not human-approved)

## Content roles

| Role | Use |
| --- | --- |
| `PRODUCTION` | Campaign / Gallery collection rewards |
| `TUTORIAL` | May be primitive (line, corner, dash) |
| `DEV` | Fixtures / tests |

Batch 250 selects **PRODUCTION only**. R2 primitives (Планка, Угол, Тире, Уступ, Линия, Столбик) are retained as `tutorial` and excluded from the production pool.

## Reward-quality structural gate

`analyzeRewardQuality` → `rewardQualityStructuralPass`.

Hard reject (non-symbol / trivial symbol bars):

- `line_like`
- `tiny_trivial`
- `noise_like`

Warnings may remain for density / components / simple-high-tier.
Human recognizability is **separate** and still required via contact-sheet review.

## Pilot / batch history

### Pilot R1 — HUMAN REVIEW: NOT APPROVED

- Catalog: `2026.1-pilot`
- Checksum: `456c3b87cf32c3a617f37d8cd1f5ccf518c51df85095ec026ed001971b072bc9`
- Path: `generated/content-pilot/`

### Pilot R2 — human review improved, still not final

- Catalog: `2026.1-pilot-r2`
- Checksum: `d7c7c6fbe5838dec67ae8343d1169c814a9c302fc4954677e2f2f478f659f19c`
- Path: `generated/content-pilot-r2/`
- Distinct concepts 100, patterns 6%, titles 0 — but primitives still appeared in human review.

### Batch 250 — READY FOR HUMAN REVIEW (candidate)

- Catalog: `2026.1-b250-r1`
- Generator: `prod-v2`
- Path: `generated/content-b250/`
- Contact sheet:
  `review-artifacts/production-content/b250-r1/contact-sheet.html`
- Hard gates: selected 250, distinctConcepts ≥220, maxConceptFrequency ≤2,
  patterns ≤25, expert patterns ≤8, exact/transform dup 0, titles 0,
  reward-quality hard rejects 0, PRODUCTION role only
- Near-duplicate pairs ≥0.92: soft warning target ≤12

## Layout

| Path | Role |
| --- | --- |
| `content-src/` | Human rejection list + content README |
| `scripts/content/` | Generator, validation, diversity, reward quality, contact sheets |
| `scripts/content/rewardQuality.ts` | Structural reward-quality gate |
| `scripts/content/families/r2ConceptLibrary.ts` | Authored concept library + expansions |
| `generated/content-pilot/` | R1 rejected baseline |
| `generated/content-pilot-r2/` | R2 baseline (kept for comparison) |
| `generated/content-b250/` | Deterministic B250 candidate artifact |
| `review-artifacts/production-content/b250-r1/` | Gitignored HTML contact sheet |

## Commands

```bash
npm run content:generate-b250    # build B250 candidates + reports + contact sheet
npm run content:generate-pilot   # alias of generate-b250 (same entrypoint)
npm run content:contact-sheets   # regenerate HTML from existing report
npm run content:build            # fail-closed audit of generated batch
npm run audit:production-content # same gates as content:build
```

## Human review workflow (B250)

1. Open contact sheet offline (`file:///.../contact-sheet.html`)
2. Views: Blind shortlist (~40) → Random 30 → Worst-case 20 → Expert → Small → All
3. Approve / Reject / Fix + controlled reason; Export review JSON (includes checksum)
4. Review JSON is a human artifact — Cursor applies it only in a later phase after confirmation
5. **STOP** — do not generate 251–1000; do not integrate into runtime

## Selection order (deterministic)

1. Build PRODUCTION authored pool (tutorial/dev excluded)
2. Individual mathematical / structural / reward-quality validation
3. Exact / transform dedup
4. Tier from `analyzeDifficulty` only
5. Diversity-aware selection (tier quota → concept → family → collection → quality)
6. Hard gates; shortage → `BLOCKED_CONTENT_QUOTA_SHORTAGE` (non-zero exit)

## Runtime isolation

- Campaign / Gallery remain 21 development puzzles
- Daily version unchanged
- Schema v4 sticky achievements are a separate runtime baseline (see PERSISTENCE.md)
- Candidate B250 is not imported by the app bundle
