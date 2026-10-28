// @ts-check
// The only module that writes to disk.
//
// Keeping every write here does two jobs. A reader knows where to look for anything that changes their machine, and
// the runner can lock writes while steps are only being checked: during the plan stage any write throws, so
// "nothing changes before you confirm" is enforced by the code rather than promised in a comment.
//
// All operations are synchronous on purpose. Each one is small, and a synchronous write can't be interrupted
// halfway by Ctrl+C, which is part of what "nothing is half-written" rests on.

import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmdirSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

/** Suffix of the temporary file an atomic write goes through. Fixed, so a leftover one is recognisable. */
export const TEMPORARY_SUFFIX = ".claude-rules-tmp";

/** The `\\?\` prefix Windows puts on junction targets. */
const WINDOWS_PREFIX = /^\\\\\?\\/;

/** Slashes at the end of a path, which would stop two paths from comparing equal. */
const TRAILING_SLASHES = /[\\/]+$/;

/** The colons and dot in an ISO time, which can't go in a Windows file name. */
const ISO_TIME_SEPARATORS = /[:.]/g;

/** The `.bak` at the end of a backup's name. */
const BACKUP_EXTENSION = /\.bak$/;

/** The number added when a timestamped backup name is already taken: `<name>.<timestamp>.2.bak`. */
const FIRST_NUMBERED_COPY = 2;

/**
 * What sits at a path we may want to turn into a link.
 * @typedef {{ kind: "missing" }
 *   | { kind: "link", target: string }
 *   | { kind: "directory", entries: string[] }
 *   | { kind: "file" }} PathInfo
 */

/**
 * Windows reports junction targets with a `\\?\` prefix. Strip it so the target compares equal to a normal path.
 * @param {string} target the link target as Windows reported it
 * @returns {string} the target without the prefix
 */
export const withoutWindowsPrefix = (target) => target.replace(WINDOWS_PREFIX, "");

/**
 * The file-system helpers every command uses. Each one is described where `createFiles` defines it.
 * @typedef {object} Files
 * @property {(path: string) => boolean} exists whether a file or folder is at a path, following links
 * @property {(path: string) => boolean} isDirectory whether a path is a folder
 * @property {(path: string) => string | null} readText a file's text, or null if there is no such file
 * @property {(path: string) => string[]} listDirectory a folder's entry names, sorted
 * @property {(path: string) => string | null} realPath the path with every link resolved
 * @property {(first: string, second: string) => boolean} isSamePath whether two paths are the same once made
 *   absolute; links are not followed
 * @property {(path: string) => PathInfo} inspectPath what sits at a path, without following links
 * @property {(path: string, text: string) => void} writeTextAtomic writes a file so it is never half-written
 * @property {(path: string, options?: { intoFolder?: string }) => string} backUp copies a file before it changes
 * @property {(path: string) => void} createDirectory creates a folder
 * @property {(target: string, linkPath: string) => void} createDirectoryLink creates a link to a folder
 * @property {(path: string) => void} removeEmptyDirectory removes a folder only if it is empty
 * @property {(path: string) => void} removeLink removes a link, leaving the folder it points at
 * @property {<T>(work: () => Promise<T>) => Promise<T>} withWritesLocked runs `work` with every write turned into
 *   an error
 * @property {() => boolean} hasChanged whether any write was attempted in this process
 */

/**
 * Creates the file-system helpers used by every command.
 * @param {{ platform: NodeJS.Platform }} options the operating system, which decides whether case matters in paths
 *   and how a link is removed
 * @returns {Files} the helpers that read, write and lock the disk
 */
export const createFiles = ({ platform }) => {
  let writesLocked = false;
  let hasChangedAnything = false;

  /**
   * Called first by every write. Throws while writes are locked; otherwise records that something may change.
   * @param {string} action the write being tried, in words for the error, e.g. "back up"
   * @param {string} path the path the write would change
   */
  const assertWritable = (action, path) => {
    // A bug in a step, not a user problem: check() must only look.
    if (writesLocked) {
      throw new Error(`Tried to ${action} ${path} while only checking. A step's check() must not change anything.`);
    }

    hasChangedAnything = true;
  };

  /**
   * Whether any write was attempted in this process, so a stop message can say whether anything changed.
   * @returns {boolean} true once any write has started
   */
  const hasChanged = () => hasChangedAnything;

  /**
   * Whether anything is at a path.
   * @param {string} path the path to look at
   * @returns {boolean} true when a file or folder is there, following links; a broken link counts as nothing
   */
  const exists = (path) => existsSync(path);

  /**
   * Whether a path is a folder, following links.
   * @param {string} path the path to look at
   * @returns {boolean} true when a folder is there
   */
  const isDirectory = (path) => existsSync(path) && statSync(path).isDirectory();

  /**
   * Reads a file as UTF-8 text.
   * @param {string} path the file to read
   * @returns {string | null} the text, or null if there is no such file
   */
  const readText = (path) => (existsSync(path) && statSync(path).isFile() ? readFileSync(path, "utf8") : null);

  /**
   * Lists the names in a folder, sorted.
   * @param {string} path the folder to list
   * @returns {string[]} entry names, or an empty list if the folder doesn't exist
   */
  const listDirectory = (path) => (isDirectory(path) ? readdirSync(path).sort() : []);

  /**
   * Follows every link in a path to where it really leads.
   * @param {string} path the path to resolve
   * @returns {string | null} the path with every link resolved, or null if nothing is there
   */
  const realPath = (path) => {
    try {
      return realpathSync(path);
    } catch {
      return null;
    }
  };

  /**
   * Compares two paths the way the platform does: case-insensitively on Windows.
   * @param {string} first one path
   * @param {string} second the path to compare it with
   * @returns {boolean} true when both are the same absolute path, ignoring trailing slashes, and case on Windows.
   *   Links are not followed: callers resolve them first
   */
  const isSamePath = (first, second) => {
    const normalise = (/** @type {string} */ path) => {
      const resolved = resolve(withoutWindowsPrefix(path)).replace(TRAILING_SLASHES, "");

      return platform === "win32" ? resolved.toLowerCase() : resolved;
    };

    return normalise(first) === normalise(second);
  };

  /**
   * Looks at a path without following links, so a junction is reported as a link rather than as its target.
   * @param {string} path the path to look at
   * @returns {PathInfo} what is there: nothing, a link and its target, a folder and its entries, or a file
   */
  const inspectPath = (path) => {
    let stats;

    try {
      stats = lstatSync(path);
    } catch {
      return { kind: "missing" };
    }

    if (stats.isSymbolicLink()) {
      const target = withoutWindowsPrefix(readlinkSync(path));

      return { kind: "link", target: resolve(dirname(path), target) };
    }

    if (stats.isDirectory()) {
      return { kind: "directory", entries: readdirSync(path) };
    }

    return { kind: "file" };
  };

  /**
   * Writes through a temporary file and a rename, so the file is always either the old version or the new one.
   * @param {string} path the file to write
   * @param {string} text the file's new contents
   */
  const writeTextAtomic = (path, text) => {
    assertWritable("write", path);
    mkdirSync(dirname(path), { recursive: true });

    const temporaryPath = `${path}${TEMPORARY_SUFFIX}`;

    try {
      writeFileSync(temporaryPath, text, "utf8");
      renameSync(temporaryPath, path);
    } catch (error) {
      // Inside an app, a leftover temp file would show up in `git status`.
      if (existsSync(temporaryPath) && statSync(temporaryPath).isFile()) {
        unlinkSync(temporaryPath);
      }

      throw error;
    }
  };

  /**
   * Copies a file before we change it. An existing backup is never overwritten, since it may hold the only copy of
   * the original; a timestamped name is used instead.
   * @param {string} path the file to copy
   * @param {{ intoFolder?: string }} [options]
   *   intoFolder: put the copy there as `<name>.<timestamp>.bak`, e.g. inside `.git` so git never lists it.
   *   Without it, the copy goes beside the file as `<file>.bak`.
   * @returns {string} where the copy went
   */
  const backUp = (path, { intoFolder } = {}) => {
    assertWritable("back up", path);

    // Colons aren't allowed in Windows file names, so the ISO time is written with dashes.
    const timestamp = new Date().toISOString().replace(ISO_TIME_SEPARATORS, "-");
    const stamped = (/** @type {string} */ folder) => join(folder, `${basename(path)}.${timestamp}.bak`);
    let backupPath = `${path}.bak`;

    if (intoFolder) {
      mkdirSync(intoFolder, { recursive: true });
      backupPath = stamped(intoFolder);
    } else if (existsSync(backupPath)) {
      backupPath = stamped(dirname(path));
    }

    // Two backups within the same millisecond still get a name each.
    const withoutExtension = backupPath.replace(BACKUP_EXTENSION, "");

    for (let copy = FIRST_NUMBERED_COPY; existsSync(backupPath); copy += 1) {
      backupPath = `${withoutExtension}.${copy}.bak`;
    }

    copyFileSync(path, backupPath);

    return backupPath;
  };

  /**
   * Creates a folder and any missing folders above it.
   * @param {string} path the folder to create
   */
  const createDirectory = (path) => {
    assertWritable("create", path);
    mkdirSync(path, { recursive: true });
  };

  /**
   * A junction on Windows needs no admin rights. Elsewhere Node ignores the type and makes a directory symlink.
   * @param {string} target the folder the link should point at
   * @param {string} linkPath where the link goes
   */
  const createDirectoryLink = (target, linkPath) => {
    assertWritable("link", linkPath);
    mkdirSync(dirname(linkPath), { recursive: true });
    symlinkSync(target, linkPath, "junction");
  };

  /**
   * Removes a folder only if it is empty. Never recursive: a folder with anything in it is someone's data.
   * @param {string} path the folder to remove
   */
  const removeEmptyDirectory = (path) => {
    assertWritable("remove", path);
    rmdirSync(path);
  };

  /**
   * Removes a link itself. The folder it points at is untouched.
   * @param {string} path the link to remove
   */
  const removeLink = (path) => {
    assertWritable("remove", path);

    if (platform === "win32") {
      rmdirSync(path);
    } else {
      unlinkSync(path);
    }
  };

  /**
   * Runs `work` with every write turned into an error. Used for the plan stage, where steps may only look.
   * @template T
   * @param {() => Promise<T>} work the checks to run while writes are locked
   * @returns {Promise<T>} what `work` gave back
   */
  const withWritesLocked = async (work) => {
    writesLocked = true;

    try {
      return await work();
    } finally {
      writesLocked = false;
    }
  };

  return {
    exists,
    isDirectory,
    readText,
    listDirectory,
    realPath,
    isSamePath,
    inspectPath,
    writeTextAtomic,
    backUp,
    createDirectory,
    createDirectoryLink,
    removeEmptyDirectory,
    removeLink,
    withWritesLocked,
    hasChanged,
  };
};
