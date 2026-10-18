import Phaser from "phaser";
import {
  Match,
  SHOTS,
  SHOT_NAMES,
  matchup,
  type Mode,
  type Shot,
  type Length,
  type Line,
  type Movement,
} from "./engine";
import { keyboardAction, PadInput, type Action } from "./input";
import { PixelScene } from "./view";
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const m = new Match(),
  padInput = new PadInput();
let signature = "",
  sound = false,
  audio: AudioContext | undefined,
  connected = false,
  best = 0,
  lastRecord: unknown = null;
try {
  const n = Number(localStorage.getItem("cricket-best"));
  if (Number.isFinite(n) && n > 0) best = n;
} catch {}
function beep(f = 480) {
  if (!sound) return;
  audio ??= new AudioContext();
  void audio.resume();
  const o = audio.createOscillator(),
    g = audio.createGain();
  o.type = "square";
  o.frequency.value = f;
  g.gain.setValueAtTime(0.025, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.09);
  o.connect(g);
  g.connect(audio.destination);
  o.start();
  o.stop(audio.currentTime + 0.1);
}
function dispatch(a: Action) {
  if (a === "pause") {
    if (m.phase !== "menu") m.paused = !m.paused;
    return;
  }
  if (m.paused) {
    if (a === "confirm" || a === "next") m.paused = false;
    return;
  }
  if (m.phase === "menu") {
    if (a === "confirm" || a === "next") start();
    return;
  }
  const inPlay = m.phase === "fielding";
  if (a === "run" || (a === "right" && inPlay)) {
    if (m.batting) m.run();
    return;
  }
  if (a === "stop" || (a === "down" && inPlay)) {
    if (m.batting) m.stop();
    return;
  }
  if (a === "turn" || (a === "left" && inPlay)) {
    if (m.batting) m.turn();
    return;
  }
  switch (a) {
    case "confirm":
      m.action();
      break;
    case "next":
      m.next();
      break;
    case "left":
      m.batting ? m.selectShot(-1) : m.changeLine(-1);
      break;
    case "right":
      m.batting ? m.selectShot(1) : m.changeLine(1);
      break;
    case "up":
      m.changeLength(-1);
      break;
    case "down":
      m.changeLength(1);
      break;
    case "movement-left":
      m.changeMovement(-1);
      break;
    case "movement-right":
      m.changeMovement(1);
      break;
    case "slow":
      if (
        !m.batting &&
        m.mode === "advanced" &&
        (m.preparation || m.phase === "accuracy")
      )
        m.bowling.slow = !m.bowling.slow;
      break;
    case "bouncer":
      if (
        !m.batting &&
        m.mode === "advanced" &&
        (m.preparation || m.phase === "accuracy")
      ) {
        m.bowling.bouncer = !m.bowling.bouncer;
        if (m.bowling.bouncer) m.bowling.length = "short";
      }
      break;
  }
  beep();
}
function start() {
  m.start(
    $<HTMLSelectElement>("mode").value as Mode,
    $<HTMLInputElement>("auto-run").checked,
    $<HTMLSelectElement>("team").value,
  );
  beep();
}
function sync() {
  const status = JSON.stringify([
    m.phase,
    m.runs,
    m.wickets,
    m.balls,
    m.innings,
    m.target,
    m.completedRuns,
    m.moving,
    m.queued,
    m.returning,
    m.message,
    m.shot,
    m.bowling,
    m.placement,
    m.paused,
    m.last,
  ]);
  if (status === signature) return;
  signature = status;
  $("phase").textContent =
    m.phase === "menu"
      ? "CRICKET CUP"
      : m.paused
        ? "PAUSED"
        : m.batting
          ? "YOU BAT"
          : "YOU BOWL";
  $("score").textContent = `${m.provisionalRuns}/${m.wickets} · ${m.overs}`;
  $("message").textContent = m.paused
    ? "Paused. Press 5 / Space or Resume."
    : m.message;
  $("mode-label").textContent = `${m.mode.toUpperCase()} MODE`;
  $("menu").hidden = m.phase !== "menu";
  $("play").hidden = m.phase === "menu";
  $("pause").hidden = m.phase === "menu";
  $("pause").textContent = m.paused ? "Resume" : "Pause";
  $("task").textContent =
    m.phase === "finished"
      ? "MATCH RESULT"
      : `${m.batting ? "YOU BAT" : "YOU BOWL"} · ${m.striker ? "BATTER 2" : "BATTER 1"}`;
  $("target").textContent = m.batting
    ? `${12 - m.balls} balls left`
    : `Target ${m.target} · ${Math.max(0, m.target - m.provisionalRuns)} needed`;
  $("shot-settings").hidden = !m.batting;
  $<HTMLSelectElement>("shot").value = m.shot;
  $("shot").toggleAttribute(
    "disabled",
    !m.preparation || m.mode === "classic" || m.paused,
  );
  $("shot-keys").textContent =
    m.mode === "classic"
      ? "Auto Shot · ← / → places shot"
      : "← / → before delivery";
  $("matchup").textContent = matchup(
    m.shot,
    m.preparation ? m.expected : (m.delivery ?? m.expected),
  );
  $("bowling-settings").hidden =
    m.batting || m.mode === "classic" || !m.preparation;
  $<HTMLSelectElement>("length").value = m.bowling.length;
  $<HTMLSelectElement>("line").value = m.bowling.line;
  $<HTMLSelectElement>("movement").value = m.bowling.movement;
  $<HTMLSelectElement>("speed").value = m.bowling.slow ? "slow" : "normal";
  $<HTMLInputElement>("bouncer").checked = m.bowling.bouncer;
  document
    .querySelectorAll<HTMLSelectElement | HTMLInputElement>(
      "#bowling-settings select,#bowling-settings input",
    )
    .forEach(
      (e) =>
        (e.disabled = !(m.preparation || m.phase === "accuracy") || m.paused),
    );
  const running =
    m.phase === "fielding" &&
    m.batting &&
    !m.contact?.boundary &&
    !m.contact?.wicket &&
    (m.contact?.distance ?? 0) > 0;
  $("running").hidden = !running;
  $("run-state").textContent = m.returning
    ? "TURNING BACK"
    : m.moving
      ? m.queued
        ? "RUN + NEXT QUEUED"
        : "RUNNING"
      : "HOLDING";
  $("run-count").textContent = `${m.completedRuns} completed`;
  $("keypad").hidden = m.phase === "fielding";
  document
    .querySelectorAll<HTMLElement>(".up,.down")
    .forEach(
      (e) => (e.hidden = m.batting || m.mode === "classic" || !m.preparation),
    );
  $("movement-buttons").hidden =
    m.batting || m.mode === "classic" || !["ready", "result"].includes(m.phase);
  $("action-label").textContent =
    m.phase === "accuracy"
      ? "RELEASE"
      : m.phase === "delivery"
        ? "SWING"
        : m.phase === "innings"
          ? "NEXT INNINGS"
          : m.batting
            ? "START"
            : "BOWL";
  $("action").toggleAttribute(
    "disabled",
    (m.phase === "delivery" && !m.batting) || m.paused,
  );
  $("next").hidden = !["ready", "result", "innings", "finished"].includes(
    m.phase,
  );
  $("next").textContent =
    m.phase === "innings"
      ? "BOWL NEXT · ENTER"
      : m.phase === "finished"
        ? "PLAY AGAIN · ENTER"
        : m.batting
          ? "NEXT BALL · ENTER"
          : "BOWL · ENTER";
  $("next").toggleAttribute("disabled", m.paused);
  $("history").replaceChildren(
    ...m.history.slice(-12).map((r) => {
      const span = document.createElement("span");
      span.textContent = r.wide ? "Wd" : r.wicket ? "W" : String(r.runs);
      span.className = r.wicket ? "wicket" : r.runs >= 4 ? "boundary" : "";
      span.title = `${r.label}${r.wicket && r.runs ? ` · ${r.runs} completed runs` : ""}`;
      return span;
    }),
  );
  document.body.dataset.phase = m.phase;
  document.body.dataset.mode = m.mode;
  document.body.dataset.innings = String(m.innings);
  document.body.dataset.camera =
    m.phase === "fielding" ? "fielding" : "batting";
  if (m.phase === "innings" && m.runs > best) {
    best = m.runs;
    try {
      localStorage.setItem("cricket-best", String(best));
    } catch {}
  }
  if (m.last !== lastRecord) {
    if (m.last) beep(m.last.wicket ? 170 : m.last.runs >= 4 ? 800 : 450);
    lastRecord = m.last;
  }
}
const scene = new PixelScene(m, (dt) => {
  let pad: Gamepad | null = null;
  try {
    pad =
      Array.from(navigator.getGamepads?.() ?? []).find((p) => p?.connected) ??
      null;
  } catch {}
  if (!!pad !== connected) {
    if (connected && !pad && m.phase !== "menu") {
      m.paused = true;
      m.message = "Controller disconnected. Resume for keyboard or touch.";
    }
    connected = !!pad;
    $("controller").textContent = pad
      ? "Controller connected · standard mapping"
      : "Keyboard + touch";
  }
  for (const a of padInput.poll(pad)) dispatch(a);
  m.tick(dt);
  document.body.dataset.progress = String(m.progress);
  sync();
});
new Phaser.Game({
  type: Phaser.CANVAS,
  width: 128,
  height: 128,
  parent: "game",
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  backgroundColor: "#13894d",
  scene,
  banner: false,
  audio: { noAudio: true },
});
for (const shot of SHOTS) {
  const option = document.createElement("option");
  option.value = shot;
  option.textContent = SHOT_NAMES[shot];
  $("shot").append(option);
}
$("start").onclick = start;
$("next").onclick = () => dispatch("next");
$("pause").onclick = () => dispatch("pause");
document
  .querySelectorAll<HTMLButtonElement>("[data-action]")
  .forEach((b) => (b.onclick = () => dispatch(b.dataset.action as Action)));
$("mode").onchange = () => {
  $<HTMLInputElement>("auto-run").checked =
    $<HTMLSelectElement>("mode").value === "classic";
  $("mode-label").textContent =
    `${$<HTMLSelectElement>("mode").value.toUpperCase()} MODE`;
};
$("shot").onchange = () => {
  if (m.preparation && m.mode === "advanced")
    m.shot = $<HTMLSelectElement>("shot").value as Shot;
};
for (const id of ["length", "line", "movement", "speed", "bouncer"])
  $(id).onchange = () => {
    if (!m.preparation && m.phase !== "accuracy") return;
    if (id === "length") {
      m.bowling.length = $<HTMLSelectElement>(id).value as Length;
      m.bowling.bouncer = false;
    } else if (id === "line")
      m.bowling.line = $<HTMLSelectElement>(id).value as Line;
    else if (id === "movement")
      m.bowling.movement = $<HTMLSelectElement>(id).value as Movement;
    else if (id === "speed")
      m.bowling.slow = $<HTMLSelectElement>(id).value === "slow";
    else {
      m.bowling.bouncer = $<HTMLInputElement>(id).checked;
      if (m.bowling.bouncer) m.bowling.length = "short";
    }
  };
window.addEventListener("keydown", (e) => {
  if (
    ["SELECT", "INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)
  )
    return;
  if (
    (e.target as HTMLElement)?.tagName === "BUTTON" &&
    [" ", "Enter"].includes(e.key)
  )
    return;
  const a = keyboardAction(e.key);
  if (a) {
    e.preventDefault();
    if (!e.repeat) dispatch(a);
  }
});
$("reset").onclick = () => {
  if (["accuracy", "delivery", "fielding"].includes(m.phase)) {
    if (!window.confirm("Abandon this match and return to the menu?")) return;
  }
  m.phase = "menu";
  m.paused = false;
};
$("sound").onclick = () => {
  sound = !sound;
  $("sound").textContent = sound ? "Sound on" : "Sound off";
  $("sound").setAttribute("aria-pressed", String(sound));
  beep();
};
$("help").onclick = () => {
  $("controls").hidden = !$("controls").hidden;
};
$("instructions").onclick = () => {
  $("menu-detail").hidden = !$("menu-detail").hidden;
  $("menu-detail").textContent =
    "Classic: time Space / 5 at the crease; Auto Shot picks a standard shot. Advanced: choose with arrows before delivery. After contact: Right runs, Down cancels the next run, Left turns back. Completed runs count; being stranded at the throw can run you out. Bowling: choose line/length/swing, then time the accuracy meter.";
};
$("best").onclick = () => {
  $("menu-detail").hidden = !$("menu-detail").hidden;
  $("menu-detail").textContent = `Best innings on this device: ${best} runs.`;
};
document.addEventListener("visibilitychange", () => {
  if (document.hidden && ["accuracy", "delivery", "fielding"].includes(m.phase))
    m.paused = true;
});
if ("serviceWorker" in navigator && import.meta.env.PROD)
  window.addEventListener(
    "load",
    () => void navigator.serviceWorker.register("/sw.js"),
  );
sync();
