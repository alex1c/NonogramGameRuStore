# ForestMusic DevTools pin

This project was bootstrapped / Phase 3-checked against:

- Repository: https://github.com/alex1c/forestMusicDevTools
- Version: **1.1.0**
- `main` SHA: **527d089ac229e4f7af15d8e4ca04efaaa85acd92**

Unchanged since Phase 1 / Phase 2 checkpoints (fetched `origin/main` again
before Phase 3; still v1.1.0 @ 527d089).

Applied in Phase 0–3:

- README.md
- VERSION
- checklists/PROJECT_BOOTSTRAP.md
- checklists/ANDROID_QA.md
- playbooks/FORESTMUSIC_DEV_PLAYBOOK.md
- playbooks/ADS_AND_BOTTOM_LAYOUT.md
- playbooks/ANDROID_DEVICE_QA.md
- templates/react-native-expo/README.md
- scripts/android/* (copied into project)

Phase 3 native notes (from DevTools):

- Skia / gesture-handler / reanimated require a **dev client / native build**,
  not Expo Go.
- Prefer `npx expo prebuild` without `--clean` unless DevTools workflow
  explicitly requires a clean regenerate.
- Canonical Metro: `npx expo start --dev-client --host lan --port 8081`
- Device QA script: `npm run android:qa` (optional `-Build` after native deps).
