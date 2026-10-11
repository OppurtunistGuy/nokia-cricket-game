import Phaser from "phaser";
type Stage =
  "menu" | "ready" | "delivery" | "flight" | "result" | "innings" | "finished";
type Level = "rookie" | "club" | "pro";
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
let stage: Stage = "menu",
  innings = 1,
  runs = 0,
  wickets = 0,
  balls = 0,
  first = 0,
  target = 0,
  direction = 0,
  progress = 0,
  meter = 0,
  meterStarted = 0,
  shot = false,
  team = "INDIA",
  opponent = "AUSTRALIA",
  level: Level = "club",
  sound = false,
  audio: AudioContext | undefined,
  last = "CRICKET CUP",
  swingUntil = 0;
let history: (number | "W")[] = [];
let pending: {
  value: number;
  wicket: boolean;
  started: number;
  until: number;
  line: number;
} | null = null;
let best = 0;
try {
  best = Number(localStorage.getItem("cricket-best") || 0);
} catch {
  /* Storage can be unavailable in a private webview. */
}
const duration = () =>
  level === "rookie" ? 2400 : level === "pro" ? 1500 : 1900;
function beep(freq = 600) {
  if (!sound) return;
  audio ??= new AudioContext();
  void audio.resume();
  const o = audio.createOscillator(),
    g = audio.createGain();
  o.type = "triangle";
  o.frequency.setValueAtTime(freq, audio.currentTime);
  o.frequency.exponentialRampToValueAtTime(
    freq * 0.6,
    audio.currentTime + 0.15,
  );
  g.gain.setValueAtTime(0.05, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.18);
  o.connect(g);
  g.connect(audio.destination);
  o.start();
  o.stop(audio.currentTime + 0.18);
}
function sync(msg: string) {
  $("message").textContent = msg;
  $("phase").textContent =
    stage === "menu"
      ? "QUICK MATCH"
      : stage === "finished"
        ? "MATCH RESULT"
        : innings === 1
          ? "FIRST INNINGS · YOU BAT"
          : "SECOND INNINGS · YOU BOWL";
  $("team-name").textContent = `${team}  /  ${opponent}`;
  $("runs").replaceChildren(
    document.createTextNode(String(runs)),
    Object.assign(document.createElement("span"), {
      textContent: `/${wickets}`,
    }),
  );
  $("over").textContent = `${Math.floor(balls / 6)}.${balls % 6}`;
  $("score").textContent =
    `${runs}/${wickets} · ${Math.floor(balls / 6)}.${balls % 6} / 2`;
  $("menu").hidden = stage !== "menu";
  $("play").hidden = stage === "menu";
  $("next").hidden = !["ready", "result", "innings", "finished"].includes(
    stage,
  );
  $("next").textContent =
    stage === "innings"
      ? "DEFEND YOUR TOTAL"
      : stage === "finished"
        ? "PLAY AGAIN"
        : stage === "ready"
          ? "START DELIVERY"
          : "NEXT BALL";
  $("action-label").textContent = innings === 1 ? "PLAY SHOT" : "RELEASE BALL";
  $("action").toggleAttribute("disabled", stage !== "delivery");
  $("team-settings").hidden = stage !== "menu";
  $("team").toggleAttribute("disabled", stage !== "menu");
  $("difficulty").toggleAttribute("disabled", stage !== "menu");
  $("menu-detail").hidden = true;
  $("match-task").textContent =
    stage === "menu"
      ? "BAT FIRST. SET THE STANDARD."
      : stage === "finished"
        ? last
        : innings === 1
          ? "BUILD YOUR INNINGS."
          : "DEFEND YOUR TOTAL.";
  $("target-info").textContent =
    stage === "menu"
      ? "Two overs. Two wickets. One shot at a great innings."
      : innings === 1
        ? `${12 - balls} balls remaining. Make every delivery count.`
        : `Target ${target}. ${opponent} need ${Math.max(0, target - runs)} from ${12 - balls}.`;
  $("balls-left").textContent = `${12 - balls} BALLS LEFT`;
  $("history").replaceChildren(
    ...Array.from({ length: 6 }, (_, i) => {
      const n = history[Math.floor(Math.max(0, balls - 1) / 6) * 6 + i],
        el = document.createElement("span");
      el.textContent = n === undefined ? "–" : String(n);
      el.className =
        n === "W"
          ? "wicket"
          : n === 4 || n === 6
            ? "boundary"
            : n !== undefined
              ? "run"
              : "";
      return el;
    }),
  );
  $("result-banner").hidden = !["result", "innings", "finished"].includes(
    stage,
  );
  $("result-kicker").textContent =
    stage === "finished"
      ? "FINAL SCORE"
      : stage === "innings"
        ? "CHANGE OF INNINGS"
        : "DELIVERY RESULT";
  $("result-title").textContent = last;
  $("result-detail").textContent = msg;
  document.body.dataset.outcome =
    last === "BOWLED!"
      ? "wicket"
      : last === "SIX!" || last === "FOUR!"
        ? "boundary"
        : "normal";
  document.body.dataset.stage = stage;
  document.body.dataset.innings = String(innings);
  updateAim();
}
function updateAim() {
  $("aim-label").textContent =
    direction < 0 ? "LEG SIDE" : direction > 0 ? "OFF SIDE" : "STRAIGHT";
  document
    .querySelectorAll<HTMLButtonElement>(".keypad button")
    .forEach((b) => {
      const selected =
        (b.dataset.key === "4" && direction < 0) ||
        (b.dataset.key === "6" && direction > 0);
      b.classList.toggle("active", selected);
      b.setAttribute("aria-pressed", String(selected));
    });
}
function start() {
  team = $<HTMLSelectElement>("team").value;
  opponent = team === "AUSTRALIA" ? "INDIA" : "AUSTRALIA";
  level = $<HTMLSelectElement>("difficulty").value as Level;
  innings = 1;
  runs = wickets = balls = first = target = 0;
  direction = 0;
  pending = null;
  history = [];
  last = "PLAY YOUR INNINGS";
  stage = "ready";
  sync("You bat first. Choose a line, then start the delivery.");
  beep();
}
function delivery() {
  if (stage === "innings") {
    innings = 2;
    first = runs;
    target = first + 1;
    runs = wickets = balls = 0;
    history = [];
    stage = "ready";
    last = `TARGET ${target}`;
    sync(`Defend ${first}. Stop the bowling meter in its green zone.`);
    return;
  }
  if (stage === "finished") {
    start();
    return;
  }
  if (stage !== "ready" && stage !== "result") return;
  stage = "delivery";
  shot = false;
  progress = meter = 0;
  meterStarted = performance.now();
  pending = null;
  last = innings === 1 ? "WATCH THE BALL" : "FIND YOUR LENGTH";
  sync(
    innings === 1
      ? "Let it come to you. Play your shot as the ball reaches the crease."
      : "Stop the moving marker in the green zone to bowl a good length.",
  );
  beep(420);
}
function animate(value: number, wicket: boolean) {
  const t = performance.now();
  pending = {
    value,
    wicket,
    started: t,
    until: t + 1300,
    line: direction || 1,
  };
  stage = "flight";
  last = wicket ? "BEATEN" : value >= 4 ? "INTO THE GAP" : "SHOT AWAY";
  sync(
    wicket
      ? "The ball beats the bat…"
      : "The ball is away. Fielders are chasing.",
  );
  swingUntil = t + 450;
}
function resolve(value: number, wicket: boolean) {
  if (stage !== "delivery" && stage !== "flight") return;
  balls++;
  if (wicket) wickets++;
  else runs += value;
  history.push(wicket ? "W" : value);
  last = wicket
    ? "BOWLED!"
    : value === 0
      ? "DOT BALL"
      : value === 4
        ? "FOUR!"
        : value === 6
          ? "SIX!"
          : `${value} RUN${value === 1 ? "" : "S"}`;
  beep(wicket ? 180 : value >= 4 ? 900 : 500);
  stage = "result";
  let msg = `${last} ${innings === 2 ? `${Math.max(0, target - runs)} needed from ${12 - balls} balls.` : `${12 - balls} balls remaining.`}`;
  if (innings === 2 && runs >= target) {
    stage = "finished";
    last = "YOU LOSE";
    msg = `${opponent} win by ${2 - wickets} wicket${2 - wickets === 1 ? "" : "s"}. Your total: ${first}.`;
  } else if (balls >= 12 || wickets >= 2) {
    if (innings === 1) {
      best = Math.max(best, runs);
      try {
        localStorage.setItem("cricket-best", String(best));
      } catch {}
      stage = "innings";
      last = "INNINGS OVER";
      msg = `You scored ${runs}/${wickets}. ${opponent} need ${runs + 1}. Time to bowl!`;
    } else {
      stage = "finished";
      last = runs === first ? "MATCH TIED" : "YOU WIN!";
      msg =
        runs === first
          ? `Both teams scored ${first}. Honours shared.`
          : `${team} win by ${first - runs} run${first - runs === 1 ? "" : "s"}! ${first} against ${runs}/${wickets}.`;
    }
  }
  sync(msg);
}
function key(k: string) {
  if (stage === "flight") return;
  if (k === "4" || k === "ArrowLeft") {
    direction = -1;
    updateAim();
    beep(350);
  }
  if (k === "6" || k === "ArrowRight") {
    direction = 1;
    updateAim();
    beep(450);
  }
  if (k === "5" || k === " " || k === "Enter") {
    if (stage === "menu") {
      start();
      return;
    }
    if (stage !== "delivery") {
      delivery();
      return;
    }
    if (shot) return;
    shot = true;
    if (innings === 1) {
      const error = Math.abs(progress - 0.84),
        forgiving = level === "rookie" ? 1.2 : level === "pro" ? 0.85 : 1,
        value =
          error < 0.045 * forgiving
            ? 6
            : error < 0.1 * forgiving
              ? 4
              : error < 0.17 * forgiving
                ? 2
                : error < 0.24 * forgiving
                  ? 1
                  : 0;
      animate(value, error > 0.3 * forgiving);
    } else {
      const error = Math.min(
          1,
          Math.abs(meter - 0.5) + (direction === 0 ? 0.025 : 0),
        ),
        roll = Math.random(),
        wicket = roll < (error < 0.09 ? 0.48 : error < 0.2 ? 0.22 : 0.05),
        value =
          error < 0.09
            ? roll > 0.8
              ? 1
              : 0
            : error < 0.2
              ? roll > 0.7
                ? 2
                : 1
              : roll < 0.35
                ? 6
                : roll < 0.7
                  ? 4
                  : 2;
      animate(value, wicket);
    }
  }
}
function polygon(
  c: CanvasRenderingContext2D,
  points: number[][],
  fill: string,
) {
  c.fillStyle = fill;
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fill();
}
function background(canvas: HTMLCanvasElement, overhead: boolean) {
  const c = canvas.getContext("2d")!;
  const w = 960,
    h = 720;
  let seed = 93;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  if (overhead) {
    c.fillStyle = "#142128";
    c.fillRect(0, 0, w, h);
    for (let ring = 0; ring < 6; ring++) {
      c.strokeStyle = ring % 2 ? "#2c4646" : "#36504b";
      c.lineWidth = 12;
      c.beginPath();
      c.ellipse(480, 350, 420 - ring * 13, 325 - ring * 10, 0, 0, Math.PI * 2);
      c.stroke();
    }
    for (let i = 0; i < 900; i++) {
      const a = rand() * Math.PI * 2,
        r = rand() * 50;
      c.fillStyle = ["#526058", "#658376", "#b5ba87", "#799a91"][i % 4];
      c.fillRect(
        480 + Math.cos(a) * (370 + r),
        350 + Math.sin(a) * (282 + r * 0.7),
        2,
        2,
      );
    }
    c.fillStyle = "#204f36";
    c.beginPath();
    c.ellipse(480, 355, 365, 272, 0, 0, Math.PI * 2);
    c.fill();
    c.save();
    c.beginPath();
    c.ellipse(480, 355, 365, 272, 0, 0, Math.PI * 2);
    c.clip();
    for (let x = 0; x < w; x += 65) {
      c.fillStyle = x % 130 ? "#285e3b" : "#2d6740";
      c.fillRect(x, 70, 65, 590);
    }
    const grad = c.createRadialGradient(390, 300, 40, 480, 350, 450);
    grad.addColorStop(0, "#76b46022");
    grad.addColorStop(1, "#001a1455");
    c.fillStyle = grad;
    c.fillRect(0, 0, w, h);
    c.restore();
    c.strokeStyle = "#cfdeb5";
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(480, 355, 345, 252, 0, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = "#aad29450";
    c.setLineDash([6, 6]);
    c.beginPath();
    c.ellipse(480, 355, 175, 127, 0, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = "#ba9c6f";
    c.fillRect(464, 302, 32, 105);
    c.strokeStyle = "#eedcc0";
    c.lineWidth = 2;
    [318, 390].forEach((y) => {
      c.beginPath();
      c.moveTo(451, y);
      c.lineTo(509, y);
      c.stroke();
    });
    return;
  }
  const sky = c.createLinearGradient(0, 0, 0, 300);
  sky.addColorStop(0, "#071219");
  sky.addColorStop(1, "#36514e");
  c.fillStyle = sky;
  c.fillRect(0, 0, w, h);
  c.fillStyle = "#d8e6c3";
  c.beginPath();
  c.arc(768, 89, 19, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#12252d";
  c.beginPath();
  c.arc(776, 84, 18, 0, Math.PI * 2);
  c.fill();
  for (let i = 0; i < 80; i++) {
    c.fillStyle = `rgba(207,230,214,${rand() * 0.4})`;
    c.fillRect(rand() * w, rand() * 130, 1, 1);
  }
  // Stadium architecture, three tiers of seats and a luminous boundary ribbon.
  polygon(
    c,
    [
      [0, 122],
      [190, 153],
      [430, 175],
      [720, 147],
      [960, 110],
      [960, 275],
      [0, 275],
    ],
    "#172f34",
  );
  for (let row = 0; row < 11; row++) {
    const y = 156 + row * 8;
    c.fillStyle = row % 4 === 0 ? "#536a61" : "#273f40";
    c.fillRect(0, y, w, 3);
    for (let x = 0; x < w; x += 9) {
      c.fillStyle = ["#6d8068", "#415956", "#a6af7e", "#687678", "#274950"][
        Math.floor(rand() * 5)
      ];
      c.fillRect(x, y + 3, 4, 3);
    }
  }
  c.fillStyle = "#101f27";
  c.fillRect(0, 244, w, 26);
  c.fillStyle = "#acd495";
  c.fillRect(0, 258, w, 2);
  c.font = "bold 11px Arial";
  c.fillStyle = "#8aada1";
  for (let x = 20; x < w; x += 170)
    c.fillText("CRICKET CUP   /   NIGHT SESSION", x, 255);
  [
    [80, 65],
    [900, 45],
    [265, 115],
    [704, 106],
  ].forEach(([x, y]) => {
    c.strokeStyle = "#365453";
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(x, y + 12);
    c.lineTo(x, 250);
    c.stroke();
    const glow = c.createRadialGradient(x, y, 0, x, y, 120);
    glow.addColorStop(0, "#edffdc45");
    glow.addColorStop(1, "#d6ffbc00");
    c.fillStyle = glow;
    c.fillRect(x - 120, y - 100, 240, 240);
    c.fillStyle = "#e2f5d0";
    c.fillRect(x - 21, y - 5, 42, 9);
    for (let i = 0; i < 7; i++) {
      c.fillStyle = "#fdffe1";
      c.fillRect(x - 19 + i * 6, y - 3, 3, 4);
    }
  });
  c.fillStyle = "#2b6341";
  c.fillRect(0, 270, w, 450);
  for (let i = -8; i < 9; i++) {
    const x = 480 + i * 94;
    polygon(
      c,
      [
        [480 + i * 22, 270],
        [480 + (i + 1) * 22, 270],
        [x + 94, 720],
        [x, 720],
      ],
      i % 2 ? "#2c6843" : "#235b3b",
    );
  }
  const light = c.createLinearGradient(0, 270, 0, 720);
  light.addColorStop(0, "#b9da7c10");
  light.addColorStop(1, "#09201850");
  c.fillStyle = light;
  c.fillRect(0, 270, w, 450);
  c.strokeStyle = "#cedfbb80";
  c.lineWidth = 2;
  c.beginPath();
  c.ellipse(480, 295, 450, 62, 0, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = "#bbcfa43a";
  c.setLineDash([8, 9]);
  c.beginPath();
  c.ellipse(480, 349, 245, 87, 0, 0, Math.PI * 2);
  c.stroke();
  c.setLineDash([]);
  // A worn, perspective pitch. Seeded texture never affects match randomness.
  polygon(
    c,
    [
      [445, 282],
      [520, 282],
      [672, 720],
      [280, 720],
    ],
    "#b49b76",
  );
  polygon(
    c,
    [
      [449, 283],
      [515, 283],
      [640, 720],
      [318, 720],
    ],
    "#c8ad82",
  );
  c.save();
  c.beginPath();
  c.moveTo(445, 282);
  c.lineTo(520, 282);
  c.lineTo(672, 720);
  c.lineTo(280, 720);
  c.closePath();
  c.clip();
  for (let i = 0; i < 3800; i++) {
    const y = 280 + rand() * 440;
    c.fillStyle = i % 2 ? "#e3c89b20" : "#826e5025";
    c.fillRect(250 + rand() * 450, y, rand() * 3 + 1, 1);
  }
  for (let i = 0; i < 13; i++) {
    const y = 390 + rand() * 320,
      x = 390 + rand() * 190;
    c.strokeStyle = "#76654c35";
    c.lineWidth = 0.6;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + 7, y + 12);
    c.lineTo(x + 2, y + 22);
    c.stroke();
  }
  c.restore();
  c.strokeStyle = "#f6ead3";
  c.lineWidth = 3;
  [
    [424, 543, 313],
    [309, 632, 619],
    [295, 649, 646],
  ].forEach(([x1, x2, y]) => {
    c.beginPath();
    c.moveTo(x1, y);
    c.lineTo(x2, y);
    c.stroke();
  });
  [
    [346, 617, 338, 658],
    [599, 617, 607, 658],
  ].forEach(([x1, y1, x2, y2]) => {
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
  });
  // Foreground vignette keeps HUD and ball legible under stadium lights.
  const vignette = c.createRadialGradient(500, 490, 150, 480, 360, 630);
  vignette.addColorStop(0, "#00160b00");
  vignette.addColorStop(1, "#0310159c");
  c.fillStyle = vignette;
  c.fillRect(0, 0, w, h);
}
class CricketScene extends Phaser.Scene {
  g!: Phaser.GameObjects.Graphics;
  perspective!: Phaser.GameObjects.Image;
  overhead!: Phaser.GameObjects.Image;
  shade!: Phaser.GameObjects.Rectangle;
  previousBall = "";
  create() {
    document.getElementById("boot-status")?.remove();
    $("start").removeAttribute("disabled");
    for (const [name, overhead] of [
      ["stadium", false],
      ["overview", true],
    ] as const) {
      const tex = this.textures.createCanvas(name, 960, 720)!;
      background(tex.canvas, overhead);
      tex.refresh();
    }
    this.perspective = this.add.image(0, 0, "stadium").setOrigin(0);
    this.overhead = this.add
      .image(0, 0, "overview")
      .setOrigin(0)
      .setVisible(false);
    this.g = this.add.graphics();
    this.shade = this.add
      .rectangle(0, 0, 960, 720, 0x06120f, 0.4)
      .setOrigin(0)
      .setVisible(true);
    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      if (
        ["SELECT", "BUTTON", "A"].includes(
          (e.target as HTMLElement)?.tagName,
        ) &&
        e.key === "Enter"
      )
        return;
      if ((e.target as HTMLElement)?.tagName === "SELECT") return;
      if (
        [" ", "ArrowLeft", "ArrowRight", "5", "4", "6", "Enter"].includes(e.key)
      ) {
        e.preventDefault();
        if (!e.repeat) key(e.key);
      }
    });
  }
  stumps(x: number, y: number, s: number, broken = false) {
    const g = this.g;
    g.fillStyle(0x061c16, 0.35);
    g.fillEllipse(x + 10 * s, y + 3 * s, 30 * s, 5 * s);
    g.lineStyle(3 * s, 0xf3e2bd);
    for (let i = -1; i <= 1; i++) {
      g.beginPath();
      g.moveTo(x + i * 5 * s, y);
      g.lineTo(
        x + i * 5 * s + (broken ? i * 8 * s : 0),
        y - 30 * s + (broken ? 14 * s : 0),
      );
      g.strokePath();
    }
    if (!broken) {
      g.lineStyle(2 * s, 0xd0bc94);
      g.lineBetween(x - 7 * s, y - 31 * s, x + 7 * s, y - 31 * s);
    }
  }
  player(
    x: number,
    y: number,
    s: number,
    color: number,
    pose: "bat" | "bowl" | "field" = "field",
    motion = 0,
  ) {
    const g = this.g,
      P = (a: number, b: number) => ({ x: x + a * s, y: y + b * s }),
      line = (
        a: number,
        b: number,
        c: number,
        d: number,
        width: number,
        col: number,
      ) => {
        g.lineStyle(width * s, col);
        g.lineBetween(x + a * s, y + b * s, x + c * s, y + d * s);
      };
    const swinging = pose === "bat" && performance.now() < swingUntil,
      step =
        pose === "bowl"
          ? Math.sin(motion * 8) * 4
          : pose === "field"
            ? Math.sin(motion * 15) * 3
            : 0;
    g.fillStyle(0x06150f, 0.28);
    g.fillEllipse(x + 12 * s, y + 3 * s, 40 * s, 9 * s);
    line(-6, -29, -7 - step, -3, 10, 0xd8decb);
    line(6, -29, 9 + step, -3, 10, 0xc7d3bd);
    line(-8 - step, -3, -15 - step, 0, 6, 0x152b29);
    line(9 + step, -3, 18 + step, 0, 6, 0x152b29);
    g.fillStyle(color);
    g.fillPoints(
      [P(-12, -61), P(7, -62), P(14, -48), P(9, -30), P(-10, -30), P(-16, -49)],
      true,
    );
    g.fillStyle(0xffffff, 0.13);
    g.fillPoints([P(-12, -61), P(-6, -61), P(-4, -32), P(-10, -30)], true);
    g.fillStyle(0x0d2425, 0.25);
    g.fillPoints([P(7, -62), P(14, -48), P(9, -30), P(3, -30)], true);
    line(-10, -32, 9, -32, 2, 0x183832);
    const ax = swinging
        ? direction < 0
          ? -31
          : 35
        : pose === "bowl"
          ? Math.sin(motion * 5) * 19 + 8
          : pose === "bat"
            ? 16
            : 18,
      ay = swinging
        ? -64
        : pose === "bowl"
          ? -72 + Math.cos(motion * 5) * 15
          : -43;
    line(-10, -56, -14, -42, 7, color);
    line(-14, -42, ax, ay, 5, 0xcda47b);
    line(8, -57, 16, -43, 7, color);
    line(16, -43, ax + 2, ay + 3, 5, 0xcda47b);
    g.fillStyle(0xf1e5c9);
    g.fillCircle(x + ax * s, y + ay * s, 3.5 * s);
    g.fillStyle(0xc99f77);
    g.fillRoundedRect(x - 7 * s, y - 81 * s, 17 * s, 20 * s, 5 * s);
    if (pose === "bat") {
      g.fillStyle(0x223b51);
      g.fillRoundedRect(x - 9 * s, y - 85 * s, 21 * s, 13 * s, 6 * s);
      g.fillRect(x + 4 * s, y - 74 * s, 12 * s, 3 * s);
      line(9, -73, 14, -61, 1, 0x9ab3b8);
      line(2, -67, 14, -66, 1, 0x9ab3b8);
      g.fillStyle(0xdbe3ce);
      g.fillRect(x - 12 * s, y - 21 * s, 9 * s, 15 * s);
      g.fillRect(x + 4 * s, y - 21 * s, 9 * s, 15 * s);
      const bx = swinging ? ax + direction * 32 : ax + 12,
        by = swinging ? ay - 20 : ay + 38;
      line(ax, ay, bx, by, 6, 0xccb488);
      line(ax, ay, ax + (bx - ax) * 0.33, ay + (by - ay) * 0.33, 3, 0x243d32);
      g.lineStyle(1 * s, 0xf8e3b5);
      g.lineBetween(
        x + (ax + 2) * s,
        y + (ay + 10) * s,
        x + (bx + 2) * s,
        y + by * s,
      );
    } else {
      g.fillStyle(0x152728);
      g.fillRoundedRect(x - 8 * s, y - 85 * s, 18 * s, 9 * s, 4 * s);
      g.fillStyle(0xffffff, 0.7);
      g.fillRect(x - 3 * s, y - 50 * s, 8 * s, 11 * s);
    }
  }
  update(_t: number, delta: number) {
    const now = performance.now();
    const ballId = `${innings}-${balls}`;
    if (stage === "result" && this.previousBall !== ballId) {
      this.previousBall = ballId;
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        if (last === "BOWLED!") this.cameras.main.shake(160, 0.002);
        else if (last === "FOUR!" || last === "SIX!")
          this.cameras.main.flash(160, 195, 247, 129);
      }
    }
    if (pending && now >= pending.until) {
      const result = pending;
      pending = null;
      resolve(result.value, result.wicket);
    }
    if (stage === "delivery") {
      if (innings === 1) {
        progress += Math.min(delta, 50) / duration();
        if (progress >= 1 && !shot) resolve(0, true);
      } else
        meter =
          (Math.sin(
            (now - meterStarted) /
              (level === "pro" ? 250 : level === "rookie" ? 450 : 330),
          ) +
            1) /
          2;
    }
    const elapsed = pending ? now - pending.started : 0,
      field =
        stage === "flight" &&
        !!pending &&
        !pending.wicket &&
        pending.value > 0 &&
        elapsed > 300;
    this.overhead.setVisible(field);
    this.perspective.setVisible(!field);
    this.shade.setVisible(stage === "menu");
    document.body.dataset.camera = field ? "fielding" : "batting";
    $("camera-label").textContent =
      stage === "menu"
        ? "THE PAVILION · NIGHT SESSION"
        : field
          ? "FIELD CAM · LIVE"
          : innings === 1
            ? "BATTER CAM · LIVE"
            : "BOWLER CAM · LIVE";
    $("timing").hidden = stage !== "delivery";
    $("timing-title").textContent =
      innings === 1 ? "SHOT TIMING" : "DELIVERY LENGTH";
    $("timing-hint").textContent =
      innings === 1 ? "WAIT FOR THE CREASE" : "FIND THE GREEN";
    $("timing-marker").style.left =
      `${(innings === 1 ? Math.min(1, progress) : meter) * 100}%`;
    const g = this.g;
    g.clear();
    if (field && pending) {
      const t = Math.min(1, (elapsed - 300) / 850),
        value = pending.value,
        angle = pending.line < 0 ? -2.7 : -0.45,
        radius = value >= 4 ? 330 : 90 + value * 45,
        bx = 480 + Math.cos(angle) * radius * t,
        by = 365 + Math.sin(angle) * radius * t;
      const positions = [
        [260, 220],
        [390, 180],
        [640, 220],
        [730, 400],
        [590, 520],
        [285, 465],
        [450, 480],
      ];
      const nearest = positions
        .map(([x, y]) =>
          Math.hypot(
            x - (480 + Math.cos(angle) * radius),
            y - (365 + Math.sin(angle) * radius),
          ),
        )
        .reduce((a, v, i, arr) => (v < arr[a] ? i : a), 0);
      positions.forEach(([x, y], i) => {
        const moving = i === nearest && value < 6,
          f = moving ? Math.min(0.85, t) : 0;
        this.player(
          x + (bx - x) * f,
          y + (by - y) * f,
          0.27,
          0x80a9b6,
          "field",
          moving ? t * 5 : 0,
        );
      });
      this.player(477, 305, 0.22, 0x80a9b6);
      this.player(470, 390 - t * 32, 0.25, 0xe6a15b, "bat");
      this.player(490, 310 + t * 32, 0.25, 0xe6a15b, "bat");
      g.lineStyle(3, 0xd6eaba, 0.2);
      g.lineBetween(480, 365, bx, by);
      g.fillStyle(0x021b12, 0.5);
      g.fillEllipse(bx + 5, by + 7, 12, 4);
      g.fillStyle(0xf9f4df);
      g.fillCircle(bx, by - (value === 6 ? Math.sin(t * Math.PI) * 65 : 0), 5);
      g.fillStyle(0xffffff, 0.15);
      g.fillCircle(bx, by, 9);
      return;
    }
    this.stumps(484, 311, 0.55);
    this.stumps(485, 641, 1.22, stage === "result" && last === "BOWLED!");
    const running = stage === "delivery" ? progress : 0;
    this.player(481, 286 + running * 28, 0.54, 0x8eabbc, "bowl", running * 2);
    this.player(377, 425, 0.36, 0xe6a15b, "bat");
    [
      [164, 295],
      [802, 300],
      [676, 353],
    ].forEach(([x, y]) => this.player(x, y, 0.2, 0x8eabbc));
    this.player(423, 632, 1.17, 0xdb9051, "bat");
    if (stage === "delivery" && innings === 1) {
      const p = progress,
        x = 485 + direction * 18 * p,
        y = 260 + 420 * p,
        arc =
          p < 0.55
            ? Math.sin((p / 0.55) * Math.PI) * 48
            : Math.sin(((p - 0.55) / 0.45) * Math.PI) * 13,
        r = 2.5 + p * 5;
      g.fillStyle(0x021811, 0.4);
      g.fillEllipse(x + 6, y + 7, r * 2.6, r * 0.65);
      g.fillStyle(0xf2f0df, 0.1);
      g.fillCircle(x, y - arc, r * 2);
      g.fillStyle(0xf7f3df);
      g.fillCircle(x, y - arc, r);
      g.lineStyle(1, 0xb9604d);
      g.lineBetween(x - 2, y - arc - r / 2, x + 2, y - arc + r / 2);
      g.lineStyle(2, 0xe07c5e, 0.55);
      g.lineBetween(476 + direction * 12, 525, 490 + direction * 12, 537);
      g.lineBetween(490 + direction * 12, 525, 476 + direction * 12, 537);
    }
    if (stage === "flight" && pending) {
      const t = Math.min(1, elapsed / 450);
      g.fillStyle(0xf4f1d6);
      if (pending.wicket) {
        g.fillCircle(490, 610 + t * 33, 6);
        if (t > 0.65) this.stumps(485, 641, 1.22, true);
      } else if (innings === 1)
        g.fillCircle(485 + pending.line * t * 130, 610 - t * 240, 7 - t * 3);
      else g.fillCircle(485 + pending.line * t * 12, 275 + t * 330, 3 + t * 4);
    }
  }
}
new Phaser.Game({
  type: Phaser.CANVAS,
  width: 960,
  height: 720,
  parent: "game",
  antialias: true,
  backgroundColor: "#142b25",
  scene: CricketScene,
  banner: false,
  audio: { noAudio: true },
});
$("start").onclick = start;
$("next").onclick = delivery;
document
  .querySelectorAll<HTMLButtonElement>("[data-key]")
  .forEach((b) => (b.onclick = () => key(b.dataset.key!)));
$("reset").onclick = () => {
  stage = "menu";
  pending = null;
  last = "CRICKET CUP";
  sync("Choose your team. Make the night yours.");
};
$("sound").onclick = () => {
  sound = !sound;
  $("sound").textContent = sound ? "SOUND ON" : "SOUND OFF";
  $("sound").setAttribute("aria-pressed", String(sound));
  beep();
};
$("instructions").onclick = () => {
  $("menu-detail").hidden = !$("menu-detail").hidden;
  $("menu-detail").textContent =
    "4 / 6 or arrows choose direction. Space / 5 plays your shot at the crease. When bowling, stop the meter in its green zone. Enter starts the next delivery. Two overs, two wickets, automatic fielding.";
};
$("high-scores").onclick = () => {
  $("menu-detail").hidden = !$("menu-detail").hidden;
  $("menu-detail").textContent =
    `YOUR BEST INNINGS: ${best} RUNS. Complete your batting innings to set a new personal best.`;
};
$("team").onchange = () => {
  $("team-name").textContent =
    `${$<HTMLSelectElement>("team").value} / ${$<HTMLSelectElement>("team").value === "AUSTRALIA" ? "INDIA" : "AUSTRALIA"}`;
};
sync("Choose your team. Make the night yours.");
if ("serviceWorker" in navigator && import.meta.env.PROD)
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js");
  });
