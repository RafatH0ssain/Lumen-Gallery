import { test } from "node:test";
import assert from "node:assert/strict";
import { feedReducer, initialFeedState, FOCUS_BATCH } from "../src/feed/feedReducer.js";

const art = (id, genre = "painting") => ({ id, genre, title: `Art ${id}` });

test("EXPLORE_APPEND adds unseen items and skips duplicates", () => {
  const state = feedReducer(initialFeedState, {
    type: "EXPLORE_APPEND",
    arts: [art("a"), art("b")],
  });
  assert.equal(state.items.length, 2);
  assert.equal(state.mode, "EXPLORE");
  const again = feedReducer(state, { type: "EXPLORE_APPEND", arts: [art("a")] });
  assert.equal(again.items.length, 2, "duplicate id must not be appended");
});

test("FOCUS_START splices skeletons after the tapped card and enters FOCUSED", () => {
  const seeded = feedReducer(initialFeedState, {
    type: "EXPLORE_APPEND",
    arts: [art("a"), art("b")],
  });
  const state = feedReducer(seeded, {
    type: "FOCUS_START",
    genre: "painting",
    anchorArtId: "a",
    placeholderKeys: ["k1", "k2"],
  });
  assert.equal(state.mode, "FOCUSED");
  assert.equal(state.focus.genre, "painting");
  assert.equal(state.items.filter((it) => it.kind === "skeleton").length, 2);
  assert.equal(state.items[1].kind, "skeleton", "skeletons go directly after the anchor");
});

test("FOCUS_FILL replaces skeletons with focused items", () => {
  const seeded = feedReducer(initialFeedState, {
    type: "EXPLORE_APPEND",
    arts: [art("a")],
  });
  const started = feedReducer(seeded, {
    type: "FOCUS_START",
    genre: "painting",
    anchorArtId: "a",
    placeholderKeys: ["k1"],
  });
  const filled = feedReducer(started, {
    type: "FOCUS_FILL",
    arts: [art("c"), art("d")],
    placeholderKeys: ["k1"],
  });
  assert.equal(filled.items.filter((it) => it.kind === "skeleton").length, 0);
  assert.equal(filled.focus.size, 2);
  assert.equal(filled.focus.pending, false);
});

test("scrolling past the whole batch reverts to EXPLORE", () => {
  const seeded = feedReducer(initialFeedState, {
    type: "EXPLORE_APPEND",
    arts: [art("a")],
  });
  const started = feedReducer(seeded, {
    type: "FOCUS_START",
    genre: "painting",
    anchorArtId: "a",
    placeholderKeys: ["k1"],
  });
  const filled = feedReducer(started, {
    type: "FOCUS_FILL",
    arts: [art("c"), art("d")],
    placeholderKeys: ["k1"],
  });
  const one = feedReducer(filled, { type: "ITEM_SEEN", artId: "c" });
  assert.equal(one.mode, "FOCUSED");
  const two = feedReducer(one, { type: "ITEM_SEEN", artId: "d" });
  assert.equal(two.mode, "EXPLORE");
  assert.equal(two.focus, null);
});

test("FOCUS_ABORT removes skeletons and resumes EXPLORE", () => {
  const seeded = feedReducer(initialFeedState, {
    type: "EXPLORE_APPEND",
    arts: [art("a")],
  });
  const started = feedReducer(seeded, {
    type: "FOCUS_START",
    genre: "painting",
    anchorArtId: "a",
    placeholderKeys: ["k1", "k2"],
  });
  const aborted = feedReducer(started, {
    type: "FOCUS_ABORT",
    placeholderKeys: ["k1", "k2"],
  });
  assert.equal(aborted.mode, "EXPLORE");
  assert.equal(aborted.items.filter((it) => it.kind === "skeleton").length, 0);
});

test("FOCUS_BATCH is a sane batch size", () => {
  assert.ok(FOCUS_BATCH >= 3 && FOCUS_BATCH <= 5);
});
