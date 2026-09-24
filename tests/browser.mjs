import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.TEST_URL || "http://localhost:4173";
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || "msedge",
  headless: true,
});
await mkdir("artifacts", { recursive: true });
const errors = [],
  results = [];
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
await page.addInitScript(() => {
  const raw = sessionStorage.getItem("__fixture");
  if (raw) {
    localStorage.setItem("grove-blocks-v1", raw);
    sessionStorage.removeItem("__fixture");
  }
});
page.on("pageerror", (e) => errors.push(e.message));
const snapshot = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("grove-blocks-v1")));
async function test(name, fn) {
  await fn();
  results.push(name);
  console.log("PASS", name);
}
async function choose(i) {
  await page.locator(`[data-piece="${i}"]`).click();
}
async function cell(x, y) {
  await page.locator(`[data-index="${y * 8 + x}"]`).click();
}
async function loadFixture(mode, patch = {}, meta = {}) {
  await page.evaluate(
    async ({ mode, patch, meta }) => {
      const { newGame } = await import("./src/engine.js");
      const s = newGame({ mode });
      Object.assign(s, patch);
      sessionStorage.setItem(
        "__fixture",
        JSON.stringify({
          version: 1,
          meta: {
            best: 0,
            flowers: 0,
            sound: false,
            theme: "meadow",
            tutorialSeen: true,
            ...meta,
          },
          sessions: { [mode]: { state: s, undos: 3 } },
        }),
      );
    },
    { mode, patch, meta },
  );
  await page.reload();
  if (mode === "daily") await page.locator("#daily-tab").click();
}
try {
  await page.goto(base);
  await test("First clear, score, flowers, undo and saved resume", async () => {
    assert.equal(await page.locator(".cell").count(), 64);
    await choose(0);
    await cell(5, 7);
    let s = await snapshot();
    assert.equal(s.sessions.classic.state.score, 220);
    assert.equal(s.meta.flowers, 3);
    assert.equal(s.sessions.classic.state.lines, 1);
    await page.locator("#undo").click();
    s = await snapshot();
    assert.equal(s.sessions.classic.state.score, 0);
    assert.equal(s.meta.flowers, 0);
    assert.equal(s.sessions.classic.undos, 2);
    await choose(0);
    await cell(5, 7);
    await page.reload();
    assert.equal((await snapshot()).sessions.classic.state.score, 220);
    assert.equal(await page.locator("#score").innerText(), "220");
  });
  await test("Invalid placement does not mutate state", async () => {
    const before = (await snapshot()).sessions.classic.state;
    await choose(1);
    await cell(7, 7);
    assert.deepEqual((await snapshot()).sessions.classic.state, before);
  });
  await test("Keyboard placement and free hint", async () => {
    await page.keyboard.press("2");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    assert.equal((await snapshot()).sessions.classic.state.moves, 2);
    await page.locator("#hint").click();
    assert.ok((await page.locator(".cell.ghost,.cell.will-clear").count()) > 0);
    await page.keyboard.press("Enter");
    assert.equal((await snapshot()).sessions.classic.state.moves, 3);
  });
  await test("Help, sound, garden and focus dismissal", async () => {
    await page.locator("#help").click();
    assert.equal(await page.locator("dialog").isVisible(), true);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("dialog").isVisible(), false);
    await page.locator("#sound").click();
    const muted = (await snapshot()).meta.sound;
    await page.reload();
    assert.equal((await snapshot()).meta.sound, muted);
    await page.locator("#garden").click();
    assert.equal(await page.locator(".plant-card").count(), 9);
    await page.locator('[data-action="close"]').first().click();
  });
  await test("Mode switch preserves Classic; Daily replay is deterministic", async () => {
    const classic = (await snapshot()).sessions.classic.state;
    await page.locator("#daily-tab").click();
    const initial = (await snapshot()).sessions.daily.state;
    await page.locator("#hint").click();
    await page.keyboard.press("Enter");
    assert.equal((await snapshot()).sessions.daily.state.moves, 1);
    await page.locator("#classic-tab").click();
    assert.deepEqual((await snapshot()).sessions.classic.state, classic);
    await page.locator("#daily-tab").click();
    await page.locator("#restart").click();
    await page.locator('[data-action="play-again"]').click();
    assert.deepEqual((await snapshot()).sessions.daily.state, initial);
  });
  await test("Charged Bloom consumes charge, removes tiles, awards no points", async () => {
    await loadFixture("classic", { bloom: 8, flowers: 8, moves: 3 });
    await page.locator("#bloom").click();
    await cell(2, 7);
    const s = (await snapshot()).sessions.classic.state;
    assert.equal(s.bloom, 0);
    assert.equal(s.score, 0);
    assert.equal(s.moves, 3);
    assert.equal(s.board.filter(Boolean).length, 2);
  });
  await test("Daily move30 result, replay, and pending result behind Help", async () => {
    await loadFixture("daily", {
      moves: 29,
      board: Array(64).fill(null),
      tray: [
        null,
        null,
        { id: "daily-last", cells: [[0, 0]], color: 1, flowerIndex: 0 },
      ],
    });
    await page.locator("#hint").click();
    await page.keyboard.press("Enter");
    await page.locator("#help").click();
    await page.waitForTimeout(750);
    await page.locator('[data-action="close"]').first().click();
    await page.getByText("A lovely day’s growing.").waitFor();
    assert.equal((await snapshot()).sessions.daily.state.moves, 30);
    assert.equal((await snapshot()).sessions.daily.state.over, true);
    await page.locator('[data-action="play-again"]').click();
    assert.equal((await snapshot()).sessions.daily.state.moves, 0);
  });
  await test("Classic no-space ending, undo after ending, and replay", async () => {
    await page.evaluate(async () => {
      const { newGame } = await import("./src/engine.js");
      const state = newGame({ seed: 42 });
      state.board = Array.from({ length: 64 }, (_, i) =>
        (i + Math.floor(i / 8)) % 2 === 0 ? { color: 0, flower: false } : null,
      );
      state.tray = [
        { id: "end-0", cells: [[0, 0]], color: 0, flowerIndex: -1 },
        {
          id: "end-1",
          cells: [
            [0, 0],
            [1, 0],
          ],
          color: 0,
          flowerIndex: -1,
        },
        {
          id: "end-2",
          cells: [
            [0, 0],
            [1, 0],
          ],
          color: 0,
          flowerIndex: -1,
        },
      ];
      sessionStorage.setItem(
        "__fixture",
        JSON.stringify({
          version: 1,
          meta: { sound: false },
          sessions: { classic: { state, undos: 3 } },
        }),
      );
    });
    await page.reload();
    await choose(0);
    await cell(1, 0);
    await page.getByText("Room for a fresh start.").waitFor();
    assert.equal((await snapshot()).sessions.classic.state.over, true);
    await page.locator('[data-action="undo-end"]').click();
    assert.equal((await snapshot()).sessions.classic.state.over, false);
    assert.equal((await snapshot()).sessions.classic.undos, 2);
  });
  await test("All long pieces fit their tray slots at desktop and portal sizes", async () => {
    await page.evaluate(async () => {
      const { newGame, SHAPES } = await import("./src/engine.js");
      const state = newGame({ seed: 42 });
      state.tray = [23, 22, 24].map((n, i) => ({
        id: "fit" + i,
        cells: SHAPES[n],
        color: i,
        flowerIndex: 0,
      }));
      sessionStorage.setItem(
        "__fixture",
        JSON.stringify({
          version: 1,
          meta: { sound: false },
          sessions: { classic: { state, undos: 3 } },
        }),
      );
    });
    await page.reload();
    for (const [width, height] of [
      [1440, 1000],
      [1216, 684],
      [1077, 606],
      [907, 510],
      [390, 844],
      [320, 740],
      [844, 390],
    ]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(100);
      const issues = await page.evaluate(() => {
        const issues = [];
        for (const slot of document.querySelectorAll(".piece-slot")) {
          const shape = slot.querySelector(".piece-shape");
          if (!shape) continue;
          const a = slot.getBoundingClientRect(),
            b = shape.getBoundingClientRect();
          if (b.width > a.width - 4 || b.height > a.height - 4)
            issues.push("piece overflow");
          const tray = slot.parentElement.getBoundingClientRect();
          if (a.right > tray.right + 1 || a.left < tray.left - 1)
            issues.push("slot overflow");
        }
        const board = document.querySelector("#board").getBoundingClientRect(),
          tools = document.querySelector(".game-tools").getBoundingClientRect();
        if (board.right > innerWidth || board.left < 0)
          issues.push("board outside width");
        if (tools.bottom > innerHeight)
          issues.push("tools below fold: " + tools.bottom);
        if (document.documentElement.scrollWidth > innerWidth)
          issues.push("horizontal scroll");
        return issues;
      });
      assert.deepEqual(issues, [], `${width}x${height}: ${issues}`);
      await page.screenshot({
        path: `artifacts/layout-${width}x${height}.png`,
        fullPage: true,
      });
    }
  });
  await page.setViewportSize({ width: 1280, height: 850 });
  await test("Mouse drag and keyboard during drag are safe", async () => {
    await loadFixture("classic");
    const p = await page.locator('[data-piece="0"]').boundingBox(),
      c = await page.locator('[data-index="62"]').boundingBox();
    await page.mouse.move(p.x + p.width / 2, p.y + p.height / 2);
    await page.mouse.down();
    await page.keyboard.press("2");
    await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2, { steps: 10 });
    await page.mouse.up();
    assert.equal((await snapshot()).sessions.classic.state.score, 220);
  });
  await test("Malformed storage recovers cleanly", async () => {
    await page.evaluate(() => sessionStorage.setItem("__fixture", "{invalid"));
    await page.reload();
    assert.equal(await page.locator(".cell").count(), 64);
    assert.equal((await snapshot()).sessions.classic.state.score, 0);
  });
  await test("Garden unlock and theme persist", async () => {
    await loadFixture("classic", {}, { flowers: 125 });
    await page.locator("#help").click();
    await page.keyboard.press("Escape");
    const garden = page.locator("#garden");
    if (await garden.isVisible()) await garden.click();
    else await page.locator("#mobile-garden").click();
    assert.equal(await page.locator(".plant-card.unlocked").count(), 6);
    await page.locator('[data-theme="dusk"]').click();
    await page.locator('[data-action="close"]').first().click();
    assert.equal(await page.locator("body").getAttribute("data-theme"), "dusk");
    await page.reload();
    assert.equal(await page.locator("body").getAttribute("data-theme"), "dusk");
  });
  await test("Touch tap and drag on mobile", async () => {
    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 2,
    });
    const p = await mobile.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(base);
    await p.locator('[data-piece="0"]').tap();
    await p.locator('[data-index="61"]').tap();
    assert.equal(await p.locator("#score").innerText(), "220");
    await p.screenshot({ path: "artifacts/mobile-play.png" });
    await p.locator("#undo").tap();
    const a = await p.locator('[data-piece="0"]').boundingBox(),
      b = await p.locator('[data-index="62"]').boundingBox();
    const cdp = await mobile.newCDPSession(p);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: a.x + a.width / 2, y: a.y + a.height / 2 }],
    });
    for (let i = 1; i <= 10; i++)
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          {
            x:
              a.x +
              a.width / 2 +
              ((b.x + b.width / 2 - a.x - a.width / 2) * i) / 10,
            y:
              a.y +
              a.height / 2 +
              ((b.y + b.height / 2 + 38 - a.y - a.height / 2) * i) / 10,
          },
        ],
      });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    assert.equal(await p.locator("#score").innerText(), "220");
    await mobile.close();
  });
  await test("Unavailable localStorage still allows a complete move", async () => {
    const c = await browser.newContext();
    const p = await c.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    await p.addInitScript(() =>
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new DOMException("Blocked", "SecurityError");
        },
      }),
    );
    await p.goto(base);
    await p.locator('[data-piece="0"]').click();
    await p.locator('[data-index="61"]').click();
    assert.equal(await p.locator("#score").innerText(), "220");
    assert.equal(await p.locator(".saved-label").innerText(), "Session only");
    await c.close();
  });
  await test("Standalone has no external requests and runs offline after loading", async () => {
    const c = await browser.newContext();
    const p = await c.newPage();
    const requests = [];
    p.on("request", (r) => requests.push(r.url()));
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(base);
    await p.emulateMedia({ reducedMotion: "reduce" });
    await c.setOffline(true);
    await p.locator('[data-piece="0"]').click();
    await p.locator('[data-index="61"]').click();
    assert.equal(await p.locator("#score").innerText(), "220");
    assert.equal(await p.locator(".particle").count(), 0);
    assert.equal(
      requests.filter((u) => new URL(u).origin !== new URL(base).origin).length,
      0,
    );
    await c.close();
  });
  assert.deepEqual(errors, []);
  results.push("No browser JavaScript errors");
  await writeFile(
    "artifacts/browser-results.json",
    JSON.stringify(
      {
        date: new Date().toISOString(),
        browser: "Microsoft Edge (Chromium)",
        passed: results.length,
        results,
      },
      null,
      2,
    ),
  );
  console.log(`\n${results.length} browser checks passed.`);
} finally {
  await browser.close();
}
