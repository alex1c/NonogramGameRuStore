# Content pipeline (Phase 8A / 8A.1)

Offline deterministic tooling to produce **production candidate** nonogram packs.
Does **not** replace the runtime mini catalog (21 puzzles) until a later approved
integration phase.

## Versions

- `CONTENT_GENERATOR_VERSION` = `prod-v1.1`
- `CONTENT_CATALOG_VERSION` = `2026.1-pilot-r2` (active Pilot R2)
- Pilot status label: **candidate** (not production-approved / not human-approved)

## Pilot history

### Pilot R1 — HUMAN REVIEW: NOT APPROVED

- Catalog: `2026.1-pilot`
- Checksum:
  `456c3b87cf32c3a617f37d8cd1f5ccf518c51df85095ec026ed001971b072bc9`
- Path: `generated/content-pilot/`
- Human rejection reasons (baseline for R2 comparison):
  - excessive semantic duplicates
  - repeated procedural variants
  - Patterns share 22%
  - Expert over-reliance on mosaics/lattices
  - weak recognizability of some 5×5
  - repeated generic titles
  - insufficient concept diversity
- R1 remains a **technical pipeline proof** and comparison baseline — not approved content.

### Pilot R2 — READY FOR HUMAN REVIEW

- Catalog: `2026.1-pilot-r2`
- Path: `generated/content-pilot-r2/`
- Contact sheet:
  `review-artifacts/production-content/pilot-r2/contact-sheet.html`
- Semantic gates: `conceptId` / `compositionId`, distinct concepts ≥80,
  max concept frequency ≤2, patterns ≤10, expert patterns ≤3,
  max family share ≤5%
- Near-duplicate pairs ≥0.92: **review warning** target ≤5 (not hard fail)

## Layout

| Path | Role |
| --- | --- |
| `content-src/` | Human rejection list + content README |
| `scripts/content/` | Generator, validation, diversity selection, contact sheets |
| `scripts/content/families/r2ConceptLibrary.ts` | Authored R2 concept library |
| `scripts/content/families/r2QuotaExpansion.ts` | Beginner + Hard/Expert expansions |
| `generated/content-pilot/` | R1 rejected baseline (kept for comparison) |
| `generated/content-pilot-r2/` | Deterministic R2 pilot artifact |
| `review-artifacts/production-content/pilot-r2/` | Gitignored HTML contact sheet |

## Commands

```bash
npm run content:generate-pilot   # build R2 100 candidates + reports + contact sheet
npm run content:contact-sheets   # regenerate HTML from existing report
npm run content:build            # fail-closed audit of generated R2 pilot
npm run audit:production-content # same gates as content:build
```

Canonical review sequence:

1. `npm run content:generate-pilot`
2. `npm run audit:production-content`
3. Open `review-artifacts/production-content/pilot-r2/contact-sheet.html`
4. Use **Проверка без названий** for blind recognizability review
5. Human approve / reject (optional Export review JSON)
6. **STOP** — do not scale to 1000 without explicit approval

## Selection order (deterministic)

1. Generate authored candidate pool
2. Individual mathematical / structural validation
3. Exact / transform dedup
4. Semantic metadata validation (`conceptId`, `compositionId`)
5. Tier from `analyzeDifficulty` only
6. Structural quality warnings
7. Diversity-aware selection (tier quota → concept → family → collection → quality)
8. Global near-duplicate report
9. Contact sheet

Within a concept, prefer fewer warnings, authored source, preferred size, then stable id.
Prefer a new concept over a second composition of an existing concept.
Prefer underrepresented collection / family when tier ties.

## Quality gates (automatic)

Each accepted candidate must be:

- unique solution
- logically solvable (no guessing)
- sequential Hint-chain solvable
- non-empty / non-full / non-extreme fill
- unique id + unique solution hash
- no mirror/180 transformation duplicate of another accepted candidate
- `conceptId` present (normalized slug)
- selected pack: distinct concepts ≥80, max concept frequency ≤2
- patterns ≤10; expert pure patterns ≤3
- max family share ≤5%

Difficulty tier comes **only** from `analyzeDifficulty` (Phase 2 model).
Do not recalibrate thresholds in R2 from a few anomalies — report them.

## Source format

Authored templates: ASCII `#` / `.` rows with `conceptId` + `compositionId`.
R2 pool is authored-library only (no procedural size/mutation families).
Clues are always regenerated from the solution bitmap.

## Runtime isolation

Phase 8A.1 artifacts are **not** imported by Campaign / Gallery / Daily.
Save schema remains **v3**. Campaign = 21, Gallery = 21.

## Achievement risk (integration later)

`first_collection` is derived from current `GALLERY_ITEMS`. Replacing gallery
taxonomy can drop a previously unlocked derived achievement.
**REQUIRES DESIGN FIX BEFORE RUNTIME INTEGRATION** (sticky unlock IDs).

## Scale-up

After human approval of **R2** checksum, later phases may generate batches
101–250, 251–500, … comparing against the global approved duplicate index.
Do not start 1000 until human R2 contact-sheet review passes.
