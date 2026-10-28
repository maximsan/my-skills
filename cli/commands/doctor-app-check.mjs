// @ts-check
// doctor's check for one app: add-app's own step checks, plus what only doctor looks at.
//
// It's kept apart from doctor.mjs, so that file stays a short list of checks. The `@` line check lives here too.
// doctor also runs it on the shared rules file.

import { isAbsolute, join, resolve } from "node:path";
import { importTargets, leftoverBySection } from "../lib/app-notes.mjs";
import { NOTES_FILE } from "../lib/app-paths.mjs";
import { COMMAND_NAME } from "../lib/constants.mjs";
import { expandHome, spaceInPathWarning } from "../lib/layout.mjs";
import { appSafetySteps, readRepositoryFacts } from "./add-app-steps.mjs";

/**
 * The fix that sends you to add-app: for one app when it's named, or to pick one when it isn't.
 * @param {string} [name] the app's folder name
 * @returns {string} the fix, as a command to run
 */
export const runAddApp = (name) => `Run ${COMMAND_NAME} add-app${name ? ` ${name}` : ""}`;

/**
 * Finds the `@` lines in a file that have a problem, sorted by what the problem is. Claude skips a missing import
 * without saying so, so doctor has to look.
 * @param {string} text the file's text
 * @param {string} fromDirectory imports resolve relative to the file that has them
 * @param {import("../lib/contract.mjs").Context} context the run's files and home folder
 * @returns {{ broken: string[], withSpace: string[] }} broken: pointing at nothing; withSpace: they exist, but
 *   Claude may not read a path with a space in it
 */
export const findImportProblems = (text, fromDirectory, { files, homeDirectory }) => {
  const targets = importTargets(text).map((target) => {
    const expanded = expandHome(target, homeDirectory);
    const path = isAbsolute(expanded) ? expanded : resolve(fromDirectory, expanded);

    return { target, exists: files.exists(path) };
  });

  return {
    broken: targets.filter(({ exists }) => !exists).map(({ target }) => target),
    withSpace: targets.filter(({ exists, target }) => exists && target.includes(" ")).map(({ target }) => target),
  };
};

/**
 * @typedef {object} AppResults
 * @property {import("../lib/contract.mjs").CheckResult[]} results what add-app's checks and doctor's own found
 * @property {string} gitState how git sees the app's notes, e.g. "kept out of git: …", for a result with no problem
 * @property {string} notes the app's CLAUDE.local.md
 * @property {string[]} withSpace `@` paths in the notes that exist but have a space in them
 */

/**
 * Runs add-app's own checks for the folders, the skill links and the ignore lines on one app, then doctor's own:
 * `@` lines that point at nothing, and a notes file the repo has committed.
 * @param {import("../lib/contract.mjs").Context} context everything the command may use
 * @param {import("../lib/apps.mjs").AppFolder} app the app folder to check
 * @returns {Promise<AppResults>} everything the checks found in the app
 */
const collectAppResults = async (context, app) => {
  const { files, git } = context;
  const repository = await readRepositoryFacts(context, app.directory);
  const { folders, skills, exclude, verify } = appSafetySteps(context, app.directory, repository);

  // The ignore check's "todo" only means it waits for the ignore lines, which the exclude result already reports.
  const verifyResult = await verify.check();
  const results = [
    await folders.check(),
    await skills.check(),
    await exclude.check(),
    ...(verifyResult.status === "todo" ? [] : [verifyResult]),
  ];

  const notes = files.readText(join(app.directory, NOTES_FILE)) ?? "";
  const { broken, withSpace } = findImportProblems(notes, app.directory, context);

  if (broken.length > 0) {
    results.push({
      status: "blocked",
      reason: `these @ lines point at nothing: ${broken.join(", ")}`,
      fix: runAddApp(app.name),
    });
  }

  if (repository.isRepository && (await git.isTracked(app.directory, NOTES_FILE))) {
    results.push({
      status: "blocked",
      reason: `${NOTES_FILE} is committed to the repo`,
      fix: "Ask the team why it's committed.",
    });
  }

  const gitState = repository.isRepository ? (verifyResult.reason ?? "") : "not a git repository";

  return { results, gitState, notes, withSpace };
};

/**
 * One finding as the row's reason, or several as points listed under the row, so no row runs on with semicolons.
 * @param {string[]} reasons what was found, one entry each
 * @returns {{ reason: string } | { points: string[] }} the reason when there's one, the points otherwise
 */
const asReasonOrPoints = (reasons) => (reasons.length === 1 ? { reason: reasons[0] } : { points: reasons });

/**
 * Turns everything found in one app into its one row. Problems block, and each one's fix is listed once. With no
 * problem, a path with a space is only worth a look. Placeholders left to fill in are mentioned, but aren't a
 * warning.
 * @param {import("../lib/contract.mjs").Context} context the run's files and layout
 * @param {import("../lib/apps.mjs").AppFolder} app the app folder that was checked
 * @param {AppResults} found everything the checks found in the app
 * @returns {import("../lib/contract.mjs").CheckResult} the app's one row
 */
const summariseAppResults = ({ files, layout }, app, { results, gitState, notes, withSpace }) => {
  const blocked = results.filter((result) => result.status === "blocked");
  const todo = results.filter((result) => result.status === "todo");

  if (blocked.length > 0 || todo.length > 0) {
    const fixes = [
      ...blocked.map((result) => result.fix ?? runAddApp(app.name)),
      ...(todo.length > 0 ? [runAddApp(app.name)] : []),
    ];

    return {
      status: blocked.length > 0 ? "blocked" : "todo",
      ...asReasonOrPoints([...blocked, ...todo].map((result) => result.reason ?? "")),
      fix: [...new Set(fixes)].join(" "),
    };
  }

  // Placeholders left in the notes aren't a problem: Claude fills them in on its first task in the app, and asks
  // you to check them. So they're mentioned, never warned about.
  const hasLeftover = leftoverBySection(notes, files.readText(layout.notesTemplate) ?? "").length > 0;
  const fillNote = hasLeftover ? `Claude fills in the rest of ${NOTES_FILE} on its first task here` : "";

  if (withSpace.length === 0) {
    return { status: "done", reason: [gitState, fillNote].filter(Boolean).join("; ") };
  }

  return {
    status: "warn",
    points: [gitState, spaceInPathWarning(layout) ?? "a path has a space in it", fillNote].filter(Boolean),
  };
};

/**
 * One check per app that has our notes. It runs add-app's own checks for the folders, the skill links and the ignore
 * lines, then adds what only doctor looks at. Problems block; placeholders left to fill in are only mentioned.
 * @param {import("../lib/contract.mjs").Context} context everything the command may use
 * @param {import("../lib/apps.mjs").AppFolder} app the app folder to check
 * @returns {import("../lib/contract.mjs").Step} the step that checks the app
 */
export const appStep = (context, app) => ({
  title: `App ${app.name}`,
  check: async () => summariseAppResults(context, app, await collectAppResults(context, app)),
});
