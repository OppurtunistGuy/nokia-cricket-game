# Cricket Cup V0.3

V0.3 supersedes the modern stadium presentation. Both modes use one 128 × 128 pixel renderer, original tiny sprites, two simple views (pitch and field), and minimal pose changes. There are no stadium effects, particles, camera effects, skeletal animations, or dynamic shadows.

## Modes

Classic is the default. It selects a standard shot from the incoming delivery. Left/right chooses placement. Automatic running is initially enabled to retain one-button play.

Advanced starts with manual running and offers Auto, Drive, Cut, Pull/Hook, Sweep, Reverse Sweep, Paddle Sweep, Scoop/Ramp, Defensive, and Lofted. Select a shot before delivery. Both modes can enable or disable automatic running before starting a match. They share the same rules and renderer.

## Batting and bowling

Timing, reachable line, actual length, movement, placement, shot suitability, and a small accuracy variation affect contact. Reverse, scoop and lofted shots carry additional edge/catch risk. Suitability is qualitative, never a promised success rate. A missed yorker is more scoopable than an accurately delivered yorker. Defence sacrifices distance and boundaries for safety.

Bowling combines four lengths, five line choices (leg, middle, off, wide-off, wide-leg), three movement choices, and optional slower speed. Bouncer is a short-ball modifier. Length controls the bounce point and height; movement curves late in opposite directions. Accuracy affects actual length/line and the AI batter's reaction. Watch the green zone and stop the meter to release.

A wide-line choice can still pass within reach and be legal. A delivery actually passing beyond playable reach awards one wide extra and consumes no legal ball. A wide extra can complete a chase. V0.3 does not implement no-balls, LBW, byes, or leg-byes.

## Running and scoring

- Run starts a crossing. Press it again during a crossing to queue another.
- Stop cancels the queued run; the current crossing finishes.
- Turn reverses an incomplete crossing toward its original safe end.
- Only completed runs count. Being stranded when the ball returns can cause a run-out; completed runs remain credited.
- A catch discards attempted runs; a boundary replaces running runs with four or six.
- Two wickets or twelve legal balls end an innings. Chasing the target ends the match immediately. Equal final totals are a tie.

Fielders and the AI innings are automatic. Field position, shot direction and distance determine retrieval time. Running takes 1.25 seconds per crossing. AI sometimes takes an ambitious run. Timing/placement balance is an initial arcade tuning and needs human playtesting.

## Input

| Context | Keyboard/keypad | Standard controller |
| --- | --- | --- |
| Shot selection / bowling line | Left/right, 4/6 | D-pad left/right, left stick |
| Bowling length | Up/down, 2/8 | D-pad up/down |
| Act / swing / meter | Space, 5 | A/Cross |
| Start next ball / innings | Enter | A/Cross |
| Run during fielding | Right, 6 | B/Circle |
| Stop after current run | Down, 8 | X/Square |
| Turn back | Left, 4 | Y/Triangle |
| Movement | Q/E | L1/R1 |
| Slower ball | S | Left trigger |
| Bouncer | B | Right trigger |
| Pause/resume | Escape / 5 to resume | Start / A to resume |

Touch presents context-specific controls. Preparatory dropdowns lock during delivery. Controller actions use press edges and pause safely on disconnect. Backgrounding an active match pauses it. Controller support uses the browser's standard Gamepad mapping; physical device mapping and latency need device testing.
