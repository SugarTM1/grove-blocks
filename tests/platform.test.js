import test from "node:test";
import assert from "node:assert/strict";

let sequence = 0;
async function freshPlatform() {
  return import(`../src/platform.js?test=${sequence++}`);
}

function browser({
  hostname = "localhost",
  search = "",
  referrer = "",
  sdk,
} = {}) {
  const scripts = [];
  globalThis.window = {
    location: { hostname, search },
    CrazyGames: sdk ? { SDK: sdk } : undefined,
  };
  globalThis.document = {
    referrer,
    head: {
      appendChild(script) {
        scripts.push(script);
      },
    },
    createElement() {
      return { remove() {} };
    },
  };
  return scripts;
}

function mockSdk(init = async () => {}) {
  const events = [];
  return {
    events,
    init,
    environment: "local",
    game: Object.fromEntries(
      [
        "loadingStart",
        "loadingStop",
        "gameplayStart",
        "gameplayStop",
        "happytime",
      ].map((event) => [
        event,
        () => {
          events.push(event);
        },
      ]),
    ),
  };
}

test("standalone and lookalike domains do not request the SDK", async () => {
  for (const hostname of [
    "localhost",
    "127.0.0.1",
    "mygame.example",
    "crazygames.com.evil.example",
  ]) {
    const scripts = browser({ hostname });
    const platform = await freshPlatform();
    platform.setPlaying(true);
    platform.celebrate();
    assert.deepEqual(await platform.initPlatform(), {
      available: false,
      reason: "standalone",
    });
    assert.equal(scripts.length, 0);
  }
});

test("initialization preserves play state and sends only transitions", async () => {
  let finish;
  const sdk = mockSdk(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  browser({ search: "?crazygames=true", sdk });
  const platform = await freshPlatform();
  const pending = platform.initPlatform();
  assert.equal(platform.initPlatform(), pending);
  platform.setPlaying(true);
  await Promise.resolve();
  assert.deepEqual(sdk.events, []);
  finish();
  assert.equal((await pending).available, true);
  platform.setPlaying(true);
  platform.setPlaying(false);
  platform.setPlaying(false);
  platform.setPlaying(true);
  platform.celebrate();
  assert.deepEqual(sdk.events, [
    "loadingStart",
    "loadingStop",
    "gameplayStart",
    "gameplayStop",
    "gameplayStart",
    "happytime",
  ]);
});

test("a pause while SDK initializes does not report phantom gameplay", async () => {
  const sdk = mockSdk();
  browser({ referrer: "https://www.crazygames.com/game/grove-blocks", sdk });
  const platform = await freshPlatform();
  platform.setPlaying(true);
  platform.setPlaying(false);
  await platform.initPlatform();
  assert.deepEqual(sdk.events, ["loadingStart", "loadingStop"]);
});

test("script failure and rejected initialization leave the game independent", async () => {
  const scripts = browser({ hostname: "games.crazygames.com" });
  let platform = await freshPlatform();
  const pending = platform.initPlatform();
  assert.equal(scripts.length, 1);
  assert.equal(
    scripts[0].src,
    "https://sdk.crazygames.com/crazygames-sdk-v3.js",
  );
  scripts[0].onerror();
  assert.equal((await pending).available, false);
  assert.doesNotThrow(() => platform.setPlaying(true));

  browser({
    search: "?crazygames=true",
    sdk: mockSdk(async () => {
      throw new Error("offline");
    }),
  });
  platform = await freshPlatform();
  assert.equal((await platform.initPlatform()).available, false);
  assert.doesNotThrow(() => platform.celebrate());
});

test("disabled SDK environments never receive game events", async () => {
  const sdk = mockSdk();
  sdk.environment = "disabled";
  browser({ search: "?crazygames=true", sdk });
  const platform = await freshPlatform();
  platform.setPlaying(true);
  assert.deepEqual(await platform.initPlatform(), {
    available: false,
    reason: "disabled",
  });
  platform.celebrate();
  assert.deepEqual(sdk.events, []);
});

test("a slow SDK times out and cannot attach itself after failure", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let complete;
  const sdk = mockSdk(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  browser({ search: "?crazygames=true", sdk });
  const platform = await freshPlatform();
  platform.setPlaying(true);
  const pending = platform.initPlatform();
  await Promise.resolve();
  t.mock.timers.tick(4001);
  assert.equal((await pending).available, false);
  complete();
  await Promise.resolve();
  platform.setPlaying(false);
  platform.setPlaying(true);
  assert.deepEqual(sdk.events, []);
});

test("SDK event exceptions and rejected promises do not reach gameplay", async () => {
  const sdk = mockSdk();
  sdk.game.gameplayStart = () => {
    throw new Error("portal disconnected");
  };
  sdk.game.happytime = () => Promise.reject(new Error("portal disconnected"));
  browser({ search: "?crazygames=true", sdk });
  const platform = await freshPlatform();
  await platform.initPlatform();
  assert.doesNotThrow(() => platform.setPlaying(true));
  assert.doesNotThrow(() => platform.celebrate());
  await Promise.resolve();
});

test.after(() => {
  delete globalThis.window;
  delete globalThis.document;
});
