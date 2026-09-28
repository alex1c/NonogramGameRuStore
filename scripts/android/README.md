# ForestMusic Android device QA startup

This script provides the reusable real-device startup flow for ForestMusic
Expo/RN projects:

```powershell
cd D:\petProject\myForestMusicApp
.\scripts\android\android-device-qa.ps1
```

Use native build/install verification when native dependencies, plugins, or
native configuration changed:

```powershell
.\scripts\android\android-device-qa.ps1 -Build
```

Use a bounded PID-filtered logcat snapshot after launch:

```powershell
.\scripts\android\android-device-qa.ps1 -Logcat
```

The project root is inferred by checking parent directories for package.json.
This supports the bundled scripts/android layout and a flat project-local
scripts layout. To reuse the script from another location, pass an explicit
root:

```powershell
.\scripts\android\android-device-qa.ps1 -ProjectPath D:\petProject\anotherForestMusicApp
```

## One Metro per active project

Use the standard port 8081 unless the project explicitly documents an
override. Before startup, the script identifies the 8081 listener, queries
Metro /status, and checks the process ancestry/Expo CLI path for a project
root. It reuses a confidently identified Metro for this project. If another
project owns the port, or ownership is unknown, it stops with an actionable
diagnostic. It never kills an unknown Node process or silently changes ports.

A development client can display a different game's JS bundle when another
project's Metro owns 8081. Device launch and PID success do not prove that the
right app UI loaded; verify project identity and the real screen.

Use -MetroPort only when this project explicitly documents an override:

    .\scripts\android\android-device-qa.ps1 -MetroPort 8082

Otherwise keep the shared default 8081.

## Why --host lan is required on this Windows PC

Historical failing command: `npx expo start --dev-client --localhost --port
8081`. On this machine it binds
Metro to IPv6 loopback `::1:8081`. Consequently,
`Test-NetConnection 127.0.0.1 -Port 8081` fails and the phone cannot reach
Metro through `adb reverse`.

The verified flow is:

```text
npx expo start --dev-client --host lan --port 8081
adb reverse tcp:8081 tcp:8081
adb shell curl -s http://127.0.0.1:8081/status
```

The script therefore keeps one project on one Metro port, `8081`, verifies
both the host IPv4 socket and `/status`, applies the reverse mapping, and
then verifies the phone-side HTTP status before launching the dev client.

## Safety behavior

The script does not clean Gradle, delete caches or native folders, install npm
dependencies, run prebuild, change source/version/package configuration, kill
unknown processes, switch Metro ports, launch an AVD, reset Git, clean Git, or
force-push. Tracked changes and unexpected untracked files stop QA; recognized
local release outputs under release-artifacts do not. An unknown 8081 owner,
unauthorized device, missing native project in Build mode, failed version
verification, and other uncertain states stop with a layer-specific
diagnostic.

Default mode reuses an installed native build and starts/reuses the current
project's Metro. `-Build` runs only `android\gradlew.bat assembleDebug
--console=plain`, verifies `BUILD SUCCESSFUL`, installs the standard debug APK,
and compares `versionName`/`versionCode` with resolved Expo config.

The final PASS means device connectivity and dev-client startup passed. It
does not prove visual correctness, gameplay, or screen-level QA; the operator
must verify the physical phone UI separately.

## White-screen diagnosis

If Metro /status, device connectivity and app PID all pass but the screen is
blank:

1. Force-stop the discovered package.
2. Explicitly relaunch its development-client deep link to the current
   project's Metro.
3. Watch Metro output for Android Bundled and confirm its project root.
4. If still blank, take a bounded logcat snapshot scoped to the app PID.

Do not start with npm install, cache deletion, prebuild clean, or app-data
clearing. First establish whether the right Metro bundle reached the app.

## Screenshot capture

Use scripts/android/android-screenshot.ps1 after manually preparing the
desired app state:

    .\scripts\android\android-screenshot.ps1 -Name "03-game" -VerifyDimensions

It uses adb shell screencap -p to a unique device file, then adb pull.
Never use adb exec-out screencap -p > screenshot.png in Windows PowerShell
5.1; text redirection may corrupt the PNG. See the canonical screenshot
workflow at ../../playbooks/RUSTORE_SCREENSHOTS.md.
