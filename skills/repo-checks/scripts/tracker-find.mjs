#!/usr/bin/env node
/**
 * Lists every issue, open or closed, whose title or body mentions a word, in
 * one call: the duplicate check before an issue is created.
 *
 * Usage: node tracker-find.mjs <word>, run inside the checkout.
 */
import { ISSUE_FIELDS, WHOLE_TRACKER, github, issueFrom, mentions, rows } from "./github.mjs";
import { exitCodeOf, runsAsScript } from "./shared.mjs";

/** Wide enough for `closed`, so the titles line up. */
const STATE_WIDTH = 6;

/**
 * The issues in `issues` whose title or body mentions `word`, as listed:
 * newest first.
 * @param {string} word what to look for, in any case
 * @param {import('./github.mjs').Issue[]} issues the issues to search
 * @returns {import('./github.mjs').Issue[]} the matching issues, in their listed order
 */
export function issuesMentioning(word, issues) {
  return issues.filter((issue) => mentions(issue.title, word) || mentions(issue.body, word));
}

/**
 * `#846 open   Three checks sessions repeat by hand become programs`.
 * @param {import('./github.mjs').Issue} issue the issue to print
 * @returns {string} the issue's number, state and title on one line
 */
export function issueLine(issue) {
  return `#${issue.number} ${issue.state.toLowerCase().padEnd(STATE_WIDTH)} ${issue.title}`;
}

/**
 * Prints every issue that mentions the word given on the command line.
 * @param {string[]} argv the command-line arguments after the script's path: just the word
 * @returns {number} the exit code: 0, whether or not an issue mentions the word
 */
export function main(argv) {
  if (argv.length !== 1) {
    throw new Error("Usage: node tracker-find.mjs <word>");
  }

  const [word] = argv;
  const issues = rows(
    github(["issue", "list", "--state", "all", "--limit", String(WHOLE_TRACKER), "--json", ISSUE_FIELDS]),
    issueFrom,
  );
  const found = issuesMentioning(word, issues);

  if (found.length === 0) {
    console.log(`No issue mentions "${word}".`);

    return 0;
  }

  for (const issue of found) {
    console.log(issueLine(issue));
  }

  return 0;
}

const [, , ...scriptArgs] = process.argv;

if (runsAsScript(import.meta.url)) {
  process.exitCode = exitCodeOf(() => main(scriptArgs));
}
