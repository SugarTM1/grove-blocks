import test from "node:test";
import assert from "node:assert/strict";
import { initProgress, SAVE_KEY } from "../src/progress.js";

const snapshot = (best = 500) => ({ version: 1, meta: { best }, sessions: {} });
const portal = async () => ({ available: true });
const standalone = async () => ({ available: false, reason: "standalone" });

function storage(initial = null) {
  return {
    value: initial,
    reads: [],
    writes: [],
    getItem(key) { this.reads.push(key); return this.value; },
    setItem(key, value) { this.writes.push([key, value]); this.value = value; },
  };
}

test("progress waits for SDK initialization before reading or writing", async () => {
  let complete;
  const data = storage(JSON.stringify(snapshot()));
  const pending = initProgress({
    initialize: () => new Promise((resolve) => { complete = resolve; }),
    getData: () => data,
  });
  assert.deepEqual(data.reads, []);
  assert.deepEqual(data.writes, []);
  complete({ available: true });
  const progress = await pending;
  assert.deepEqual(progress.saved, snapshot());
  assert.deepEqual(data.reads, [SAVE_KEY]);
  assert.equal(progress.kind, "crazygames");
});

test("cloud save wins without accessing standalone browser storage", async () => {
  const data = storage(JSON.stringify(snapshot(1234)));
  const progress = await initProgress({
    initialize: portal,
    getData: () => data,
    getLocal: () => { throw new Error("Must not read standalone progress"); },
  });
  assert.equal(progress.saved.meta.best, 1234);
  assert.equal(progress.save(snapshot(2000)), true);
  assert.equal(JSON.parse(data.value).meta.best, 2000);
});

test("new CrazyGames guests use Data Module exclusively", async () => {
  const data = storage();
  let localReads = 0;
  const progress = await initProgress({
    initialize: portal,
    getData: () => data,
    getLocal: () => { localReads++; return storage(JSON.stringify(snapshot(9999))); },
  });
  assert.deepEqual(progress.saved, {});
  assert.equal(progress.save(snapshot(0)), true);
  assert.equal(localReads, 0);
  assert.equal(data.writes.length, 1);
});

test("SDK read failure prevents every later write, even after recovery", async () => {
  const data = storage(JSON.stringify(snapshot()));
  const getItem = data.getItem;
  data.getItem = () => { throw { code: "other" }; };
  const progress = await initProgress({ initialize: portal, getData: () => data });
  data.getItem = getItem;
  assert.equal(progress.kind, "session");
  assert.equal(progress.save(snapshot(0)), false);
  assert.equal(data.writes.length, 0);
  assert.equal(JSON.parse(data.value).meta.best, 500);
});

test("disabled or missing Data Module never falls back to local saves", async () => {
  for (const getData of [() => null, () => ({}), () => { throw { code: "dataModuleDisabled" }; }]) {
    let reads = 0;
    const progress = await initProgress({
      initialize: portal,
      getData,
      getLocal: () => { reads++; return storage(); },
    });
    assert.equal(progress.save(snapshot()), false);
    assert.equal(reads, 0);
  }
});

test("malformed or newer cloud saves are not overwritten", async () => {
  for (const raw of ["bad json", "null", "[]", "{}", '{"version":2,"meta":{},"sessions":{}}']) {
    const data = storage(raw);
    const progress = await initProgress({ initialize: portal, getData: () => data });
    assert.equal(progress.save(snapshot()), false);
    assert.equal(data.value, raw);
    assert.equal(data.writes.length, 0);
  }
});

test("transient write failure retains loaded progress and can retry", async () => {
  const data = storage(JSON.stringify(snapshot()));
  const progress = await initProgress({ initialize: portal, getData: () => data });
  const setItem = data.setItem;
  data.setItem = () => { throw { code: "dataLimitExcedeed" }; };
  assert.equal(progress.save(snapshot(600)), false);
  assert.deepEqual(progress.saved, snapshot());
  data.setItem = setItem;
  assert.equal(progress.save(snapshot(600)), true);
  assert.equal(JSON.parse(data.value).meta.best, 600);
});

test("identical snapshots do not create duplicate SDK writes", async () => {
  const data = storage(JSON.stringify(snapshot()));
  const progress = await initProgress({ initialize: portal, getData: () => data });
  progress.save(snapshot());
  progress.save(snapshot(600));
  progress.save(snapshot(600));
  assert.equal(data.writes.length, 1);
});

test("standalone and disabled SDK environments preserve local progress", async () => {
  for (const reason of ["standalone", "disabled"]) {
    const local = storage(JSON.stringify(snapshot()));
    const progress = await initProgress({
      initialize: async () => ({ available: false, reason }),
      getData: () => { throw new Error("Do not use SDK"); },
      getLocal: () => local,
    });
    assert.equal(progress.kind, "local");
    assert.deepEqual(progress.saved, snapshot());
    assert.equal(progress.save(snapshot(700)), true);
    assert.equal(JSON.parse(local.value).meta.best, 700);
  }
});

test("unavailable SDK uses session only and never imports local progress", async () => {
  const progress = await initProgress({
    initialize: async () => ({ available: false, reason: "unavailable" }),
    getLocal: () => { throw new Error("Do not read local"); },
  });
  assert.equal(progress.kind, "session");
  assert.equal(progress.save(snapshot()), false);
});

test("blocked browser storage leaves standalone playable without persistence", async () => {
  const progress = await initProgress({
    initialize: standalone,
    getLocal: () => { throw new Error("Storage blocked"); },
  });
  assert.deepEqual(progress.saved, {});
  assert.equal(progress.save(snapshot()), false);
});

test("corrupt standalone saves can be replaced with a fresh local game", async () => {
  const local = storage("corrupt");
  const progress = await initProgress({ initialize: standalone, getLocal: () => local });
  assert.equal(progress.kind, "local");
  assert.deepEqual(progress.saved, {});
  assert.equal(progress.save(snapshot()), true);
});
