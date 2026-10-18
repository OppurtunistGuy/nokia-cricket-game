export type Mode = "classic" | "advanced";
export type Phase =
  | "menu"
  | "ready"
  | "accuracy"
  | "delivery"
  | "fielding"
  | "result"
  | "innings"
  | "finished";
export const SHOTS = [
  "auto",
  "drive",
  "cut",
  "pull",
  "sweep",
  "reverse",
  "paddle",
  "scoop",
  "defensive",
  "lofted",
] as const;
export type Shot = (typeof SHOTS)[number];
export const SHOT_NAMES: Record<Shot, string> = {
  auto: "Auto Shot",
  drive: "Drive",
  cut: "Cut",
  pull: "Pull / Hook",
  sweep: "Sweep",
  reverse: "Reverse Sweep",
  paddle: "Paddle Sweep",
  scoop: "Scoop / Ramp",
  defensive: "Defensive",
  lofted: "Lofted Shot",
};
export const LENGTHS = ["yorker", "full", "good", "short"] as const;
export type Length = (typeof LENGTHS)[number];
export const LINES = ["leg", "middle", "off", "wide-off", "wide-leg"] as const;
export type Line = (typeof LINES)[number];
export const MOVEMENTS = ["straight", "inswing", "outswing"] as const;
export type Movement = (typeof MOVEMENTS)[number];
export interface Bowling {
  length: Length;
  line: Line;
  movement: Movement;
  slow: boolean;
  bouncer: boolean;
}
export interface Delivery extends Bowling {
  pitch: number;
  crossing: number;
  curve: number;
  duration: number;
  accuracy: number;
  contactAt: number;
  aiAt: number;
  aiShot: Shot;
}
export interface Contact {
  shot: Shot;
  quality: number;
  angle: number;
  distance: number;
  boundary: 0 | 4 | 6;
  wicket: "caught" | "bowled" | null;
  fieldTime: number;
  label: string;
}
export interface BallRecord {
  runs: number;
  wicket: string | null;
  wide: boolean;
  shot: Shot;
  label: string;
}
export const DEFAULT_BOWLING: Bowling = {
  length: "good",
  line: "middle",
  movement: "straight",
  slow: false,
  bouncer: false,
};
export const AI_PLANS: readonly Bowling[] = [
  DEFAULT_BOWLING,
  {
    length: "full",
    line: "off",
    movement: "outswing",
    slow: false,
    bouncer: false,
  },
  {
    length: "short",
    line: "leg",
    movement: "straight",
    slow: false,
    bouncer: false,
  },
  {
    length: "full",
    line: "leg",
    movement: "inswing",
    slow: true,
    bouncer: false,
  },
  {
    length: "yorker",
    line: "middle",
    movement: "straight",
    slow: false,
    bouncer: false,
  },
  {
    length: "short",
    line: "off",
    movement: "outswing",
    slow: false,
    bouncer: true,
  },
];
export const RUN_MS = 1250;
export const clamp = (n: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, n));
export function cycle<T>(values: readonly T[], value: T, step: number): T {
  return values[(values.indexOf(value) + step + values.length) % values.length];
}
export function autoShot(b: Bowling): Shot {
  return b.length === "short"
    ? "pull"
    : b.line === "wide-off"
      ? "cut"
      : b.slow && b.line === "leg"
        ? "sweep"
        : "drive";
}
export function suitability(shot: Shot, b: Bowling, pitch?: number): number {
  if (shot === "auto") shot = autoShot(b);
  const length =
    pitch === undefined
      ? b.length
      : pitch < 0.23
        ? "yorker"
        : pitch < 0.4
          ? "full"
          : pitch < 0.64
            ? "good"
            : "short";
  const full = length === "full",
    good = length === "good",
    short = length === "short",
    leg = b.line === "leg" || b.line === "wide-leg",
    off = b.line === "off" || b.line === "wide-off";
  switch (shot) {
    case "auto":
      return suitability(autoShot(b), b, pitch);
    case "drive":
      return full ? 1 : good ? 0.85 : b.length === "yorker" ? 0.55 : 0.2;
    case "cut":
      return short && off ? 1 : short ? 0.65 : good && off ? 0.7 : 0.25;
    case "pull":
      return short ? 1 : 0.2;
    case "sweep":
      return short ? 0.25 : b.slow ? 1 : full ? 0.85 : good ? 0.65 : 0.3;
    case "reverse":
      return full || good ? 0.85 : 0.2;
    case "paddle":
      return full && leg ? 1 : full ? 0.75 : good && leg ? 0.65 : 0.25;
    case "scoop":
      return full
        ? 1
        : b.length === "yorker" && (pitch ?? 0.16) > 0.2
          ? 0.85
          : 0.2;
    case "defensive":
      return short ? 0.65 : 1;
    case "lofted":
      return full ? 1 : good ? 0.65 : short ? 0.45 : 0.2;
  }
}
export function matchup(shot: Shot, b: Bowling): string {
  if (shot === "auto")
    return "Auto selects a standard shot. Timing still matters.";
  const n = suitability(shot, b);
  return `${n >= 0.8 ? "Favourable" : n >= 0.5 ? "Playable" : "Risky"} vs ${b.bouncer ? "bouncer" : b.length} / ${b.line}. ${["reverse", "scoop", "lofted"].includes(shot) ? "High-risk shot." : "Time and place your shot."}`;
}
export function makeDelivery(
  b: Bowling,
  accuracy: number,
  random: () => number = Math.random,
): Delivery {
  const error = 1 - clamp(accuracy),
    pitch = clamp(
      { yorker: 0.15, full: 0.3, good: 0.51, short: 0.75 }[b.length] +
        (random() - 0.5) * (0.05 + error * 0.2),
      0.08,
      0.88,
    );
  const curve =
    (b.movement === "inswing" ? -0.26 : b.movement === "outswing" ? 0.26 : 0) *
    (b.slow ? 0.75 : 1);
  const crossing =
    { leg: -0.38, middle: 0, off: 0.38, "wide-off": 0.96, "wide-leg": -0.96 }[
      b.line
    ] +
    (random() - 0.5) * (0.12 + error * 0.95) +
    (b.bouncer ? (random() - 0.5) * 0.22 : 0) +
    curve;
  const duration = (b.slow ? 2550 : 1950) - (b.length === "short" ? 100 : 0);
  return {
    ...b,
    pitch,
    crossing,
    curve,
    duration,
    accuracy: clamp(accuracy),
    contactAt:
      b.length === "yorker" ? 0.88 : b.length === "short" ? 0.79 : 0.84,
    aiAt: 0,
    aiShot: "auto",
  };
}
export function ballPosition(
  d: Delivery,
  t: number,
): { x: number; depth: number; height: number } {
  const p = clamp(t),
    bounceAt = 0.93 - d.pitch * 0.72;
  const before = p <= bounceAt,
    local = before ? p / bounceAt : (p - bounceAt) / (1 - bounceAt);
  const height = before
    ? Math.sin(local * Math.PI) * 0.35
    : Math.sin((local * Math.PI) / 2) *
      (d.length === "short"
        ? d.bouncer
          ? 0.65
          : 0.48
        : d.length === "yorker"
          ? 0.025
          : 0.18);
  return {
    x: (d.crossing - d.curve) * p + d.curve * p * p * p,
    depth: p,
    height,
  };
}
export function assessShot(
  d: Delivery,
  selected: Shot,
  t: number,
  placement: number,
  random: () => number = Math.random,
): Contact {
  const shot = selected === "auto" ? autoShot(d) : selected,
    fit = suitability(shot, d, d.pitch),
    err = Math.abs(t - d.contactAt),
    risk = shot === "reverse" || shot === "scoop" || shot === "lofted",
    window = shot === "defensive" ? 0.29 : risk ? 0.18 : 0.24;
  const empty = (label: string, wicket: Contact["wicket"] = null): Contact => ({
    shot,
    quality: 0,
    angle: 0,
    distance: 0,
    boundary: 0,
    wicket,
    fieldTime: 650,
    label,
  });
  if (Math.abs(d.crossing) > 1.16) return empty("Wide");
  if (err > window)
    return empty(
      Math.abs(d.crossing) < 0.3 ? "Bowled" : "Missed",
      Math.abs(d.crossing) < 0.3 ? "bowled" : null,
    );
  const timing = clamp(1 - err / window),
    reach = clamp(1 - Math.max(0, Math.abs(d.crossing) - 0.4) * 0.35),
    quality = clamp(
      timing * (0.47 + 0.53 * fit) * reach + (random() - 0.5) * 0.07,
    );
  const edgeRisk =
    (1 - quality) * 0.4 +
    (risk ? 0.13 : 0) +
    (fit < 0.4 ? 0.14 : 0) +
    (Math.abs(d.curve) > 0.15 ? 0.04 : 0);
  if (shot !== "defensive" && random() < edgeRisk)
    return {
      ...empty("Caught", "caught"),
      quality,
      shot,
      distance: 45,
      fieldTime: 1400,
    };
  const angle =
    shot === "reverse"
      ? -2.75
      : shot === "paddle"
        ? 2.45
        : shot === "scoop"
          ? Math.PI / 2
          : shot === "pull"
            ? -2.7
            : shot === "cut"
              ? -0.65
              : shot === "sweep"
                ? -2.2
                : placement < 0
                  ? -2.5
                  : placement > 0
                    ? -0.55
                    : -Math.PI / 2;
  const aerial = ["lofted", "scoop", "pull", "reverse"].includes(shot),
    boundary: 0 | 4 | 6 =
      shot === "defensive"
        ? 0
        : quality > 0.89 && aerial
          ? 6
          : quality > 0.78
            ? 4
            : 0;
  const distance =
    shot === "defensive" ? 18 + quality * 12 : 30 + quality * 110;
  // Placement matters: covered regions return sooner, gaps take longer.
  const gap = Math.abs(Math.sin(angle * 3.5));
  return {
    shot,
    quality,
    angle,
    distance,
    boundary,
    wicket: null,
    fieldTime: boundary
      ? 1650
      : shot === "defensive"
        ? Math.round(1200 + quality * 300)
        : Math.round(1500 + quality * 1900 + gap * 650),
    label:
      quality > 0.8
        ? "Clean contact"
        : quality > 0.5
          ? "In the gap"
          : "Inside edge",
  };
}
export class Match {
  phase: Phase = "menu";
  mode: Mode = "classic";
  autoRun = true;
  team = "INDIA";
  opponent = "AUSTRALIA";
  innings = 1;
  runs = 0;
  wickets = 0;
  balls = 0;
  first = 0;
  target = 0;
  extras = 0;
  attempts = 0;
  striker = 0;
  shot: Shot = "auto";
  placement = 0;
  bowling: Bowling = { ...DEFAULT_BOWLING };
  delivery: Delivery | null = null;
  contact: Contact | null = null;
  time = 0;
  progress = 0;
  meter = 0.5;
  fieldElapsed = 0;
  completedRuns = 0;
  runnerPosition = 0;
  runnerHome = 0;
  runnerTarget = 1;
  moving = false;
  queued = false;
  returning = false;
  paused = false;
  last: BallRecord | null = null;
  history: BallRecord[] = [];
  message = "Choose Classic or Advanced. Two overs. Two wickets.";
  private holding = false;
  private aiActed = false;
  private aiAdvance = true;
  constructor(private random: () => number = Math.random) {}
  start(mode: Mode = "classic", autoRun = mode === "classic", team = "INDIA") {
    this.mode = mode;
    this.autoRun = autoRun;
    this.team = team;
    this.opponent = team === "AUSTRALIA" ? "INDIA" : "AUSTRALIA";
    this.innings = 1;
    this.runs =
      this.wickets =
      this.balls =
      this.first =
      this.target =
      this.extras =
      this.attempts =
      this.striker =
        0;
    this.history = [];
    this.last = null;
    this.delivery = null;
    this.contact = null;
    this.phase = "ready";
    this.shot = mode === "classic" ? "auto" : "drive";
    this.bowling = { ...DEFAULT_BOWLING };
    this.placement = 0;
    this.paused = false;
    this.message = "You bat first. Choose your shot, then start the ball.";
  }
  get expected(): Bowling {
    return { ...AI_PLANS[this.attempts % AI_PLANS.length] };
  }
  get batting() {
    return this.innings === 1;
  }
  get preparation() {
    return this.phase === "ready" || this.phase === "result";
  }
  get overs() {
    return `${Math.floor(this.balls / 6)}.${this.balls % 6}`;
  }
  get visibleShot() {
    return this.contact?.shot ?? this.shot;
  }
  get provisionalRuns() {
    return (
      this.runs +
      (this.phase === "fielding" &&
      !this.contact?.wicket &&
      !this.contact?.boundary
        ? this.completedRuns
        : 0)
    );
  }
  next() {
    if (this.paused) return;
    if (this.phase === "innings") {
      this.first = this.runs;
      this.target = this.first + 1;
      this.runs = this.wickets = this.balls = this.extras = this.striker = 0;
      this.history = [];
      this.last = null;
      this.contact = null;
      this.delivery = null;
      this.innings = 2;
      this.phase = "ready";
      this.message = `Defend ${this.first}. Choose the delivery, then set its accuracy.`;
      return;
    }
    if (this.phase === "finished") {
      this.start(this.mode, this.autoRun, this.team);
      return;
    }
    if (!this.preparation) return;
    this.last = null;
    this.contact = null;
    this.time = this.progress = 0;
    if (!this.batting) {
      this.phase = "accuracy";
      this.meter = 0.5;
      this.message = "Press 5 / Space with the accuracy marker in the centre.";
      return;
    }
    this.release(
      makeDelivery(
        { ...AI_PLANS[this.attempts % AI_PLANS.length] },
        0.75,
        this.random,
      ),
    );
  }
  release(d: Delivery) {
    this.delivery = d;
    this.attempts++;
    this.time = this.progress = 0;
    this.aiActed = false;
    d.aiShot =
      this.random() < 0.85 - d.accuracy * 0.35
        ? "auto"
        : SHOTS[1 + Math.floor(this.random() * (SHOTS.length - 1))];
    d.aiAt = clamp(
      d.contactAt +
        (this.random() - 0.5) *
          (0.18 + d.accuracy * 0.31 + Math.abs(d.curve) * 0.2),
      0.5,
      0.98,
    );
    this.phase = "delivery";
    this.message = `${d.bouncer ? "Bouncer" : d.length} / ${d.line} / ${d.movement}${d.slow ? " / slower ball" : ""}. Watch the bounce.`;
  }
  action() {
    if (this.paused) {
      this.paused = false;
      return;
    }
    if (this.phase === "menu") {
      this.start();
      return;
    }
    if (
      this.preparation ||
      this.phase === "innings" ||
      this.phase === "finished"
    ) {
      this.next();
      return;
    }
    if (this.phase === "accuracy") {
      this.release(
        makeDelivery(
          this.bowling,
          clamp(1 - Math.abs(this.meter - 0.5) * 2),
          this.random,
        ),
      );
      return;
    }
    if (this.phase === "delivery" && this.batting)
      this.hit(this.shot, this.progress);
  }
  hit(shot: Shot, t: number) {
    if (!this.delivery || this.phase !== "delivery") return;
    this.contact = assessShot(
      this.delivery,
      shot,
      t,
      this.placement,
      this.random,
    );
    if (Math.abs(this.delivery.crossing) > 1.16) {
      this.contact = null;
      this.message = "Outside playable reach. Let it pass.";
      return;
    }
    this.phase = "fielding";
    this.fieldElapsed =
      this.completedRuns =
      this.runnerPosition =
      this.runnerHome =
        0;
    this.runnerTarget = 1;
    this.moving = this.queued = this.returning = false;
    this.holding = false;
    this.aiAdvance = this.random() < 0.12;
    this.message =
      this.contact.wicket === "caught"
        ? "In the air…"
        : this.contact.wicket
          ? "Beaten!"
          : `${SHOT_NAMES[this.contact.shot]}. ${this.contact.label}.`;
    if (
      !this.contact.wicket &&
      !this.contact.boundary &&
      (this.batting ? this.autoRun : true)
    ) {
      this.run();
    }
  }
  run() {
    if (
      this.phase !== "fielding" ||
      !this.contact ||
      this.contact.wicket ||
      this.contact.distance === 0 ||
      this.contact.boundary
    )
      return;
    if (this.moving) {
      this.queued = true;
      this.returning = false;
      this.runnerTarget = 1 - this.runnerHome;
    } else {
      this.runnerTarget = 1 - this.runnerHome;
      this.returning = false;
      this.moving = true;
    }
    this.holding = false;
    this.message = this.queued
      ? "Next run queued. Down stops after this run."
      : "Running! Left turns back; Down cancels the next run.";
  }
  stop() {
    if (this.phase !== "fielding") return;
    this.queued = false;
    this.holding = true;
    this.message = this.moving
      ? "Finish this run, then hold."
      : "Holding at the crease.";
  }
  turn() {
    if (this.phase !== "fielding" || !this.moving) return;
    this.runnerTarget = this.runnerHome;
    this.returning = true;
    this.queued = false;
    this.holding = true;
    this.message = "Turning back! Get home before the throw.";
  }
  selectShot(step: number) {
    if (this.preparation && this.batting && this.mode === "advanced")
      this.shot = cycle(SHOTS, this.shot, step);
    else if (this.preparation && this.batting)
      this.placement = step < 0 ? -1 : 1;
  }
  changeLine(step: number) {
    if (!this.batting && (this.preparation || this.phase === "accuracy"))
      this.bowling.line = cycle(LINES, this.bowling.line, step);
  }
  changeLength(step: number) {
    if (
      !this.batting &&
      this.mode === "advanced" &&
      (this.preparation || this.phase === "accuracy")
    ) {
      this.bowling.length = cycle(LENGTHS, this.bowling.length, step);
      this.bowling.bouncer = false;
    }
  }
  changeMovement(step: number) {
    if (
      !this.batting &&
      this.mode === "advanced" &&
      (this.preparation || this.phase === "accuracy")
    )
      this.bowling.movement = cycle(MOVEMENTS, this.bowling.movement, step);
  }
  tick(ms: number) {
    if (this.paused) return;
    for (let remaining = Math.max(0, ms); remaining > 0;) {
      const dt = Math.min(remaining, 30);
      remaining -= dt;
      this.step(dt);
    }
  }
  private step(dt: number) {
    if (this.phase === "accuracy") {
      this.time += dt;
      this.meter = (Math.sin(this.time / 350) + 1) / 2;
      return;
    }
    if (this.phase === "delivery" && this.delivery) {
      this.time += dt;
      this.progress = this.time / this.delivery.duration;
      if (
        !this.batting &&
        !this.aiActed &&
        this.progress >= this.delivery.aiAt
      ) {
        this.aiActed = true;
        this.hit(this.delivery.aiShot, this.progress);
        if (this.phase !== "delivery") return;
      }
      if (this.progress >= 1) {
        if (Math.abs(this.delivery.crossing) > 1.16)
          this.settle(1, null, true, "Wide: +1. Bowl again.");
        else
          this.settle(
            0,
            Math.abs(this.delivery.crossing) < 0.3 ? "bowled" : null,
            false,
            Math.abs(this.delivery.crossing) < 0.3 ? "Bowled" : "Dot ball",
          );
      }
      return;
    }
    if (this.phase !== "fielding" || !this.contact) return;
    const timeLeft = Math.max(0, this.contact.fieldTime - this.fieldElapsed),
      step = Math.min(dt, timeLeft);
    this.fieldElapsed += step;
    if (this.moving) {
      const sign = Math.sign(this.runnerTarget - this.runnerPosition);
      this.runnerPosition = clamp(this.runnerPosition + (sign * step) / RUN_MS);
      if (Math.abs(this.runnerPosition - this.runnerTarget) < 0.001) {
        this.runnerPosition = this.runnerTarget;
        this.moving = false;
        if (!this.returning) {
          this.completedRuns++;
          this.runnerHome = this.runnerTarget;
          if (!this.batting && this.runs + this.completedRuns >= this.target) {
            this.settle(this.completedRuns, null, false, "Target reached");
            return;
          }
        }
        if (this.queued && !this.returning) {
          this.queued = false;
          this.runnerTarget = 1 - this.runnerHome;
          this.moving = true;
        }
        this.returning = false;
      }
    }
    if (
      !this.contact.boundary &&
      !this.contact.wicket &&
      (this.batting ? this.autoRun : true) &&
      !this.returning &&
      !this.holding
    ) {
      const safe = this.contact.fieldTime - this.fieldElapsed > RUN_MS + 120;
      if (safe) {
        if (!this.moving) this.run();
        else if (this.contact.fieldTime - this.fieldElapsed > RUN_MS * 2 + 120)
          this.queued = true;
      } else if (
        !this.batting &&
        this.aiAdvance &&
        this.completedRuns === 1 &&
        !this.moving &&
        this.contact.fieldTime - this.fieldElapsed > 700
      )
        this.run();
    }
    if (this.fieldElapsed >= this.contact.fieldTime) {
      if (this.contact.wicket)
        this.settle(
          0,
          this.contact.wicket,
          false,
          this.contact.wicket === "caught" ? "Caught" : "Bowled",
        );
      else if (this.contact.boundary)
        this.settle(
          this.contact.boundary,
          null,
          false,
          this.contact.boundary === 6 ? "Six!" : "Four!",
        );
      else {
        const unsafe =
          this.moving &&
          Math.abs(this.runnerPosition - this.runnerHome) > 0.025;
        this.settle(
          this.completedRuns,
          unsafe ? "run out" : null,
          false,
          unsafe
            ? "Run out"
            : this.completedRuns
              ? `${this.completedRuns} run${this.completedRuns === 1 ? "" : "s"}`
              : "Dot ball",
        );
      }
    }
  }
  private settle(
    value: number,
    wicket: string | null,
    wide: boolean,
    label: string,
  ) {
    if (!wide) this.balls++;
    else this.extras++;
    this.runs += value;
    if (wicket) this.wickets++;
    const record: BallRecord = {
      runs: value,
      wicket,
      wide,
      shot: this.contact?.shot ?? "auto",
      label,
    };
    this.history.push(record);
    this.last = record;
    if (!wide && value % 2) this.striker = 1 - this.striker;
    if (!wide && this.balls % 6 === 0) this.striker = 1 - this.striker;
    this.phase = "result";
    this.message = label;
    if (!this.batting && this.runs >= this.target) {
      this.phase = "finished";
      this.message = `${this.opponent} win by ${2 - this.wickets} wicket${2 - this.wickets === 1 ? "" : "s"}.`;
    } else if (this.balls >= 12 || this.wickets >= 2) {
      if (this.batting) {
        this.phase = "innings";
        this.message = `You scored ${this.runs}/${this.wickets}. ${this.opponent} need ${this.runs + 1}.`;
      } else {
        this.phase = "finished";
        this.message =
          this.runs === this.first
            ? "Match tied."
            : `${this.team} win by ${this.first - this.runs} run${this.first - this.runs === 1 ? "" : "s"}.`;
      }
    }
  }
}
