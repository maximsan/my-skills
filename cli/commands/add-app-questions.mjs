// @ts-check
// The questions `add-app` asks, and what it says while looking around. Kept apart from its steps so each file reads
// as one stage: this one is stages 2 and 3 (looking around, questions), `add-app-steps.mjs` is what gets done.

import { isAbsolute, join, resolve, sep } from "node:path";
import { missingImportLines } from "../lib/app-notes.mjs";
import { NOTES_FILE } from "../lib/app-paths.mjs";
import { appDirectoryFromWorkingDirectory, isOurNotes, listAppFolders } from "../lib/apps.mjs";
import { COMMAND_NAME } from "../lib/constants.mjs";
import { EXIT_CODES } from "../lib/errors.mjs";
import { displayPath, homePath, isInsideFolder, spaceInPathWarning, toImportLine } from "../lib/layout.mjs";
import { isComputerSetUp } from "../lib/machine-setup.mjs";

/**
 * A path with its links followed, so two ways of naming one folder compare equal. A path that can't be followed is
 * kept as it is.
 * @param {import("../lib/files.mjs").Files} files reads the file system
 * @param {string} path the path to follow
 * @returns {string} the followed path, or the path as given
 */
const resolvedPath = (files, path) => files.realPath(path) ?? path;

/**
 * The app named on the command line: a folder name next to this repo, or a path.
 * @param {import("../lib/contract.mjs").Context} context the run's layout, files and working folder
 * @param {string} argument the app's folder name or path, as typed
 * @returns {{ directory: string } | { stop: import("../lib/contract.mjs").Stop }} the app's folder, or why to stop
 */
const appFromArgument = ({ layout, files, cwd }, argument) => {
  const looksLikePath
    = isAbsolute(argument) || argument.startsWith(".") || argument.includes(sep) || argument.includes("/");
  const directory = looksLikePath ? resolve(cwd, argument) : join(layout.projectsDirectory, argument);

  if (files.isDirectory(directory)) {
    return { directory };
  }

  return {
    stop: {
      reason: `There's no folder at ${displayPath(directory)}.`,
      fix: `Check the name, or run ${COMMAND_NAME} add-app with no name to pick from a list.`,
      exitCode: EXIT_CODES.USAGE,
    },
  };
};

/**
 * Asks which app, from a pick list of the app folders. The first one not added yet is highlighted first.
 * @param {import("../lib/contract.mjs").Context} context the run's layout, files, questions, printing and options
 * @returns {Promise<{ directory: string } | { stop: import("../lib/contract.mjs").Stop }>} the chosen app's folder, or
 * why to stop
 */
const pickAppFromList = async ({ layout, files, ask, ui, options }) => {
  const apps = listAppFolders(layout, files);

  if (apps.length === 0) {
    return {
      stop: {
        reason: `There are no app folders in ${displayPath(layout.projectsDirectory)} yet.`,
        fix: "Clone an app there, then run add-app again.",
      },
    };
  }

  if (options.yes) {
    return {
      stop: {
        reason: "--yes can't pick an app for you.",
        fix: `Name it: ${COMMAND_NAME} add-app <name> --yes`,
        exitCode: EXIT_CODES.USAGE,
      },
    };
  }

  const items = apps.map((app) => ({ label: app.hasOurNotes ? `${app.name}   (already added)` : app.name }));
  const firstNew = apps.findIndex((app) => !app.hasOurNotes);

  ui.line();

  const choice = await ask.pickOne("Which app?", items, firstNew === -1 ? 0 : firstNew);

  return { directory: apps[choice].directory };
};

/**
 * Works out which app to set up: the argument, else the app folder you're standing in, else a pick list.
 * @param {import("../lib/contract.mjs").Context} context everything the command may use
 * @returns {Promise<{ directory: string } | { stop: import("../lib/contract.mjs").Stop }>} the app's folder, or why to
 * stop
 */
export const chooseApp = async (context) => {
  const [argument] = context.args;

  if (argument) {
    return appFromArgument(context, argument);
  }

  const current = appDirectoryFromWorkingDirectory(context.layout, context.cwd);

  if (current) {
    return { directory: current };
  }

  return pickAppFromList(context);
};

/**
 * Refuses the two folders that are never an app: this rules repo, and the projects folder itself.
 * @param {import("../lib/contract.mjs").Context} context the run's layout, files and platform
 * @param {string} directory the folder picked as the app
 * @returns {import("../lib/contract.mjs").Stop | null} why to stop, or null when the folder can be an app
 */
export const refuseNonApp = ({ layout, files, platform }, directory) => {
  const fix = `Name one app: ${COMMAND_NAME} add-app <name>, or run it with no name to pick from a list.`;

  if (isInsideFolder(resolvedPath(files, layout.repoRoot), resolvedPath(files, directory), platform)) {
    return { reason: `${displayPath(directory)} is this rules repo, not an app.`, fix, exitCode: EXIT_CODES.USAGE };
  }

  if (files.isSamePath(resolvedPath(files, directory), resolvedPath(files, layout.projectsDirectory))) {
    return {
      reason: `${displayPath(directory)} is the projects folder itself, not an app.`,
      fix,
      exitCode: EXIT_CODES.USAGE,
    };
  }

  return null;
};

/**
 * Refuses a folder inside a repo that isn't the repo's top folder: the ignore lines and notes belong at the top.
 * @param {import("../lib/contract.mjs").Context} context the run's files and git
 * @param {string} directory a folder inside a git repository
 * @returns {Promise<import("../lib/contract.mjs").Stop | null>} why to stop, or null when it is the repo's top folder
 */
export const refuseRepoSubfolder = async ({ files, git }, directory) => {
  const topLevel = await git.topLevel(directory);

  if (files.isSamePath(resolvedPath(files, directory), resolvedPath(files, topLevel))) {
    return null;
  }

  return {
    reason: `${displayPath(directory)} is inside the repo at ${displayPath(topLevel)}, not its top folder.`,
    fix: `Run add-app on the repo's top folder: ${COMMAND_NAME} add-app "${displayPath(topLevel)}"`,
    exitCode: EXIT_CODES.USAGE,
  };
};

/**
 * Where the app is, and whether the shared rules and skills can reach it from there.
 * @param {import("../lib/contract.mjs").Context} context the run's layout, files and platform
 * @param {import("../lib/apps.mjs").AppFacts} app what was read from the app's folder
 * @returns {import("../lib/contract.mjs").Finding[]} the lines about the app's location
 */
const describeLocation = ({ layout, files, platform, homeDirectory }, app) => {
  /** @type {import("../lib/contract.mjs").Finding[]} */
  const findings = [{ tone: "ok", text: `App: ${homePath(app.directory, homeDirectory)}` }];

  if (!isInsideFolder(layout.projectsDirectory, app.directory, platform)) {
    findings.push({
      tone: "warn",
      text:
        `It isn't inside ${homePath(layout.projectsDirectory, homeDirectory)}, `
        + "so the shared rules and skills there won't load for it",
    });
  }

  if (!isComputerSetUp(layout, files, platform)) {
    findings.push({
      tone: "warn",
      text: `This computer isn't set up yet, so the shared rules and skills won't load. Run ${COMMAND_NAME} setup too.`,
    });
  }

  const spaceWarning = spaceInPathWarning(layout);

  if (spaceWarning) {
    findings.push({ tone: "warn", text: spaceWarning });
  }

  return findings;
};

/**
 * Whether the app is a git repository, and which of our folders its team already commits.
 * @param {import("./add-app-steps.mjs").RepositoryFacts} repository what git and the disk say about the app's folder
 * @returns {import("../lib/contract.mjs").Finding[]} the lines about the repository
 */
const describeRepository = (repository) => [
  repository.isRepository
    ? { tone: "ok", text: "It's a git repository" }
    : { tone: "warn", text: "It isn't a git repository, so there's nothing to keep your notes out of" },
  ...repository.teamFolders.map(
    /**
     * The warning for one of our folders that the team commits.
     * @param {string} folder the committed folder's name
     * @returns {import("../lib/contract.mjs").Finding} the warning line
     */ (folder) => ({
      tone: "warn",
      text: `${folder} is committed in this repo, so it's the team's. It's left alone: no ignore line, nothing added.`,
    }),
  ),
];

/**
 * The project's own Claude files, which are left as they are, and whether our notes file is already there.
 * @param {import("../lib/apps.mjs").AppFacts} app what was read from the app's folder
 * @returns {import("../lib/contract.mjs").Finding[]} the lines about the app's Claude files
 */
const describeProjectFiles = (app) => {
  /** @type {import("../lib/contract.mjs").Finding[]} */
  const findings = [
    app.projectInstructionFiles.length > 0
      ? {
          tone: "info",
          text:
            `Found the project's own ${app.projectInstructionFiles.join(", ")} — left as is. `
            + `Your notes go in ${NOTES_FILE}.`,
        }
      : { tone: "info", text: `No Claude files of its own. Your notes go in ${NOTES_FILE}.` },
  ];

  if (app.hasAgentsFile) {
    findings.push({ tone: "warn", text: "Found AGENTS.md — Claude won't read it with this setup. Left as is." });
  }

  if (app.notesText !== null && !isOurNotes(app.notesText)) {
    findings.push({ tone: "info", text: `${NOTES_FILE} already exists — only missing rule lines will be added` });
  }

  return findings;
};

/**
 * Each stack that was detected, with why. When none was, the stacks there are to choose from.
 * @param {import("../lib/stacks.mjs").DetectedStack[]} stacks every known stack, with a reason on the detected ones
 * @returns {import("../lib/contract.mjs").Finding[]} the lines about the stacks
 */
const describeStacks = (stacks) => {
  const detected = stacks.filter((stack) => stack.reason);

  if (detected.length === 0) {
    return [{ tone: "info", text: `No stack detected. Available: ${stacks.map((stack) => stack.label).join(", ")}` }];
  }

  return detected.map(
    /**
     * The line for one detected stack.
     * @param {import("../lib/stacks.mjs").DetectedStack} stack a detected stack
     * @returns {import("../lib/contract.mjs").Finding} the stack's name and why it was detected
     */ (stack) => ({
      tone: "ok",
      text: `${stack.label} — ${stack.reason}`,
    }),
  );
};

/**
 * The "Looking around" lines for one app.
 * @param {import("../lib/contract.mjs").Context} context everything the command may use
 * @param {import("../lib/apps.mjs").AppFacts} app what was read from the app's folder
 * @param {import("./add-app-steps.mjs").RepositoryFacts} repository what git and the disk say about the app's folder
 * @param {import("../lib/stacks.mjs").DetectedStack[]} stacks every known stack, with a reason on the detected ones
 * @returns {import("../lib/contract.mjs").Finding[]} every line to show under "Looking around"
 */
export const describeApp = (context, app, repository, stacks) => {
  const added = stacksInNotes(context, app, stacks);

  return [
    ...describeLocation(context, app),
    ...describeRepository(repository),
    ...describeProjectFiles(app),
    ...(added ? [describeAddedStacks(added)] : describeStacks(stacks)),
  ];
};

/**
 * The stacks whose rule lines an added app's notes already have. An app add-app prepared before keeps those, so
 * the stack question isn't asked again.
 * @param {import("../lib/contract.mjs").Context} context the run's platform, which decides if a path's case matters
 * @param {import("../lib/apps.mjs").AppFacts} app what was read from the app's folder
 * @param {import("../lib/stacks.mjs").DetectedStack[]} stacks every known stack
 * @returns {import("../lib/stacks.mjs").DetectedStack[] | null} those stacks, or null when the app isn't added yet
 */
export const stacksInNotes = ({ platform }, app, stacks) => {
  const notes = app.notesText;

  if (!isOurNotes(notes) || notes === null) {
    return null;
  }

  return stacks.filter((stack) => missingImportLines(notes, [toImportLine(stack.file)], platform).length === 0);
};

/**
 * The line for an added app's stacks, which aren't asked about again.
 * @param {import("../lib/stacks.mjs").DetectedStack[]} added the stacks already in its notes
 * @returns {import("../lib/contract.mjs").Finding} which they are, and how to change them
 */
const describeAddedStacks = (added) => ({
  tone: "ok",
  text:
    `Already added, with ${added.length > 0 ? added.map((stack) => stack.label).join(", ") : "no"} stack rules. `
    + `To change them, edit its ${NOTES_FILE}.`,
});

/**
 * Which stack rules the app gets, from one list with the detected stacks already marked. Each stack's hint says why it
 * was detected, or that it wasn't.
 * @param {import("../lib/ask.mjs").Asker} ask the questions a command can ask
 * @param {import("../lib/stacks.mjs").DetectedStack[]} stacks every stack, each with why it was detected, if it was
 * @returns {Promise<import("../lib/stacks.mjs").DetectedStack[]>} the stacks to add rules for; none is a valid answer
 */
export const chooseStacks = async (ask, stacks) => {
  const items = stacks.map((stack) => ({ label: stack.label, hint: stack.reason ?? "not detected in this app" }));
  const detected = stacks.flatMap((stack, index) => (stack.reason ? [index] : []));
  const picked = await ask.pickMany("Stack rules:", items, detected);

  return picked.map((index) => stacks[index]);
};
