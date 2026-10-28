// @ts-check
// Whether you let Claude Code load the rules. The first time Claude starts in a folder whose CLAUDE.md imports files
// from outside it, it asks whether to allow them, and keeps your answer in its own state file, ~/.claude.json, with
// one entry per folder it was started in. `doctor` reads that answer. Nothing here writes the file.
//
// The file belongs to Claude Code and its shape isn't documented, so anything unexpected means "can't tell", never a
// failure. All functions here are pure.

import { join } from "node:path";
import { plural } from "./text.mjs";

/** The two flags Claude Code keeps per folder: the answer, and whether the question was shown at all. */
const APPROVED_FLAG = "hasClaudeMdExternalIncludesApproved";
const SHOWN_FLAG = "hasClaudeMdExternalIncludesWarningShown";

const TRAILING_SLASHES = /[\\/]+$/;
const BACKSLASHES = /\\/g;

/**
 * Where Claude Code keeps its state, including the answers to the import question.
 * @param {string} homeDirectory your home folder
 * @returns {string} e.g. C:\Users\me\.claude.json
 */
export const claudeStateFile = (homeDirectory) => join(homeDirectory, ".claude.json");

/**
 * @typedef {"yes" | "no" | "not-asked" | "unknown"} ImportAnswer
 *   yes: you allowed the imports. no: you refused them, so the rules don't load. not-asked: Claude hasn't been started
 *   there yet, or hasn't asked. unknown: the entry is there, but without the flags this reads.
 * @typedef {{ name: string, answer: ImportAnswer }} FolderAnswer
 * @typedef {{ kind: "unreadable" } | { kind: "read", answers: FolderAnswer[] }} ImportAnswers
 */

/**
 * A folder path as Claude Code's entries may spell it: with either slash, and on Windows in any case.
 * @param {string} path the folder's path
 * @param {NodeJS.Platform} platform the operating system, which decides whether case matters
 * @returns {string} the path with forward slashes and no slash at the end
 */
const normalise = (path, platform) => {
  const forward = path.replace(BACKSLASHES, "/").replace(TRAILING_SLASHES, "");

  return platform === "win32" ? forward.toLowerCase() : forward;
};

/**
 * What one folder's entry says about the import question.
 * @param {unknown} entry the folder's entry under "projects", if there is one
 * @returns {ImportAnswer} the answer it records
 */
const answerIn = (entry) => {
  if (entry === undefined) {
    return "not-asked";
  }

  if (!entry || typeof entry !== "object") {
    return "unknown";
  }

  const { [APPROVED_FLAG]: approved, [SHOWN_FLAG]: shown } = /** @type {Record<string, unknown>} */ (entry);

  if (typeof approved !== "boolean" && typeof shown !== "boolean") {
    return "unknown";
  }

  if (approved === true) {
    return "yes";
  }

  return shown === true ? "no" : "not-asked";
};

/**
 * Reads the answer to the import question for each folder.
 * @param {string | null} text the state file's text, or null when there is no file
 * @param {{ name: string, path: string }[]} folders the folders to look up, by the name messages use
 * @param {NodeJS.Platform} platform the operating system, which decides whether a path's case matters
 * @returns {ImportAnswers} unreadable when the file is missing or isn't shaped as expected; otherwise one answer per
 *   folder
 */
export const readImportAnswers = (text, folders, platform) => {
  if (text === null) {
    return { kind: "unreadable" };
  }

  /** @type {unknown} */
  let state;

  try {
    state = JSON.parse(text);
  } catch {
    return { kind: "unreadable" };
  }

  const projects = state && typeof state === "object" ? /** @type {Record<string, unknown>} */ (state).projects : null;

  if (!projects || typeof projects !== "object") {
    return { kind: "unreadable" };
  }

  const entries = new Map(
    Object.entries(projects).map(([path, entry]) => [normalise(path, platform), /** @type {unknown} */ (entry)]),
  );

  return {
    kind: "read",
    answers: folders.map(({ name, path }) => ({ name, answer: answerIn(entries.get(normalise(path, platform))) })),
  };
};

/**
 * Whether the answers leave any folder unknown, so doctor still needs its reminder about the question.
 * @param {ImportAnswers} answers what readImportAnswers found
 * @returns {boolean} true when the file couldn't be read, or a folder's entry couldn't
 */
export const hasUnknownAnswers = (answers) =>
  answers.kind === "unreadable" || answers.answers.some(({ answer }) => answer === "unknown");

/**
 * What the answers mean, as a check result.
 * @param {ImportAnswers} answers what readImportAnswers found
 * @param {string} shownFile the state file as messages show it, e.g. ~/.claude.json
 * @returns {import("./contract.mjs").CheckResult} done, blocked or skipped, with the reason and any fix
 */
export const describeImportAnswers = (answers, shownFile) => {
  if (answers.kind === "unreadable") {
    return { status: "skipped", reason: `can't tell: ${shownFile} is missing, or not in a shape this reads` };
  }

  const named = (/** @type {ImportAnswer} */ answer) =>
    answers.answers.filter((folder) => folder.answer === answer).map((folder) => folder.name);
  const refused = named("no");

  if (refused.length > 0) {
    return {
      status: "blocked",
      reason: `you chose No in ${refused.join(", ")}, so the rules don't load there`,
      fix:
        `Close Claude. In ${shownFile}, under "projects", find that folder, and set "${APPROVED_FLAG}" and `
        + `"${SHOWN_FLAG}" to false. The next chat there asks again: choose Yes.`,
    };
  }

  const unknown = named("unknown");

  if (unknown.length > 0) {
    return { status: "skipped", reason: `can't tell for ${unknown.join(", ")}` };
  }

  // A folder Claude was never started in is never asked, and neither is one whose imports are all inside it. Both
  // are normal, so they're counted, not listed.
  const allowed = named("yes").length;
  const notAsked = named("not-asked").length;
  const parts = [
    ...(allowed > 0 ? [`allowed in ${plural(allowed, "folder")}`] : []),
    ...(notAsked > 0 ? [`not asked in ${plural(notAsked, "folder")}`] : []),
  ];

  return { status: "done", reason: parts.join("; ") };
};
