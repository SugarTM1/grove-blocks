import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { newGame } from "../src/engine.js";

const base = process.env.TEST_URL || "http://localhost:4173";
const portalURL = new URL(base);
portalURL.searchParams.set("crazygames", "true");
const key = "grove-blocks-v1";
const results = [], errors = [], externalRequests = [];
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || "msedge",
  headless: true,
});

function fixture(score = 0) {
  const state = newGame({ seed: 42 });
  state.score = score;
  return JSON.stringify({
    version: 1,
    meta: {
      best: score,
      flowers: 0,
      sound: false,
      theme: "meadow",
      tutorialSeen: true,
      dailyBest: { date: new Date().toISOString().slice(0, 10), score: 0 },
    },
    sessions: { classic: { state, undos: 3 } },
  });
}

async function scenario(options, run) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.route("**/*", async (route) => {
    if (new URL(route.request().url()).origin !== portalURL.origin) {
      externalRequests.push(route.request().url());
      await route.abort();
    } else await route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(({ key, options }) => {
    const local = window.localStorage;
    if (!sessionStorage.getItem("__sdkSeeded")) {
      sessionStorage.setItem("__sdkSeeded", "true");
      if (options.cloud !== null)
        sessionStorage.setItem("__sdkCloud", options.cloud);
      if (options.local) local.setItem(key, options.local);
    }
    window.__sdkTest = {
      initialized: false,
      initStarted: false,
      localAccesses: 0,
      reads: [],
      writes: [],
      events: [],
    };
    const info = window.__sdkTest;
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        info.localAccesses++;
        return local;
      },
    });
    window.__readLocal = () => local.getItem(key);
    window.CrazyGames = {
      SDK: {
        environment: "crazygames",
        async init() {
          info.initStarted = true;
          if (options.delay)
            await new Promise((resolve) => { window.__releaseSDK = resolve; });
          if (options.initError) throw new Error("Connection unavailable");
          info.initialized = true;
        },
        user: { getUser: async () => options.guest ? null : { userId: "test-user" } },
        data: {
          getItem(requestedKey) {
            info.reads.push({ key: requestedKey, initialized: info.initialized });
            if (options.readError) throw new Error("Cloud data unavailable");
            return sessionStorage.getItem("__sdkCloud");
          },
          setItem(requestedKey, value) {
            info.writes.push({ key: requestedKey, initialized: info.initialized, value });
            if (options.writeError) throw new Error("Data limit exceeded");
            sessionStorage.setItem("__sdkCloud", value);
          },
        },
        game: Object.fromEntries(
          ["loadingStart", "loadingStop", "gameplayStart", "gameplayStop", "happytime"]
            .map((method) => [method, () => info.events.push(method)]),
        ),
      },
    };
  }, { key, options: { cloud: fixture(), ...options } });
  try {
    await page.goto(portalURL.href, { waitUntil: options.delay ? "commit" : "load" });
    if (options.delay) await page.waitForFunction(() => window.__sdkTest?.initStarted);
    else await page.locator("#board").waitFor();
    await run(page);
  } finally {
    await context.close();
  }
}

const info = (page) => page.evaluate(() => window.__sdkTest);
const cloudRaw = (page) => page.evaluate(() => sessionStorage.getItem("__sdkCloud"));
const snapshot = async (page) => JSON.parse(await cloudRaw(page));
async function firstClear(page) {
  await page.locator('[data-piece="0"]').click();
  await page.locator('[data-index="61"]').click();
}
async function test(name, options, run) {
  await scenario(options, run);
  results.push(name);
  console.log("PASS", name);
}

try {
  await test("Delayed SDK initialization cannot expose play or overwrite cloud progress",
    { delay: true, cloud: fixture(740), local: fixture(20) }, async (page) => {
      assert.equal(await page.locator(".loading-screen").isVisible(), true);
      assert.equal(await page.locator("#board").count(), 0);
      assert.deepEqual((await info(page)).reads, []);
      assert.deepEqual((await info(page)).writes, []);
      await page.evaluate(() => window.__releaseSDK());
      await page.locator("#board").waitFor();
      assert.equal(await page.locator("#score").innerText(), "740");
      assert.ok((await info(page)).reads.every((read) => read.initialized));
      assert.ok((await info(page)).writes.every((write) => write.initialized));
    });

  await test("Cloud progress wins over conflicting local progress without local access",
    { cloud: fixture(840), local: fixture(120) }, async (page) => {
      assert.equal(await page.locator("#score").innerText(), "840");
      assert.equal((await info(page)).localAccesses, 0);
      assert.equal(await page.evaluate(() => window.__readLocal()), fixture(120));
      assert.equal((await info(page)).reads[0].key, key);
      assert.equal(await page.locator(".saved-label").innerText(), "Progress saved");
    });

  await test("A move persists through SDK data and resumes after reload",
    {}, async (page) => {
      await firstClear(page);
      const saved = await snapshot(page);
      assert.equal(saved.sessions.classic.state.score, 220);
      assert.equal(saved.meta.flowers, 3);
      assert.equal(saved.sessions.classic.state.moves, 1);
      await page.reload();
      await page.locator("#board").waitFor();
      assert.equal(await page.locator("#score").innerText(), "220");
      assert.deepEqual(await snapshot(page), saved);
      assert.equal((await info(page)).localAccesses, 0);
    });

  await test("Guests also use SDK data and leave an unrelated local save untouched",
    { guest: true, cloud: null, local: fixture(120) }, async (page) => {
      assert.equal(await page.locator("#score").innerText(), "0");
      await firstClear(page);
      assert.equal((await snapshot(page)).sessions.classic.state.score, 220);
      assert.equal((await info(page)).localAccesses, 0);
      assert.equal(await page.evaluate(() => window.__readLocal()), fixture(120));
      assert.ok((await info(page)).writes.length > 0);
    });

  await test("Cloud read failure allows session play without any cloud or local writes",
    { readError: true, cloud: fixture(980), local: fixture(120) }, async (page) => {
      await firstClear(page);
      assert.equal(await page.locator("#score").innerText(), "220");
      assert.equal(await page.locator(".saved-label").innerText(), "Session only");
      assert.deepEqual((await info(page)).writes, []);
      assert.equal(await cloudRaw(page), fixture(980));
      assert.equal((await info(page)).localAccesses, 0);
    });

  await test("Cloud write failure keeps the game playable and reports Session only",
    { writeError: true }, async (page) => {
      await firstClear(page);
      assert.equal(await page.locator("#score").innerText(), "220");
      assert.equal(await page.locator(".saved-label").innerText(), "Session only");
      assert.equal(await cloudRaw(page), fixture());
      assert.ok((await info(page)).writes.length > 0);
      assert.equal((await info(page)).localAccesses, 0);
    });

  await test("Malformed cloud JSON remains untouched during session play",
    { cloud: "{unreadable" }, async (page) => {
      await firstClear(page);
      assert.equal(await page.locator("#score").innerText(), "220");
      assert.equal(await page.locator(".saved-label").innerText(), "Session only");
      assert.equal(await cloudRaw(page), "{unreadable");
      assert.deepEqual((await info(page)).writes, []);
    });

  await test("Unrecognized cloud save shape remains untouched",
    { cloud: JSON.stringify({ version: 2, meta: {}, sessions: {} }) }, async (page) => {
      await firstClear(page);
      assert.equal(await page.locator(".saved-label").innerText(), "Session only");
      assert.equal(await cloudRaw(page), JSON.stringify({ version: 2, meta: {}, sessions: {} }));
      assert.deepEqual((await info(page)).writes, []);
    });

  await test("SDK initialization failure never reads or overwrites another save",
    { initError: true, cloud: fixture(980), local: fixture(120) }, async (page) => {
      await firstClear(page);
      assert.equal(await page.locator("#score").innerText(), "220");
      assert.equal(await page.locator(".saved-label").innerText(), "Session only");
      assert.deepEqual((await info(page)).reads, []);
      assert.deepEqual((await info(page)).writes, []);
      assert.equal((await info(page)).localAccesses, 0);
      assert.equal(await cloudRaw(page), fixture(980));
    });

  await test("Visibility and pagehide events do not submit extra cloud writes",
    {}, async (page) => {
      await firstClear(page);
      const before = await info(page);
      await page.evaluate(() => {
        Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
        document.dispatchEvent(new Event("visibilitychange"));
        window.dispatchEvent(new Event("pagehide"));
      });
      assert.deepEqual((await info(page)).writes, before.writes);
      assert.equal((await snapshot(page)).sessions.classic.state.score, 220);
    });

  assert.deepEqual(errors, []);
  results.push("No browser JavaScript errors");
  assert.deepEqual(externalRequests, []);
  results.push("Mocked integration makes no external SDK or account requests");
  await mkdir("artifacts", { recursive: true });
  await writeFile("artifacts/data-browser-results.json", JSON.stringify({
    date: new Date().toISOString(),
    browser: "Microsoft Edge (Chromium)",
    url: portalURL.href,
    passed: results.length,
    results,
    pageErrors: errors,
  }, null, 2));
  console.log(`\n${results.length} Data Module browser checks passed.`);
} finally {
  await browser.close();
}
