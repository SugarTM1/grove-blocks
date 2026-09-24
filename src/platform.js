const SDK_URL = "https://sdk.crazygames.com/crazygames-sdk-v3.js";
const TIMEOUT_MS = 4000;

let sdk = null;
let initialization = null;
let wantsToPlay = false;
let reportedPlaying = false;

function isCrazyGamesHost(hostname) {
  return /(^|\.)(crazygames\.com|crazygames-cdn\.com)$/i.test(hostname);
}

function shouldLoadPlatform() {
  if (typeof window === "undefined" || typeof document === "undefined")
    return false;
  if (new URLSearchParams(window.location.search).get("crazygames") === "true")
    return true;
  if (isCrazyGamesHost(window.location.hostname)) return true;
  try {
    return isCrazyGamesHost(new URL(document.referrer).hostname);
  } catch {
    return false;
  }
}

function withTimeout(promise, onTimeout = () => {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      onTimeout();
      reject(new Error("CrazyGames initialization timed out"));
    }, TIMEOUT_MS);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function loadScript() {
  if (window.CrazyGames?.SDK) return;
  const script = document.createElement("script");
  script.src = SDK_URL;
  script.async = true;
  const loaded = new Promise((resolve, reject) => {
    script.onload = resolve;
    script.onerror = () =>
      reject(new Error("CrazyGames SDK could not be loaded"));
    document.head.appendChild(script);
  });
  try {
    await withTimeout(loaded, () => script.remove());
  } finally {
    script.onload = null;
    script.onerror = null;
  }
}

function callGame(method) {
  if (typeof sdk?.game?.[method] !== "function") return false;
  try {
    // v3 events can be synchronous; also consume any rejected promise safely.
    Promise.resolve(sdk.game[method]()).catch(() => {});
    return true;
  } catch {
    // A portal connection failure must never interrupt the puzzle.
    return false;
  }
}

function syncPlaying() {
  if (!sdk || reportedPlaying === wantsToPlay) return;
  if (callGame(wantsToPlay ? "gameplayStart" : "gameplayStop")) {
    reportedPlaying = wantsToPlay;
  }
}

/** Optional portal integration. Standalone play never requests an external SDK. */
export function initPlatform() {
  if (initialization) return initialization;
  initialization = (async () => {
    if (!shouldLoadPlatform())
      return { available: false, reason: "standalone" };
    try {
      await loadScript();
      const candidate = window.CrazyGames?.SDK;
      if (typeof candidate?.init !== "function")
        throw new Error("CrazyGames v3 SDK missing");
      await withTimeout(candidate.init());
      if (candidate.environment === "disabled")
        return { available: false, reason: "disabled" };
      sdk = candidate;
      callGame("loadingStart");
      // The game has no deferred asset downloads. The local UI is ready now.
      callGame("loadingStop");
      syncPlaying();
      return {
        available: true,
        environment: candidate.environment ?? "unknown",
      };
    } catch {
      sdk = null;
      return { available: false, reason: "unavailable" };
    }
  })();
  return initialization;
}

/** Report actual play/menu transitions, not browser visibility or focus changes. */
export function setPlaying(playing) {
  wantsToPlay = Boolean(playing);
  syncPlaying();
}

/** Call sparingly for a meaningful achievement such as a new personal best. */
export function celebrate() {
  callGame("happytime");
}

/** Only available after initPlatform has completed successfully. */
export function getDataStorage() {
  return sdk?.data ?? null;
}
