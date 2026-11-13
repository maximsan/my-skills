import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { isInUse, isRecent, parseWorktrees, STATUS, statusOf } from "./worktree-audit.mjs";

const CLEAN = { inUse: false, changes: 0, merged: false, onGitHub: false, recent: false };
const NOW = Date.parse("2026-11-05T12:00:00Z");

describe("parseWorktrees", () => {
  test("reads a branch, a detached worktree and a stale record", () => {
    const porcelain = [
      "worktree /repo\nHEAD aaa\nbranch refs/heads/main\n",
      "worktree /wt/one\nHEAD bbb\nbranch refs/heads/feat/one\n",
      "worktree /wt/two\nHEAD ccc\ndetached\n",
      "worktree /tmp/gone\nHEAD ddd\ndetached\nprunable gitdir file points to non-existent location\n",
    ].join("\n");

    assert.deepEqual(parseWorktrees(porcelain), [
      { folder: "/repo", branch: "main", prunable: false },
      { folder: "/wt/one", branch: "feat/one", prunable: false },
      { folder: "/wt/two", branch: null, prunable: false },
      { folder: "/tmp/gone", branch: null, prunable: true },
    ]);
  });

  test("is empty when git printed nothing", () => {
    assert.deepEqual(parseWorktrees(""), []);
  });
});

describe("statusOf", () => {
  test("a running process outranks everything", () => {
    assert.equal(statusOf({ inUse: true, changes: 3, merged: true, onGitHub: true, recent: true }), STATUS.inUse);
  });

  test("uncommitted changes outrank a merged commit", () => {
    assert.equal(statusOf({ ...CLEAN, changes: 1, merged: true }), STATUS.changes);
  });

  test("a merged commit whose branch left GitHub is merged", () => {
    assert.equal(statusOf({ ...CLEAN, merged: true }), STATUS.merged);
  });

  test("a branch tip on GitHub is pushed", () => {
    assert.equal(statusOf({ ...CLEAN, onGitHub: true }), STATUS.pushed);
  });

  test("a commit GitHub does not have is unpushed", () => {
    assert.equal(statusOf(CLEAN), STATUS.unpushed);
  });

  test("a just-started worktree on a commit in main is recent, not merged", () => {
    assert.equal(statusOf({ ...CLEAN, merged: true, onGitHub: true, recent: true }), STATUS.recent);
  });

  test("unpushed work stays unpushed however recent it is", () => {
    assert.equal(statusOf({ ...CLEAN, recent: true }), STATUS.unpushed);
  });
});

describe("isRecent", () => {
  test("counts a date inside the window", () => {
    assert.ok(isRecent("2026-11-01", NOW));
  });

  test("leaves out an older date", () => {
    assert.ok(!isRecent("2026-10-22", NOW));
  });
});

describe("isInUse", () => {
  test("matches the folder and folders inside it", () => {
    assert.ok(isInUse("/wt/one", new Set(["/wt/one"])));
    assert.ok(isInUse("/wt/one", new Set(["/wt/one/lib"])));
  });

  test("ignores a folder that only shares a prefix", () => {
    assert.ok(!isInUse("/wt/one", new Set(["/wt/one-more"])));
  });
});

describe("run through a symlink", () => {
  test("prints the same report as a direct run", (context) => {
    const skillFolder = dirname(fileURLToPath(import.meta.url));
    const temp = mkdtempSync(join(tmpdir(), "worktree-audit-"));
    const linkedFolder = join(temp, "disk-audit");
    const noRepos = join(temp, "projects");

    context.after(() => rmSync(temp, { recursive: true, force: true }));
    symlinkSync(skillFolder, linkedFolder, "dir");
    mkdirSync(noRepos);

    // An empty home folder keeps the audit off this machine's real worktrees and Codex state.
    /**
     * Runs the script from `folder` on the empty projects folder.
     * @param {string} folder the skill's folder, real or linked
     * @returns {import("node:child_process").SpawnSyncReturns<string>} what the run printed
     */
    const run = (folder) => spawnSync(process.execPath, [join(folder, "worktree-audit.mjs"), noRepos], {
      encoding: "utf8",
      env: { ...process.env, HOME: temp },
    });
    const linked = run(linkedFolder);

    assert.match(linked.stdout, /^STATUS\t/);
    assert.equal(linked.stdout, run(skillFolder).stdout);
  });
});
