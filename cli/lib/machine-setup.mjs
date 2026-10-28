// @ts-check
// The state of the once-per-computer setup, read and described the same way by `setup` (to decide what to do) and
// `doctor` (to report it). One reading and one description, so the two commands can never disagree about what
// "set up" means, or give different fixes for the same problem.

import { dirname, join } from "node:path";
import { listAppFolders } from "./apps.mjs";
import { COMMAND_NAME, MINIMUM_NODE_MAJOR } from "./constants.mjs";
import { findExecutable } from "./exec.mjs";
import { GIT_MISSING } from "./git.mjs";
import { displayPath, relativeInside, toImportLine } from "./layout.mjs";
import { isSameLine, plural } from "./text.mjs";

/** The "v" in front of a Node version string, e.g. "v20.11.0". */
const VERSION_PREFIX = /^v/;

/** A line break, with or without the carriage return Windows adds. */
const LINE_BREAK = /\r?\n/;

/**
 * The major version number from a Node version string.
 * @param {string} version e.g. "v20.11.0"
 * @returns {number} the major version, e.g. 20
 */
const nodeMajorVersion = (version) => Number(version.replace(VERSION_PREFIX, "").split(".")[0]);

/**
 * The checks for the tools this CLI needs: a new enough Node, and git on PATH. doctor shows both. setup only needs
 * git's, since main.mjs has already checked Node before setup can start. When a check is done, its reason is the
 * version found.
 * @param {import("./contract.mjs").Context} context the run's Node version, git and paths
 * @returns {{ node: import("./contract.mjs").Step, git: import("./contract.mjs").Step }} one check for each tool
 */
export const checkTools = ({ nodeVersion, git, layout }) => ({
  node: {
    title: `Node ${MINIMUM_NODE_MAJOR} or newer`,
    check: () =>
      nodeMajorVersion(nodeVersion) >= MINIMUM_NODE_MAJOR
        ? { status: "done", reason: nodeVersion }
        : { status: "blocked", reason: `found ${nodeVersion}`, fix: "Install a current Node from https://nodejs.org." },
  },
  git: {
    title: "git",
    check: async () => {
      const version = await git.version(layout.repoRoot);

      return version ? { status: "done", reason: version } : { status: "blocked", ...GIT_MISSING };
    },
  },
});

/**
 * Whether the text has this line, ignoring spaces around it.
 * @param {string | null} text the file's text, or null when there is no file
 * @param {string} line the line to look for
 * @param {NodeJS.Platform} platform on Windows, a path in the line matches whatever its case
 * @returns {boolean} true when one of the lines matches
 */
export const hasLine = (text, line, platform) =>
  Boolean(text?.split(LINE_BREAK).some((existing) => isSameLine(existing.trim(), line, platform)));

/**
 * @typedef {{ kind: "source-missing" }
 *   | { kind: "missing" }
 *   | { kind: "without-line", text: string }
 *   | { kind: "present", text: string }} SharedRulesState
 */

/**
 * Reads projects/CLAUDE.md: whether it exists, and whether it has the line that loads the shared rules.
 * @param {import("./layout.mjs").Layout} layout where the shared rules file and the common rules file are
 * @param {import("./files.mjs").Files} files reads the disk
 * @param {NodeJS.Platform} platform the operating system, which decides whether a path's case matters
 * @returns {SharedRulesState} this repo's common rules file missing, or projects/CLAUDE.md missing, without the
 *   line, or with it; with the file's text when it exists
 */
export const readSharedRulesState = (layout, files, platform) => {
  if (!files.exists(layout.commonRulesFile)) {
    return { kind: "source-missing" };
  }

  const text = files.readText(layout.sharedRulesFile);

  if (text === null) {
    return { kind: "missing" };
  }

  return hasLine(text, toImportLine(layout.commonRulesFile), platform)
    ? { kind: "present", text }
    : { kind: "without-line", text };
};

/**
 * What the shared rules state means, as a check result. `todo` is what `setup` does.
 * @param {SharedRulesState} state what readSharedRulesState found
 * @param {import("./layout.mjs").Layout} layout where the common rules file is, for the message
 * @returns {import("./contract.mjs").CheckResult} done, todo or blocked, with the reason and any fix
 */
export const describeSharedRules = (state, layout) => {
  switch (state.kind) {
    case "source-missing":
      return {
        status: "blocked",
        reason: `${displayPath(layout.commonRulesFile)} is missing from this repo`,
        fix: "Run git pull in this repo, or clone it again.",
      };
    case "missing":
      return { status: "todo", reason: "the file doesn't exist yet", action: "create it, with the line" };
    case "without-line":
      return {
        status: "todo",
        reason: "the file doesn't have the line yet",
        action: "add the line at the top, after a backup beside it",
      };
    case "present":
      return { status: "done", reason: "the line is there" };
  }
};

/**
 * @typedef {{ kind: "ours" }
 *   | { kind: "missing" }
 *   | { kind: "empty-folder" }
 *   | { kind: "other-link", target: string }
 *   | { kind: "folder-with-files", count: number }
 *   | { kind: "file" }} SkillsLinkState
 */

/**
 * Reads what's at projects/.claude/skills: our link, another link, a folder, a file, or nothing.
 * @param {import("./layout.mjs").Layout} layout where the skills link and the skills folder are
 * @param {import("./files.mjs").Files} files reads the disk
 * @returns {SkillsLinkState} what is at the link's path
 */
export const readSkillsLinkState = (layout, files) => {
  const found = files.inspectPath(layout.skillsLink);

  if (found.kind === "missing") {
    return { kind: "missing" };
  }

  if (found.kind === "file") {
    return { kind: "file" };
  }

  if (found.kind === "link") {
    return files.isSamePath(found.target, layout.skillsSource)
      ? { kind: "ours" }
      : { kind: "other-link", target: found.target };
  }

  return found.entries.length === 0
    ? { kind: "empty-folder" }
    : { kind: "folder-with-files", count: found.entries.length };
};

/**
 * What the skills link state means, as a check result. `todo` is what `setup` does.
 * @param {SkillsLinkState} state what readSkillsLinkState found
 * @param {import("./layout.mjs").Layout} layout where the skills link and the skills folder are, for the message
 * @param {{ mayReplaceOtherLink: boolean, skillCount: number }} options what the user agreed to, and how many skills
 *   there are
 *   mayReplaceOtherLink: the user agreed to replace a link that points somewhere else
 * @returns {import("./contract.mjs").CheckResult} done, todo or blocked, with the reason and any fix
 */
export const describeSkillsLink = (state, layout, { mayReplaceOtherLink, skillCount }) => {
  switch (state.kind) {
    case "ours":
      return { status: "done", reason: plural(skillCount, "skill") };
    case "missing":
      return { status: "todo", reason: "there's no link yet", action: "create the link" };
    case "empty-folder":
      return { status: "todo", reason: "it's an empty folder", action: "replace the empty folder with the link" };
    case "other-link":
      return mayReplaceOtherLink
        ? {
            status: "todo",
            reason: `it's a link to ${displayPath(state.target)}`,
            action: `replace the link, which points to ${displayPath(state.target)}`,
          }
        : {
            status: "blocked",
            reason: `it's a link to ${displayPath(state.target)}, not to this repo's skills`,
            fix: `Run ${COMMAND_NAME} setup and answer yes to replacing it, or change the link yourself.`,
          };
    case "folder-with-files":
      return {
        status: "blocked",
        reason: `it's a real folder with ${plural(state.count, "item")} in it, so it's never deleted`,
        fix:
          `Move what's in it into ${displayPath(layout.skillsSource)} or somewhere safe, `
          + `delete the empty folder, then run ${COMMAND_NAME} setup.`,
      };
    case "file":
      return {
        status: "blocked",
        reason: "a file is in the way",
        fix: `Move or delete ${displayPath(layout.skillsLink)}, then run ${COMMAND_NAME} setup.`,
      };
  }
};

/**
 * How many skills this repo provides: sub-folders with a SKILL.md.
 * @param {import("./layout.mjs").Layout} layout where this repo's skills folder is
 * @param {import("./files.mjs").Files} files reads the skills folder
 * @returns {number} the number of skills
 */
export const countSkills = (layout, files) =>
  files.listDirectory(layout.skillsSource).filter((name) => files.exists(join(layout.skillsSource, name, "SKILL.md")))
    .length;

/**
 * @typedef {{ kind: "missing" } | { kind: "ours", path: string } | { kind: "elsewhere", path: string }} CommandState
 */

/**
 * Whether `claude-rules` is on PATH, and whether it runs this copy of the repo. npm links the command back to the
 * clone it was installed from: through a symlink on macOS and Linux, and through
 * `<npm folder>\node_modules\claude-rules` (a junction) next to the `.cmd` launcher on Windows.
 * @param {import("./layout.mjs").Layout} layout where this repo is
 * @param {import("./files.mjs").Files} files follows links to where they lead
 * @param {{ env: NodeJS.ProcessEnv, platform: NodeJS.Platform }} environment the PATH to search, and the operating
 *   system
 * @returns {CommandState} whether the command was found, and whether it runs this repo
 */
export const readCommandState = (layout, files, { env, platform }) => {
  const path = findExecutable(COMMAND_NAME, { env, platform });

  if (!path) {
    return { kind: "missing" };
  }

  const repoRoot = files.realPath(layout.repoRoot) ?? layout.repoRoot;
  const candidates = [files.realPath(path), files.realPath(join(dirname(path), "node_modules", COMMAND_NAME))];
  const isInsideRepo = (/** @type {string | null} */ candidate) =>
    candidate !== null && relativeInside(repoRoot, candidate) !== null;

  return candidates.some(isInsideRepo) ? { kind: "ours", path } : { kind: "elsewhere", path };
};

/**
 * Whether `setup` has nothing left to do on this computer.
 * @param {import("./layout.mjs").Layout} layout where the shared rules file, the skills link and this repo are
 * @param {import("./files.mjs").Files} files reads the disk
 * @param {NodeJS.Platform} platform the operating system, which decides whether a path's case matters
 * @returns {boolean} true when the shared rules line and the skills link are both in place
 */
export const isComputerSetUp = (layout, files, platform) =>
  readSharedRulesState(layout, files, platform).kind === "present"
  && readSkillsLinkState(layout, files).kind === "ours";

/**
 * How far this computer has got.
 * @typedef {{ isSetUp: boolean, appCount: number, addedAppCount: number }} SetupProgress
 *   isSetUp: setup has nothing left to do; appCount: app folders found; addedAppCount: those add-app has prepared
 */

/**
 * How far this computer has got, for the menu's status line and its suggested next command.
 * @param {import("./layout.mjs").Layout} layout where the shared files and the app folders are
 * @param {import("./files.mjs").Files} files reads the disk
 * @param {NodeJS.Platform} platform the operating system, which decides whether a path's case matters
 * @returns {SetupProgress} whether setup is done, and how many apps there are and have been added
 */
export const readSetupProgress = (layout, files, platform) => {
  const apps = listAppFolders(layout, files);

  return {
    isSetUp: isComputerSetUp(layout, files, platform),
    appCount: apps.length,
    addedAppCount: apps.filter((app) => app.hasOurNotes).length,
  };
};
