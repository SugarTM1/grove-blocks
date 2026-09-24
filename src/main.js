import {
  SIZE,
  newGame,
  canPlace,
  findLines,
  placePiece,
  useBloom,
  getHint,
  validateState,
} from "./engine.js";
import { setPlaying, celebrate } from "./platform.js";
import { initProgress } from "./progress.js";
import { icon, plants, plantArt, gardenArt } from "./art.js";

// SDK initialization preloads account data. Do not create/save a game before it.
const progress = await initProgress();
const today = () => new Date().toISOString().slice(0, 10);
const num = (n) => Math.round(n).toLocaleString("en-US");
const defaults = {
  best: 0,
  flowers: 0,
  sound: true,
  theme: "meadow",
  tutorialSeen: false,
  dailyBest: { date: today(), score: 0 },
};
const saved = progress.saved;
let meta = { ...defaults };
if (saved.version === 1 && saved.meta) {
  for (const k of ["best", "flowers"])
    if (Number.isFinite(saved.meta[k]) && saved.meta[k] >= 0)
      meta[k] = Math.floor(saved.meta[k]);
  if (typeof saved.meta.sound === "boolean") meta.sound = saved.meta.sound;
  if (typeof saved.meta.tutorialSeen === "boolean")
    meta.tutorialSeen = saved.meta.tutorialSeen;
  if (["meadow", "dusk", "terracotta"].includes(saved.meta.theme))
    meta.theme = saved.meta.theme;
  if (
    saved.meta.dailyBest?.date === today() &&
    Number.isFinite(saved.meta.dailyBest.score) &&
    saved.meta.dailyBest.score >= 0
  )
    meta.dailyBest = { ...saved.meta.dailyBest };
}
let sessions = {};
for (const mode of ["classic", "daily"]) {
  const s = saved.sessions?.[mode];
  if (
    validateState(s?.state) &&
    s.state.mode === mode &&
    (mode !== "daily" || s.state.dailyDate === today())
  )
    sessions[mode] = {
      state: s.state,
      undos: Number.isInteger(s.undos) ? Math.max(0, Math.min(3, s.undos)) : 3,
    };
}
let mode = "classic";
sessions.classic ??= { state: newGame(), undos: 3 };
let state = sessions.classic.state;
let selected = -1,
  preview = null,
  bloomMode = false,
  undo = null,
  drag = null,
  modalOpen = false,
  locked = false,
  audioCtx,
  toastTimer,
  overTimer,
  pendingResults = false,
  celebrated = false;
const app = document.querySelector("#app");
app.innerHTML = `
 <header class="header"><a class="brand" href="#" aria-label="Grove Blocks home"><img src="./public/icon.svg" alt=""/><span>grove<span class="brand-light"> blocks</span><small>A LITTLE PUZZLE. A GROWING GARDEN.</small></span></a><div class="header-actions"><span class="saved-label">${icon("check")} Progress saved</span><button class="icon-button" id="compact-garden" title="Your garden" aria-label="Your garden">${icon("flower")}</button><button class="icon-button" id="sound" title="Toggle sound" aria-label="Turn sound off"></button><button class="icon-button" id="help" title="How to play" aria-label="How to play">${icon("help")}</button></div></header>
 <main class="layout">
  <aside class="garden-sidebar"><div class="eyebrow">MAKE ROOM FOR GOOD THINGS</div><h1>A little space<br>to <em>grow.</em></h1><p>Find your flow. Clear a line.<br>Let something lovely bloom.</p><div id="garden-preview"></div><div class="collection-caption"><span>YOUR LITTLE GARDEN</span><b id="collection-count"></b></div><div class="garden-progress"><span id="garden-progress-fill"></span></div><p class="next-plant" id="next-plant"></p><button id="garden" class="text-button">Visit your garden ${icon("arrow")}</button><div class="sidebar-note">${icon("leaf")} A quiet moment, just for you.</div></aside>
  <section class="play-area" aria-label="Grove Blocks game">
   <div class="mode-tabs" role="group" aria-label="Game mode"><button id="classic-tab" class="active">${icon("leaf")} Classic</button><button id="daily-tab">${icon("sun")} Daily garden <span class="new-dot"></span></button></div>
   <div class="scoreboard"><div><span class="eyebrow" id="score-label">YOUR SCORE</span><strong id="score">0</strong></div><div id="combo" class="combo-badge">Take your time</div><div class="best-score"><span class="eyebrow">${icon("trophy")} <span id="best-label">PERSONAL BEST</span></span><strong id="best">0</strong></div></div>
   <div class="board-wrap"><div id="board" class="board" role="grid" aria-label="8 by 8 puzzle board. Select a piece, use arrow keys and press Enter to place." tabindex="0"></div><div class="board-message" id="board-message"></div></div>
   <div class="tray" id="tray" aria-label="Available pieces"></div>
   <div class="instruction" id="instruction">Drag a piece onto the board, or tap a piece then a square.</div>
   <div class="game-tools"><button id="undo" class="tool-button">${icon("undo")}<span>Undo <small id="undo-count">3</small></span></button><button id="hint" class="tool-button">${icon("hint")}<span>Hint</span></button><button id="bloom" class="tool-button bloom-button">${icon("flower")}<span>Bloom <small id="bloom-count">0/8</small></span></button><button id="restart" class="tool-button" title="Start a new game">${icon("refresh")}<span>New</span></button></div>
   <button id="mobile-garden" class="mobile-garden">${icon("flower")}<span id="mobile-garden-text">Your garden</span>${icon("arrow")}</button>
  </section>
  <aside class="details-sidebar"><div class="season-label"><span></span> THE MEADOW COLLECTION</div><div class="bloom-card"><div class="bloom-icon">${icon("flower")}</div><h2>A little flower power.</h2><p>Clear flower tiles to charge a bloom. Then clear a 3 × 3 patch to make room.</p><div class="bloom-dots" id="bloom-dots"></div><span class="bloom-status" id="bloom-status">0 of 8 flowers</span></div><div class="tip-card"><span class="eyebrow">A SEED OF ADVICE</span><p id="tip">Clear a row and a column together for a lovely score boost.</p><div class="tiny-grid"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div><div class="daily-note">${icon("calendar")}<div><b>A fresh start, every day</b><p>The daily garden gives everyone the same 30-move puzzle.</p></div></div></aside>
 </main><footer class="footer"><span>MADE FOR YOUR MOMENT OF CALM</span><span>Place. Clear. Bloom.</span></footer>
 <div class="toast" id="toast" role="status"></div><div id="drag-ghost" class="drag-ghost" aria-hidden="true"></div>
 <dialog id="dialog" aria-labelledby="dialog-title"><div id="dialog-content"></div></dialog>`;
const $ = (s) => document.querySelector(s);
const board = $("#board"),
  tray = $("#tray"),
  dialog = $("#dialog");
for (let i = 0; i < 64; i++) {
  const cell = document.createElement("button");
  cell.className = "cell";
  cell.dataset.index = i;
  cell.tabIndex = -1;
  cell.setAttribute("role", "gridcell");
  board.append(cell);
}
const cells = [...board.children];
function flowerMarkup() {
  return '<span class="tile-flower" aria-hidden="true"><i></i><i></i><i></i><i></i><b></b></span>';
}
function pieceMarkup(piece, mini = false) {
  const w = Math.max(...piece.cells.map((p) => p[0])) + 1,
    h = Math.max(...piece.cells.map((p) => p[1])) + 1;
  return `<div class="piece-shape ${mini ? "mini" : ""}" style="--pw:${w};--ph:${h}">${piece.cells.map(([x, y], i) => `<span class="piece-tile color-${piece.color}" style="grid-column:${x + 1};grid-row:${y + 1}">${i === piece.flowerIndex ? flowerMarkup() : ""}</span>`).join("")}</div>`;
}
function save() {
  sessions[mode] = { state, undos: sessions[mode].undos };
  const saved = progress.save({ version: 1, meta, sessions });
  $(".saved-label").innerHTML = saved
    ? `${icon("check")} Progress saved`
    : "Session only";
}
function fitTray() {
  for (const slot of tray.children) {
    const shape = slot.querySelector(".piece-shape");
    if (!shape) continue;
    const w = Number(shape.style.getPropertyValue("--pw")),
      h = Number(shape.style.getPropertyValue("--ph"));
    shape.style.setProperty(
      "--tile",
      Math.max(
        4,
        Math.min(
          32,
          (slot.clientWidth - 20 - (w - 1) * 3) / w,
          (slot.clientHeight - 20 - (h - 1) * 3) / h,
        ),
      ) + "px",
    );
  }
}
new ResizeObserver(fitTray).observe(tray);
function render() {
  document.body.dataset.theme = meta.theme;
  state.board.forEach((c, i) => {
    cells[i].className = "cell" + (c ? ` filled color-${c.color}` : "");
    cells[i].innerHTML = c?.flower ? flowerMarkup() : "";
    cells[i].setAttribute(
      "aria-label",
      `Row ${Math.floor(i / 8) + 1}, column ${(i % 8) + 1}, ${c ? (c.flower ? "flower tile" : "occupied") : "empty"}`,
    );
  });
  tray.innerHTML = state.tray
    .map(
      (p, i) =>
        `<button class="piece-slot ${selected === i ? "selected" : ""} ${p ? "" : "used"}" data-piece="${i}" ${p ? "" : "disabled"} aria-label="${p ? `Piece ${i + 1}, ${p.cells.length} blocks. Select to place.` : "Piece placed"}" aria-pressed="${selected === i}">${p ? pieceMarkup(p) : icon("check")}<span class="piece-key">${i + 1}</span></button>`,
    )
    .join("");
  $("#score").textContent = num(state.score);
  $("#best").textContent = num(
    mode === "daily"
      ? meta.dailyBest.date === state.dailyDate
        ? meta.dailyBest.score
        : 0
      : meta.best,
  );
  $("#score-label").textContent =
    mode === "daily" ? `DAILY · ${state.moves}/30 MOVES` : "YOUR SCORE";
  $("#best-label").textContent =
    mode === "daily" ? "TODAY’S BEST" : "PERSONAL BEST";
  $("#combo").textContent =
    state.combo > 1
      ? `${state.combo}× streak`
      : mode === "daily"
        ? `${30 - state.moves} moves left`
        : "Take your time";
  $("#combo").classList.toggle("hot", state.combo > 1);
  $("#undo-count").textContent = sessions[mode].undos;
  $("#undo").disabled = !undo || sessions[mode].undos === 0;
  $("#bloom-count").textContent = `${state.bloom}/8`;
  $("#bloom").disabled = state.bloom < 8 || state.over;
  $("#bloom").classList.toggle("ready", state.bloom >= 8);
  $("#bloom").classList.toggle("active", bloomMode);
  $("#hint").disabled = state.over;
  $("#bloom-dots").innerHTML = Array.from(
    { length: 8 },
    (_, i) => `<i class="${i < state.bloom ? "charged" : ""}"></i>`,
  ).join("");
  $("#bloom-status").textContent =
    state.bloom >= 8 ? "Ready to bloom!" : `${state.bloom} of 8 flowers`;
  $("#sound").innerHTML = icon(meta.sound ? "sound" : "mute");
  $("#sound").setAttribute(
    "aria-label",
    meta.sound ? "Turn sound off" : "Turn sound on",
  );
  for (const m of ["classic", "daily"]) {
    $(`#${m}-tab`).classList.toggle("active", mode === m);
    $(`#${m}-tab`).setAttribute("aria-pressed", mode === m);
  }
  const unlocked = plants.filter((p) => meta.flowers >= p.need).length,
    next = plants[unlocked],
    prev = plants[unlocked - 1];
  $("#garden-preview").innerHTML = gardenArt(unlocked);
  $("#collection-count").textContent = `${unlocked} / 9`;
  $("#garden-progress-fill").style.width =
    (next
      ? Math.min(
          100,
          ((meta.flowers - prev.need) / (next.need - prev.need)) * 100,
        )
      : 100) + "%";
  $("#next-plant").textContent = next
    ? `${next.need - meta.flowers} flowers until ${next.name.toLowerCase()}`
    : "Your whole garden is in bloom.";
  $("#mobile-garden-text").textContent = `Your garden · ${unlocked}/9 plants`;
  fitTray();
  updateInstruction();
  renderPreview();
}
function updateInstruction(text) {
  $("#instruction").textContent =
    text ||
    (bloomMode
      ? "Choose a patch to bloom. Clears 3 × 3 tiles."
      : selected >= 0
        ? "Tap to place. The whole piece snaps inside the edges."
        : !meta.tutorialSeen && mode === "classic"
          ? "Try the 3-block piece in the gap on the bottom row."
          : "Drag a piece onto the board, or tap a piece then a square.");
}
function renderPreview() {
  board.classList.toggle("previewing", selected >= 0 || bloomMode);
  cells.forEach((c) =>
    c.classList.remove("ghost", "invalid", "will-clear", "bloom-preview"),
  );
  preview = placementPosition(preview);
  if (!preview) return;
  if (bloomMode) {
    for (let y = preview.y - 1; y <= preview.y + 1; y++)
      for (let x = preview.x - 1; x <= preview.x + 1; x++)
        if (x >= 0 && x < 8 && y >= 0 && y < 8)
          cells[y * 8 + x].classList.add("bloom-preview");
    return;
  }
  const piece = state.tray[selected];
  if (!piece) return;
  const valid = canPlace(state.board, piece, preview.x, preview.y),
    copy = [...state.board];
  for (const [px, py] of piece.cells) {
    const x = preview.x + px,
      y = preview.y + py;
    if (x >= 0 && x < 8 && y >= 0 && y < 8) {
      cells[y * 8 + x].classList.add(valid ? "ghost" : "invalid");
      if (valid) copy[y * 8 + x] = { color: piece.color, flower: false };
    }
  }
  if (valid) {
    const f = findLines(copy);
    for (const i of f.cells) cells[i].classList.add("will-clear");
  }
}
function selectPiece(i) {
  if (state.over || locked || !state.tray[i]) return;
  selected = i;
  bloomMode = false;
  preview = null;
  render();
  sound("pick");
}
function place(x, y) {
  if (locked || state.over) return;
  const target = placementPosition({ x, y });
  if (!target) return;
  ({ x, y } = target);
  const previous = structuredClone(state),
    previousFlowers = meta.flowers;
  const result = bloomMode
    ? useBloom(state, x, y)
    : placePiece(state, selected, x, y);
  if (!result.valid) {
    sound("invalid");
    board.classList.remove("shake");
    void board.offsetWidth;
    board.classList.add("shake");
    announce(
      bloomMode
        ? "Choose a patch with tiles."
        : "That piece does not fit there.",
    );
    return;
  }
  const wasBloom = bloomMode;
  undo = { state: previous, flowers: previousFlowers };
  state = result.state;
  meta.flowers += result.flowers;
  meta.tutorialSeen = true;
  if (mode === "classic") meta.best = Math.max(meta.best, state.score);
  else {
    if (meta.dailyBest.date !== state.dailyDate)
      meta.dailyBest = { date: state.dailyDate, score: 0 };
    meta.dailyBest.score = Math.max(meta.dailyBest.score, state.score);
  }
  selected = -1;
  preview = null;
  bloomMode = false;
  if (result.cleared.length) {
    particles(result.cleared);
    sound(wasBloom ? "bloom" : "clear");
    const msg = wasBloom
      ? "Room to grow"
      : result.lines > 1
        ? `${result.lines} lines! +${num(result.points)}`
        : `Lovely! +${num(result.points)}`;
    boardMessage(msg);
    if (result.lines > 1 && !celebrated) {
      celebrate();
      celebrated = true;
    }
  } else sound("place");
  const newPlant = plants.find(
    (p) => p.need > previousFlowers && p.need <= meta.flowers,
  );
  if (newPlant) notify(`${newPlant.name} is growing in your garden!`);
  save();
  render();
  announce(
    `${state.score} points. ${result.lines ? `${result.lines} lines cleared.` : ""} ${mode === "daily" ? `${30 - state.moves} moves left.` : ""}`,
  );
  if (state.over) {
    pendingResults = true;
    setPlaying(false);
    overTimer = setTimeout(showGameOver, 650);
  }
}
function sound(type) {
  if (!meta.sound || document.hidden) return;
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    const notes = {
      pick: [392],
      place: [330, 440],
      clear: [523, 659, 784],
      bloom: [392, 523, 659, 1047],
      invalid: [165],
      win: [523, 659, 784, 1047],
    }[type] || [440];
    notes.forEach((f, i) => {
      const o = audioCtx.createOscillator(),
        g = audioCtx.createGain(),
        t = audioCtx.currentTime + i * 0.06;
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.045, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start(t);
      o.stop(t + 0.25);
    });
  } catch {}
}
function particles(indices) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (const i of indices) {
    const r = cells[i].getBoundingClientRect();
    for (let j = 0; j < 3; j++) {
      const p = document.createElement("span");
      p.className = "particle";
      p.style.cssText = `left:${r.x + r.width / 2}px;top:${r.y + r.height / 2}px;--dx:${(Math.random() - 0.5) * 110}px;--dy:${-25 - Math.random() * 80}px;--rot:${Math.random() * 280}deg;background:${["#e5ba70", "#88ac88", "#db947e"][j]}`;
      document.body.append(p);
      setTimeout(() => p.remove(), 850);
    }
  }
}
function boardMessage(text) {
  const el = $("#board-message");
  el.textContent = text;
  el.classList.remove("show");
  void el.offsetWidth;
  el.classList.add("show");
}
function announce(text) {
  $("#announcer").textContent = text;
}
function notify(text) {
  clearTimeout(toastTimer);
  $("#toast").textContent = text;
  $("#toast").classList.add("visible");
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 3200);
}
function openModal(html) {
  cancelDrag();
  modalOpen = true;
  setPlaying(false);
  $("#dialog-content").innerHTML = html;
  dialog.showModal();
}
function closeModal() {
  dialog.close();
  modalOpen = false;
  setPlaying(!state.over);
  if (pendingResults && state.over) overTimer = setTimeout(showGameOver, 0);
}
function modalHeader(kicker, title) {
  return `<button class="modal-close icon-button" data-action="close" aria-label="Close">${icon("close")}</button><div class="eyebrow">${kicker}</div><h2 id="dialog-title">${title}</h2>`;
}
function showGarden() {
  const count = plants.filter((p) => meta.flowers >= p.need).length;
  openModal(
    `${modalHeader("YOUR LITTLE GARDEN", "Good things take a little growing.")}<p class="modal-intro">${num(meta.flowers)} flowers collected · ${count} of 9 plants grown.<br>Clear flower tiles to bring your next plant to life.</p><div class="plant-collection">${plants.map((p, i) => `<div class="plant-card ${meta.flowers >= p.need ? "unlocked" : "plant-locked"}">${plantArt(i)}<b>${p.name}</b><span>${meta.flowers >= p.need ? "Grown with care" : `${p.need} flowers`}</span></div>`).join("")}</div><div class="theme-picker"><span class="eyebrow">YOUR PALETTE</span>${[
      ["meadow", "Meadow", 0],
      ["terracotta", "Clay", 40],
      ["dusk", "Dusk", 120],
    ]
      .map(
        ([t, label, need]) =>
          `<button data-theme="${t}" ${meta.flowers < need ? "disabled" : ""} class="theme-chip ${meta.theme === t ? "chosen" : ""}"><i class="swatch ${t}"></i>${label} ${meta.flowers < need ? `· ${need} ${icon("lock")}` : meta.theme === t ? icon("check") : ""}</button>`,
      )
      .join("")}</div>`,
  );
}
function showHelp() {
  openModal(
    `${modalHeader("A MOMENT TO FIND YOUR FLOW", "Place. Clear. Bloom.")}<div class="help-steps"><div><b>01</b><p><strong>Make yourself some space.</strong>Drag a piece onto the 8 × 8 board. Or tap a piece, then tap the area where you want it. Near an edge, the whole piece snaps inside the board. Pieces cannot rotate.</p></div><div><b>02</b><p><strong>A full line is a fresh start.</strong>Fill a row or column to clear it. Clear several lines together, or on consecutive moves, for bonus points.</p></div><div><b>03</b><p><strong>Let your garden grow.</strong>Clear tiles with a flower to collect them. Every 8 flowers charges Bloom: choose a 3 × 3 patch to clear. Bloom earns no points.</p></div></div><p class="help-detail"><b>Classic:</b> keep growing until no piece fits and no Bloom is ready. Three undos per game; hints are always free.<br><b>Daily:</b> the same seeded puzzle for everyone, 30 placements. Replays are welcome. A new garden arrives at midnight UTC.</p><p class="keyboard-help">Keyboard: <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> select · arrows aim · <kbd>Enter</kbd> place · <kbd>B</kbd> bloom · <kbd>H</kbd> hint · <kbd>U</kbd> undo</p><button class="primary-button" data-action="close">Let’s grow ${icon("arrow")}</button>`,
  );
}
function showGameOver() {
  if (!state.over || modalOpen) return;
  pendingResults = false;
  const complete = mode === "daily" && state.moves >= 30;
  openModal(
    `${modalHeader(complete ? "DAILY GARDEN COMPLETE" : "EVERY GARDEN HAS A NEW BEGINNING", complete ? "A lovely day’s growing." : "Room for a fresh start.")}<div class="result-art">${plantArt(Math.min(8, plants.filter((p) => meta.flowers >= p.need).length - 1))}</div><div class="result-score">${num(state.score)}<span>POINTS GROWN</span></div><div class="result-stats"><span><b>${state.lines}</b> lines cleared</span><span><b>${state.flowers}</b> flowers picked</span></div><p class="modal-intro">${complete ? "Come back tomorrow for a new puzzle, or replay today to improve your personal best." : "No more pieces fit. Your flowers are safe in your garden."}</p><button class="primary-button" data-action="play-again">${mode === "daily" ? "Replay this garden" : "Plant a new game"} ${icon("arrow")}</button>${undo && sessions[mode].undos > 0 ? '<button class="text-button centered" data-action="undo-end">Undo the last move</button>' : ""}<button class="text-button centered" data-action="end-switch">${mode === "daily" ? "Return to Classic" : "Try the daily garden"}</button>`,
  );
  sound("win");
}
function startNew() {
  clearTimeout(overTimer);
  pendingResults = false;
  celebrated = false;
  state = newGame({ mode, date: today() });
  sessions[mode] = { state, undos: 3 };
  undo = null;
  selected = -1;
  preview = null;
  bloomMode = false;
  save();
  render();
  setPlaying(true);
}
function switchMode(next) {
  if (next === mode) return;
  clearTimeout(overTimer);
  pendingResults = false;
  celebrated = false;
  cancelDrag();
  save();
  mode = next;
  if (
    !sessions[mode] ||
    (mode === "daily" && sessions.daily.state.dailyDate !== today())
  )
    sessions[mode] = { state: newGame({ mode, date: today() }), undos: 3 };
  state = sessions[mode].state;
  undo = null;
  selected = -1;
  preview = null;
  bloomMode = false;
  render();
  save();
  setPlaying(!state.over);
  if (state.over) showGameOver();
  else if (mode === "daily")
    notify("30 moves. One shared puzzle. Make every piece count.");
}
function doUndo() {
  if (!undo || sessions[mode].undos <= 0) return;
  clearTimeout(overTimer);
  pendingResults = false;
  state = undo.state;
  meta.flowers = undo.flowers;
  undo = null;
  sessions[mode].undos--;
  if (
    (meta.flowers < 40 && meta.theme === "terracotta") ||
    (meta.flowers < 120 && meta.theme === "dusk")
  )
    meta.theme = "meadow";
  selected = -1;
  preview = null;
  bloomMode = false;
  save();
  render();
  setPlaying(!state.over);
  sound("pick");
  notify("One move back. A fresh possibility.");
}
function hint() {
  if (state.over) return;
  const h = getHint(state);
  if (!h) {
    if (state.bloom >= 8) {
      bloomMode = true;
      selected = -1;
      preview = { x: 3, y: 3 };
      render();
      notify("Use your charged Bloom to open a patch.");
    }
    return;
  }
  selected = h.index;
  bloomMode = false;
  preview = { x: h.x, y: h.y };
  render();
  updateInstruction(
    "A little nudge: place the selected piece in the glowing patch.",
  );
}
function toggleBloom() {
  if (state.bloom < 8 || state.over) return;
  bloomMode = !bloomMode;
  selected = -1;
  preview = null;
  render();
}
function cancelDrag() {
  drag = null;
  $("#drag-ghost").innerHTML = "";
  $("#drag-ghost").style.display = "none";
  board.classList.remove("dragging");
}
// All input methods share the same whole-piece footprint. Near an edge, shift
// the origin just enough to keep every tile inside, without searching for gaps.
function placementPosition(position) {
  if (!position) return null;
  const piece = state.tray[selected];
  if (!bloomMode && !piece) return null;
  const maxX = bloomMode ? 0 : Math.max(...piece.cells.map(([x]) => x));
  const maxY = bloomMode ? 0 : Math.max(...piece.cells.map(([, y]) => y));
  return {
    x: Math.max(0, Math.min(SIZE - 1 - maxX, position.x)),
    y: Math.max(0, Math.min(SIZE - 1 - maxY, position.y)),
  };
}
function pointerPosition(e, centered = false) {
  const r = board.getBoundingClientRect();
  if (
    e.clientX < r.left ||
    e.clientX >= r.right ||
    e.clientY < r.top ||
    e.clientY >= r.bottom
  )
    return null;
  // Cell rectangles include the actual border, padding and responsive grid gap.
  const first = cells[0].getBoundingClientRect();
  const stepX = cells[1].getBoundingClientRect().left - first.left;
  const stepY = cells[SIZE].getBoundingClientRect().top - first.top;
  let x = Math.floor((e.clientX - first.left) / stepX),
    y = Math.floor((e.clientY - first.top) / stepY);
  if (centered && state.tray[selected]) {
    const p = state.tray[selected];
    x -= Math.floor(Math.max(...p.cells.map((c) => c[0])) / 2);
    y -= Math.floor(Math.max(...p.cells.map((c) => c[1])) / 2);
  }
  return placementPosition({ x, y });
}
function dragPosition(e) {
  return pointerPosition(
    {
      clientX: e.clientX,
      clientY: e.clientY + (e.pointerType === "touch" ? -38 : 0),
    },
    true,
  );
}
tray.addEventListener("pointerdown", (e) => {
  const slot = e.target.closest("[data-piece]");
  if (!slot || slot.disabled || state.over || locked) return;
  const index = Number(slot.dataset.piece);
  selectPiece(index);
  drag = {
    startX: e.clientX,
    startY: e.clientY,
    id: e.pointerId,
    moved: false,
    index,
  };
  e.preventDefault();
});
tray.addEventListener("click", (e) => {
  if (e.detail !== 0) return;
  const slot = e.target.closest("[data-piece]");
  if (slot) selectPiece(Number(slot.dataset.piece));
});
window.addEventListener(
  "pointermove",
  (e) => {
    if (drag) {
      if (e.pointerId !== drag.id) return;
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 6)
        drag.moved = true;
      if (!drag.moved) return;
      e.preventDefault();
      const ghost = $("#drag-ghost");
      ghost.innerHTML = pieceMarkup(state.tray[drag.index]);
      const r = cells[0].getBoundingClientRect();
      ghost.style.setProperty("--tile", `${r.width}px`);
      ghost.style.left = e.clientX + "px";
      ghost.style.top =
        e.clientY + (e.pointerType === "touch" ? -38 : 0) + "px";
      preview = dragPosition(e);
      // On the board, show one complete destination instead of a floating
      // piece that can disagree with the snapped footprint beneath it.
      ghost.style.display = preview ? "none" : "grid";
      renderPreview();
      board.classList.add("dragging");
    } else if ((selected >= 0 || bloomMode) && e.target.closest?.("#board")) {
      preview = pointerPosition(e);
      renderPreview();
    }
  },
  { passive: false },
);
window.addEventListener("pointerup", (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const moved = drag.moved,
    pos = moved ? dragPosition(e) : null;
  cancelDrag();
  if (moved && pos) {
    place(pos.x, pos.y);
  }
  if (moved) {
    preview = null;
    renderPreview();
  }
});
window.addEventListener("pointercancel", () => {
  cancelDrag();
  preview = null;
  renderPreview();
});
board.addEventListener("click", (e) => {
  if (drag) return;
  const c = e.target.closest("[data-index]");
  if (!c) return;
  if (selected < 0 && !bloomMode) {
    notify("Choose one of the pieces below first.");
    return;
  }
  const i = Number(c.dataset.index);
  place(i % 8, Math.floor(i / 8));
});
board.addEventListener("pointerleave", () => {
  if (!drag) {
    preview = null;
    renderPreview();
  }
});
$("#classic-tab").onclick = () => switchMode("classic");
$("#daily-tab").onclick = () => switchMode("daily");
$("#hint").onclick = hint;
$("#undo").onclick = doUndo;
$("#bloom").onclick = toggleBloom;
$("#garden").onclick = showGarden;
$("#compact-garden").onclick = showGarden;
$("#mobile-garden").onclick = showGarden;
$("#help").onclick = showHelp;
$(".brand").onclick = (e) => {
  e.preventDefault();
  showHelp();
};
$("#sound").onclick = () => {
  meta.sound = !meta.sound;
  save();
  render();
  if (meta.sound) sound("pick");
};
$("#restart").onclick = () =>
  openModal(
    `${modalHeader("A FRESH PATCH", "Start a new garden?")}<p class="modal-intro">This run will end. Your collected flowers and personal best stay with you.</p><button class="primary-button" data-action="play-again">${mode === "daily" ? "Replay today’s puzzle" : "Start a new game"} ${icon("arrow")}</button><button class="text-button centered" data-action="close">Keep growing this one</button>`,
  );
dialog.addEventListener("click", (e) => {
  const a = e.target.closest("[data-action]")?.dataset.action;
  if (a === "close") closeModal();
  if (a === "play-again") {
    closeModal();
    startNew();
  }
  if (a === "undo-end") {
    closeModal();
    doUndo();
  }
  if (a === "end-switch") {
    closeModal();
    switchMode(mode === "daily" ? "classic" : "daily");
  }
  const theme = e.target.closest("button[data-theme]");
  if (theme && !theme.disabled) {
    meta.theme = theme.dataset.theme;
    save();
    render();
    dialog.close();
    modalOpen = false;
    showGarden();
  }
});
dialog.addEventListener("cancel", () => {
  modalOpen = false;
  setPlaying(!state.over);
  if (pendingResults && state.over) overTimer = setTimeout(showGameOver, 0);
});
document.addEventListener("keydown", (e) => {
  if (modalOpen || e.ctrlKey || e.metaKey || e.altKey || drag) return;
  if (["1", "2", "3"].includes(e.key)) {
    selectPiece(Number(e.key) - 1);
    preview = { x: 0, y: 0 };
    renderPreview();
    board.focus();
    return;
  }
  if (e.key.toLowerCase() === "h") {
    hint();
    return;
  }
  if (e.key.toLowerCase() === "u") {
    doUndo();
    return;
  }
  if (e.key.toLowerCase() === "b" && state.bloom >= 8 && !state.over) {
    toggleBloom();
    preview = { x: 3, y: 3 };
    renderPreview();
    board.focus();
    return;
  }
  if (
    (selected >= 0 || bloomMode) &&
    ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", " "].includes(
      e.key,
    )
  ) {
    e.preventDefault();
    preview ??= { x: 0, y: 0 };
    if (e.key === "Enter" || e.key === " ") {
      place(preview.x, preview.y);
      return;
    }
    preview.x = Math.max(
      0,
      Math.min(
        7,
        preview.x +
          (e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0),
      ),
    );
    preview.y = Math.max(
      0,
      Math.min(
        7,
        preview.y + (e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0),
      ),
    );
    preview = placementPosition(preview);
    renderPreview();
    announce(`Row ${preview.y + 1}, column ${preview.x + 1}`);
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    cancelDrag();
    if (progress.kind !== "crazygames") save();
    audioCtx?.suspend().catch(() => {});
  } else if (meta.sound && audioCtx?.state === "suspended")
    audioCtx.resume().catch(() => {});
});
window.addEventListener("pagehide", () => {
  if (progress.kind !== "crazygames") save();
});
render();
save();
setPlaying(!modalOpen && !state.over);
if (state.over) overTimer = setTimeout(showGameOver, 300);
