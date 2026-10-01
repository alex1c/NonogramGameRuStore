# Content pipeline (Phase 8A → 8D)

Offline deterministic tooling for **production candidate** nonogram packs.
Phase 8D integrates the accepted B1000 catalog into runtime.

## Active versions (Phase 8D runtime)

- `CONTENT_GENERATOR_VERSION` = `prod-v2.2`
- Runtime catalog = `2026.1-b1000-r1`
- Checksum = `154959457649ba0db245ae230102c1e40f27198120e86cf756893c59c8b8d0c9`
- Runtime artifact: `src/content/runtime/b1000Catalog.json`
- Export: `npm run content:export-runtime`
- Integrity: `npm run audit:runtime-content`

## Ancestry chain

| Checkpoint | Count | Catalog | Parent |
| --- | ---: | --- | --- |
| B250-R2 | 250 | `2026.1-b250-r2` | — |
| B500 | 500 | `2026.1-b500-r1` | B250-R2 |
| B750 | 750 | `2026.1-b750-r1` | B500 |
| B1000 | 1000 | `2026.1-b1000-r1` | B750 |

## Runtime notes (8D)

- Campaign: 20×50, unlock next set after 35/50
- Gallery: 20 production collections
- Daily: `daily-v2` (753 eligible); `daily-v1` history retained
- Legacy mini-21 kept for active-game / Daily-v1 resolution only
- No catalog-wide solver audit at app startup (lazy decode)
- Runtime derives clues from ascii at export (Phase 8C manifest stored empty clue arrays; content checksum unchanged)

## Human review (B1000)

1. `review-artifacts/production-content/b1000-r1/contact-sheet.html`
2. Accepted for v1 → Phase 8D runtime integration

## Schema

Schema remains v4 (sticky achievements). No ads/AppMetrica in 8D.
