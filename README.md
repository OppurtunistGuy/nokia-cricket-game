# Cricket Cup — The Nostalgia Project

A complete two-over cricket match, built with Phaser and TypeScript. The uploaded Nokia footage informs a perspective batting camera and a separate overhead fielding camera. Original procedural artwork runs on a 960 × 720 canvas with stadium lighting, shaded players, pitch wear, and a modern HUD. Browser and Android use the same game.

## Play

Select your team and play a quick match. Bat first, then defend your total.

- **4 / Left arrow** and **6 / Right arrow** choose shot or delivery direction.
- **5 / Space** swings the bat or stops the bowling meter.
- **Enter** starts the next delivery. The on-screen keypad supports touch.
- Time a batting shot as the ball reaches the crease. Better timing scores more runs; a badly mistimed or missed shot can cost a wicket.
- When bowling, stop the meter near its centre to improve your chance of dots and wickets. AI outcomes have some randomness.

Each innings has 12 legal deliveries or two wickets. Running and fielding are automatic. No extras or manual running. Chasing the target ends the match immediately; equal totals are a draw. Sound is optional and starts muted. Rookie, Club, and Pro levels change delivery speed and batting forgiveness. Completed batting innings save a personal best on this device.

## Develop

Node.js 22 or newer recommended; this environment was verified with Node 24.

```sh
npm ci --cache /tmp/cricket-npm
npm run dev -- --port 5175 --strictPort
```

```sh
npm run build
npm test
```

The production output is `dist/`. `npm run preview` serves it for local verification. Browser tests use `/usr/bin/chromium` when available, or Playwright’s installed Chromium otherwise. On a new local machine, run `npx playwright install chromium` once before `npm test`; `CHROMIUM_PATH` can select another installed Chromium.

The production service worker caches all game assets after the initial online load. Later reloads work offline. Development mode deliberately does not register it. Android embeds the assets and does not require an initial network load.

## If CSS or the pitch is missing

Use the Vite terminal command above and open the address it prints. Do not open `index.html` directly or use VS Code **Go Live / Live Server**: those serve raw TypeScript without compiling it, preventing the game from starting. Use port 5175 to avoid other projects on ports 5173 and 5174. If the browser has a service worker from another project on the same port, use a new port or clear that site's storage in browser developer tools.

## Android

The Capacitor project is in `android/`. It requires JDK 21, Android SDK platform 36, and build tools 35.0.0 (the SDK also includes 36.0.0).

```sh
npm run android:sync
cd android
./gradlew assembleDebug --max-workers=2
```

In this cloud environment, `npm run android:build` configures the retained SDK/JDK, proxy routing, and managed certificate trust store automatically.

Set `JAVA_HOME`, `ANDROID_HOME`, and a writable `GRADLE_USER_HOME` for your machine. The debug APK is `android/app/build/outputs/apk/debug/app-debug.apk`. It is for local installation and testing, not a signed store release. A physical Android device has not been tested in this cloud machine.

## Layout

- `src/main.ts`: match state, input, timing, scoring, and both stadium cameras.
- `src/style.css`: responsive stadium layout, HUD, and touch controls.
- `scripts/offline.mjs`: production asset cache generation.
- `tests/game.spec.ts`: real-browser match, input, innings, and offline checks.

Five-over mode and tournaments remain future extensions. This version focuses on a complete playable quick match.
