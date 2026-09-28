# Японские кроссворды (NonogramGame)

Android / RuStore ForestMusic project.

- Internal name: `NonogramGame`
- Package: `com.calculatorplatform.nonogram`
- Scheme: `nonogram`
- ForestMusic DevTools: **v1.1.0** (`527d089`)

## Scripts

```bash
npm run typecheck
npm run lint
npm test
npm run audit:solver
npm run audit:content
npm run audit:random
npm run audit:campaign
npm run audit:gallery
npm run audit:achievements
npm start
```

Android device QA (after native prebuild/dev client exists):

```powershell
.\scripts\android\android-device-qa.ps1
```

## Phase status

- Phase 0 — project foundation
- Phase 1 — nonogram domain + complete/logical solvers + validator
- Phase 2 — difficulty model + production content gate + mini catalog
- Phase 3 / 3B — playable board, gestures, clue typography (physical QA PASS)
- Phase 4 — campaign + persistence + progress (**physical QA PASS**)
- Phase 5 — Gallery + Collections + Achievements (**code complete; physical QA pending**)

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/CONTENT.md](docs/CONTENT.md),
[docs/PERSISTENCE.md](docs/PERSISTENCE.md), and [docs/GALLERY.md](docs/GALLERY.md).
