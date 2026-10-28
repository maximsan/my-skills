// @ts-check
// Building and updating an app's CLAUDE.local.md. All functions here are pure.
//
// CLAUDE.local.md is Claude Code's file for personal, per-project notes: it loads right after the project's own
// CLAUDE.md, which we never touch. It starts with NOTES_MARKER so this tool can recognise the files it wrote.

import { isSameLine } from "./text.mjs";

/** First line of every notes file this tool writes. Current Claude Code strips HTML comments, so it costs nothing. */
export const NOTES_MARKER = "<!-- claude-rules: app-notes -->";

const RULES_HEADING = "## Rules for this app";
const STACK_RULES_PLACEHOLDER = "<stack rules>";
const NO_STACK_RULES
  = "None yet. To add some, put an `@` line here pointing at a stack file in `prompts/rules/`, such as `react.md`.";

/**
 * Which template placeholder each package.json script fills, in the order they're tried. `<run one test>` is left
 * for you on purpose: no script says how to run a single test, and a guess would be wrong half the time.
 * @type {{ placeholder: string, scripts: string[] }[]}
 */
const SCRIPT_PLACEHOLDERS = [
  { placeholder: "<build>", scripts: ["build"] },
  { placeholder: "<run all tests>", scripts: ["test"] },
  { placeholder: "<type-check>", scripts: ["typecheck", "type-check", "tsc"] },
  { placeholder: "<lint>", scripts: ["lint"] },
  { placeholder: "<format>", scripts: ["format"] },
];

const SECTION_HEADING_PREFIX = "## ";

/** A placeholder in the template, such as `<run one test>`: a letter after `<`, all on one line. */
const PLACEHOLDER = /<[A-Za-z][^<>\n]*>/g;

/** The fenced code block under "## Commands", with the heading kept in group 1. */
const COMMANDS_CODE_BLOCK = /(## Commands\n\n)```[\s\S]*?```/;

const COMMANDS_HEADING = /^##\s+Commands\b/m;

/** An `@` import line; group 1 is the path. */
const IMPORT_LINE = /^@(\S.*)$/;

/** The characters that mean something special inside a regular expression. */
const REGEXP_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g;

const LINE_BREAK = /\r?\n/;
const CRLF = /\r\n/g;
const LINE_FEED = /\n/g;
const LEADING_LF = /^\n/;

/**
 * A section's placeholders are listed by name in the leftover summary only when every one is this long or shorter.
 * One longer placeholder means the section is prose, and only its heading is shown.
 */
const SHORT_PLACEHOLDER_MAX_LENGTH = 20;

/** More leftover placeholders than this in one section, and the summary names only the section. */
const MAX_PLACEHOLDERS_LISTED = 3;

/**
 * Runs a line-based edit on LF text and gives the result back in the file's own line endings, so a file saved on
 * Windows keeps its CRLFs.
 * @param {string} text the file's text, in its own line endings
 * @param {(lfText: string) => string} edit the change to make, given the text with LF line endings
 * @returns {string} the edited text, in the file's own line endings
 */
const keepingLineEndings = (text, edit) => {
  const usesCrlf = text.includes("\r\n");
  const result = edit(text.replace(CRLF, "\n"));

  return usesCrlf ? result.replace(LINE_FEED, "\r\n") : result;
};

/**
 * Which package manager an app uses, from the lock file in its top folder. npm when there's none.
 * @param {string[]} rootFileNames the names of the files in the app's top folder
 * @returns {"pnpm" | "yarn" | "npm"} the package manager's command name
 */
export const packageManagerFor = (rootFileNames) => {
  if (rootFileNames.includes("pnpm-lock.yaml")) {
    return "pnpm";
  }

  if (rootFileNames.includes("yarn.lock")) {
    return "yarn";
  }

  return "npm";
};

/**
 * The commands we can fill in from package.json, keyed by the placeholder they replace.
 * @param {Record<string, string>} scripts the `scripts` section of package.json
 * @param {"pnpm" | "yarn" | "npm"} packageManager the command that runs the scripts
 * @returns {Map<string, string>} each placeholder, such as "<build>", with the command that replaces it
 */
export const commandsFromScripts = (scripts, packageManager) => {
  const commands = new Map();

  for (const { placeholder, scripts: candidates } of SCRIPT_PLACEHOLDERS) {
    const script = candidates.find((name) => name in scripts);

    if (!script) {
      continue;
    }

    commands.set(placeholder, script === "test" ? `${packageManager} test` : `${packageManager} run ${script}`);
  }

  return commands;
};

/**
 * Escapes text so a regular expression matches it exactly.
 * @param {string} text the text to match
 * @returns {string} the text with every special character escaped
 */
const escapeForRegExp = (text) => text.replace(REGEXP_SPECIAL_CHARACTERS, "\\$&");

/**
 * Fills the template for one app.
 * @param {string} template the notes template, with its `<placeholders>`
 * @param {{ projectName: string, importLines: string[], commands: Map<string, string>,
 *           commandsLiveInProjectFile: boolean }} values
 *   commandsLiveInProjectFile: the project's own CLAUDE.md already lists commands, so point there instead
 * @returns {string} the app's notes, in the template's line endings
 */
export const renderNotes = (template, { projectName, importLines, commands, commandsLiveInProjectFile }) =>
  keepingLineEndings(template, (text) => {
    let notes = text

      // Function replacers: a name or path holding "$&" or "$1" must go in as it is, not as a replacement pattern.
      .replace("<Project name>", () => projectName)
      .replace(STACK_RULES_PLACEHOLDER, () => (importLines.length > 0 ? importLines.join("\n") : NO_STACK_RULES));

    if (commandsLiveInProjectFile) {
      return notes.replace(COMMANDS_CODE_BLOCK, "$1See the project's own `CLAUDE.md`.");
    }

    for (const [placeholder, command] of commands) {
      // The whole line goes: the "e.g." hint after a placeholder describes the placeholder, not your command.
      notes = notes.replace(new RegExp(`^${escapeForRegExp(placeholder)}.*$`, "m"), () => command);
    }

    return notes;
  });

/**
 * The chosen rule lines that the notes don't have yet.
 * @param {string} notes the app's current notes
 * @param {string[]} importLines the `@` lines for the chosen rules
 * @param {NodeJS.Platform} platform on Windows, paths match whatever their case
 * @returns {string[]} the import lines the notes don't have yet
 */
export const missingImportLines = (notes, importLines, platform) => {
  const present = notes.split(LINE_BREAK).map((line) => line.trim());

  return importLines.filter((line) => !present.some((existing) => isSameLine(existing, line, platform)));
};

/**
 * Adds import lines to existing notes: under our "Rules for this app" heading if the file has it, otherwise at the
 * top. Our marker goes first if it's missing, so doctor recognises the file from then on. Under our heading, the
 * "no stack rules" line goes, since the file now has some. Nothing else changes.
 * @param {string} notes the app's current notes
 * @param {string[]} importLines the `@` lines to add
 * @returns {string} the updated notes, in their own line endings
 */
export const insertImportLines = (notes, importLines) =>
  keepingLineEndings(notes, (text) => {
    const withMarker = (/** @type {string} */ body) =>
      body.includes(NOTES_MARKER) ? body : `${NOTES_MARKER}\n${body}`;

    if (importLines.length === 0) {
      return withMarker(text);
    }

    const block = importLines.join("\n");

    if (text.includes(`${RULES_HEADING}\n\n`)) {
      const updated = text

        // A function replacer: a path holding "$&" or "$`" must go in as it is, not as a replacement pattern.
        .replace(`${RULES_HEADING}\n\n`, () => `${RULES_HEADING}\n\n${block}\n`)
        .replace(`${NO_STACK_RULES}\n`, "");

      return withMarker(updated);
    }

    const withoutMarker = text.startsWith(NOTES_MARKER)
      ? text.slice(NOTES_MARKER.length).replace(LEADING_LF, "")
      : text;

    return `${NOTES_MARKER}\n${block}\n\n${withoutMarker}`;
  });

/**
 * Whether the project's own CLAUDE.md already has a "## Commands" section.
 * @param {string | null} projectClaudeMdText the project's own CLAUDE.md
 * @returns {boolean} true when the file has the section
 */
export const hasCommandsSection = (projectClaudeMdText) => COMMANDS_HEADING.test(projectClaudeMdText ?? "");

/**
 * The template's `<placeholders>` still left in the notes: the parts only you can fill in.
 * @param {string} notes the app's current notes
 * @param {string} template the notes template the placeholders come from
 * @returns {string[]} each leftover placeholder once
 */
export const leftoverPlaceholders = (notes, template) => {
  const placeholders = new Set(template.match(PLACEHOLDER) ?? []);

  return [...placeholders].filter((placeholder) => notes.includes(placeholder));
};

/**
 * The leftover placeholders grouped under the heading they sit in, so "what's left" reads as a short to-do list
 * ("Commands: <run one test>", "Where things are") rather than a wall of angle brackets.
 * @param {string} notes the app's current notes
 * @param {string} template the notes template the placeholders come from
 * @returns {{ section: string, placeholders: string[] }[]} each heading with leftovers, in file order
 */
export const leftoverBySection = (notes, template) => {
  const leftover = new Set(leftoverPlaceholders(notes, template));

  /** @type {Map<string, Set<string>>} */
  const sections = new Map();
  let section = "Top of the file";

  for (const line of notes.split(LINE_BREAK)) {
    if (line.startsWith(SECTION_HEADING_PREFIX)) {
      section = line.slice(SECTION_HEADING_PREFIX.length).trim();
    }

    for (const placeholder of line.match(PLACEHOLDER) ?? []) {
      if (!leftover.has(placeholder)) {
        continue;
      }

      if (!sections.has(section)) {
        sections.set(section, new Set());
      }

      sections.get(section)?.add(placeholder);
    }
  }

  return [...sections].map(([name, placeholders]) => ({ section: name, placeholders: [...placeholders] }));
};

/**
 * The leftover placeholders as one short line, for the recap and doctor.
 * @param {{ section: string, placeholders: string[] }[]} sections the leftovers by heading, from leftoverBySection()
 * @returns {string} e.g. "Commands (<run one test>, <format>), Where things are"
 */
export const describeLeftover = (sections) =>
  sections
    .map(({ section, placeholders }) => {
      // In prose sections the placeholders are long sentences; the heading alone says enough.
      const areShort = placeholders.every((placeholder) => placeholder.length <= SHORT_PLACEHOLDER_MAX_LENGTH);
      const areFew = placeholders.length <= MAX_PLACEHOLDERS_LISTED;

      return areShort && areFew ? `${section} (${placeholders.join(", ")})` : section;
    })
    .join(", ");

/**
 * The paths a file imports with `@` lines. Lines inside code fences are skipped, as Claude skips them. A path is read
 * to the end of its line, so one with a space in it isn't cut short.
 * @param {string} text the file's text
 * @returns {string[]} the imported paths, in file order
 */
export const importTargets = (text) => {
  let isInFence = false;
  const targets = [];

  for (const line of text.split(LINE_BREAK)) {
    if (line.trimStart().startsWith("```")) {
      isInFence = !isInFence;
    }

    const match = !isInFence && line.trim().match(IMPORT_LINE);

    if (match) {
      targets.push(match[1]);
    }
  }

  return targets;
};
