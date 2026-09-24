/** Deterministic, immutable rules for Grove Blocks. No browser dependencies. */
export const SIZE = 8;
const DAILY_MOVES = 30;
const BLOOM_COST = 8;

export const SHAPES = Object.freeze(
  [
    [[0, 0]],
    [
      [0, 0],
      [1, 0],
    ],
    [
      [0, 0],
      [0, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [2, 0],
    ],
    [
      [0, 0],
      [0, 1],
      [0, 2],
    ],
    [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [0, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [1, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ],
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
    ],
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 2],
    ],
    [
      [1, 0],
      [1, 1],
      [0, 2],
      [1, 2],
    ],
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
    ],
    [
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [1, 1],
    ],
    [
      [1, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ],
    [
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [0, 2],
    ],
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
    ],
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
    ],
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [0, 2],
      [1, 2],
      [2, 2],
    ],
  ].map((shape) => Object.freeze(shape.map((cell) => Object.freeze(cell)))),
);
const WEIGHTS = [
  2, 4, 4, 8, 8, 8, 7, 7, 7, 7, 5, 5, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 2, 2, 2,
];
const SHAPE_KEYS = new Set(SHAPES.map(shapeKey));

function shapeKey(cells) {
  return cells
    .map(([x, y]) => `${x},${y}`)
    .sort()
    .join(";");
}

/** Stable FNV-1a hash, also used to make a UTC date a daily seed. */
export function daySeed(dateString) {
  let hash = 2166136261;
  for (const char of String(dateString)) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  }
  return hash >>> 0;
}

function randomSeed() {
  if (globalThis.crypto?.getRandomValues) {
    return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return (Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0;
}

function normalizeSeed(seed) {
  return typeof seed === "number" && Number.isFinite(seed)
    ? Math.trunc(seed) >>> 0
    : daySeed(seed);
}

// Mulberry32 advances explicit state, so saves and daily games reproduce exactly.
function nextRandom(rng) {
  const next = (rng + 0x6d2b79f5) >>> 0;
  let t = Math.imul(next ^ (next >>> 15), next | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { rng: next, value: ((t ^ (t >>> 14)) >>> 0) / 0x100000000 };
}

function weightedShape(value, eligible = SHAPES.map((_, i) => i)) {
  let target = value * eligible.reduce((total, i) => total + WEIGHTS[i], 0);
  for (const i of eligible) {
    target -= WEIGHTS[i];
    if (target < 0) return i;
  }
  return eligible[eligible.length - 1];
}

function createPiece(shapeIndex, color, flowerIndex, id) {
  return {
    id,
    cells: SHAPES[shapeIndex].map(([x, y]) => [x, y]),
    color,
    flowerIndex,
  };
}

function fillTray(board, initialRng, moves) {
  let rng = initialRng;
  const draw = () => {
    const result = nextRandom(rng);
    rng = result.rng;
    return result.value;
  };
  const tray = Array.from({ length: 3 }, (_, i) => {
    const shape = weightedShape(draw());
    const color = Math.floor(draw() * 6);
    const flowerRoll = draw();
    const flowerIndex =
      flowerRoll < 0.68
        ? Math.floor((flowerRoll / 0.68) * SHAPES[shape].length)
        : -1;
    return createPiece(
      shape,
      color,
      flowerIndex,
      `p${moves}-${i}-${rng.toString(36)}`,
    );
  });
  if (!tray.some((piece) => findPlacements(board, piece).length)) {
    // A finite scan, never an unbounded reroll: fresh trays always offer one fit.
    const eligible = SHAPES.flatMap((cells, i) =>
      findPlacements(board, { cells }).length ? [i] : [],
    );
    if (eligible.length) {
      const shape = weightedShape(draw(), eligible);
      tray[0] = createPiece(
        shape,
        tray[0].color,
        0,
        `p${moves}-0-${rng.toString(36)}`,
      );
    }
  }
  return { tray, rng };
}

export function newGame({ mode = "classic", seed, date } = {}) {
  if (mode !== "classic" && mode !== "daily")
    throw new TypeError("Unknown game mode.");
  const dailyDate =
    mode === "daily" ? (date ?? new Date().toISOString().slice(0, 10)) : null;
  if (mode === "daily" && !validDate(dailyDate))
    throw new TypeError("Daily date must be YYYY-MM-DD.");
  const actualSeed =
    seed === undefined
      ? mode === "daily"
        ? daySeed(dailyDate)
        : randomSeed()
      : normalizeSeed(seed);
  const board = Array(SIZE * SIZE).fill(null);
  let rng = actualSeed;
  let tray;
  if (mode === "classic") {
    for (let x = 0; x < 5; x++)
      board[7 * SIZE + x] = { color: 2, flower: x === 1 || x === 4 };
    tray = [
      createPiece(3, 0, 1, "p0-0-starter"),
      createPiece(5, 1, 0, "p0-1-starter"),
      createPiece(6, 3, 2, "p0-2-starter"),
    ];
  } else {
    const spots = Array.from({ length: 32 }, (_, i) => i + 32);
    for (let i = spots.length - 1; i > 0; i--) {
      const roll = nextRandom(rng);
      rng = roll.rng;
      const j = Math.floor(roll.value * (i + 1));
      [spots[i], spots[j]] = [spots[j], spots[i]];
    }
    const rowCounts = [0, 0, 0, 0];
    let planted = 0;
    for (const spot of spots) {
      const row = Math.floor(spot / SIZE) - 4;
      if (rowCounts[row] >= 5) continue;
      rowCounts[row]++;
      const roll = nextRandom(rng);
      rng = roll.rng;
      board[spot] = {
        color: Math.floor(roll.value * 6),
        flower: planted % 3 === 0,
      };
      if (++planted === 10) break;
    }
    ({ tray, rng } = fillTray(board, rng, 0));
  }
  return {
    version: 1,
    mode,
    seed: actualSeed,
    rng,
    board,
    tray,
    score: 0,
    moves: 0,
    lines: 0,
    flowers: 0,
    combo: 0,
    bloom: 0,
    bloomsUsed: 0,
    over: false,
    dailyDate,
  };
}

export function canPlace(board, piece, x, y) {
  if (
    !piece ||
    !Array.isArray(piece.cells) ||
    !piece.cells.length ||
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    !Array.isArray(board) ||
    board.length !== SIZE * SIZE
  )
    return false;
  return piece.cells.every(([dx, dy]) => {
    const px = x + dx;
    const py = y + dy;
    return (
      px >= 0 &&
      px < SIZE &&
      py >= 0 &&
      py < SIZE &&
      board[py * SIZE + px] === null
    );
  });
}

export function findPlacements(board, piece) {
  if (!piece) return [];
  const result = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++)
      if (canPlace(board, piece, x, y)) result.push({ x, y });
  }
  return result;
}

export function findLines(board) {
  const rows = [];
  const cols = [];
  const cells = new Set();
  for (let i = 0; i < SIZE; i++) {
    let rowFull = true;
    let colFull = true;
    for (let j = 0; j < SIZE; j++) {
      if (!board[i * SIZE + j]) rowFull = false;
      if (!board[j * SIZE + i]) colFull = false;
    }
    if (rowFull) rows.push(i);
    if (colFull) cols.push(i);
  }
  for (const y of rows) for (let x = 0; x < SIZE; x++) cells.add(y * SIZE + x);
  for (const x of cols) for (let y = 0; y < SIZE; y++) cells.add(y * SIZE + x);
  return { rows, cols, cells: [...cells].sort((a, b) => a - b) };
}

/** Whether any remaining tray piece physically fits, independent of daily completion. */
export function hasMoves(state) {
  return state.tray.some(
    (piece) => piece && findPlacements(state.board, piece).length > 0,
  );
}

function isOver(state) {
  return (
    (state.mode === "daily" && state.moves >= DAILY_MOVES) ||
    (!hasMoves(state) && state.bloom < BLOOM_COST)
  );
}

function invalid(state) {
  return { state, valid: false, cleared: [], lines: 0, flowers: 0, points: 0 };
}

export function placePiece(state, index, x, y) {
  if (state.over || !Number.isInteger(index) || index < 0 || index >= 3)
    return invalid(state);
  const piece = state.tray[index];
  if (!canPlace(state.board, piece, x, y)) return invalid(state);
  const board = state.board.slice();
  piece.cells.forEach(([dx, dy], i) => {
    board[(y + dy) * SIZE + x + dx] = {
      color: piece.color,
      flower: i === piece.flowerIndex,
    };
  });
  const found = findLines(board);
  const lines = found.rows.length + found.cols.length;
  const flowers = found.cells.reduce(
    (total, i) => total + Number(board[i].flower),
    0,
  );
  for (const i of found.cells) board[i] = null;
  const combo = lines > 0 ? state.combo + 1 : 0;
  const points =
    piece.cells.length * 5 +
    lines * 100 +
    Math.max(0, lines - 1) * 75 +
    Math.max(0, combo - 1) * 50 +
    flowers * 35;
  const moves = state.moves + 1;
  let tray = state.tray.map((item, i) => (i === index ? null : item));
  let rng = state.rng;
  if (
    tray.every((item) => item === null) &&
    !(state.mode === "daily" && moves >= DAILY_MOVES)
  ) {
    ({ tray, rng } = fillTray(board, rng, moves));
  }
  const next = {
    ...state,
    board,
    tray,
    rng,
    score: state.score + points,
    moves,
    lines: state.lines + lines,
    flowers: state.flowers + flowers,
    combo,
    bloom: Math.min(BLOOM_COST, state.bloom + flowers),
  };
  next.over = isOver(next);
  return {
    state: next,
    valid: true,
    cleared: found.cells,
    lines,
    flowers,
    points,
  };
}

export function useBloom(state, x, y) {
  if (
    state.over ||
    state.bloom < BLOOM_COST ||
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    x >= SIZE ||
    y < 0 ||
    y >= SIZE
  )
    return invalid(state);
  const cleared = [];
  const board = state.board.slice();
  for (let py = Math.max(0, y - 1); py <= Math.min(SIZE - 1, y + 1); py++) {
    for (let px = Math.max(0, x - 1); px <= Math.min(SIZE - 1, x + 1); px++) {
      const i = py * SIZE + px;
      if (board[i]) {
        cleared.push(i);
        board[i] = null;
      }
    }
  }
  if (!cleared.length) return invalid(state);
  const next = {
    ...state,
    board,
    bloom: state.bloom - BLOOM_COST,
    bloomsUsed: state.bloomsUsed + 1,
  };
  next.over = isOver(next);
  return { state: next, valid: true, cleared, lines: 0, flowers: 0, points: 0 };
}

export function getHint(state) {
  if (state.over) return null;
  let best = null;
  let bestValue = -Infinity;
  for (let index = 0; index < state.tray.length; index++) {
    const piece = state.tray[index];
    if (!piece) continue;
    for (const { x, y } of findPlacements(state.board, piece)) {
      const result = placePiece(state, index, x, y);
      const board = result.state.board;
      let potential = 0;
      for (let i = 0; i < SIZE; i++) {
        let row = 0;
        let col = 0;
        for (let j = 0; j < SIZE; j++) {
          row += Number(board[i * SIZE + j] !== null);
          col += Number(board[j * SIZE + i] !== null);
        }
        potential += row * row + col * col;
      }
      const lost =
        result.state.over &&
        !(state.mode === "daily" && result.state.moves === DAILY_MOVES);
      const value =
        result.lines * 10000 +
        result.flowers * 150 +
        potential +
        piece.cells.length * 10 +
        y * 0.1 -
        (lost ? 20000 : 0);
      if (value > bestValue) {
        bestValue = value;
        best = { index, x, y };
      }
    }
  }
  return best;
}

function plain(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function hasKeys(value, keys) {
  return (
    plain(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function uint(value) {
  return Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
}

function validDate(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value
  );
}

/** Reject incompatible or malformed local saves before the UI consumes them. */
export function validateState(state) {
  if (
    !hasKeys(state, [
      "version",
      "mode",
      "seed",
      "rng",
      "board",
      "tray",
      "score",
      "moves",
      "lines",
      "flowers",
      "combo",
      "bloom",
      "bloomsUsed",
      "over",
      "dailyDate",
    ])
  )
    return false;
  if (
    state.version !== 1 ||
    !["classic", "daily"].includes(state.mode) ||
    !uint(state.seed) ||
    !uint(state.rng) ||
    typeof state.over !== "boolean"
  )
    return false;
  if (
    state.mode === "daily"
      ? !validDate(state.dailyDate)
      : state.dailyDate !== null
  )
    return false;
  for (const key of [
    "score",
    "moves",
    "lines",
    "flowers",
    "combo",
    "bloom",
    "bloomsUsed",
  ]) {
    if (!Number.isSafeInteger(state[key]) || state[key] < 0) return false;
  }
  if (
    state.moves > 10000000 ||
    state.bloom > BLOOM_COST ||
    state.combo > state.moves ||
    state.lines > state.moves * 6 ||
    state.flowers > state.moves * SIZE * SIZE ||
    state.bloom + state.bloomsUsed * BLOOM_COST > state.flowers ||
    (state.mode === "daily" && state.moves > DAILY_MOVES)
  )
    return false;
  if (
    !Array.isArray(state.board) ||
    state.board.length !== SIZE * SIZE ||
    !Array.from(state.board).every(
      (cell) =>
        cell === null ||
        (hasKeys(cell, ["color", "flower"]) &&
          Number.isInteger(cell.color) &&
          cell.color >= 0 &&
          cell.color < 6 &&
          typeof cell.flower === "boolean"),
    )
  )
    return false;
  if (findLines(state.board).cells.length) return false;
  if (!Array.isArray(state.tray) || state.tray.length !== 3) return false;
  const ids = new Set();
  for (const piece of state.tray) {
    if (piece === null) continue;
    if (
      !hasKeys(piece, ["id", "cells", "color", "flowerIndex"]) ||
      typeof piece.id !== "string" ||
      !/^[a-zA-Z0-9-]{1,80}$/.test(piece.id) ||
      ids.has(piece.id) ||
      !Number.isInteger(piece.color) ||
      piece.color < 0 ||
      piece.color > 5 ||
      !Array.isArray(piece.cells) ||
      piece.cells.length < 1 ||
      piece.cells.length > 9
    )
      return false;
    ids.add(piece.id);
    if (
      !piece.cells.every(
        (cell) =>
          Array.isArray(cell) &&
          cell.length === 2 &&
          cell.every((v) => Number.isInteger(v) && v >= 0 && v <= 4),
      ) ||
      !SHAPE_KEYS.has(shapeKey(piece.cells)) ||
      !Number.isInteger(piece.flowerIndex) ||
      piece.flowerIndex < -1 ||
      piece.flowerIndex >= piece.cells.length
    )
      return false;
  }
  const used = state.tray.filter((piece) => piece === null).length;
  if (
    used !==
    (state.mode === "daily" && state.moves === DAILY_MOVES
      ? 3
      : state.moves % 3)
  )
    return false;
  return state.over === isOver(state);
}
