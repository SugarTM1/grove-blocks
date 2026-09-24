import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { newGame, validateState } from "../src/engine.js";

const base = process.env.TEST_URL || "http://localhost:4173";
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || "msedge",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors = [];
let passed = 0;
const corners = [0, 7, 56, 63];
// Explicit expected footprints keep the assertions independent of the UI's
// coordinate conversion and edge-clamping implementation.
const shapes = [
  {
    name: "five horizontal blocks",
    cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
    footprints: [
      [0, 1, 2, 3, 4], [3, 4, 5, 6, 7],
      [56, 57, 58, 59, 60], [59, 60, 61, 62, 63],
    ],
  },
  {
    name: "five vertical blocks",
    cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
    footprints: [
      [0, 8, 16, 24, 32], [7, 15, 23, 31, 39],
      [24, 32, 40, 48, 56], [31, 39, 47, 55, 63],
    ],
  },
  {
    name: "three by three square",
    cells: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
    footprints: [
      [0, 1, 2, 8, 9, 10, 16, 17, 18],
      [5, 6, 7, 13, 14, 15, 21, 22, 23],
      [40, 41, 42, 48, 49, 50, 56, 57, 58],
      [45, 46, 47, 53, 54, 55, 61, 62, 63],
    ],
  },
  {
    name: "L shape",
    cells: [[0, 0], [0, 1], [0, 2], [1, 2]],
    footprints: [
      [0, 8, 16, 17], [6, 14, 22, 23],
      [40, 48, 56, 57], [46, 54, 62, 63],
    ],
  },
];

async function setup(p) {
  p.on("pageerror", (error) => errors.push(error.message));
  await p.addInitScript(() => {
    const fixture = sessionStorage.getItem("__placement-fixture");
    if (fixture) {
      localStorage.setItem("grove-blocks-v1", fixture);
      sessionStorage.removeItem("__placement-fixture");
    }
  });
  await p.goto(base);
}

async function loadFixture(p, shape, occupied = []) {
  const state = newGame({ seed: 42 });
  state.board = Array.from({ length: 64 }, (_, i) =>
    occupied.includes(i) ? { color: 2, flower: false } : null,
  );
  state.tray = [
    { id: "placement-shape", cells: shape.cells, color: 0, flowerIndex: -1 },
    { id: "placement-spare-1", cells: [[0, 0]], color: 1, flowerIndex: -1 },
    { id: "placement-spare-2", cells: [[0, 0]], color: 2, flowerIndex: -1 },
  ];
  assert.equal(validateState(state), true, "fixture must be a valid saved game");
  await p.evaluate((value) => {
    sessionStorage.setItem("__placement-fixture", JSON.stringify(value));
  }, {
    version: 1,
    meta: { sound: false, tutorialSeen: true },
    sessions: { classic: { state, undos: 3 } },
  });
  await p.reload();
  await p.locator(".piece-slot").first().waitFor();
  return state;
}

async function currentState(p = page) {
  return p.evaluate(() =>
    JSON.parse(localStorage.getItem("grove-blocks-v1")).sessions.classic.state,
  );
}

async function marked(p, kind) {
  return p.locator(`.cell.${kind}`).evaluateAll((cells) =>
    cells.map((cell) => Number(cell.dataset.index)),
  );
}

async function assertPreview(p, expected, valid = true) {
  assert.deepEqual(await marked(p, valid ? "ghost" : "invalid"), expected);
  assert.deepEqual(await marked(p, valid ? "invalid" : "ghost"), []);
}

async function assertPlaced(p, expected) {
  const state = await currentState(p);
  assert.equal(state.moves, 1);
  assert.deepEqual(
    state.board.flatMap((cell, index) => cell ? [index] : []),
    expected,
    "the placed footprint must exactly match the preview",
  );
  assert.equal(state.tray[0], null);
}

async function cellCenter(p, index) {
  const box = await p.locator(`[data-index="${index}"]`).boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function startDrag(p, index) {
  const box = await p.locator('[data-piece="0"]').boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  const target = await cellCenter(p, index);
  await p.mouse.move(target.x, target.y, { steps: 8 });
}

async function test(name, run) {
  await run();
  passed++;
  console.log("PASS", name);
}

try {
  await mkdir("artifacts", { recursive: true });
  await setup(page);
  for (const shape of shapes) {
    for (const [corner, index] of corners.entries()) {
      await test(`Hover and click ${shape.name} at corner ${index}`, async () => {
        await loadFixture(page, shape);
        await page.locator('[data-piece="0"]').click();
        await page.locator(`[data-index="${index}"]`).hover();
        await assertPreview(page, shape.footprints[corner]);
        if (shape === shapes[2] && index === 63) {
          await page.screenshot({ path: "artifacts/corner-preview.png" });
        }
        await page.locator(`[data-index="${index}"]`).click();
        await assertPlaced(page, shape.footprints[corner]);
      });
      await test(`Drag ${shape.name} at corner ${index}`, async () => {
        await loadFixture(page, shape);
        await startDrag(page, index);
        await assertPreview(page, shape.footprints[corner]);
        assert.equal(await page.locator("#drag-ghost").isVisible(), false);
        await page.mouse.up();
        await assertPlaced(page, shape.footprints[corner]);
      });
    }
  }

  await test("Leaving the board clears the whole preview and cancels release", async () => {
    const before = await loadFixture(page, shapes[0]);
    await startDrag(page, 63);
    await assertPreview(page, shapes[0].footprints[3]);
    await page.mouse.move(2, 2, { steps: 4 });
    await assertPreview(page, []);
    assert.equal(await page.locator("#drag-ghost").isVisible(), true);
    await page.mouse.up();
    assert.deepEqual(await currentState(), before);
    assert.equal(await page.locator("#drag-ghost").isVisible(), false);
  });

  await test("Dragging back onto the board restores the complete preview", async () => {
    await loadFixture(page, shapes[1]);
    await startDrag(page, 0);
    await page.mouse.move(2, 2);
    await assertPreview(page, []);
    const target = await cellCenter(page, 63);
    await page.mouse.move(target.x, target.y);
    await assertPreview(page, shapes[1].footprints[3]);
    await page.mouse.up();
    await assertPlaced(page, shapes[1].footprints[3]);
  });

  await test("An off-board release without a move event cannot place a stale preview", async () => {
    const before = await loadFixture(page, shapes[0]);
    await startDrag(page, 63);
    await assertPreview(page, shapes[0].footprints[3]);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchMouseEvent", {
      type: "mouseReleased", x: 2, y: 2, button: "left", clickCount: 1,
    });
    await cdp.detach();
    assert.deepEqual(await currentState(), before);
    await assertPreview(page, []);
    assert.equal(await page.locator("#drag-ghost").isVisible(), false);
    // Synchronize Playwright's button bookkeeping after the direct release.
    await page.mouse.up();
  });

  await test("An occupied edge shows the whole shape red and rejects placement", async () => {
    const before = await loadFixture(page, shapes[0], [63]);
    await startDrag(page, 63);
    await assertPreview(page, shapes[0].footprints[3], false);
    assert.equal(await page.locator("#drag-ghost").isVisible(), false);
    await page.mouse.up();
    assert.deepEqual(await currentState(), before);
    await page.locator(`[data-index="63"]`).hover();
    await assertPreview(page, shapes[0].footprints[3], false);
    await page.locator(`[data-index="63"]`).click();
    assert.deepEqual(await currentState(), before);
  });

  for (const shape of shapes) {
    await test(`Keyboard keeps the entire ${shape.name} on the board`, async () => {
      await loadFixture(page, shape);
      await page.keyboard.press("1");
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("ArrowDown");
      }
      await assertPreview(page, shape.footprints[3]);
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press("ArrowLeft");
        await page.keyboard.press("ArrowUp");
      }
      await assertPreview(page, shape.footprints[0]);
      await page.keyboard.press("Enter");
      await assertPlaced(page, shape.footprints[0]);
    });
  }

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true, isMobile: true, deviceScaleFactor: 2,
  });
  const touchPage = await mobile.newPage();
  await setup(touchPage);
  for (const shape of shapes) {
    await test(`Touch tap places the complete ${shape.name} at the last corner`, async () => {
      await loadFixture(touchPage, shape);
      await touchPage.locator('[data-piece="0"]').tap();
      await touchPage.locator('[data-index="63"]').tap();
      await assertPlaced(touchPage, shape.footprints[3]);
    });
  }
  await test("Touch drag keeps the lifted preview and bottom-right release aligned", async () => {
    await loadFixture(touchPage, shapes[2]);
    const slot = await touchPage.locator('[data-piece="0"]').boundingBox();
    const target = await cellCenter(touchPage, 63);
    const start = { x: slot.x + slot.width / 2, y: slot.y + slot.height / 2 };
    const cdp = await mobile.newCDPSession(touchPage);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart", touchPoints: [start],
    });
    for (let i = 1; i <= 10; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{
          x: start.x + (target.x - start.x) * i / 10,
          y: start.y + (target.y + 38 - start.y) * i / 10,
        }],
      });
    }
    await assertPreview(touchPage, shapes[2].footprints[3]);
    assert.equal(await touchPage.locator("#drag-ghost").isVisible(), false);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd", touchPoints: [],
    });
    await assertPlaced(touchPage, shapes[2].footprints[3]);
    await cdp.detach();
  });
  await mobile.close();
  assert.deepEqual(errors, []);
  console.log(`\n${passed} placement checks passed; no browser JavaScript errors.`);
} finally {
  await browser.close();
}
