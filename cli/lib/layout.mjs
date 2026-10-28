// @ts-check
// Where everything lives, worked out once from where this repo is.
//
// The projects folder is always the folder that contains this repo, the same rule SETUP.md has always had. Keeping
// it fixed means nothing has to be remembered between runs: `setup`, `add-app` and `doctor` all derive the same
// paths from the repo's own location, with no state file to go stale.

import { basename, dirname, isAbsolute, join, relative, sep } from "node:path";
import { INVESTIGATIONS_FOLDER } from "./app-paths.mjs";

/** Slashes at the end of a path, which would stop it from comparing equal to the same path without them. */
const TRAILING_SLASHES = /[\\/]+$/;

/** How a shell writes "the home folder" at the start of a path. */
const HOME_PREFIX = "~/";

/**
 * @typedef {object} Layout
 * @property {string} repoRoot this repo, e.g. C:\Users\me\projects\prompts
 * @property {string} repoFolderName e.g. "prompts", excluded from the app list
 * @property {string} projectsDirectory the folder holding this repo and the apps
 * @property {string} sharedRulesFile projects\CLAUDE.md, which applies to every app below it
 * @property {string} rulesDirectory the common rules and the stack rules, side by side
 * @property {string} commonRulesFile the rules the shared file points at
 * @property {string} skillsLink projects\.claude\skills, for Claude started in the projects folder; an app that is a
 *   git repo never reads it, so add-app links each skill into the app as well
 * @property {string} skillsSource the skills folder in this repo the link points at
 * @property {string} notesTemplate the template for each app's CLAUDE.local.md
 * @property {string} taskTemplate the template for each ticket's task.md
 * @property {string} investigationsDirectory projects\investigations, which holds one task folder per ticket
 * @property {string} packageFile this repo's package.json, for --version
 * @property {string} bugFixReminderScript the hook script setup adds to your personal Claude Code settings
 */

/**
 * Every path the CLI uses, worked out from where this repo is.
 * @param {string} repoRoot this repo's own top folder, e.g. C:\Users\me\projects\prompts
 * @returns {Layout} every path the CLI reads or writes
 */
export const resolveLayout = (repoRoot) => {
  const projectsDirectory = dirname(repoRoot);
  const rulesDirectory = join(repoRoot, "rules");

  return {
    repoRoot,
    repoFolderName: basename(repoRoot),
    projectsDirectory,
    sharedRulesFile: join(projectsDirectory, "CLAUDE.md"),
    rulesDirectory,
    commonRulesFile: join(rulesDirectory, "common.md"),
    skillsLink: join(projectsDirectory, ".claude", "skills"),
    skillsSource: join(repoRoot, "skills"),
    notesTemplate: join(repoRoot, "templates", "CLAUDE.local.md.template"),
    taskTemplate: join(repoRoot, "templates", "task.md.template"),
    investigationsDirectory: join(projectsDirectory, INVESTIGATIONS_FOLDER),
    packageFile: join(repoRoot, "package.json"),
    bugFixReminderScript: join(repoRoot, "cli", "hooks", "bug-fix-reminder.mjs"),
  };
};

/**
 * A path the way messages show it: always with forward slashes, so one screen never mixes `\` and `/`. Windows
 * accepts forward slashes too, so a shown path can be copied into a command as it is.
 * @param {string} path the path to show
 * @returns {string} the path with forward slashes
 */
export const displayPath = (path) => path.split(sep).join("/");

/**
 * `path` relative to `folder` when it's inside it, or null when it's somewhere else. `folder` itself gives "".
 * @param {string} folder the folder `path` may be inside
 * @param {string} path the path to look up
 * @returns {string | null} `path` relative to `folder`, or null when it's outside
 */
export const relativeInside = (folder, path) => {
  const fromFolder = relative(folder, path);

  return fromFolder.startsWith("..") || isAbsolute(fromFolder) ? null : fromFolder;
};

/**
 * A path as short as it can be while staying unambiguous, for plan and recap titles: relative to the folder that
 * holds the projects folder, so `C:\Users\me\projects\CLAUDE.md` reads as `projects/CLAUDE.md`. Paths elsewhere stay
 * absolute.
 * @param {Layout} layout where the projects folder is
 * @param {string} path the path to show
 * @returns {string} the shortened path, with forward slashes
 */
export const shortPath = (layout, path) => displayPath(relativeInside(dirname(layout.projectsDirectory), path) ?? path);

/**
 * A path the way a person reads a location: from the home folder, so `C:\Users\me\projects\web-shop` reads as
 * `~/projects/web-shop`. Paths outside it stay absolute. Messages only: a command to copy keeps the full path.
 * @param {string} path the path to show
 * @param {string} homeDirectory the user's home folder
 * @returns {string} the path, from `~/` when it's inside the home folder, with forward slashes
 */
export const homePath = (path, homeDirectory) => {
  const fromHome = relativeInside(homeDirectory, path);

  return fromHome === null ? displayPath(path) : displayPath(fromHome ? `${HOME_PREFIX}${fromHome}` : "~");
};

/**
 * How to install the `claude-rules` command: one short line, run in this repo's folder, rather than a full path.
 * @param {Layout} layout where this repo is
 * @param {string} homeDirectory the user's home folder, to show the repo's folder from
 * @returns {string} e.g. "run  npm install -g .  once, in ~/projects/prompts"
 */
export const installCommand = (layout, homeDirectory) =>
  `run  npm install -g .  once, in ${homePath(layout.repoRoot, homeDirectory)}`;

/**
 * A path with a leading `~/` turned into the home folder, the way a shell reads it. Other paths come back unchanged.
 * @param {string} path the path as typed, maybe starting with `~/`
 * @param {string} homeDirectory the user's home folder
 * @returns {string} the path with `~/` replaced by the home folder
 */
export const expandHome = (path, homeDirectory) =>
  (path.startsWith(HOME_PREFIX) ? join(homeDirectory, path.slice(HOME_PREFIX.length)) : path);

/**
 * Whether `path` is `folder` or inside it. Case-insensitive on Windows, where paths are.
 * @param {string} folder the folder `path` may be inside
 * @param {string} path the path to check
 * @param {NodeJS.Platform} platform the operating system, which decides whether case matters
 * @returns {boolean} true when `path` is `folder` or below it
 */
export const isInsideFolder = (folder, path, platform) => {
  const normalise = (/** @type {string} */ text) => {
    const withoutSlash = text.replace(TRAILING_SLASHES, "");

    return platform === "win32" ? withoutSlash.toLowerCase() : withoutSlash;
  };

  const [parent, child] = [normalise(folder), normalise(path)];

  return child === parent || child.startsWith(`${parent}/`) || child.startsWith(`${parent}\\`);
};

/**
 * A warning when this repo's path has a space in it. This CLI reads an `@` path to the end of its line. Whether
 * Claude Code does the same hasn't been checked, so we warn rather than guess at an escape.
 * @param {Layout} layout where this repo is
 * @returns {string | null} the warning, or null when the path has no space
 */
export const spaceInPathWarning = (layout) =>
  layout.repoRoot.includes(" ")
    ? `This repo's path has a space in it (${displayPath(layout.repoRoot)}). Claude may not load @ imports from it. `
    + "If the rules don't load, move the projects folder to a path without spaces."
    : null;

/**
 * The `@` line that makes Claude load a file. Always forward slashes, which Claude reads on every platform and
 * which SETUP.md has always used: `@C:/Users/me/projects/prompts/rules/react.md`.
 * @param {string} absolutePath the file Claude should load
 * @returns {string} the `@` line, e.g. `@C:/Users/me/projects/prompts/rules/react.md`
 */
export const toImportLine = (absolutePath) => `@${displayPath(absolutePath)}`;
