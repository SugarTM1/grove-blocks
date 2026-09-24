import { initPlatform, getDataStorage } from "./platform.js";

export const SAVE_KEY = "grove-blocks-v1";

function parseSave(raw) {
  const value = JSON.parse(raw);
  if (
    !value || value.version !== 1 ||
    !value.meta || typeof value.meta !== "object" || Array.isArray(value.meta) ||
    !value.sessions || typeof value.sessions !== "object" || Array.isArray(value.sessions)
  ) throw new Error("Unrecognized save format");
  return value;
}

/** Choose one storage backend before the game can read or change progress. */
export async function initProgress({
  initialize = initPlatform,
  getData = getDataStorage,
  getLocal = () => window.localStorage,
} = {}) {
  const platform = await initialize();
  let storage = null;
  let kind = "session";
  let saved = {};
  let lastSaved = null;
  try {
    if (platform.available) {
      storage = getData();
      kind = "crazygames";
    } else if (["standalone", "disabled"].includes(platform.reason)) {
      storage = getLocal();
      kind = "local";
    }
    if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
      throw new Error("Progress storage unavailable");
    }
    // A failed read must never be followed by writing a new game over cloud data.
    const raw = storage.getItem(SAVE_KEY);
    if (raw !== null) {
      try {
        saved = parseSave(raw);
        lastSaved = raw;
      } catch (error) {
        if (kind === "crazygames") throw error;
      }
    }
  } catch {
    storage = null;
    kind = "session";
  }
  return {
    saved,
    kind,
    save(value) {
      if (!storage) return false;
      try {
        const raw = JSON.stringify(value);
        if (raw !== lastSaved) storage.setItem(SAVE_KEY, raw);
        lastSaved = raw;
        return true;
      } catch {
        return false;
      }
    },
  };
}
