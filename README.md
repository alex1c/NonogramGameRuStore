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
npm start
```

Android device QA (after native prebuild/dev client exists):

```powershell
.\scripts\android\android-device-qa.ps1
```

## Phase status

Phase 0 — project foundation  
Phase 1 — nonogram domain + complete/logical solvers + validator

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
