export type Action =
  | "confirm"
  | "next"
  | "left"
  | "right"
  | "up"
  | "down"
  | "movement-left"
  | "movement-right"
  | "slow"
  | "bouncer"
  | "run"
  | "stop"
  | "turn"
  | "pause";
export function keyboardAction(key: string): Action | null {
  const map: Record<string, Action> = {
    " ": "confirm",
    "5": "confirm",
    Enter: "next",
    ArrowLeft: "left",
    "4": "left",
    ArrowRight: "right",
    "6": "right",
    ArrowUp: "up",
    "2": "up",
    ArrowDown: "down",
    "8": "down",
    q: "movement-left",
    e: "movement-right",
    s: "slow",
    b: "bouncer",
    Escape: "pause",
  };
  return map[key.length === 1 ? key.toLowerCase() : key] ?? null;
}
export interface Pad {
  buttons: readonly { pressed: boolean }[];
  axes: readonly number[];
}
const BUTTONS: Record<number, Action> = {
  0: "confirm",
  1: "run",
  2: "stop",
  3: "turn",
  4: "movement-left",
  5: "movement-right",
  6: "slow",
  7: "bouncer",
  9: "pause",
  12: "up",
  13: "down",
  14: "left",
  15: "right",
};
export class PadInput {
  private previous = new Set<string>();
  poll(pad: Pad | null): Action[] {
    const pressed = new Map<string, Action>();
    if (pad) {
      for (const [i, a] of Object.entries(BUTTONS)) {
        if (pad.buttons[Number(i)]?.pressed) pressed.set(`b${i}`, a);
      }
      if (pad.axes[0] < -0.6) pressed.set("axis-left", "left");
      if (pad.axes[0] > 0.6) pressed.set("axis-right", "right");
      if (pad.axes[1] < -0.6) pressed.set("axis-up", "up");
      if (pad.axes[1] > 0.6) pressed.set("axis-down", "down");
    }
    const actions = [
      ...new Set(
        [...pressed].filter(([k]) => !this.previous.has(k)).map(([, a]) => a),
      ),
    ];
    this.previous = new Set(pressed.keys());
    return actions;
  }
}
