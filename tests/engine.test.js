import test from "node:test";
import assert from "node:assert/strict";
import {
  SIZE,
  SHAPES,
  newGame,
  canPlace,
  findPlacements,
  findLines,
  placePiece,
  useBloom,
  getHint,
  hasMoves,
  validateState,
  daySeed,
} from "../src/engine.js";

const occupied = (flower = false) => ({ color: 2, flower });
const single = (id) => ({ id, cells: [[0, 0]], color: 0, flowerIndex: -1 });
const copy = (value) => JSON.parse(JSON.stringify(value));
function freezeDeep(value) {
  if (value && typeof value === "object") {
    Object.freeze(value);
    Object.values(value).forEach(freezeDeep);
  }
  return value;
}

test("classic introduction provides an immediate, rewarding line clear", () => {
  const state = newGame({ seed: 42 });
  assert.equal(SIZE, 8);
  assert.equal(validateState(state), true);
  const result = placePiece(state, 0, 5, 7);
  assert.equal(result.valid, true);
  assert.equal(result.lines, 1);
  assert.equal(result.flowers, 3);
  assert.equal(result.points, 220);
  assert.equal(result.state.bloom, 3);
  assert.equal(result.state.board.filter(Boolean).length, 0);
  assert.equal(result.state.tray[0], null);
  assert.equal(validateState(result.state), true);
});

test("placements are immutable, bounded, and consume a piece exactly once", () => {
  const state = freezeDeep(newGame({ seed: 88 }));
  const before = copy(state);
  for (const [index, x, y] of [
    [0, -1, 0],
    [0, 7, 0],
    [0, 0, 7],
    [1, 0, 7],
    [3, 0, 0],
    [0, 0.5, 1],
    [0, NaN, 1],
  ]) {
    const result = placePiece(state, index, x, y);
    assert.equal(result.valid, false);
    assert.equal(result.state, state);
    assert.deepEqual(result.cleared, []);
  }
  const result = placePiece(state, 0, 5, 7);
  assert.deepEqual(state, before);
  assert.notEqual(result.state, state);
  assert.notEqual(result.state.board, state.board);
  assert.equal(placePiece(result.state, 0, 0, 0).valid, false);
  assert.equal(canPlace(state.board, null, 0, 0), false);
  assert.equal(canPlace(state.board, state.tray[0], Infinity, 0), false);
});

test("crossing row and column clear simultaneously and count intersection flowers once", () => {
  const state = newGame({ seed: 1 });
  state.board.fill(null);
  state.tray = [single("one"), single("two"), single("three")];
  state.tray[0].flowerIndex = 0;
  for (let x = 0; x < SIZE; x++)
    if (x !== 3) state.board[4 * SIZE + x] = occupied(x === 0);
  for (let y = 0; y < SIZE; y++)
    if (y !== 4) state.board[y * SIZE + 3] = occupied(y === 0);
  const result = placePiece(state, 0, 3, 4);
  assert.equal(result.lines, 2);
  assert.equal(result.cleared.length, 15);
  assert.equal(new Set(result.cleared).size, 15);
  assert.equal(result.flowers, 3);
  assert.equal(result.points, 385);
  assert.equal(result.state.lines, 2);
  assert.equal(result.state.board.filter(Boolean).length, 0);
  const full = Array.from({ length: 64 }, () => occupied());
  assert.deepEqual(findLines(full).rows, [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(findLines(full).cells.length, 64);
});

test("consecutive clearing moves earn combo bonus; a quiet move resets it", () => {
  let state = newGame({ seed: 1 });
  state.board.fill(null);
  state.tray = [single("one"), single("two"), single("three")];
  for (let y = 0; y < 2; y++)
    for (let x = 0; x < 7; x++) state.board[y * SIZE + x] = occupied();
  let result = placePiece(state, 0, 7, 0);
  assert.equal(result.state.combo, 1);
  assert.equal(result.points, 105);
  result = placePiece(result.state, 1, 7, 1);
  assert.equal(result.state.combo, 2);
  assert.equal(result.points, 155);
  result = placePiece(result.state, 2, 0, 0);
  assert.equal(result.state.combo, 0);
  assert.equal(result.points, 5);
});

test("seeded refills and UTC daily starts reproduce exactly", () => {
  for (const mode of ["classic", "daily"]) {
    let a = newGame({ mode, seed: 12345, date: "2026-09-24" });
    let b = newGame({ mode, seed: 12345, date: "2026-09-24" });
    for (let i = 0; i < 12; i++) {
      assert.deepEqual(a, b);
      const hint = getHint(a);
      if (!hint) break;
      a = placePiece(a, hint.index, hint.x, hint.y).state;
      b = placePiece(b, hint.index, hint.x, hint.y).state;
    }
    assert.deepEqual(a, b);
  }
  assert.deepEqual(
    newGame({ mode: "daily", date: "2026-09-24" }),
    newGame({ mode: "daily", date: "2026-09-24" }),
  );
  assert.notEqual(daySeed("2026-09-24"), daySeed("2026-09-25"));
  assert.notDeepEqual(
    newGame({ mode: "daily", date: "2026-09-24" }).board,
    newGame({ mode: "daily", date: "2026-09-25" }).board,
  );
  assert.throws(
    () => newGame({ mode: "daily", date: "2026-02-31" }),
    TypeError,
  );
});

test("daily challenge stops exactly after placement 30", () => {
  let state = newGame({ mode: "daily", date: "2026-09-24" });
  state.moves = 29;
  state.board.fill(null);
  state.tray = [null, null, single("final")];
  assert.equal(validateState(state), true);
  const result = placePiece(state, 2, 0, 0);
  state = result.state;
  assert.equal(result.valid, true);
  assert.equal(state.moves, 30);
  assert.equal(state.over, true);
  assert.deepEqual(state.tray, [null, null, null]);
  assert.equal(validateState(state), true);
  assert.equal(placePiece(state, 0, 0, 1).valid, false);
  assert.equal(getHint(state), null);
});

test("bloom is an immutable 3 by 3 rescue, costs eight, and cannot refill itself", () => {
  const state = newGame({ mode: "daily", date: "2026-09-24" });
  state.board.fill(null);
  for (let y = 0; y < 3; y++)
    for (let x = 0; x < 3; x++) state.board[y * SIZE + x] = occupied(true);
  state.bloom = 8;
  state.flowers = 8;
  state.score = 800;
  state.moves = 3;
  freezeDeep(state);
  const result = useBloom(state, 1, 1);
  assert.equal(result.valid, true);
  assert.equal(result.cleared.length, 9);
  assert.equal(result.state.bloom, 0);
  assert.equal(result.state.flowers, 8);
  assert.equal(result.state.score, 800);
  assert.equal(result.state.bloomsUsed, 1);
  assert.equal(result.state.moves, 3);
  assert.equal(result.flowers, 0);
  assert.equal(result.points, 0);
  assert.equal(state.board.filter(Boolean).length, 9);
  assert.equal(useBloom(result.state, 0, 0).valid, false);
  assert.equal(useBloom(state, 7, 7).valid, false);
  assert.equal(useBloom(state, -1, 0).valid, false);
  assert.equal(useBloom(state, 1.5, 0).valid, false);
  assert.equal(useBloom(state, 0, 0).cleared.length, 4);
  assert.equal(validateState(result.state), true);
});

test("charged bloom keeps a blocked board alive, then restores legal moves", () => {
  const makeBlocked = (charged) => {
    const state = newGame({ seed: 9 });
    state.board = Array.from({ length: 64 }, (_, i) =>
      (Math.floor(i / 8) + (i % 8)) % 2 ? occupied() : null,
    );
    state.tray = [
      single("one"),
      {
        id: "two",
        cells: [
          [0, 0],
          [1, 0],
        ],
        color: 2,
        flowerIndex: -1,
      },
      {
        id: "three",
        cells: [
          [0, 0],
          [0, 1],
        ],
        color: 3,
        flowerIndex: -1,
      },
    ];
    state.bloom = charged ? 8 : 0;
    state.flowers = charged ? 8 : 0;
    return placePiece(state, 0, 0, 0).state;
  };
  const blocked = makeBlocked(false);
  assert.equal(hasMoves(blocked), false);
  assert.equal(blocked.over, true);
  assert.equal(validateState(blocked), true);
  const rescued = makeBlocked(true);
  assert.equal(hasMoves(rescued), false);
  assert.equal(rescued.over, false);
  assert.equal(getHint(rescued), null);
  assert.equal(validateState(rescued), true);
  const after = useBloom(rescued, 3, 3);
  assert.equal(after.valid, true);
  assert.equal(hasMoves(after.state), true);
  assert.equal(after.state.over, false);
  assert.equal(validateState(after.state), true);
});

test("bloom meter caps at eight and duplicate flower harvesting cannot occur", () => {
  const state = newGame({ seed: 1 });
  state.bloom = 7;
  state.flowers = 7;
  const result = placePiece(state, 0, 5, 7);
  assert.equal(result.state.bloom, 8);
  assert.equal(result.state.flowers, 10);
  assert.equal(findLines(result.state.board).cells.length, 0);
});

test("every built-in shape fits an empty board and all reported placements are legal", () => {
  const board = Array(64).fill(null);
  for (const cells of SHAPES) {
    const piece = { cells };
    assert.ok(findPlacements(board, piece).length > 0);
    for (const { x, y } of findPlacements(board, piece))
      assert.equal(canPlace(board, piece, x, y), true);
  }
});

test("hundreds of seeded games preserve invariants and guarantee a fit in fresh trays", () => {
  let placements = 0;
  let refills = 0;
  for (let seed = 0; seed < 320; seed++) {
    let state = newGame({
      mode: seed % 2 ? "daily" : "classic",
      seed,
      date: "2026-09-24",
    });
    for (let turn = 0; turn < 55; turn++) {
      assert.equal(
        validateState(state),
        true,
        `invalid seed ${seed}, move ${state.moves}`,
      );
      assert.equal(findLines(state.board).cells.length, 0);
      if (state.over) break;
      const legal = state.tray.flatMap((piece, index) =>
        findPlacements(state.board, piece).map((pos) => ({ ...pos, index })),
      );
      if (!legal.length) {
        assert.equal(state.bloom, 8);
        const spot = state.board.findIndex(Boolean);
        state = useBloom(state, spot % SIZE, Math.floor(spot / SIZE)).state;
        continue;
      }
      const choice = legal[(seed * 23 + turn * 17) % legal.length];
      const before = copy(state);
      const result = placePiece(state, choice.index, choice.x, choice.y);
      assert.equal(result.valid, true);
      assert.deepEqual(state, before);
      state = result.state;
      placements++;
      if (
        state.moves % 3 === 0 &&
        !(state.mode === "daily" && state.moves === 30)
      ) {
        assert.equal(state.tray.filter(Boolean).length, 3);
        assert.equal(hasMoves(state), true);
        refills++;
      }
    }
    assert.equal(validateState(state), true);
  }
  assert.ok(placements > 2500);
  assert.ok(refills > 700);
});

test("save validator rejects malformed, incompatible, and impossible state", () => {
  const good = newGame({ seed: 42 });
  assert.equal(validateState(copy(good)), true);
  const corruptions = [
    (state) => {
      state.version = 2;
    },
    (state) => {
      state.mode = "unknown";
    },
    (state) => {
      state.board.pop();
    },
    (state) => {
      delete state.board[0];
    },
    (state) => {
      state.board[0] = { color: 7, flower: false };
    },
    (state) => {
      state.board[0] = { color: 0, flower: "yes" };
    },
    (state) => {
      state.tray[0].cells.push([0, 0]);
    },
    (state) => {
      state.tray[0].cells[0][0] = -1;
    },
    (state) => {
      state.tray[0].flowerIndex = 10;
    },
    (state) => {
      state.tray[1].id = state.tray[0].id;
    },
    (state) => {
      state.tray[0] = null;
    },
    (state) => {
      state.score = NaN;
    },
    (state) => {
      state.score = -1;
    },
    (state) => {
      state.score = Number.MAX_SAFE_INTEGER + 1;
    },
    (state) => {
      state.bloom = 9;
    },
    (state) => {
      state.bloom = 8;
    },
    (state) => {
      state.rng = 0x100000000;
    },
    (state) => {
      state.over = true;
    },
    (state) => {
      state.dailyDate = "2026-09-24";
    },
    (state) => {
      state.unknown = true;
    },
    (state) => {
      state.moves = 1.5;
    },
  ];
  for (const corrupt of corruptions) {
    const state = copy(good);
    corrupt(state);
    assert.equal(validateState(state), false);
  }
  for (const candidate of [null, undefined, {}, [], "", 42])
    assert.equal(validateState(candidate), false);
  const daily = newGame({ mode: "daily", date: "2026-09-24" });
  daily.dailyDate = "2026-02-31";
  assert.equal(validateState(daily), false);
});
