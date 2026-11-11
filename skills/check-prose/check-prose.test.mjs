import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { blocks, findings } from "./check-prose.mjs";

/**
 * Why each finding in `text` was reported, without the text it is about.
 * @param {string} text the Markdown to check
 * @returns {string[]} one reason per finding, in the order found
 */
const reasons = (text) => findings(text).map(([why]) => why);

const COUNT = "a count, which goes stale";

describe("a count of parts", () => {
  test("flags a count of parts of the code or the work", () => {
    for (const text of [
      "Classes are joined with cn; seven places that joined them now do.",
      "I compared every element at five widths and in both moods.",
      "The plugin finds 86 places, all warnings.",
      "It compared 14,580 elements in each version.",
      "Nine constants were renamed to fit.",
      "Lint, type check and all 52 unit tests pass.",
    ]) {
      assert.ok(reasons(text).includes(COUNT), text);
    }
  });

  test("passes numbers that are not counts", () => {
    for (const text of [
      "The token is `3 places` in code.",
      "Ruled by the owner on 25 Oct 2026.",
      "Tailwind 4 already has its own class.",
      "-1, 0, 1, 2 and 100 need no name.",
      "The repo has Tailwind 4.3.3 and ESLint 9.",
      "Roasty is 72, 170 or 200px wide.",
      "One of the moments plays.",
      "Its drawing box is 200 × 280.",
      "A step is 1.5 spacing units.",
      "2 is allowed for halves and doubles.",
    ]) {
      assert.ok(!reasons(text).includes(COUNT), text);
    }
  });

  test("passes a count of things outside the code", () => {
    for (const text of [
      "It now rounds all four corners 14px.",
      "A mood is one of the site's two colour themes.",
      "Closes #46 Closes #47 tests",
      "The old fix breaks Tailwind 4 pages.",
    ]) {
      assert.ok(!reasons(text).includes(COUNT), text);
    }
  });
});

describe("a back-reference", () => {
  test("flags \"that\" pointing at a noun never named", () => {
    assert.deepEqual(reasons("Keep that name."), ["\"that name\" never named before it"]);
  });

  test("passes \"that\" which points at nothing", () => {
    assert.deepEqual(reasons("A lesson that short has one card."), []);
    assert.deepEqual(reasons("Stop at the first one that differs."), []);
  });
});

describe("a product name or unit", () => {
  test("passes an acronym beside a capitalized word", () => {
    for (const text of ["Close VS Code first.", "Removes the Neural DSP installers."]) {
      assert.deepEqual(reasons(text), [], text);
    }
  });

  test("passes a size unit", () => {
    assert.deepEqual(reasons("It frees 12 GB of space."), []);
  });

  test("still flags an acronym after the opening word of a sentence", () => {
    assert.deepEqual(reasons("Ship SPM today."), ["acronym SPM never expanded"]);
  });
});

describe("an acronym", () => {
  test("flags one never expanded, and passes one expanded or well known", () => {
    assert.deepEqual(reasons("Ship the SPM build."), ["acronym SPM never expanded"]);
    assert.deepEqual(reasons("Swift Package Manager (SPM) builds it. The PR adds it."), []);
  });

  test("reads \"CO₂\" as one word", () => {
    assert.deepEqual(reasons("Roasting gives off CO₂."), []);
  });
});

describe("sentence shape", () => {
  test("flags an aside between dashes and a request to recall", () => {
    assert.deepEqual(reasons("The value — the old one — stays."), ["aside between dashes"]);
    assert.deepEqual(reasons("Run it as we did before."), ["asks the reader to recall"]);
  });

  test("flags a ticket named by its number alone", () => {
    assert.deepEqual(
      reasons("[#448](https://github.com/maximsan/brewpath/issues/448)."),
      ["a ticket named by its number alone"],
    );
  });

  test("reads no sentence in a heading, a table or a fenced block", () => {
    assert.deepEqual(reasons("# a — b — c\n\n| a — b — c |\n\n```\na — b — c\n```"), []);
  });

  test("reads no acronym in inline code", () => {
    assert.deepEqual(reasons("Run `SPM` first."), []);
  });
});

describe("blocks", () => {
  test("keeps each list item apart and joins its wrapped line", () => {
    assert.deepEqual(blocks("Intro line.\n\n- first item\n  wrapped\n- second item"), [
      "Intro line.",
      "first item wrapped",
      "second item",
    ]);
  });
});

describe("run through a symlink", () => {
  test("prints the same findings as a direct run", (context) => {
    const skillFolder = dirname(fileURLToPath(import.meta.url));
    const temp = mkdtempSync(join(tmpdir(), "check-prose-"));
    const linkedFolder = join(temp, "check-prose");
    const markdown = join(temp, "aside.md");

    context.after(() => rmSync(temp, { recursive: true, force: true }));
    symlinkSync(skillFolder, linkedFolder, "dir");
    writeFileSync(markdown, "The fix — a small one — ships today.\n");

    /**
     * Runs the script from `folder` on the Markdown file.
     * @param {string} folder the skill's folder, real or linked
     * @returns {import("node:child_process").SpawnSyncReturns<string>} what the run printed
     */
    const run = (folder) =>
      spawnSync(process.execPath, [join(folder, "check-prose.mjs"), markdown], { encoding: "utf8" });
    const linked = run(linkedFolder);

    assert.match(linked.stdout, /aside\.md: 1\n/);
    assert.equal(linked.stdout, run(skillFolder).stdout);
  });
});
