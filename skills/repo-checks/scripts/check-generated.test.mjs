import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { changeTo, generatedSources, staleFiles } from "./check-generated.mjs";

// Digests stand for the two files a generator rewrote on main in the
// BrewPath repo on 24 October 2026: the router's checksum line changed, the
// Saved providers' did not.
const router = "lib/app/app_router.g.dart";
const saved = "lib/features/saved/domain/saved_providers.g.dart";
const committed = new Map([
  [router, "3ab561f8ebbef7b6b95a9a6a944fbe108e0bc3a6"],
  [saved, "28d17ad934816dfc6bd06eb18002ff3bcea09a5f"],
]);
const regenerated = new Map([
  [router, "1a89513b77e404069ef3638c9365ad3a3babeb51"],
  [saved, "28d17ad934816dfc6bd06eb18002ff3bcea09a5f"],
]);

describe("staleFiles", () => {
  test("a file the generator rewrote is stale", () => {
    assert.deepEqual(staleFiles(committed, regenerated), [router]);
    assert.equal(changeTo(router, committed, regenerated), "rewrote");
  });

  test("a file the generator added is stale too", () => {
    const added = "lib/features/new/new_providers.g.dart";
    const after = new Map([...regenerated, [added, "d41d8cd98f00b204e9800998ecf8427e"]]);

    assert.deepEqual(staleFiles(regenerated, after), [added]);
    assert.equal(changeTo(added, regenerated, after), "added");
  });

  test("a file the generator deleted is stale too", () => {
    const after = new Map([[saved, regenerated.get(saved)]]);

    assert.deepEqual(staleFiles(regenerated, after), [router]);
    assert.equal(changeTo(router, regenerated, after), "deleted");
  });

  test("files the generator left as they were are current", () => {
    assert.deepEqual(staleFiles(regenerated, regenerated), []);
  });
});

describe("generatedSources", () => {
  // A scratch checkout: one committed generated file, one not yet committed,
  // one file outside the pattern.
  /** @type {string} */
  let checkout;

  before(() => {
    checkout = mkdtempSync(join(tmpdir(), "check-generated-"));

    /**
     * Runs git quietly in the scratch checkout.
     * @param {...string} args git's arguments
     * @returns {Buffer} git's output, unused
     */
    const git = (...args) => execFileSync("git", args, { cwd: checkout, stdio: "ignore" });

    git("init", "-q");
    writeFileSync(join(checkout, "committed.g.dart"), "committed\n");
    writeFileSync(join(checkout, "hand_written.dart"), "by hand\n");
    git("add", "committed.g.dart", "hand_written.dart");
    git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "first");
    writeFileSync(join(checkout, "added.g.dart"), "added\n");
  });
  after(() => rmSync(checkout, { recursive: true, force: true }));

  test("lists committed and uncommitted files matching the pattern, with a digest", () => {
    const sources = generatedSources(["*.g.dart"], { cwd: checkout });

    assert.deepEqual([...sources.keys()].sort(), ["added.g.dart", "committed.g.dart"]);

    for (const digest of sources.values()) {
      assert.match(digest, /^[0-9a-f]{64}$/);
    }
  });
});

describe("run through a symlink", () => {
  test("prints the same usage message and exit code as a direct run", (context) => {
    const scriptsFolder = dirname(fileURLToPath(import.meta.url));
    const temp = mkdtempSync(join(tmpdir(), "check-generated-"));
    const linkedFolder = join(temp, "scripts");

    context.after(() => rmSync(temp, { recursive: true, force: true }));
    symlinkSync(scriptsFolder, linkedFolder, "dir");

    // With no arguments the script prints its usage and fails: output that does not depend on a checkout.
    /**
     * Runs the script from `folder` with no arguments.
     * @param {string} folder the scripts folder, real or linked
     * @returns {{ status: number | null, stderr: string }} its exit code and what it printed as an error
     */
    const run = (folder) => {
      const { status, stderr } = spawnSync(process.execPath, [join(folder, "check-generated.mjs")], {
        cwd: temp,
        encoding: "utf8",
      });

      return { status, stderr };
    };

    const linked = run(linkedFolder);

    assert.match(linked.stderr, /^Usage: /);
    assert.deepEqual(linked, run(scriptsFolder));
  });
});
