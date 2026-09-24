import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile, unlink, rmdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  newGame,
  getHint,
  placePiece,
  useBloom,
  validateState,
} from "../src/engine.js";

// Record actual UI interactions against a running local build. No overlays or
// fabricated scores: the opening save is reached by playing the engine normally.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "marketing", "videos");
const rawDirectory = path.join(output, "raw");
const base = process.env.PREVIEW_URL || "http://localhost:4173";
const ffmpeg =
  process.env.FFMPEG_PATH ||
  (process.platform === "win32"
    ? "C:/ffmpeg-7.1.1-essentials_build/bin/ffmpeg.exe"
    : "ffmpeg");
const ffprobe =
  process.env.FFPROBE_PATH ||
  (ffmpeg.includes("/") || ffmpeg.includes("\\")
    ? path.join(
        path.dirname(ffmpeg),
        process.platform === "win32" ? "ffprobe.exe" : "ffprobe",
      )
    : "ffprobe");

function command(executable, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { windowsHide: true });
    let stdout = "",
      stderr = "";
    child.stdout.on("data", (data) => {
      stdout += data;
    });
    child.stderr.on("data", (data) => {
      stderr += data;
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve(stdout)
        : reject(new Error(`${executable} exited ${code}: ${stderr}`)),
    );
  });
}

function playedOpening() {
  let state = newGame({ seed: 42 });
  for (let i = 0; i < 34; i++) {
    const hint = getHint(state);
    assert.ok(hint, "The recorded opening must be reachable.");
    state = placePiece(state, hint.index, hint.x, hint.y).state;
  }
  assert.equal(validateState(state), true);
  return state;
}

function bestBloom(state) {
  let best;
  for (let y = 1; y < 7; y++)
    for (let x = 1; x < 7; x++) {
      const result = useBloom(state, x, y);
      if (result.valid && (!best || result.cleared.length > best.count))
        best = { x, y, count: result.cleared.length };
    }
  return best;
}

await mkdir(rawDirectory, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || "msedge",
  headless: true,
});
const previews = [];
try {
  for (const format of [
    {
      name: "landscape",
      viewport: { width: 1920, height: 1080 },
      export: { width: 1920, height: 1080 },
    },
    // A phone CSS viewport preserves the real mobile layout; export at 2x.
    {
      name: "portrait",
      viewport: { width: 540, height: 960 },
      export: { width: 1080, height: 1920 },
    },
  ]) {
    let expected = playedOpening();
    const openingScore = expected.score;
    const save = {
      version: 1,
      meta: {
        best: expected.score,
        flowers: expected.flowers,
        sound: false,
        theme: "meadow",
        tutorialSeen: true,
      },
      sessions: { classic: { state: expected, undos: 3 } },
    };
    const context = await browser.newContext({
      viewport: format.viewport,
      recordVideo: { dir: rawDirectory, size: format.viewport },
      colorScheme: "light",
    });
    await context.addInitScript(
      (data) => localStorage.setItem("grove-blocks-v1", JSON.stringify(data)),
      save,
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const video = page.video();
    await page.goto(base, { waitUntil: "networkidle" });
    await page.locator("#board .cell").last().waitFor();
    const snapshot = () =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("grove-blocks-v1")).sessions.classic
            .state,
      );
    assert.deepEqual(await snapshot(), expected);
    // Let the browser's initial video frame and hover transitions settle before
    // the exported opening. The pointer leaves the UI before gameplay begins.
    await page.locator("#hint").hover();
    await page.waitForTimeout(150);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(1600);

    let clearedLines = 0;
    for (let i = 0; i < 12; i++) {
      const hint = getHint(expected);
      assert.ok(hint, "Every recorded placement must be legal.");
      const piece = expected.tray[hint.index];
      const slot = await page
        .locator(`[data-piece="${hint.index}"]`)
        .boundingBox();
      const targetX =
        hint.x +
        Math.floor(Math.max(...piece.cells.map((cell) => cell[0])) / 2);
      const targetY =
        hint.y +
        Math.floor(Math.max(...piece.cells.map((cell) => cell[1])) / 2);
      const target = await page
        .locator(`[data-index="${targetY * 8 + targetX}"]`)
        .boundingBox();
      assert.ok(slot && target);
      await page.mouse.move(slot.x + slot.width / 2, slot.y + slot.height / 2, {
        steps: 6,
      });
      await page.mouse.down();
      await page.waitForTimeout(65);
      await page.mouse.move(
        target.x + target.width / 2,
        target.y + target.height / 2,
        { steps: 15 },
      );
      await page.waitForTimeout(110);
      await page.mouse.up();
      const result = placePiece(expected, hint.index, hint.x, hint.y);
      assert.equal(result.valid, true);
      expected = result.state;
      clearedLines += result.lines;
      assert.deepEqual(
        await snapshot(),
        expected,
        `UI drag ${i + 1} must match the engine.`,
      );
      await page.waitForTimeout(result.lines ? 350 : 200);
    }

    const bloom = bestBloom(expected);
    assert.ok(bloom);
    await page.locator("#bloom").click();
    const patch = await page
      .locator(`[data-index="${bloom.y * 8 + bloom.x}"]`)
      .boundingBox();
    await page.mouse.move(
      patch.x + patch.width / 2,
      patch.y + patch.height / 2,
      { steps: 13 },
    );
    await page.waitForTimeout(350);
    await page.mouse.click(
      patch.x + patch.width / 2,
      patch.y + patch.height / 2,
    );
    expected = useBloom(expected, bloom.x, bloom.y).state;
    assert.deepEqual(await snapshot(), expected);
    await page.mouse.move(format.viewport.width - 24, 40, { steps: 8 });
    await page.waitForTimeout(1300);
    assert.deepEqual(
      errors,
      [],
      "The gameplay recording must contain no runtime errors.",
    );
    await context.close();
    const raw = await video.path();
    const destination = path.join(output, `grove-blocks-${format.name}.mp4`);
    await command(ffmpeg, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-ss",
      "1.7",
      "-i",
      raw,
      "-t",
      "17.8",
      "-vf",
      `scale=${format.export.width}:${format.export.height}:flags=lanczos,fps=30`,
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-an",
      "-movflags",
      "+faststart",
      "-metadata",
      "title=Grove Blocks — Garden Puzzle",
      "-metadata",
      "description=Actual gameplay: twelve legal placements and a charged Bloom.",
      destination,
    ]);
    const probe = JSON.parse(
      await command(ffprobe, [
        "-v",
        "error",
        "-show_streams",
        "-show_format",
        "-of",
        "json",
        destination,
      ]),
    );
    const stream = probe.streams.find((item) => item.codec_type === "video");
    const duration = Number(probe.format.duration);
    assert.equal(stream.codec_name, "h264");
    assert.equal(stream.width, format.export.width);
    assert.equal(stream.height, format.export.height);
    assert.ok(
      duration <= 18 && duration > 10,
      `Unexpected preview length: ${duration}`,
    );
    assert.equal(
      probe.streams.some((item) => item.codec_type === "audio"),
      false,
    );
    for (const [frame, seconds] of [
      ["first", 0],
      ["last", Math.max(0, duration - 0.12)],
    ]) {
      await command(ffmpeg, [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-ss",
        String(seconds),
        "-i",
        destination,
        "-frames:v",
        "1",
        path.join(output, `${format.name}-${frame}.png`),
      ]);
    }
    const metadata = {
      file: path.basename(destination),
      width: stream.width,
      height: stream.height,
      duration,
      codec: stream.codec_name,
      audio: false,
      openingScore,
      closingScore: expected.score,
      placements: 12,
      linesCleared: clearedLines,
      bloomTilesCleared: bloom.count,
      startingMove: 34,
      endingMove: expected.moves,
      seed: 42,
    };
    previews.push(metadata);
    console.log(JSON.stringify(metadata));
    assert.equal(path.dirname(path.resolve(raw)), path.resolve(rawDirectory));
    await unlink(raw);
  }
  await writeFile(
    path.join(output, "metadata.json"),
    `${JSON.stringify(previews, null, 2)}\n`,
  );
  await rmdir(rawDirectory).catch(() => {});
} finally {
  await browser.close();
}
