# Cricket Cup — The Nostalgia Project · V0.3

A browser and Android arcade cricket game with Nokia-inspired pixel graphics. Classic is the default; Advanced adds selectable shots, bowling variations, manual running, and controller input. Both modes share a single 128 × 128 pixel renderer and match engine. See [the V0.3 rules and controls](docs/GAMEPLAY_V0.3.md).

## Play

Choose Classic or Advanced, your team, and whether running is automatic. Bat first, then defend your total: two overs and two wickets per side.

- Before delivery: arrows select shots (Advanced) or placement (Classic).
- Space / 5 acts; Enter starts a ball. Time batting contact at the crease.
- During fielding: Right runs, Down stops after the current run, Left turns back.
- Advanced bowling: arrows select line/length, Q/E movement, S slower speed, B bouncer. Start the accuracy meter, then stop it with Space to release.
- Standard controllers and context-sensitive touch controls provide the same actions.

Wides, catches, boundaries, completed runs, run-outs, and innings progression share the same rules in both modes. Classic enables Auto Shot and automatic running initially; Advanced defaults to manual running. No external game services or credentials are needed.

## Run locally

Use Node.js 22+ (verified here with Node 24). From this Git checkout:

```sh
npm ci
npm run dev -- --port 5175 --strictPort
```

Open the address Vite prints. Do not open `index.html` directly or use VS Code Go Live / Live Server; TypeScript must run through Vite. If another project's service worker controls a reused port, choose a new port or clear that site's storage.

```sh
npm run build
npx playwright install chromium
npm test
```

Cloud tests reuse `/usr/bin/chromium` when available; set `CHROMIUM_PATH` to select another installed Chromium. Tests cover the rules engine, input adapter, browser play, identical mode graphics, mobile layout, and offline startup. Virtual controllers are tested; physical controller and Android device checks remain manual.

Production files are in `dist/`. Serve them over HTTP(S). Browser offline play works after the initial production load installs the asset cache. Android bundles assets for offline first launch. Development mode does not install a service worker.

## Android

Installable UAT build: [downloads/CricketCup-debug.apk](downloads/CricketCup-debug.apk). This is a debug build for testing, not a store release. Android 7.0+ is required.

For local builds, install JDK 21, Android SDK platform 36, build tools 35.0.0, then:

```sh
npm run android:sync
cd android
./gradlew assembleDebug --max-workers=2
```

On Windows use `gradlew.bat assembleDebug --max-workers=2` in `android`. The output is `android/app/build/outputs/apk/debug/app-debug.apk`. Keep the same debug signing key to update a previously installed debug APK; changing keys requires uninstalling the old app and loses its local data.

This cloud workspace retains its SDK/JDK and CA trust setup. `npm run android:build` rebuilds through `scripts/android-build.sh` using those tools. It uses the platform proxy and managed certificate store without disabling TLS verification.

## Source

- `src/engine.ts`: delivery physics, shot matchups, running, and match rules.
- `src/view.ts`: shared pixel renderer and simple sprite poses.
- `src/input.ts`: keyboard/keypad and edge-triggered standard controller mapping.
- `src/main.ts`: UI, touch controls, pause, persistence, and input integration.
- `tests/engine.spec.ts`, `tests/game.spec.ts`: rules and browser checks.

No-balls/LBW/byes, longer matches, and tournaments remain outside V0.3. Balance values are initial arcade tuning; physical-device playtesting is still needed.
