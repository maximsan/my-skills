// @ts-check
// Finding app folders, and reading the facts about one app that the other modules decide from.
//
// Reading is kept apart from deciding: `readAppFacts` collects plain data once, and the stack detectors and notes
// builders are pure functions of that data. That is what lets them be tested without creating folders.

import { basename, join, sep } from "node:path";
import { NOTES_MARKER } from "./app-notes.mjs";
import { NOTES_FILE, SHARED_FOLDERS } from "./app-paths.mjs";
import { relativeInside } from "./layout.mjs";
import { plural } from "./text.mjs";

/** The start of a webpack config file's name, e.g. `webpack.config.js`. */
const WEBPACK_CONFIG_NAME = /^webpack\.config\./;

/**
 * @typedef {object} AppFolder
 * @property {string} name the folder's name
 * @property {string} directory the folder's full path
 * @property {boolean} hasOurNotes it has a CLAUDE.local.md written by this tool
 */

/**
 * @typedef {object} AppFacts
 * @property {string} name the app folder's name
 * @property {string} directory the app folder's full path
 * @property {string[]} rootFileNames the names of the files and folders at the top of the app, sorted
 * @property {string[]} dependencyNames from dependencies, devDependencies and peerDependencies
 * @property {Record<string, string>} scripts package.json scripts
 * @property {{ name: string, text: string }[]} webpackConfigs root webpack.config.* files, for federation detection
 * @property {string | null} projectClaudeMdText the project's own CLAUDE.md, if any
 * @property {string[]} projectInstructionFiles the project's own Claude files that exist, for the "left as is" line
 * @property {boolean} hasAgentsFile whether the app has an AGENTS.md at its top
 * @property {string | null} notesText our CLAUDE.local.md, if it exists
 */

/**
 * The app folders next to this repo. Dot-folders, this repo itself and the shared folders are left out.
 * @param {import("./layout.mjs").Layout} layout where the projects folder and this repo are
 * @param {import("./files.mjs").Files} files reads the projects folder
 * @returns {AppFolder[]} the app folders, sorted by name
 */
export const listAppFolders = (layout, files) =>
  files
    .listDirectory(layout.projectsDirectory)
    .filter((name) => !name.startsWith(".") && name !== layout.repoFolderName && !SHARED_FOLDERS.includes(name))
    .map((name) => ({ name, directory: join(layout.projectsDirectory, name) }))
    .filter(({ directory }) => files.isDirectory(directory))
    .map((app) => ({ ...app, hasOurNotes: isOurNotes(files.readText(join(app.directory, NOTES_FILE))) }));

/**
 * Whether a notes file was written by this tool: it has our marker line.
 * @param {string | null} text the notes file's text, or null when there is none
 * @returns {boolean} true when the marker line is there
 */
export const isOurNotes = (text) => Boolean(text?.includes(NOTES_MARKER));

/**
 * The app folder the user is standing in, if any: the first folder below the projects folder.
 * @param {import("./layout.mjs").Layout} layout where the projects folder and this repo are
 * @param {string} cwd the folder the command was run from
 * @returns {string | null} the app folder's full path, or null when the user isn't inside an app
 */
export const appDirectoryFromWorkingDirectory = (layout, cwd) => {
  const path = relativeInside(layout.projectsDirectory, cwd);

  if (!path) {
    return null;
  }

  const [first] = path.split(sep);

  if (first.startsWith(".") || first === layout.repoFolderName || SHARED_FOLDERS.includes(first)) {
    return null;
  }

  return join(layout.projectsDirectory, first);
};

/**
 * Reads everything the other modules decide from about one app, once: its files, package.json and notes.
 * @param {string} directory the app folder's full path
 * @param {import("./files.mjs").Files} files reads the app's files
 * @returns {AppFacts} the facts about the app
 */
export const readAppFacts = (directory, files) => {
  const rootFileNames = files.listDirectory(directory);
  const packageJson = parseJson(files.readText(join(directory, "package.json")));
  const dependencyFields = /** @type {const} */ (["dependencies", "devDependencies", "peerDependencies"]);
  const dependencyNames = dependencyFields.flatMap((field) =>
    Object.keys(packageJson?.[field] ?? {}),
  );
  const webpackConfigs = rootFileNames
    .filter((name) => WEBPACK_CONFIG_NAME.test(name))
    .map((name) => ({ name, text: files.readText(join(directory, name)) ?? "" }));
  const rulesDirectory = join(directory, ".claude", "rules");
  const ruleCount = files.listDirectory(rulesDirectory).filter((name) => name.endsWith(".md")).length;
  const projectInstructionFiles = [
    rootFileNames.includes("CLAUDE.md") ? "CLAUDE.md" : null,
    files.exists(join(directory, ".claude", "CLAUDE.md")) ? ".claude/CLAUDE.md" : null,
    ruleCount > 0 ? `.claude/rules/ (${plural(ruleCount, "file")})` : null,
  ].filter(/**
            * Keeps the files that exist.
            * @param {string | null} name the file's name, or null when it doesn't exist
            * @returns {name is string} true for a name
            */ (name) => name !== null);

  return {
    name: basename(directory),
    directory,
    rootFileNames,
    dependencyNames,
    scripts: packageJson?.scripts ?? {},
    webpackConfigs,
    projectClaudeMdText: files.readText(join(directory, "CLAUDE.md")),
    projectInstructionFiles,
    hasAgentsFile: rootFileNames.includes("AGENTS.md"),
    notesText: files.readText(join(directory, NOTES_FILE)),
  };
};

/**
 * The parts of a package.json this module reads. Each one may be missing.
 * @typedef {object} PackageJson
 * @property {Record<string, string>} [dependencies] the packages the app needs to run
 * @property {Record<string, string>} [devDependencies] the packages the app needs to build and test
 * @property {Record<string, string>} [peerDependencies] the packages the app expects its host to provide
 * @property {Record<string, string>} [scripts] the commands `npm run` knows
 */

/**
 * Reads a package.json's text without throwing.
 * @param {string | null} text the file's text, or null when there is no file
 * @returns {PackageJson | null} the parsed value, or null when there's no text or it isn't valid JSON
 */
const parseJson = (text) => {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};
