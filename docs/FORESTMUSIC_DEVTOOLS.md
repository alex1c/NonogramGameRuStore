# ForestMusic DevTools pin

This project was bootstrapped / Phase 7-checked against:

- Repository: https://github.com/alex1c/forestMusicDevTools
- Version: **1.1.1**
- `main` SHA: **ad2ff4469e2aaf301a4b4e93eb633ddf17c8490c**

Fetched `origin/main` again before Phase 8B; still v1.1.1 @ ad2ff446
(unchanged vs Phase 7B / 8A / 8A.1 pin). DevTools was not modified.

Applied in Phase 0–8B:

- README.md
- VERSION
- checklists/PROJECT_BOOTSTRAP.md
- checklists/ANDROID_QA.md
- playbooks/FORESTMUSIC_DEV_PLAYBOOK.md
- playbooks/ADS_AND_BOTTOM_LAYOUT.md
- playbooks/ANDROID_DEVICE_QA.md
- playbooks/PERSISTENCE.md (where present)
- templates/react-native-expo/README.md
- scripts/android/* (copied into project)

Phase 3+ native notes (from DevTools):

- Skia / gesture-handler / reanimated require a **dev client / native build**,
  not Expo Go.
- Prefer `npx expo prebuild` without `--clean` unless DevTools workflow
  explicitly requires a clean regenerate.
- Canonical Metro: `npx expo start --dev-client --host lan --port 8081`
- Device QA script: `npm run android:qa` (optional `-Build` after native deps).
