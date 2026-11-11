#!/usr/bin/env node
/**
 * Checks prose against the writing rules a script can actually test.
 *
 * Reports, per file: an aside between dashes, a sentence over the word limit, a
 * back-reference to something never named, a link whose text is only a number,
 * a phrase that asks the reader to recall, an acronym never expanded, and a
 * count of things, which goes stale. What it cannot test is NOT_CHECKED below.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const WORD_LIMIT = 25;
export const COUNT_FINDING = "a count, which goes stale";

const RECALL
  = /\b(?:as (?:we did |mentioned |noted |above|before)|like we did|recall that|as discussed|you.ll remember)/i;

/** An acronym a reader is expected to know without being told. */
const ACRONYM_ALLOWED = new Set([
  "API", "ARB", "CI", "CLI", "CSS", "HTML", "ICU", "ID", "JSON", "OS", "PDF", "PNG",
  "PR", "SDK", "UI", "URL", "UTC", "ADR", "FAQ", "AM", "PM", "TDS", "IOS",
  "DNS", "AI", "HTTPS", "JS", "KB", "EU", "MB", "GB", "TB",
]);

/** Bounded by any letter or digit, so the "CO" of "CO₂" is no acronym. */
const ACRONYM = /(?<![\p{L}\p{N}_])(?<word>[A-Z]{2,})(?![\p{L}\p{N}_])/gu;
const LONGEST_ACRONYM = 5;

/** "VS Code" and "the Neural DSP plugin": a capitalized neighbour makes it a product name. */
const CAPITALIZED_AFTER = /^\s+[A-Z][a-z]/;

/** The word before must not open a sentence, where every word is capitalized. */
const CAPITALIZED_BEFORE = /[\p{Ll},;:]\s+[A-Z][a-z]+\s+$/u;

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

/** A count that starts with a digit may be a version instead. */
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
 * Whether the acronym at `start` to `end` of `prose` is part of a product name.
 * @param {string} prose the text the acronym was found in
 * @param {number} start where the acronym starts in `prose`
 * @param {number} end where the acronym ends in `prose`
 * @returns {boolean} true when a capitalized word next to the acronym makes it a product name
 */
function inProductName(prose, start, end) {
  return CAPITALIZED_AFTER.test(prose.slice(end)) || CAPITALIZED_BEFORE.test(prose.slice(0, start));
}

/**
 * Prose split into blocks, so nothing is glued across a gap. A list item is its
 * own block; a table row, a heading and a fenced block are not prose at all.
 * @param {string} text the Markdown to read
 * @returns {string[]} each paragraph or list item, its lines joined into one
 */
export function blocks(text) {
  const found = [];
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

    if (listItem) {
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
  const found = [];

  for (const sentence of sentences(text)) {
    const plain = withoutCode(sentence);

    if (plain.split("—").length - 1 >= ASIDE_DASHES) {
      found.push(["aside between dashes", sentence]);
    }

    const words = plain.split(WHITESPACE_RUN).filter(Boolean).length;

    if (words > WORD_LIMIT) {
      found.push([`${words} words, over ${WORD_LIMIT}`, sentence]);
    }

    if (RECALL.test(plain)) {
      found.push(["asks the reader to recall", sentence]);
    }

    if (countsParts(plain)) {
      found.push([COUNT_FINDING, sentence]);
    }
  }

  // A back-reference has to follow the thing it names.
  const prose = withoutCode(text);

  for (const match of prose.matchAll(BACK_REFERENCE)) {
    const [reference] = match;
    const { noun } = match.groups;

    if (!prose.slice(0, match.index).toLowerCase().includes(noun)) {
      found.push([`"that ${noun}" never named before it`, reference]);
    }
  }

  for (const match of prose.matchAll(ACRONYM)) {
    const { word } = match.groups;
    const named = inProductName(prose, match.index, match.index + word.length);

    if (!ACRONYM_ALLOWED.has(word) && !named && word.length <= LONGEST_ACRONYM && !text.includes(`(${word})`)) {
      found.push([`acronym ${word} never expanded`, word]);
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
Still to check by reading (the skill's SKILL.md shows a bad and a good example
of each):
  - the four questions: result first, clear to a newcomer, every term
    explained, nothing removable
  - whether a sentence holds one fact or three (word count is only a proxy)
  - whether a claim about the code is true
  - an aside in parentheses: source pointers like "(source: GLOSSARY.md)" are
    parentheses too, so a check would flag every one of them
  - a chain of negatives, where the true thing should come first
  - an old-versus-new comparison that should be an "Old: / New:" list
  - a project term used without its definition on first use
  - a word with two meanings, such as "reset" or "cleared": domain terms in
    some repos, so a check would fire on every use
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

const [, startedScript, ...givenPaths] = process.argv;

if (startedScript === fileURLToPath(import.meta.url)) {
  main(givenPaths);
}
