import { test, expect } from "@playwright/test";
import {
  Match,
  DEFAULT_BOWLING,
  makeDelivery,
  ballPosition,
  assessShot,
  RUN_MS,
  type Bowling,
  type Shot,
} from "../src/engine";
import { PadInput, keyboardAction } from "../src/input";
const stable = () => 0.5;
const ball = (options: Partial<Bowling> = {}) =>
  makeDelivery({ ...DEFAULT_BOWLING, ...options }, 0.8, stable);
function ground() {
  const m = new Match(stable);
  m.start("advanced", false);
  const d = ball({ length: "full" });
  m.release(d);
  m.hit("drive", d.contactAt - 0.075);
  expect(m.phase).toBe("fielding");
  expect(m.contact?.boundary).toBe(0);
  expect(m.contact?.wicket).toBeNull();
  return m;
}
function finish(m: Match) {
  m.tick((m.contact?.fieldTime ?? 2000) + 50);
}
test("Classic defaults to Auto Shot and automatic running; Advanced opts into manual running", () => {
  const m = new Match(stable);
  m.start();
  expect(m.mode).toBe("classic");
  expect(m.autoRun).toBe(true);
  expect(m.shot).toBe("auto");
  m.start("advanced");
  expect(m.autoRun).toBe(false);
  expect(m.shot).toBe("drive");
});
test("all batting styles reward suitable deliveries without fixed success guarantees", () => {
  const pairs: [Shot, Partial<Bowling>, Partial<Bowling>][] = [
    ["drive", { length: "full" }, { length: "short" }],
    ["cut", { length: "short", line: "off" }, { length: "yorker" }],
    ["pull", { length: "short", bouncer: true }, { length: "yorker" }],
    ["sweep", { length: "full", slow: true }, { length: "short" }],
    ["reverse", { length: "full" }, { length: "short" }],
    ["paddle", { length: "full", line: "leg" }, { length: "short" }],
    ["scoop", { length: "full" }, { length: "yorker" }],
    ["lofted", { length: "full" }, { length: "yorker" }],
  ];
  for (const [shot, good, bad] of pairs) {
    const a = ball(good),
      b = ball(bad);
    expect(
      assessShot(a, shot, a.contactAt, 0, () => 0.99).quality,
      shot,
    ).toBeGreaterThan(assessShot(b, shot, b.contactAt, 0, () => 0.99).quality);
  }
});
test("mistimed high-risk shots can be caught and defensive shots cannot score boundaries", () => {
  const d = ball({ length: "full" });
  expect(
    assessShot(d, "reverse", d.contactAt - 0.06, 0, () => 0.01).wicket,
  ).toBe("caught");
  expect(assessShot(d, "defensive", d.contactAt, 0, () => 0.99).boundary).toBe(
    0,
  );
  expect(assessShot(d, "lofted", d.contactAt, 0, () => 0.99).boundary).toBe(6);
});
test("short balls bounce earlier and higher, yorkers stay low, slower balls take longer", () => {
  const short = ball({ length: "short" }),
    yorker = ball({ length: "yorker" });
  expect(ballPosition(short, 0.8).height).toBeGreaterThan(
    ballPosition(yorker, 0.8).height,
  );
  expect(
    ballPosition(ball({ length: "short", bouncer: true }), 0.9).height,
  ).toBeGreaterThan(ballPosition(short, 0.9).height);
  expect(ball({ slow: true }).duration).toBeGreaterThan(ball().duration);
});
test("inswing and outswing bend in opposite directions and retain their late movement", () => {
  const straight = ball(),
    inside = ball({ movement: "inswing" }),
    outside = ball({ movement: "outswing" });
  expect(ballPosition(inside, 1).x).toBeLessThan(ballPosition(straight, 1).x);
  expect(ballPosition(outside, 1).x).toBeGreaterThan(
    ballPosition(straight, 1).x,
  );
  expect(
    Math.abs(ballPosition(outside, 0.8).x - ballPosition(straight, 0.8).x),
  ).toBeGreaterThan(Math.abs(ballPosition(outside, 0.3).x));
});
test("an actual wide awards one extra, leaves balls and striker unchanged, and allows a replay", () => {
  const m = new Match(stable);
  m.start();
  m.release({ ...ball(), crossing: 1.4 });
  m.tick(3000);
  expect(m.runs).toBe(1);
  expect(m.extras).toBe(1);
  expect(m.balls).toBe(0);
  expect(m.striker).toBe(0);
  expect(m.last?.wide).toBe(true);
  m.release(ball({ line: "off" }));
  m.tick(3000);
  expect(m.balls).toBe(1);
  expect(m.runs).toBe(1);
});
test("wide-line selection within reach is legal and must not award an extra", () => {
  const m = new Match(stable);
  m.start();
  m.release(ball({ line: "wide-off" }));
  m.tick(3000);
  expect(m.last?.wide).toBe(false);
  expect(m.extras).toBe(0);
  expect(m.balls).toBe(1);
});
test("a completed manual single counts and swaps strike", () => {
  const m = ground();
  m.run();
  m.tick(RUN_MS + 20);
  m.stop();
  finish(m);
  expect(m.runs).toBe(1);
  expect(m.wickets).toBe(0);
  expect(m.striker).toBe(1);
  expect(m.balls).toBe(1);
});
test("Stop cancels a queued run and finishes only the current crossing", () => {
  const m = ground();
  m.run();
  m.tick(250);
  m.run();
  expect(m.queued).toBe(true);
  m.stop();
  finish(m);
  expect(m.runs).toBe(1);
  expect(m.wickets).toBe(0);
});
test("turning back to the safe crease cancels an incomplete single", () => {
  const m = ground();
  m.run();
  m.tick(400);
  m.turn();
  m.tick(430);
  expect(m.runnerPosition).toBe(0);
  finish(m);
  expect(m.runs).toBe(0);
  expect(m.wickets).toBe(0);
});
test("run-out preserves completed runs and discards the interrupted run", () => {
  const m = ground();
  m.run();
  m.tick(RUN_MS + 20);
  m.tick(m.contact!.fieldTime - m.fieldElapsed - 350);
  m.run();
  finish(m);
  expect(m.last?.wicket).toBe("run out");
  expect(m.runs).toBe(1);
  expect(m.wickets).toBe(1);
  expect(m.balls).toBe(1);
});
test("catches discard attempted runs; boundaries replace running totals", () => {
  const caught = new Match(() => 0.01);
  caught.start("advanced", false);
  const d = ball({ length: "full" });
  caught.release(d);
  caught.hit("lofted", d.contactAt);
  expect(caught.contact?.wicket).toBe("caught");
  caught.run();
  finish(caught);
  expect(caught.runs).toBe(0);
  expect(caught.wickets).toBe(1);
  const boundary = new Match(() => 0.99);
  boundary.start("advanced", false);
  boundary.release(d);
  boundary.hit("drive", d.contactAt);
  boundary.run();
  finish(boundary);
  expect(boundary.runs).toBe(4);
  expect(boundary.balls).toBe(1);
});
test("automatic running respects an explicit Stop command", () => {
  const m = ground();
  m.autoRun = true;
  m.run();
  m.tick(250);
  m.stop();
  finish(m);
  expect(m.runs).toBe(1);
});
test("two wickets or twelve legal balls end an innings; wides do not consume an over", () => {
  for (const wickets of [false, true]) {
    const m = new Match(stable);
    m.start();
    for (let i = 0; i < (wickets ? 2 : 12); i++) {
      m.release(ball({ line: wickets ? "middle" : "off" }));
      m.tick(3000);
    }
    expect(m.phase).toBe("innings");
    expect(m.balls).toBe(wickets ? 2 : 12);
    m.next();
    expect(m.innings).toBe(2);
    expect(m.target).toBe(1);
    expect(m.phase).toBe("ready");
  }
});
test("chase ends immediately when an extra reaches the target", () => {
  const m = new Match(stable);
  m.start();
  for (let i = 0; i < 2; i++) {
    m.release(ball());
    m.tick(3000);
  }
  m.next();
  m.release({ ...ball(), crossing: 1.5 });
  m.tick(3000);
  expect(m.phase).toBe("finished");
  expect(m.runs).toBe(1);
  expect(m.balls).toBe(0);
});
test("paused matches freeze delivery, meter and running progression", () => {
  const m = ground();
  m.run();
  const t = m.fieldElapsed;
  m.paused = true;
  m.tick(5000);
  expect(m.fieldElapsed).toBe(t);
  expect(m.runnerPosition).toBe(0);
  m.paused = false;
  m.tick(250);
  expect(m.runnerPosition).toBeGreaterThan(0);
});
test("controller actions use edges, distinguish run/stop/turn and reset on disconnect", () => {
  const adapter = new PadInput(),
    buttons = Array.from({ length: 16 }, () => ({ pressed: false })),
    pad = { buttons, axes: [0, 0] };
  buttons[0].pressed = true;
  expect(adapter.poll(pad)).toEqual(["confirm"]);
  expect(adapter.poll(pad)).toEqual([]);
  buttons[0].pressed = false;
  buttons[1].pressed = buttons[2].pressed = buttons[3].pressed = true;
  expect(adapter.poll(pad)).toEqual(["run", "stop", "turn"]);
  expect(adapter.poll(null)).toEqual([]);
  expect(adapter.poll(pad)).toEqual(["run", "stop", "turn"]);
  buttons.forEach((b) => (b.pressed = false));
  pad.axes = [-1, 0];
  expect(adapter.poll(pad)).toEqual(["left"]);
});
test("keypad and keyboard mappings cover shot, running and bowling controls", () => {
  expect(keyboardAction(" ")).toBe("confirm");
  expect(keyboardAction("6")).toBe("right");
  expect(keyboardAction("8")).toBe("down");
  expect(keyboardAction("Q")).toBe("movement-left");
  expect(keyboardAction("e")).toBe("movement-right");
  expect(keyboardAction("Escape")).toBe("pause");
});

test("a missed off-stump ball never starts automatic running or creates a phantom run-out", () => {
  const m = new Match(stable);
  m.start();
  m.release(ball({ line: "off" }));
  m.hit("drive", 0);
  expect(m.contact?.distance).toBe(0);
  finish(m);
  expect(m.runs).toBe(0);
  expect(m.wickets).toBe(0);
  expect(m.last?.label).toBe("Dot ball");
});
test("actual length errors change shot effectiveness and a slightly missed yorker can be scooped", () => {
  const d = ball({ length: "yorker" });
  const accurate = assessShot(d, "scoop", d.contactAt, 0, () => 0.99);
  const missed = assessShot(
    { ...d, pitch: 0.22 },
    "scoop",
    d.contactAt,
    0,
    () => 0.99,
  );
  expect(missed.quality).toBeGreaterThan(accurate.quality);
});
