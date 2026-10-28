#!/usr/bin/env node
/**
 * Checks the changelog entries in changelog/, one file per entry, and builds CHANGELOG.md from them.
 *
 *   node scripts/changelog.mjs           check; exit 1 on any problem
 *   node scripts/changelog.mjs --build   check, then write CHANGELOG.md: the intro, then every entry, newest first
 *
 * One file per entry means two branches never edit the same file, so they never conflict here.
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FOLDER = join(ROOT, "changelog");
const INTRO = "README.md";
const BUILT = join(ROOT, "CHANGELOG.md");
/** An entry's file name: `YYYY-MM-DD-short-title.md`. */
const FILE_NAME = /^(\d{4}-\d{2}-\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
/** An entry's first line: `## YYYY-MM-DD — Title`. */
const ENTRY_HEADING = /^## (\d{4}-\d{2}-\d{2}) — (.+)$/;

/** Whether a `YYYY-MM-DD` string is a real day: Date rolls "2026-02-30" over to 2 March, so compare the round trip. */
const isRealDate = (date) => {
  const parsed = new Date(date);

  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
};

/** The problems with one entry file; none means it's well-formed. */
const problemsIn = (name, text) => {
  const nameMatch = name.match(FILE_NAME);

  if (!nameMatch) {
    return ["the name isn't YYYY-MM-DD-short-title.md, in lower case"];
  }

  const found = [];
  const [heading, ...rest] = text.split("\n");
  const headingMatch = heading.match(ENTRY_HEADING);

  if (!isRealDate(nameMatch[1])) {
    found.push(`"${nameMatch[1]}" is not a real date`);
  }

  if (!headingMatch) {
    found.push(`the first line isn't "## YYYY-MM-DD — Title": ${heading}`);
  } else if (headingMatch[1] !== nameMatch[1]) {
    found.push(`the heading's date, ${headingMatch[1]}, isn't the file name's, ${nameMatch[1]}`);
  }

  if (rest.some((line) => line.startsWith("## "))) {
    found.push("it has a second ## heading; use ### inside an entry");
  }

  if (!text.endsWith("\n") || text.endsWith("\n\n") || /\n---\s*$/.test(text)) {
    found.push("it should end with its last line and one newline, with no --- separator");
  }

  return found;
};

/** Links are written from changelog/, and the built file sits one folder up, so `../docs/x.md` becomes `docs/x.md`. */
const fromTopFolder = (text) => text.replaceAll("](../", "](");

const main = () => {
  const build = process.argv.includes("--build");
  const names = readdirSync(FOLDER).filter((name) => name !== INTRO).sort().reverse();
  const entries = names.map((name) => ({ name, text: readFileSync(join(FOLDER, name), "utf8") }));
  const problems = entries.flatMap(({ name, text }) => problemsIn(name, text).map((problem) => `${name}: ${problem}`));

  if (problems.length > 0) {
    console.error("changelog/:");
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  if (build) {
    const intro = readFileSync(join(FOLDER, INTRO), "utf8");
    const parts = [intro, ...entries.map(({ text }) => text)].map((text) => fromTopFolder(text.trimEnd()));

    writeFileSync(BUILT, parts.join("\n\n---\n\n") + "\n");
    console.log(`CHANGELOG.md built: ${entries.length} entries, newest first.`);
    return;
  }

  console.log(`changelog/ OK — ${entries.length} entries.`);
};

main();
