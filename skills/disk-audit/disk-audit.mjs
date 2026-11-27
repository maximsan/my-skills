#!/usr/bin/env node
/**
 * Reports where disk space went and what changed recently. Reads only.
 *
 * Without snapshots there is no size history, so "recent" means files created
 * or changed in the window: activity, which can exceed real growth when a new
 * copy replaced an old one. Takes minutes on a full disk.
 *
 * Usage: node disk-audit.mjs
 */
import { execFileSync, spawnSync } from "node:child_process";
import { lstatSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { runsAsScript } from "./runs-as-script.mjs";

const HOME = homedir();
const DATA_VOLUME = "/System/Volumes/Data";
const KIBIBYTE = 1024;
const GIBIBYTE = 1024 ** 3;

/** `stat.blocks` counts blocks of this size, whatever the file system's own block size. */
const STAT_BLOCK_BYTES = 512;
const DAY_IN_MS = 86_400_000;
const WINDOWS_IN_DAYS = [7, 14];
const SHOWN_GROUPS = 15;
const SHOWN_FILES = 12;
const BIG_FILE_BYTES = GIBIBYTE;
const GROUP_DEPTH = 3;

/** Column width for a size such as `1234.5` GiB, so sizes line up. */
const SIZE_WIDTH = 6;

/** Room for `du`'s listing of a whole home folder; Node's default of one megabyte cuts it short. */
const OUTPUT_BYTES = 1 << 28;

const WHITESPACE_RUN = /\s+/;

/** The lines of `xcrun simctl runtime list -v` worth showing: each runtime, when it was last used, and its size. */
const SIMULATOR_LINE = /^\S+ .* - |Last Used|Size:/;

/** Everything on the data volume that sits outside the home folder. */
const OUTSIDE_HOME = [
  "/Applications", "/opt/homebrew", "/Library", "/private/var", "/private/tmp", "/System/Library/AssetsV2",
];

/** Walked for recent activity. */
const ACTIVITY_ROOTS = [HOME, "/opt/homebrew", "/private/tmp", "/private/var/folders"];

/** Folders macOS hides from a terminal without Full Disk Access. */
const OFTEN_PROTECTED = [".Trash", "Library/Mail", "Library/Messages", "Library/Application Support/MobileSync",
  "Library/Application Support/Google/Chrome", "Library/Safari", "Pictures/Photos Library.photoslibrary/originals"];

/**
 * Where a file's size is added up: `~/a/b/c`, or the first levels of its path
 * outside the home folder.
 * @param {string} path a file's absolute path
 * @param {string} home the home folder's absolute path
 * @returns {string} the group's folder, with the home folder shown as `~`
 */
export function groupOf(path, home) {
  if (path.startsWith(`${home}/`)) {
    return `~/${path.slice(home.length + 1).split("/").slice(0, GROUP_DEPTH).join("/")}`;
  }

  return path.split("/").slice(0, GROUP_DEPTH + 1).join("/");
}

/**
 * The windows a file's newest date falls in. A future date is a broken
 * timestamp, which says nothing about when the file arrived.
 * @param {number} newestDateMs the later of the file's change and creation dates, in milliseconds
 * @param {number} nowMs the time of the audit, in milliseconds
 * @param {number[]} windows days
 * @returns {number[]} the windows, in days, that the date falls in
 */
export function windowsHolding(newestDateMs, nowMs, windows) {
  const ageInDays = (nowMs - newestDateMs) / DAY_IN_MS;

  return ageInDays < 0 ? [] : windows.filter((days) => ageInDays <= days);
}

/**
 * Sizes from `du -k` output, as [folder, bytes], largest first.
 * @param {string} duOutput what `du -k` printed: a size in kibibytes, a tab and a folder on each line
 * @returns {[string, number][]} each folder with its size in bytes
 */
export function parseDu(duOutput) {
  return duOutput.split("\n").filter(Boolean).map(folderAndBytes).sort(largestFirst);
}

/**
 * One line of `du -k` output as [folder, bytes].
 * @param {string} line a size in kibibytes, a tab and a folder
 * @returns {[string, number]} the folder with its size in bytes
 */
function folderAndBytes(line) {
  const separator = line.indexOf("\t");

  return [line.slice(separator + 1), Number(line.slice(0, separator)) * KIBIBYTE];
}

/**
 * Orders [path, bytes] pairs from the most bytes to the fewest.
 * @param {[string, number]} left one pair
 * @param {[string, number]} right the pair it is compared with
 * @returns {number} below zero when `left` holds more bytes, so it sorts first
 */
function largestFirst([, leftBytes], [, rightBytes]) {
  return rightBytes - leftBytes;
}

/**
 * A size in gibibytes with one decimal, right-aligned so a column of sizes lines up.
 * @param {number} bytes the size in bytes
 * @returns {string} the size in gibibytes, without the unit
 */
const gibibytes = (bytes) => `${(bytes / GIBIBYTE).toFixed(1)}`.padStart(SIZE_WIDTH);

/**
 * Sizes of the folders `duArgs` name. `du` exits non-zero at a protected folder but still
 * prints the rest, so its exit code is no failure here.
 * @param {string[]} duArgs the arguments after `du -xk`: options such as `-d 1`, then folders
 * @returns {[string, number][]} each folder with its size in bytes, largest first
 */
function folderSizes(duArgs) {
  const { stdout } = spawnSync("du", ["-xk", ...duArgs], {
    encoding: "utf8",
    maxBuffer: OUTPUT_BYTES,
    stdio: ["ignore", "pipe", "ignore"],
  });

  return parseDu(stdout);
}

/**
 * Prints the title of the next part of the report.
 * @param {string} title the part's subject, such as `Largest folders`
 */
function heading(title) {
  console.log(`\n== ${title}`);
}

/**
 * Prints one line per folder or file: its size in gibibytes, then its path.
 * @param {[string, number][]} sizes each path with its size in bytes
 */
function printSizes(sizes) {
  for (const [folder, bytes] of sizes) {
    console.log(`${gibibytes(bytes)} GiB  ${folder.replace(HOME, "~")}`);
  }
}

/**
 * Prints free and used space on the data volume, and what swap uses.
 * @returns {number} the bytes in use on the data volume
 */
function reportFreeSpace() {
  heading("Free space");

  const [, volumeLine] = execFileSync("df", ["-k", DATA_VOLUME], { encoding: "utf8" }).split("\n");
  const [, , used, free] = volumeLine.split(WHITESPACE_RUN);
  const usedBytes = Number(used) * KIBIBYTE;

  console.log(`${gibibytes(Number(free) * KIBIBYTE)} GiB free, ${gibibytes(usedBytes)} GiB used on the data volume`);

  const swap = execFileSync("sysctl", ["-n", "vm.swapusage"], { encoding: "utf8" }).trim();

  console.log(`Swap, memory moved to disk, uses the same free space: ${swap}`);

  return usedBytes;
}

/**
 * Prints the largest folders, and how much of the used space they leave unmeasured.
 * @param {number} usedBytes the bytes in use on the data volume
 */
function reportFolders(usedBytes) {
  heading("Largest folders");

  const home = folderSizes(["-d", "1", HOME]);
  const outside = OUTSIDE_HOME.map((folder) => {
    const [folderSize] = folderSizes(["-s", folder]);

    return folderSize;
  }).filter(Boolean);
  const measured = [...outside, ...home.filter(([folder]) => folder === HOME)];

  printSizes([...home.filter(([folder]) => folder !== HOME).slice(0, SHOWN_GROUPS), ...outside]);
  heading("Inside ~/Library");
  printSizes(folderSizes(["-d", "2", join(HOME, "Library")]).slice(1, SHOWN_GROUPS + 1));

  const unmeasured = usedBytes - measured.reduce((sum, [, bytes]) => sum + bytes, 0);

  console.log(`\n${gibibytes(unmeasured)} GiB used but unmeasured. Likely the protected folders below.`);
}

function reportProtectedFolders() {
  heading("Protected from this terminal");

  for (const folder of OFTEN_PROTECTED) {
    try {
      readdirSync(join(HOME, folder));
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "EPERM") {
        console.log(`~/${folder}`);
      }
    }
  }
}

function reportActivity() {
  /** @type {Map<number, Map<string, number>>} window in days to the bytes each group gained in it */
  const totals = new Map(WINDOWS_IN_DAYS.map((days) => [days, new Map()]));
  const seen = new Set();

  /** @type {[string, number][]} */
  const bigFiles = [];
  const now = Date.now();
  const pending = [...ACTIVITY_ROOTS];

  for (let folder = pending.pop(); folder !== undefined; folder = pending.pop()) {
    let entries;

    try {
      entries = readdirSync(folder, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const path = join(folder, entry.name);

      if (entry.isDirectory()) {
        pending.push(path);
      } else if (entry.isFile()) {
        let stat;

        try {
          stat = lstatSync(path);
        } catch {
          continue;
        }

        // A hard link is the same disk space, so it counts once.
        const identity = `${stat.dev}:${stat.ino}`;

        if (!seen.has(identity)) {
          seen.add(identity);

          const bytes = stat.blocks * STAT_BLOCK_BYTES;
          const holding = windowsHolding(Math.max(stat.mtimeMs, stat.birthtimeMs), now, WINDOWS_IN_DAYS);

          for (const days of holding) {
            const groups = totals.get(days);

            if (groups) {
              const group = groupOf(path, HOME);

              groups.set(group, (groups.get(group) ?? 0) + bytes);
            }
          }

          if (bytes >= BIG_FILE_BYTES) {
            bigFiles.push([path, bytes]);
          }
        }
      }
    }
  }

  for (const [days, groups] of totals) {
    const largest = [...groups].sort(largestFirst);
    const total = largest.reduce((sum, [, bytes]) => sum + bytes, 0);

    heading(`Created or changed in ${days} days: ${gibibytes(total).trim()} GiB`);
    printSizes(largest.slice(0, SHOWN_GROUPS));
  }

  heading("Files of a gibibyte or more");
  printSizes(bigFiles.sort(largestFirst).slice(0, SHOWN_FILES));
}

function reportSimulators() {
  heading("iOS simulators");

  const { stdout } = spawnSync("xcrun", ["simctl", "runtime", "list", "-v"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  console.log((stdout ?? "").split("\n").filter((line) => SIMULATOR_LINE.test(line)).join("\n"));
}

function main() {
  reportFolders(reportFreeSpace());
  reportProtectedFolders();
  reportActivity();
  reportSimulators();
}

if (runsAsScript(import.meta.url)) {
  main();
}
