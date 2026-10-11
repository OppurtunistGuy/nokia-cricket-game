import { test, expect } from "@playwright/test";
test("complete match, restart, and no runtime errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await page.locator("#team").selectOption("PAKISTAN");
  await page.locator("#start").click();
  for (let i = 0; i < 2; i++) {
    await page.locator("#next").click();
    await expect(page.locator("body")).toHaveAttribute(
      "data-stage",
      i === 1 ? "innings" : "result",
      { timeout: 5000 },
    );
  }
  await expect(page.locator("#message")).toContainText("need 1");
  await page.locator("#next").click();
  await expect(page.locator("body")).toHaveAttribute("data-innings", "2");
  for (let i = 0; i < 12; i++) {
    if ((await page.locator("body").getAttribute("data-stage")) === "finished")
      break;
    await page.locator("#next").click();
    await page.locator('[data-key="5"]').click();
    await expect(page.locator("body")).toHaveAttribute(
      "data-stage",
      /result|finished/,
    );
  }
  await expect(page.locator("body")).toHaveAttribute("data-stage", "finished");
  await page.locator("#next").click();
  await expect(page.locator("body")).toHaveAttribute("data-stage", "ready");
  await page.locator("#reset").click();
  await expect(page.locator("#menu")).toBeVisible();
  expect(errors).toEqual([]);
});
test("touch shot scores runs and keyboard controls work", async ({ page }) => {
  await page.goto("/");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#start").click();
  await page.locator('[data-key="4"]').click();
  await page.locator("#next").click();
  await page.waitForTimeout(1500);
  await page.locator('[data-key="5"]').click();
  await expect(page.locator("#score")).toHaveText(/^[1246]\/0/);
  await page.keyboard.press("Enter");
  await expect(page.locator("body")).toHaveAttribute("data-stage", "delivery");
  await page.screenshot({
    path: "/workspace/cricket-mobile.png",
    fullPage: true,
  });
});
test("installed game reloads offline", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    await new Promise<void>((resolve) => {
      if (navigator.serviceWorker.controller) resolve();
      else
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        );
    });
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("canvas")).toBeVisible();
  await page.locator("#start").click();
  await expect(page.locator("body")).toHaveAttribute("data-stage", "ready");
});

test("twelve legal deliveries end the batting innings", async ({ page }) => {
  test.setTimeout(60000);
  await page.goto("/");
  await page.locator("#start").click();
  for (let ball = 1; ball <= 12; ball++) {
    await page.locator("#next").click();
    await page.waitForTimeout(1450);
    await page.locator('[data-key="5"]').click();
    await expect(page.locator("body")).toHaveAttribute(
      "data-stage",
      ball === 12 ? "innings" : "result",
    );
    await expect(page.locator("#score")).toContainText(
      `${Math.floor(ball / 6)}.${ball % 6} / 2`,
    );
  }
  await expect(page.locator("#message")).toContainText("Time to bowl");
});

test("page stylesheet and game initialize together", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".phone")).toHaveCSS(
    "background-color",
    "rgb(200, 207, 180)",
  );
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("#boot-status")).toHaveCount(0);
  await expect(page.locator("#start")).toBeEnabled();
});
