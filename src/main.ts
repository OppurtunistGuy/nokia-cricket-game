import Phaser from "phaser";
import "./style.css";
type Stage =
  "menu" | "ready" | "delivery" | "flight" | "result" | "innings" | "finished";
const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
let stage: Stage = "menu",
  innings = 1,
  runs = 0,
  wickets = 0,
  balls = 0,
  target = 0,
  first = 0,
  direction = 0,
  progress = 0,
  meter = 0,
  meterStarted = 0,
  shot = false,
  team = "INDIA",
  opponent = "AUSTRALIA",
  sound = false,
  audio: AudioContext | undefined;
let pending: { value: number; wicket: boolean; until: number } | null = null;
let last = "CRICKET CUP",
  flight: { x: number; y: number } | null = null,
  swingUntil = 0,
  particles: { x: number; y: number }[] = [];
const palette = {
  grass: 0x65854c,
  pitch: 0xb5b47a,
  line: 0xdce3aa,
  dark: 0x203c2e,
  blue: 0x2d6390,
  red: 0xa54836,
};
function beep(freq = 600) {
  if (!sound) return;
  audio ??= new AudioContext();
  void audio.resume();
  const o = audio.createOscillator(),
    g = audio.createGain();
  o.type = "square";
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.025, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.09);
  o.connect(g);
  g.connect(audio.destination);
  o.start();
  o.stop(audio.currentTime + 0.1);
}
function sync(msg: string) {
  $("message").textContent = msg;
  $("phase").textContent =
    stage === "menu"
      ? "QUICK MATCH"
      : stage === "finished"
        ? "MATCH RESULT"
        : innings === 1
          ? "YOU BAT"
          : "YOU BOWL";
  $("score").textContent =
    stage === "menu"
      ? "2 OVERS · 2 WICKETS"
      : `${runs}/${wickets} · ${Math.floor(balls / 6)}.${balls % 6} / 2`;
  $("menu").hidden = stage !== "menu";
  $("play").hidden = stage === "menu";
  $("next").hidden = !["ready", "result", "innings", "finished"].includes(
    stage,
  );
  $("next").textContent =
    stage === "innings"
      ? "DEFEND YOUR TOTAL ↗"
      : stage === "finished"
        ? "PLAY AGAIN ↗"
        : stage === "ready"
          ? "START DELIVERY ↗"
          : "NEXT BALL ↗";
  $("action-label").textContent = innings === 1 ? "SHOT" : "BOWL";
  $("team").toggleAttribute("disabled", stage !== "menu");
  document.body.dataset.stage = stage;
  document.body.dataset.innings = String(innings);
}
function start() {
  team = ($("team") as HTMLSelectElement).value;
  opponent = team === "AUSTRALIA" ? "INDIA" : "AUSTRALIA";
  innings = 1;
  runs = wickets = balls = target = first = 0;
  direction = 0;
  pending = null;
  last = `${team} v ${opponent}`;
  flight = null;
  stage = "ready";
  sync("You bat first. Choose left or right, then start delivery.");
  beep();
}
function delivery() {
  if (stage === "innings") {
    innings = 2;
    first = runs;
    target = first + 1;
    runs = wickets = balls = 0;
    stage = "ready";
    last = `TARGET ${target}`;
    sync(`Defend ${first}. Stop the bowling meter at the centre.`);
    return;
  }
  if (stage === "finished") {
    start();
    return;
  }
  if (stage !== "ready" && stage !== "result") return;
  stage = "delivery";
  shot = false;
  progress = 0;
  meter = 0;
  meterStarted = performance.now();
  flight = null;
  last = innings === 1 ? "WATCH THE BALL" : "HIT THE CENTRE";
  sync(
    innings === 1
      ? "Press 5 / Space as the ball reaches the batter."
      : "Press 5 / Space when the meter reaches the centre.",
  );
  beep(420);
}
function animate(value: number, wicket: boolean) {
  pending = { value, wicket, until: performance.now() + 850 };
  stage = "flight";
  last = wicket ? "BEATEN!" : value >= 4 ? "BOUNDARY SHOT" : "FIELDERS CHASING";
  sync(
    innings === 1
      ? "Shot away. Watch the fielders!"
      : "Delivery away. Watch the batter!",
  );
}
function resolve(value: number, wicket: boolean) {
  if (stage !== "delivery" && stage !== "flight") return;
  balls++;
  if (wicket) wickets++;
  else runs += value;
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
    msg = `${opponent} win by ${2 - wickets} wicket${2 - wickets === 1 ? "" : "s"}. Your score: ${first}.`;
  } else if (balls >= 12 || wickets >= 2) {
    if (innings === 1) {
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
    beep(350);
  }
  if (k === "6" || k === "ArrowRight") {
    direction = 1;
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
    swingUntil = performance.now() + 350;
    if (innings === 1) {
      const error = Math.abs(progress - 0.84);
      const value =
        error < 0.045
          ? 6
          : error < 0.1
            ? 4
            : error < 0.17
              ? 2
              : error < 0.24
                ? 1
                : 0;
      const wicket = error > 0.3;
      flight = { x: 49, y: 48 };
      particles = Array.from({ length: value >= 4 ? 5 : 2 }, (_, i) => ({
        x: 49 + i,
        y: 48 - i,
      }));
      animate(value, wicket);
    } else {
      const error = Math.min(
        1,
        Math.abs(meter - 0.5) + (direction === 0 ? 0.025 : 0),
      );
      const roll = Math.random();
      const wicket = roll < (error < 0.09 ? 0.48 : error < 0.2 ? 0.22 : 0.05);
      const value =
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
      flight = { x: 49, y: 29 };
      animate(value, wicket);
    }
  }
}
class CricketScene extends Phaser.Scene {
  g!: Phaser.GameObjects.Graphics;
  label!: Phaser.GameObjects.Text;
  sub!: Phaser.GameObjects.Text;
  create() {
    this.g = this.add.graphics();
    this.label = this.add
      .text(48, 5, "CRICKET CUP", {
        fontFamily: "monospace",
        fontSize: "5px",
        color: "#edf0be",
      })
      .setOrigin(0.5);
    this.sub = this.add
      .text(48, 62, "2 OVER QUICK MATCH", {
        fontFamily: "monospace",
        fontSize: "4px",
        color: "#edf0be",
      })
      .setOrigin(0.5);
    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "SELECT") return;
      if (
        [" ", "ArrowLeft", "ArrowRight", "5", "4", "6", "Enter"].includes(e.key)
      ) {
        e.preventDefault();
        if (!e.repeat) key(e.key);
      }
    });
  }
  player(x: number, y: number, color: number, bat = false) {
    const g = this.g;
    g.fillStyle(palette.dark);
    g.fillRect(x - 1, y - 5, 3, 3);
    g.fillStyle(0xd8bb80);
    g.fillRect(x, y - 3, 2, 2);
    g.fillStyle(color);
    g.fillRect(x - 1, y - 1, 4, 4);
    g.fillStyle(palette.dark);
    g.fillRect(x - 1, y + 3, 1, 3);
    g.fillRect(x + 2, y + 3, 1, 3);
    if (bat) {
      g.fillStyle(0xe3cf8a);
      g.fillRect(x + (direction < 0 ? -4 : 5), y - 1, 2, 6);
      if (performance.now() < swingUntil) g.fillRect(x - 5, y - 2, 11, 2);
    }
  }
  update(_time: number, delta: number) {
    if (pending && performance.now() >= pending.until) {
      const result = pending;
      pending = null;
      resolve(result.value, result.wicket);
    }
    if (stage === "delivery") {
      if (innings === 1) {
        progress += Math.min(delta, 50) / 1900;
        if (progress >= 1 && !shot) resolve(0, true);
      } else
        meter = (Math.sin((performance.now() - meterStarted) / 330) + 1) / 2;
    }
    const g = this.g;
    g.clear();
    g.fillStyle(palette.grass);
    g.fillRect(0, 0, 96, 68);
    g.fillStyle(0x719252);
    g.fillEllipse(48, 35, 83, 49);
    g.lineStyle(1, 0x9bab63);
    g.strokeEllipse(48, 35, 85, 50);
    g.fillStyle(palette.pitch);
    g.fillRect(43, 20, 12, 33);
    g.fillStyle(palette.line);
    g.fillRect(41, 25, 16, 1);
    g.fillRect(41, 47, 16, 1);
    g.fillStyle(palette.dark);
    g.fillRect(47, 22, 1, 4);
    g.fillRect(49, 22, 1, 4);
    g.fillRect(51, 22, 1, 4);
    g.fillRect(47, 48, 1, 4);
    g.fillRect(49, 48, 1, 4);
    g.fillRect(51, 48, 1, 4);
    [
      [17, 25],
      [77, 26],
      [25, 47],
      [70, 49],
      [48, 14],
    ].forEach(([x, y], i) =>
      this.player(
        x + (flight ? Math.sin(performance.now() / 300 + i) * 2 : 0),
        y,
        palette.red,
      ),
    );
    this.player(49, 29, palette.red);
    this.player(39, 43, palette.blue);
    this.player(55, 47, palette.blue, true);
    if (stage === "delivery" && innings === 1) {
      g.fillStyle(0xf5f4d1);
      g.fillRect(49 + direction * progress, 29 + progress * 23, 2, 2);
    }
    if (flight) {
      flight.x += (direction || 1) * Math.min(delta, 50) * 0.035;
      flight.y +=
        (innings === 2 && flight.y < 46 ? 1 : -1) * Math.min(delta, 50) * 0.018;
      g.fillStyle(0xf5f4d1);
      g.fillRect(flight.x, flight.y, 2, 2);
      particles.forEach((p) => {
        p.x += direction * 0.15;
        p.y -= 0.1;
        g.fillStyle(0xcfdda1, 0.5);
        g.fillRect(p.x, p.y, 1, 1);
      });
      if (flight.y < 15) flight = null;
    }
    if (stage === "delivery" && innings === 2) {
      g.fillStyle(palette.dark);
      g.fillRect(19, 56, 58, 5);
      g.fillStyle(0xa5bb64);
      g.fillRect(44, 56, 9, 5);
      g.fillStyle(0xf3efb4);
      g.fillRect(20 + meter * 55, 56, 2, 5);
    }
    this.label.setText(
      stage === "menu"
        ? "CRICKET CUP"
        : `${innings === 1 ? team : opponent} ${runs}/${wickets} ${Math.floor(balls / 6)}.${balls % 6}`,
    );
    this.sub.setText(
      stage === "delivery"
        ? innings === 1
          ? "5: HIT AT THE CREASE"
          : "5: STOP THE METER"
        : last,
    );
    if (stage === "flight" && flight) {
      const x = flight.x,
        y = flight.y;
      this.player(x - 3, y + 2, palette.red);
    }
    if (stage === "menu") {
      g.fillStyle(palette.dark, 0.88);
      g.fillRect(12, 24, 72, 22);
      this.addBanner();
    }
  }
  addBanner() {
    this.g.fillStyle(0xe1e7b1);
    for (let i = 0; i < 7; i++)
      this.g.fillRect(25 + i * 7, 30 + (i % 2) * 2, 4, 8);
  }
}
new Phaser.Game({
  type: Phaser.CANVAS,
  width: 96,
  height: 68,
  parent: "game",
  pixelArt: true,
  antialias: false,
  backgroundColor: "#65854c",
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
  flight = null;
  last = "CRICKET CUP";
  sync("Choose your team. The cup is waiting.");
};
$("sound").onclick = () => {
  sound = !sound;
  $("sound").textContent = sound ? "SOUND ON" : "SOUND OFF";
  $("sound").setAttribute("aria-pressed", String(sound));
  beep();
};
sync("Choose your team. The cup is waiting.");
if ("serviceWorker" in navigator && import.meta.env.PROD)
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js");
  });
