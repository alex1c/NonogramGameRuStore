# Content pipeline (Phase 8A)

Offline deterministic tooling to produce **production candidate** nonogram packs.
Does **not** replace the runtime mini catalog (21 puzzles) until a later approved
integration phase.

## Versions

- `CONTENT_GENERATOR_VERSION` = `prod-v1`
- `CONTENT_CATALOG_VERSION` = `2026.1-pilot`
- Pilot status label: **candidate** (not production-approved)

## Layout

| Path | Role |
| --- | --- |
| `content-src/` | Human rejection list + content README |
| `scripts/content/` | Generator, validation, duplicates, contact sheets |
| `generated/content-pilot/` | Deterministic committed pilot artifact |
| `review-artifacts/production-content/pilot/` | Gitignored HTML contact sheet + local reports |

## Commands

```bash
npm run content:generate-pilot   # build 100 candidates + reports + contact sheet
npm run content:contact-sheets   # regenerate HTML from existing report
npm run content:build            # fail-closed audit of generated pilot
npm run audit:production-content # same gates as content:build
```

Canonical review sequence:

1. `npm run content:generate-pilot`
2. `npm run audit:production-content`
3. Open `review-artifacts/production-content/pilot/contact-sheet.html`
4. Human approve / reject (record rejects in `content-src/rejections.json`)
5. **STOP** — do not scale to 1000 without explicit approval

## Quality gates (automatic)

Each accepted candidate must be:

- unique solution
- logically solvable (no guessing)
- sequential Hint-chain solvable
- non-empty / non-full / non-extreme fill
- unique id + unique solution hash
- no mirror/180 transformation duplicate of another accepted candidate

Difficulty tier comes **only** from `analyzeDifficulty` (Phase 2 model).

## Source format

Authored templates: ASCII `#` / `.` rows in TypeScript families.
Procedural families: deterministic seed/variant generators (trees, boats, scatters, …).
Clues are always regenerated from the solution bitmap.

## Runtime isolation

Phase 8A artifacts are **not** imported by Campaign / Gallery / Daily.
Save schema remains **v3**.

## Achievement risk (integration later)

`first_collection` is derived from current `GALLERY_ITEMS`. Replacing gallery
taxonomy can drop a previously unlocked derived achievement.
**REQUIRES DESIGN FIX BEFORE RUNTIME INTEGRATION** (sticky unlock IDs).

## Scale-up

After human approval of pilot checksum, later phases may generate batches
101–250, 251–500, … comparing against the global approved duplicate index.
