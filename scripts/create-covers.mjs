import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { newGame, getHint, placePiece } from "../src/engine.js";
import { plantArt } from "../src/art.js";

// All artwork is vector geometry derived from this project's original game art.
// No fonts, stock artwork, or network resources are downloaded while rendering.
const directory = path.resolve("marketing/covers");
await mkdir(directory, { recursive: true });
const colors = [
  "#93b392",
  "#de9a80",
  "#e4bf78",
  "#98b6c5",
  "#b2a2bf",
  "#c5cc91",
];
const seed = 20260926;
let state = newGame({ seed });
for (let i = 0; i < 12; i++) {
  const move = getHint(state);
  if (!move) break;
  state = placePiece(state, move.index, move.x, move.y).state;
}
const hint = getHint(state);

function flower(x, y, size = 1) {
  return `<g transform="translate(${x} ${y}) scale(${size})"><circle cy="-10" r="9" fill="#fff8df"/><circle cy="10" r="9" fill="#fff8df"/><circle cx="-10" r="9" fill="#fff8df"/><circle cx="10" r="9" fill="#fff8df"/><circle r="6" fill="#dca955"/></g>`;
}

function sprig(x, y, scale, rotation = 0, color = "#779679") {
  return `<g transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale})"><path d="M0 145Q-9 70 18 0" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round"/><path d="M1 124C-50 110-46 82-38 78-6 82 7 102 1 124M0 101C38 88 48 65 42 57 14 63 0 79 0 101M5 69C-33 55-35 28-28 24 0 32 13 51 5 69M13 37C42 28 47 7 42 0 22 6 13 23 13 37" fill="${color}"/></g>`;
}

function plant(index, x, y, width, rotation = 0) {
  const geometry = plantArt(index).replace(/<\/?svg[^>]*>/g, "");
  return `<g transform="translate(${x} ${y}) rotate(${rotation}) scale(${width / 104})">${geometry}</g>`;
}

function board(x, y, width, rotation = 0) {
  const tile = 86.25;
  let cells = "";
  for (let i = 0; i < 64; i++) {
    const bx = 20 + (i % 8) * (tile + 10),
      by = 20 + Math.floor(i / 8) * (tile + 10);
    const cell = state.board[i];
    cells += `<rect x="${bx}" y="${by}" width="${tile}" height="${tile}" rx="13" fill="${cell ? colors[cell.color] : "#edf0e4"}"/>`;
    if (cell) {
      cells += `<path d="M${bx + 12} ${by + 3}H${bx + tile - 12}" stroke="#ffffff50" stroke-width="3" stroke-linecap="round"/><path d="M${bx + 12} ${by + tile - 3}H${bx + tile - 12}" stroke="#314d4014" stroke-width="4" stroke-linecap="round"/>`;
      if (cell.flower) cells += flower(bx + tile / 2, by + tile / 2, 1.22);
    } else {
      cells += `<circle cx="${bx + tile / 2}" cy="${by + tile / 2}" r="3.2" fill="#c7d0bb70"/>`;
    }
  }
  if (hint) {
    for (const [dx, dy] of state.tray[hint.index].cells) {
      const bx = 20 + (hint.x + dx) * (tile + 10),
        by = 20 + (hint.y + dy) * (tile + 10);
      cells += `<rect x="${bx + 3}" y="${by + 3}" width="${tile - 6}" height="${tile - 6}" rx="11" fill="#93b39270" stroke="#52775d" stroke-width="3" stroke-dasharray="9 7"/>`;
    }
  }
  return `<g transform="translate(${x} ${y}) rotate(${rotation} ${width / 2} ${width / 2}) scale(${width / 800})"><rect x="-3" y="14" width="806" height="800" rx="36" fill="#bccbb0"/><rect width="800" height="800" rx="34" fill="#dfe5d5" stroke="#c6d4bd" stroke-width="3"/>${cells}</g>`;
}

function piece(x, y, tile = 72, rotation = 0) {
  const p = state.tray[hint?.index ?? 0];
  if (!p) return "";
  return `<g transform="translate(${x} ${y}) rotate(${rotation})" filter="url(#piece-shadow)">${p.cells
    .map(([dx, dy], i) => {
      const bx = dx * (tile + 6),
        by = dy * (tile + 6);
      return `<rect x="${bx}" y="${by + 5}" width="${tile}" height="${tile}" rx="11" fill="#688269"/><rect x="${bx}" y="${by}" width="${tile}" height="${tile}" rx="11" fill="${colors[p.color]}"/><path d="M${bx + 10} ${by + 3}H${bx + tile - 10}" stroke="#ffffff65" stroke-width="3" stroke-linecap="round"/>${i === p.flowerIndex ? flower(bx + tile / 2, by + tile / 2, tile / 75) : ""}`;
    })
    .join("")}</g>`;
}

function title(x, y, size, centered = false, stacked = false) {
  const align = centered ? "middle" : "start";
  if (stacked)
    return `<g fill="#254d3a" font-family="Segoe UI,Arial,sans-serif" text-anchor="${align}"><text x="${x}" y="${y}" font-size="${size}" font-weight="800" letter-spacing="-9">grove</text><text x="${x}" y="${y + size * 0.94}" font-size="${size}" font-weight="350" letter-spacing="-10">blocks</text><text x="${x + 6}" y="${y + size * 1.29}" font-size="${size * 0.14}" font-weight="650" letter-spacing="${size * 0.045}">GARDEN PUZZLE</text></g>`;
  return `<g fill="#254d3a" font-family="Segoe UI,Arial,sans-serif" text-anchor="${align}"><text x="${x}" y="${y}" font-size="${size}" letter-spacing="-5"><tspan font-weight="800">grove</tspan><tspan font-weight="350"> blocks</tspan></text><text x="${x}" y="${y + size * 0.47}" font-size="${size * 0.205}" font-weight="650" letter-spacing="${size * 0.06}">GARDEN PUZZLE</text></g>`;
}

function cover(width, height, kind) {
  const landscape = kind === "landscape";
  const portrait = kind === "portrait";
  const composition = landscape
    ? `
    <ellipse cx="1320" cy="500" rx="615" ry="640" fill="#e8edda"/>
    <ellipse cx="1200" cy="1060" rx="950" ry="165" fill="#d9e1c8"/>
    <circle cx="1635" cy="165" r="83" fill="#e6ce8b"/>
    ${sprig(80, 135, 1.9, -30, "#adc09b")}
    ${sprig(1805, 495, 2.15, 20, "#809c78")}
    ${title(170, 355, 210, false, true)}
    ${plant(5, 130, 743, 190, -7)}${plant(0, 340, 805, 135, 3)}${plant(2, 515, 750, 184, 7)}
    <g filter="url(#board-shadow)">${board(920, 115, 800, -6)}</g>
    ${piece(875, 815, 64, 8)}
    ${plant(8, 1630, 790, 225, 4)}
    ${flower(828, 260, 1.2)}${flower(715, 795, 0.85)}
  `
    : portrait
      ? `
    <ellipse cx="660" cy="490" rx="510" ry="600" fill="#e8edda"/>
    <ellipse cx="440" cy="1200" rx="720" ry="180" fill="#d9e1c8"/>
    <circle cx="652" cy="320" r="56" fill="#e6ce8b"/>
    ${sprig(74, 65, 1.25, -30, "#afc09c")}
    ${title(400, 162, 108, true)}
    ${sprig(740, 730, 1.65, 20, "#92aa85")}
    <g filter="url(#board-shadow)">${board(71, 334, 650, -5)}</g>
    ${plant(5, 5, 937, 180, -8)}${plant(8, 612, 960, 170, 5)}
    ${piece(313, 1003, 55, 4)}
    ${flower(157, 293, 1.25)}${flower(718, 280, 0.8)}
  `
      : `
    <ellipse cx="690" cy="430" rx="550" ry="565" fill="#e8edda"/>
    <ellipse cx="370" cy="825" rx="610" ry="150" fill="#d9e1c8"/>
    <circle cx="686" cy="217" r="40" fill="#e6ce8b"/>
    ${sprig(51, 8, 0.9, -35, "#afc09c")}
    ${title(400, 125, 98, true)}
    <g filter="url(#board-shadow)">${board(169, 257, 475, -6)}</g>
    ${sprig(740, 395, 1.2, 22, "#92aa85")}
    ${plant(2, 20, 568, 177, -8)}${plant(5, 631, 581, 161, 6)}
    ${piece(578, 647, 39, 11)}
    ${flower(120, 300, 0.95)}${flower(711, 321, 0.7)}
  `;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><pattern id="paper" width="13" height="13" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".85" fill="#496b3920"/></pattern><filter id="board-shadow" x="-25%" y="-25%" width="160%" height="170%"><feDropShadow dx="0" dy="24" stdDeviation="20" flood-color="#45613c" flood-opacity=".16"/></filter><filter id="piece-shadow" x="-30%" y="-30%" width="170%" height="190%"><feDropShadow dx="0" dy="9" stdDeviation="7" flood-color="#3c563b" flood-opacity=".18"/></filter></defs><rect width="100%" height="100%" fill="#f6f4e9"/><rect width="100%" height="100%" fill="url(#paper)"/>${composition}</svg>`;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Grove Blocks — ${kind} cover</title><style>html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:#f6f4e9}svg{display:block}</style>${svg}</html>`;
}

const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  for (const [kind, width, height] of [
    ["landscape", 1920, 1080],
    ["portrait", 800, 1200],
    ["square", 800, 800],
  ]) {
    const html = cover(width, height, kind);
    const stem = `grove-blocks-${kind}-${width}x${height}`;
    await writeFile(path.join(directory, `${stem}.html`), html);
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 1,
    });
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: path.join(directory, `${stem}.png`),
      fullPage: false,
    });
    await page.close();
    console.log(`Created ${stem}.png`);
  }
  await writeFile(
    path.join(directory, "README.md"),
    `# Grove Blocks covers\n\nOriginal vector promotional artwork generated from the game's palette, plant illustrations and a real board state after ${state.moves} placements (seed ${seed}). The dashed shape is a legal next-placement preview; the floating piece matches it.\n\n- Landscape: 1920 × 1080 PNG\n- Portrait: 800 × 1200 PNG\n- Square: 800 × 800 PNG\n\nRegenerate from the repository root with \`node scripts/create-covers.mjs\`. Rendering uses the installed Microsoft Edge through Playwright. The HTML files are self-contained vector sources, with no external assets or fonts.\n\nCover lettering contains only the game title and its descriptive subtitle, Garden Puzzle. These assets do not include the gameplay preview videos required separately by CrazyGames.\n`,
  );
} finally {
  await browser.close();
}
