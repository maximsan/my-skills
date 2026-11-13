#!/usr/bin/env node
/**
 * Checks prose against the writing rules a script can actually test.
 *
 * Reports, per file: an aside between dashes, a "that X" before X is named, a
 * ticket named by its number alone, and a count of parts of the code or the
 * work, which goes stale in a doc. Every other writing rule needs a reader.
 */
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const COUNT_FINDING = "a count, which goes stale";

/**
 * Nouns that "that" points back at, as in "that name". Kept short: "that short"
 * and "that differs" point at nothing, and a wider net was all false positives.
 */
const POINTS_BACK = ["name", "one", "term", "pair", "value", "number", "file",
  "rule", "ruling", "count", "list", "key", "screen", "word"];
const BACK_REFERENCE = new RegExp(
  String.raw`\bthat (?:old |other |same |first |second )?(?<noun>${POINTS_BACK.join("|")})\b`, "g");

/**
 * A count of parts of the code or the work, such as "seven places", goes stale.
 * Only these nouns count: "all four corners" is usually a fixed fact.
 */
const NUMBER_WORDS = ["two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "twenty", "dozen", "hundred"];
const COUNTED_PARTS = [
  "places", "files", "folders", "lines", "tests", "checks", "rules", "elements",
  "constants", "classes", "components", "modules", "functions", "calls", "commits",
  "pages", "screens", "widths", "strings", "keys", "tokens", "values", "entries",
  "items", "cases", "uses", "sites", "warnings", "errors", "findings", "fixes",
  "issues", "tickets", "branches", "worktrees", "steps", "sections", "scripts",
];
const COUNT_OF_PARTS = new RegExp(
  String.raw`(?<![\w.,#-])(?:\d{1,3}(?:,\d{3})+|\d+|${NUMBER_WORDS.join("|")})`
  + String.raw`(?![\w.,]\d)\s+(?:[a-z]+\s+)?(?:${COUNTED_PARTS.join("|")})\b`,
  "gi");

/** "Tailwind 4 pages": a digit after a product name is its version, not a count. */
const VERSION_BEFORE = /\b[A-Z][\w.]*\s+$/;

/**
 * Matches a count written in digits, such as `4`, which may be a version. A count in words, such as `four`, never is.
 */
const STARTS_WITH_DIGIT = /^\d/;

const LIST_ITEM = /^\s*(?:[-*+]|\d+\.)\s+(?<item>.*)/;
const WRAPPED_LINE = /^\s{2,}\S/;
const NOT_PROSE = ["#", "|", ">"];
const WHITESPACE_RUN = /\s+/g;
const SENTENCE_BREAK = /(?<=[.?!])\s+/;
const INLINE_CODE = /`[^`]*`/g;

/** Two em dashes in one sentence enclose an aside. */
const ASIDE_DASHES = 2;

/** A sentence that is little more than a ticket link: [#448](…). */
const TICKET_LINK_ONLY = /^\W*\[#\d+\]\([^)]*\)\W*$/;

/**
 * Whether `plain` counts parts of the code or the work.
 * @param {string} plain a sentence with its inline code taken out
 * @returns {boolean} true when the sentence holds a count that is not a version number
 */
function countsParts(plain) {
  return [...plain.matchAll(COUNT_OF_PARTS)].some((match) => {
    const [count] = match;
    const isVersion = STARTS_WITH_DIGIT.test(count) && VERSION_BEFORE.test(plain.slice(0, match.index));

    return !isVersion;
  });
}

/**
 * Prose split into blocks, so nothing is glued across a gap. A list item is its
 * own block; a table row, a heading and a fenced block are not prose at all.
 * @param {string} text the Markdown to read
 * @returns {string[]} each paragraph or list item, its lines joined into one
 */
export function blocks(text) {
  /** @type {string[]} */
  const found = [];

  /** @type {string[]} */
  let paragraph = [];
  let fenced = false;

  const endParagraph = () => {
    if (paragraph.length > 0) {
      found.push(paragraph.join(" "));
      paragraph = [];
    }
  };

  for (const line of text.split("\n")) {
    if (line.startsWith("```")) {
      fenced = !fenced;
      continue;
    }

    if (fenced || NOT_PROSE.some((mark) => line.startsWith(mark))) {
      continue;
    }

    const listItem = line.match(LIST_ITEM);

    if (listItem?.groups) {
      endParagraph();
      found.push(listItem.groups.item);
    } else if (!line.trim()) {
      endParagraph();
    } else if (found.length > 0 && WRAPPED_LINE.test(line) && paragraph.length === 0) {
      found[found.length - 1] += ` ${line.trim()}`;
    } else {
      paragraph.push(line.trim());
    }
  }

  endParagraph();

  return found;
}

/**
 * Every sentence of prose, block by block.
 * @param {string} text the Markdown to read
 * @returns {string[]} each sentence, trimmed, in reading order
 */
export function sentences(text) {
  return blocks(text).flatMap((block) =>
    block.replace(WHITESPACE_RUN, " ").split(SENTENCE_BREAK).map((sentence) => sentence.trim()).filter(Boolean));
}

/**
 * The text without inline code, so a path or an identifier is not read as prose.
 * @param {string} text the Markdown to read
 * @returns {string} the text with each inline code span turned into a space
 */
function withoutCode(text) {
  return text.replace(INLINE_CODE, " ");
}

/**
 * Every finding in `text`, as [why, the text it is about].
 * @param {string} text the Markdown to check
 * @returns {[string, string][]} each finding: the reason, then the sentence or word it is about
 */
export function findings(text) {
  /** @type {[string, string][]} */
  const found = [];

  for (const sentence of sentences(text)) {
    const plain = withoutCode(sentence);

    if (plain.split("—").length - 1 >= ASIDE_DASHES) {
      found.push(["aside between dashes", sentence]);
    }

    if (countsParts(plain)) {
      found.push([COUNT_FINDING, sentence]);
    }
  }

  // A back-reference has to follow the thing it names.
  const prose = withoutCode(text);

  for (const match of prose.matchAll(BACK_REFERENCE)) {
    const [reference] = match;
    const noun = match.groups?.noun;

    if (noun && !prose.slice(0, match.index).toLowerCase().includes(noun)) {
      found.push([`"that ${noun}" never named before it`, reference]);
    }
  }

  for (const sentence of sentences(text)) {
    if (TICKET_LINK_ONLY.test(sentence)) {
      found.push(["a ticket named by its number alone", sentence]);
    }
  }

  return found;
}

const NOT_CHECKED = `
Every other writing rule needs a reader: see the Writing section of ~/.claude/CLAUDE.md.
`;

const SHOWN_CHARACTERS = 100;
const SAME_FINDING_CHARACTERS = 60;

/**
 * Prints each file's findings, then what is left to check by reading.
 * @param {string[]} paths the Markdown files to check
 */
function main(paths) {
  let total = 0;

  for (const path of paths) {
    const found = findings(readFileSync(path, "utf8"));

    total += found.length;
    console.log(`\n=== ${path}: ${found.length}`);

    const shown = new Set();

    for (const [why, text] of found) {
      const key = `${why}\n${text.slice(0, SAME_FINDING_CHARACTERS)}`;

      if (!shown.has(key)) {
        shown.add(key);
        console.log(`  ${why}\n      ${text.slice(0, SHOWN_CHARACTERS)}`);
      }
    }
  }

  console.log(`\n${total} to look at`);
  console.log(NOT_CHECKED);
}

/**
 * Whether the module at `importMetaUrl` is the script Node was started with,
 * rather than an import. Both paths are compared with links followed, so a
 * script started through a symlink counts.
 * @param {string} importMetaUrl the calling module's `import.meta.url`
 * @returns {boolean} true when Node was started with that module
 */
export function runsAsScript(importMetaUrl) {
  const [, started] = process.argv;

  try {
    return started !== undefined && realpathSync(started) === realpathSync(fileURLToPath(importMetaUrl));
  } catch {
    // A start path that isn't a file means this module was imported.
    return false;
  }
}

const [, , ...givenPaths] = process.argv;

if (runsAsScript(import.meta.url)) {
  main(givenPaths);
}
