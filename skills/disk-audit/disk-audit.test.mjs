import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { groupOf, parseDu, windowsHolding } from "./disk-audit.mjs";

const DAY_IN_MS = 86_400_000;
const NOW = 1_000 * DAY_IN_MS;

describe("groupOf", () => {
  test("keeps three levels below the home folder", () => {
    assert.equal(groupOf("/Users/me/.codex/worktrees/one/brewpath/lib/a.dart", "/Users/me"), "~/.codex/worktrees/one");
  });

  test("keeps three levels of a path outside it", () => {
    assert.equal(groupOf("/opt/homebrew/Cellar/qt/6/lib", "/Users/me"), "/opt/homebrew/Cellar");
  });

  test("reads a home-like prefix as outside", () => {
    assert.equal(groupOf("/Users/meg/a/b/c/d", "/Users/me"), "/Users/meg/a");
  });
});

describe("windowsHolding", () => {
  test("lists every window the date falls in", () => {
    assert.deepEqual(windowsHolding(NOW - DAY_IN_MS, NOW, [7, 14]), [7, 14]);
    assert.deepEqual(windowsHolding(NOW - 10 * DAY_IN_MS, NOW, [7, 14]), [14]);
    assert.deepEqual(windowsHolding(NOW - 20 * DAY_IN_MS, NOW, [7, 14]), []);
  });

  test("leaves out a broken future date", () => {
    assert.deepEqual(windowsHolding(NOW + 9_000 * DAY_IN_MS, NOW, [7, 14]), []);
  });
});

describe("parseDu", () => {
  test("reads kilobytes as bytes, largest first, with tabs in no folder name", () => {
    assert.deepEqual(parseDu("1\t/small\n3\t/with space\n"), [["/with space", 3072], ["/small", 1024]]);
  });

  test("is empty for empty output", () => {
    assert.deepEqual(parseDu(""), []);
  });
});
