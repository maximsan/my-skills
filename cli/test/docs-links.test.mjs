// @ts-check
// Every relative link in the repo's Markdown reaches a file, and every `#heading` part reaches a heading in it, named
// the way GitHub names headings. Moving a section breaks links in other files, and nothing else checks them.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { test } from "node:test";
import { REAL_REPO_ROOT } from "./helpers.mjs";

const LINE_BREAK = /\r?\n/;
const FENCE = /^\s*(```|~~~)/;
const HEADING = /^#{1,6}\s+(.+?)\s*#*\s*$/;
const INLINE_CODE = /`[^`]*`/g;
const LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

// Anything with a scheme (https:, mailto:) is outside the repo, and a <placeholder> is a template to fill in.
const NOT_A_FILE = /^[a-z][a-z0-9+.-]*:|[<>]/i;

// GitHub drops every character that isn't a letter, a digit, a space, a dash or an underscore.
const NOT_IN_SLUG = /[^\p{L}\p{N} _-]/gu;
const SPACE = / /g;

/**
 * The lines of a Markdown file outside code blocks, where a link or a heading is only text.
 * @param {string} text the file's text
 * @returns {string[]} the lines outside fenced code
 */
const proseLines = (text) => {
  let isInFence = false;

  return text.split(LINE_BREAK).filter((line) => {
    if (FENCE.test(line)) {
      isInFence = !isInFence;

      return false;
    }

    return !isInFence;
  });
};

/**
 * The anchors GitHub gives a file's headings. A repeated heading gets -1, -2 and so on.
 * @param {string} text the file's text
 * @returns {Set<string>} every anchor in the file
 */
const anchorsIn = (text) => {
  /** @type {Map<string, number>} */
  const seen = new Map();
  const anchors = new Set();

  for (const line of proseLines(text)) {
    const match = line.match(HEADING);

    if (match) {
      const slug = match[1].replace(/`/g, "").toLowerCase().replace(NOT_IN_SLUG, "").replace(SPACE, "-");
      const count = seen.get(slug) ?? 0;

      anchors.add(count === 0 ? slug : `${slug}-${count}`);
      seen.set(slug, count + 1);
    }
  }

  return anchors;
};

/**
 * Every link in a file that points inside the repo.
 * @param {string} text the file's text
 * @returns {string[]} the link targets, as written
 */
const repoLinksIn = (text) =>
  proseLines(text).flatMap((line) =>
    [...line.replace(INLINE_CODE, "").matchAll(LINK)]
      .map((match) => match[1])
      .filter((target) => !NOT_A_FILE.test(target)),
  );

const markdownFiles = execFileSync("git", ["ls-files", "*.md"], { cwd: REAL_REPO_ROOT, encoding: "utf8" })
  .split(LINE_BREAK)
  .filter(Boolean);

test("every relative link in the Markdown reaches its file, and its heading", () => {
  /** @type {Map<string, Set<string>>} */
  const anchorCache = new Map();

  /**
   * The anchors in one file, read once.
   * @param {string} path the file's full path
   * @returns {Set<string>} its anchors
   */
  const anchorsOf = (path) => {
    const cached = anchorCache.get(path) ?? anchorsIn(readFileSync(path, "utf8"));

    anchorCache.set(path, cached);

    return cached;
  };

  const broken = markdownFiles.flatMap((file) => {
    const source = join(REAL_REPO_ROOT, file);

    return repoLinksIn(readFileSync(source, "utf8")).flatMap((target) => {
      const [pathPart, anchor] = target.split("#");
      const destination = pathPart ? join(dirname(source), decodeURIComponent(pathPart)) : source;

      if (!existsSync(destination)) {
        return [`${file}: ${target} (no such file)`];
      }

      const isMarkdown = destination.endsWith(".md");

      if (anchor && isMarkdown && !anchorsOf(destination).has(anchor.toLowerCase())) {
        return [`${file}: ${target} (no heading #${anchor} in ${relative(REAL_REPO_ROOT, destination)})`];
      }

      return [];
    });
  });

  assert.deepEqual(broken, []);
});
