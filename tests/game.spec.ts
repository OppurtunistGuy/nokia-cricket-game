import { test, expect, type Page } from "@playwright/test";
async function start(page: Page, mode = "classic") {
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await page.locator("#mode").selectOption(mode);
  await page.locator("#start").click();
  await expect(page.locator("body")).toHaveAttribute("data-phase", "ready");
}
async function swingAt(page: Page, p = 0.83) {
  await page.waitForFunction(
    (p) => Number(document.body.dataset.progress) >= p,
    p,
  );
  await page.locator("#action").click();
}
async function finishBatting(page: Page) {
  for (let i = 0; i < 12; i++) {
    if ((await page.locator("body").getAttribute("data-phase")) === "innings")
      return;
    await page.locator("#next").click();
    await expect(page.locator("body")).toHaveAttribute(
      "data-phase",
      "delivery",
    );
    await expect(page.locator("body")).toHaveAttribute(
      "data-phase",
      /result|innings/,
      { timeout: 6000 },
    );
  }
  await expect(page.locator("body")).toHaveAttribute("data-phase", "innings");
}
test("Classic runs a full match and restarts without runtime errors", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  await expect(page.locator("#shot")).toBeDisabled();
  await finishBatting(page);
  await page.locator("#next").click();
  await expect(page.locator("body")).toHaveAttribute("data-innings", "2");
  for (let i = 0; i < 20; i++) {
    if ((await page.locator("body").getAttribute("data-phase")) === "finished")
      break;
    await page.locator("#next").click();
    await expect(page.locator("body")).toHaveAttribute(
      "data-phase",
      "accuracy",
    );
    await page.locator("#action").click();
    await expect(page.locator("body")).toHaveAttribute(
      "data-phase",
      /result|finished/,
      { timeout: 7000 },
    );
  }
  await expect(page.locator("body")).toHaveAttribute("data-phase", "finished");
  await page.locator("#next").click();
  await expect(page.locator("body")).toHaveAttribute("data-phase", "ready");
  expect(errors).toEqual([]);
});
test("Advanced selects shots with keyboard and manually runs, turns, and holds using touch", async ({
  page,
}) => {
  await start(page, "advanced");
  await page.locator("#shot").selectOption("defensive");
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#shot")).toHaveValue("lofted");
  await page.locator("#shot").selectOption("defensive");
  await page.locator("#next").click();
  await swingAt(page, 0.72);
  await expect(page.locator("body")).toHaveAttribute("data-phase", "fielding");
  await expect(page.locator("body")).toHaveAttribute("data-camera", "fielding");
  await expect(page.locator("#running")).toBeVisible();
  await page.locator('[data-action="run"]').click();
  await expect(page.locator("#run-state")).toContainText("RUNNING");
  await page.locator('[data-action="turn"]').click();
  await expect(page.locator("#run-state")).toContainText("TURNING");
  await page.locator('[data-action="stop"]').click();
  await expect(page.locator("body")).toHaveAttribute("data-phase", "result", {
    timeout: 5000,
  });
  await expect(page.locator("#message")).toContainText("Dot ball");
});
test("Advanced bowling combines yorker, wide line, swing, slower ball and bouncer controls", async ({
  page,
}) => {
  test.setTimeout(45000);
  await start(page, "advanced");
  await finishBatting(page);
  await page.locator("#next").click();
  await page.locator("#length").selectOption("yorker");
  await page.locator("#line").selectOption("wide-off");
  await page.locator("#movement").selectOption("outswing");
  await page.locator("#speed").selectOption("slow");
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("q");
  await expect(page.locator("#movement")).toHaveValue("inswing");
  await page.keyboard.press("b");
  await expect(page.locator("#length")).toHaveValue("short");
  await expect(page.locator("#bouncer")).toBeChecked();
  await page.keyboard.press("b");
  await page.locator("#length").selectOption("yorker");
  await page.locator("#next").click();
  await page.locator("#action").click();
  await expect(page.locator("body")).toHaveAttribute("data-phase", "delivery");
  await expect(page.locator("#message")).toContainText(
    "yorker / wide-off / inswing / slower ball",
  );
  await expect(page.locator("#line")).toBeDisabled();
});
test("pixel canvas and mobile controls fit without a horizontal scrollbar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page, "advanced");
  await expect(page.locator("canvas")).toHaveAttribute("width", "128");
  await expect(page.locator("canvas")).toHaveCSS(
    "image-rendering",
    "pixelated",
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await expect(page.locator("#boot-status")).toHaveCount(0);
  await page.screenshot({
    path: "/workspace/cricket-v03-mobile.png",
    fullPage: true,
  });
  await page.locator("#next").click();
  await expect(page.locator("#shot")).toBeDisabled();
});
test("game pauses without advancing the ball and resumes", async ({ page }) => {
  await start(page);
  await page.locator("#next").click();
  await page.locator("#pause").click();
  const before = await page.locator("body").getAttribute("data-progress");
  await page.waitForTimeout(300);
  expect(await page.locator("body").getAttribute("data-progress")).toBe(before);
  await expect(page.locator("#phase")).toHaveText("PAUSED");
  await page.locator("#pause").click();
  await expect(page.locator("#phase")).toHaveText("YOU BAT");
});
test("standard controller selects shots, starts deliveries and pauses on disconnect", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = {
      connected: false,
      buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
      axes: [0, 0],
    };
    (window as any).virtualPad = state;
    Object.defineProperty(navigator, "getGamepads", {
      value: () => (state.connected ? [state] : []),
    });
  });
  await start(page, "advanced");
  await page.evaluate(() => {
    (window as any).virtualPad.connected = true;
    (window as any).virtualPad.buttons[15].pressed = true;
  });
  await expect(page.locator("#controller")).toContainText(
    "Controller connected",
  );
  await expect(page.locator("#shot")).toHaveValue("cut");
  await page.evaluate(() => {
    (window as any).virtualPad.buttons[15].pressed = false;
    (window as any).virtualPad.buttons[0].pressed = true;
  });
  await expect(page.locator("body")).toHaveAttribute("data-phase", "delivery");
  await page.evaluate(() => {
    (window as any).virtualPad.connected = false;
  });
  await expect(page.locator("#phase")).toHaveText("PAUSED");
});
test("both Classic and Advanced initialize offline from the cached production build", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    await new Promise<void>((r) => {
      if (navigator.serviceWorker.controller) r();
      else
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => r(),
          { once: true },
        );
    });
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("canvas")).toBeVisible();
  await page.locator("#start").click();
  await expect(page.locator("body")).toHaveAttribute("data-mode", "classic");
  await page.locator("#reset").click();
  await page.locator("#mode").selectOption("advanced");
  await page.locator("#start").click();
  await expect(page.locator("body")).toHaveAttribute("data-mode", "advanced");
});

test("Classic and Advanced share exactly the same ready-state pixel canvas", async ({
  page,
}) => {
  await start(page, "classic");
  const classic = await page
    .locator("canvas")
    .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  await page.locator("#reset").click();
  await page.locator("#mode").selectOption("advanced");
  await page.locator("#start").click();
  await expect(page.locator("body")).toHaveAttribute("data-phase", "ready");
  const advanced = await page
    .locator("canvas")
    .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  expect(advanced).toBe(classic);
});
