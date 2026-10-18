import Phaser from "phaser";
import { Match, ballPosition } from "./engine";
// Original tiny sprites. Palette and poses are identical in both game modes.
const P = {
  grass: 0x13894d,
  light: 0x1b9954,
  pitch: 0xd7ad87,
  white: 0xeef1cf,
  navy: 0x192b3f,
  skin: 0xd8aa78,
  blue: 0x647ba0,
  red: 0xb94732,
  dark: 0x273633,
};
export class PixelScene extends Phaser.Scene {
  g!: Phaser.GameObjects.Graphics;
  hud!: Phaser.GameObjects.Text;
  info!: Phaser.GameObjects.Text;
  banner!: Phaser.GameObjects.Text;
  constructor(
    private match: Match,
    private frame: (dt: number) => void,
  ) {
    super("cricket");
  }
  create() {
    this.g = this.add.graphics();
    this.hud = this.add.text(3, 3, "", {
      fontFamily: "monospace",
      fontSize: "8px",
      color: "#f2efd1",
      lineSpacing: 1,
    });
    this.info = this.add.text(3, 115, "", {
      fontFamily: "monospace",
      fontSize: "6px",
      color: "#ffffff",
    });
    this.banner = this.add
      .text(64, 52, "", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#ffffff",
        align: "center",
        lineSpacing: 4,
      })
      .setOrigin(0.5, 0);
    document.getElementById("boot-status")?.remove();
    document.getElementById("start")?.removeAttribute("disabled");
  }
  person(
    x: number,
    y: number,
    scale: number,
    bat = false,
    pose = "drive",
    frame = 0,
  ) {
    const g = this.g,
      rect = (a: number, b: number, w: number, h: number, c: number) => {
        g.fillStyle(c);
        g.fillRect(x + a * scale, y + b * scale, w * scale, h * scale);
      };
    const kneel = bat && ["sweep", "reverse", "paddle"].includes(pose);
    rect(1, -14, 4, 2, P.dark);
    rect(1, -12, 4, 3, P.skin);
    rect(0, -9, 6, kneel ? 4 : 6, bat ? P.red : P.blue);
    rect(0, -3, 2, 3, P.dark);
    rect(4 + frame, -3, 2, 3 - frame, P.dark);
    rect(-1, -8, 2, 4, P.skin);
    if (bat) {
      rect(4, -8, 3, 2, P.skin);
      g.lineStyle(scale, 0xf6db9b);
      const reverse = pose === "reverse";
      if (frame && ["scoop", "lofted"].includes(pose))
        g.lineBetween(
          x + 5 * scale,
          y - 7 * scale,
          x + 2 * scale,
          y - 18 * scale,
        );
      else if (frame && ["pull", "cut"].includes(pose))
        g.lineBetween(
          x - 3 * scale,
          y - 10 * scale,
          x + 10 * scale,
          y - 10 * scale,
        );
      else if (kneel)
        g.lineBetween(
          x + (reverse ? -4 : 6) * scale,
          y - 4 * scale,
          x + (reverse ? 7 : -3) * scale,
          y - 1 * scale,
        );
      else
        g.lineBetween(
          x + 6 * scale,
          y - 6 * scale,
          x + (frame ? -3 : 8) * scale,
          y + (frame ? -12 : 0) * scale,
        );
    }
  }
  stumps(x: number, y: number, broken = false) {
    const g = this.g;
    g.fillStyle(P.white);
    for (let i = 0; i < 3; i++)
      g.fillRect(
        x + i * 2 + (broken ? i : 0),
        y - (broken ? 4 : 7),
        1,
        broken ? 4 : 7,
      );
    if (!broken) g.fillRect(x - 1, y - 8, 7, 1);
  }
  perspective() {
    const g = this.g,
      m = this.match;
    g.fillStyle(P.grass);
    g.fillRect(0, 0, 128, 128);
    g.fillStyle(P.light);
    g.fillPoints(
      [
        { x: 0, y: 45 },
        { x: 38, y: 25 },
        { x: 0, y: 99 },
      ],
      true,
    );
    g.fillPoints(
      [
        { x: 95, y: 28 },
        { x: 110, y: 28 },
        { x: 128, y: 95 },
        { x: 128, y: 128 },
      ],
      true,
    );
    g.fillStyle(P.pitch);
    g.fillPoints(
      [
        { x: 59, y: 35 },
        { x: 70, y: 35 },
        { x: 102, y: 128 },
        { x: 25, y: 128 },
      ],
      true,
    );
    g.lineStyle(1, P.white);
    g.lineBetween(54, 38, 76, 38);
    g.lineBetween(28, 112, 103, 112);
    g.lineBetween(35, 117, 97, 117);
    g.lineBetween(35, 110, 35, 120);
    g.lineBetween(97, 110, 97, 120);
    this.stumps(63, 36);
    this.stumps(74, 115, m.last?.wicket === "bowled" && m.phase === "result");
    const step = m.phase === "delivery" ? Math.floor(m.progress * 8) % 2 : 0;
    this.person(61, 28 + step, 1, false, "drive", step);
    const pose = m.phase === "fielding" ? m.visibleShot : "drive";
    this.person(46, 113, 2, true, pose, m.phase === "fielding" ? 1 : 0);
    if (m.delivery && m.phase === "delivery") {
      const p = ballPosition(m.delivery, m.progress),
        x = 64 + p.x * 19,
        y = 34 + p.depth * 93 - p.height * 36;
      g.fillStyle(P.white);
      g.fillRect(Math.round(x), Math.round(y), 2, 2);
      const bounce = 0.93 - m.delivery.pitch * 0.72,
        bx = 64 + ballPosition(m.delivery, bounce).x * 19,
        by = 34 + bounce * 83;
      g.lineStyle(1, 0xb4513a);
      g.lineBetween(bx - 1, by - 1, bx + 1, by + 1);
      g.lineBetween(bx + 1, by - 1, bx - 1, by + 1);
    }
  }
  field() {
    const g = this.g,
      m = this.match,
      c = m.contact!;
    g.fillStyle(P.grass);
    g.fillRect(0, 0, 128, 128);
    g.lineStyle(1, P.white);
    g.strokeEllipse(49, 65, 92, 116);
    g.fillStyle(P.pitch);
    g.fillRect(47, 55, 3, 23);
    g.lineStyle(1, P.white);
    g.lineBetween(44, 57, 53, 57);
    g.lineBetween(44, 76, 53, 76);
    const t = Math.min(1, m.fieldElapsed / c.fieldTime),
      out = Math.min(1, t / 0.65),
      r = c.distance / 145,
      ex = 49 + Math.cos(c.angle) * r * 42,
      ey = 66 + Math.sin(c.angle) * r * 49,
      back = !c.boundary && !c.wicket && t > 0.65,
      bt = back ? (t - 0.65) / 0.35 : 0,
      bx = back ? ex + (49 - ex) * bt : 49 + (ex - 49) * out,
      by = back ? ey + (66 - ey) * bt : 66 + (ey - 66) * out;
    const fields = [
      [22, 39],
      [70, 37],
      [18, 74],
      [75, 86],
      [33, 103],
      [63, 104],
      [44, 25],
    ];
    const nearest = fields
      .map(([x, y]) => Math.hypot(x - ex, y - ey))
      .reduce((a, d, i, arr) => (d < arr[a] ? i : a), 0);
    fields.forEach(([x, y], i) => {
      const f = i === nearest && !c.boundary ? Math.min(1, t / 0.65) : 0;
      g.fillStyle(P.white);
      g.fillRect(
        Math.round(x + (ex - x) * f),
        Math.round(y + (ey - y) * f),
        2,
        2,
      );
    });
    g.fillStyle(0xffffff);
    g.fillRect(
      Math.round(bx),
      Math.round(
        by -
          (c.boundary === 6 || c.wicket === "caught"
            ? Math.sin(t * Math.PI) * 10
            : 0),
      ),
      2,
      2,
    );
    const pos = m.runnerPosition;
    g.fillStyle(P.red);
    g.fillRect(45, Math.round(75 - pos * 18), 2, 3);
    g.fillRect(51, Math.round(57 + pos * 18), 2, 3);
    g.fillStyle(P.navy);
    g.fillRect(99, 0, 29, 128);
    g.fillStyle(P.pitch);
    g.fillRect(108, 30, 13, 83);
    this.stumps(112, 37);
    this.stumps(112, 110);
    this.person(
      109,
      107 - pos * 66,
      1,
      true,
      "drive",
      Math.floor(m.fieldElapsed / 180) % 2,
    );
    this.person(
      118,
      41 + pos * 66,
      1,
      true,
      "drive",
      Math.floor(m.fieldElapsed / 180) % 2,
    );
  }
  update(_time: number, dt: number) {
    this.frame(Math.min(dt, 70));
    const m = this.match,
      g = this.g;
    g.clear();
    this.banner.setText("");
    this.info.setText("");
    m.phase === "fielding" && m.contact && m.fieldElapsed >= 180
      ? this.field()
      : this.perspective();
    g.fillStyle(P.navy);
    g.fillRect(0, 0, 41, 23);
    this.hud.setText(`${m.provisionalRuns}/${m.wickets}\n${m.overs}`);
    g.fillStyle(0xb64b37);
    g.fillRect(0, 12, 41, 1);
    if (m.phase === "accuracy" || m.phase === "delivery") {
      g.fillStyle(P.navy);
      g.fillRect(15, 120, 98, 7);
      g.fillStyle(0x9cbb68);
      const target =
        m.phase === "accuracy" ? 0.5 : (m.delivery?.contactAt ?? 0.84);
      g.fillRect(17 + (target - 0.06) * 92, 122, 12, 3);
      g.fillStyle(P.white);
      g.fillRect(
        17 + (m.phase === "accuracy" ? m.meter : m.progress) * 92,
        121,
        1,
        5,
      );
    }
    if (m.phase === "menu") {
      g.fillStyle(P.navy);
      g.fillRect(12, 34, 104, 55);
      this.banner
        .setPosition(64, 43)
        .setText("CRICKET CUP\nV0.3\nSELECT NEW GAME");
    }
    if (["result", "innings", "finished"].includes(m.phase)) {
      g.fillStyle(P.navy);
      g.fillRect(8, 39, 112, 42);
      this.banner
        .setPosition(64, 46)
        .setText(
          m.phase === "innings"
            ? "INNINGS OVER"
            : m.phase === "finished"
              ? m.runs === m.first
                ? "MATCH TIED"
                : m.runs >= m.target
                  ? "YOU LOSE"
                  : "YOU WIN"
              : m.last?.wide
                ? "WIDE +1"
                : (m.last?.wicket?.toUpperCase() ??
                  m.last?.label.toUpperCase() ??
                  ""),
        );
      this.info
        .setPosition(3, 117)
        .setText(
          m.phase === "innings" ? `TARGET ${m.runs + 1}` : `ENTER: NEXT`,
        );
    }
    if (m.phase === "fielding") {
      this.info
        .setPosition(3, 117)
        .setText(
          `${m.completedRuns} RUNS  ${m.returning ? "TURN" : m.moving ? "RUN" : "HOLD"}`,
        );
    }
    if (m.paused) {
      g.fillStyle(P.navy);
      g.fillRect(20, 42, 88, 32);
      this.banner.setPosition(64, 50).setText("PAUSED\n5 TO RESUME");
    }
  }
}
