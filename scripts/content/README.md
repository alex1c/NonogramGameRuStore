# scripts/content

Phase 8A production content tooling (Node / `tsx`, offline).

## Usage

```bash
npm run content:generate-pilot
npm run audit:production-content
npm run content:contact-sheets
```

## Modules

- `bitmap.ts` / `hash.ts` / `metrics.ts` — pure bitmap ops
- `families/*` — authored + procedural templates
- `validateCandidate.ts` — uniqueness / logical / hint-chain gates
- `selectQuota.ts` — deterministic tier quotas
- `generatePilot.ts` — pilot entrypoint
- `contactSheet.ts` — offline HTML review artifact

Do not import this folder from the React Native runtime app.
