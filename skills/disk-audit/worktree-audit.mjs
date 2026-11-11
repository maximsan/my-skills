#!/usr/bin/env node
/**
 * Lists every git worktree with whether its folder could go, comparing against
 * GitHub itself. Reads only: nothing is fetched, changed or removed.
 *
 * Local tracking branches can name commits GitHub no longer has, so "pushed"
 * means the commit is a branch tip on GitHub, and "merged" means it is in the
 * default branch or in a merged pull request, which also finds a squash merge.
 *
 * Usage: node worktree-audit.mjs [folder holding your repos ...]
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HOME = homedir();
const CODEX_WORKTREES = join(HOME, ".codex", "worktrees");
const CODEX_STATE = join(HOME, ".codex", "state_5.sqlite");

/** `~/projects/<group>/<repo>` is the deepest place a repo sits. */
const DEEPEST_REPO = 3;
const DEFAULT_BRANCHES = ["origin/HEAD", "origin/main", "origin/master"];
const RECENT_DAYS = 7;
const DAY_IN_MS = 86_400_000;
const KILOBYTES_PER_GIGABYTE = 1024 * 1024;

/** Room for a whole `git` or `lsof` listing; Node's default of one megabyte cuts it short. */
const OUTPUT_BYTES = 1 << 28;

/** An ISO timestamp cut to this length is its date alone. */
const ISO_DATE_LENGTH = "YYYY-MM-DD".length;

/** From most to least reason to keep the folder. */
export const STATUS = {
  inUse: "in use",
  changes: "has changes",
  unpushed: "unpushed",
  recent: "recent",
  pushed: "pushed, not merged",
  merged: "merged",
};

const STATUS_ORDER = Object.values(STATUS);

/**
 * The worktrees in `git worktree list --porcelain` output, main checkout first.
 * @param {string} porcelain what `git worktree list --porcelain` printed
 * @returns {{folder: string, branch: string | null, prunable: boolean}[]} each worktree's folder, its branch or
 *   null when detached, and whether git marks its record prunable
 */
export function parseWorktrees(porcelain) {
  return porcelain.split("\n\n").filter((block) => block.startsWith("worktree ")).map((block) => {
    const lines = block.split("\n");
    const [worktreeLine] = lines;
    const branchLine = lines.find((line) => line.startsWith("branch "));

    return {
      folder: worktreeLine.slice("worktree ".length),
      branch: branchLine ? branchLine.slice("branch refs/heads/".length) : null,
      prunable: lines.some((line) => line.startsWith("prunable")),
    };
  });
}

/**
 * The status of one worktree: the strongest reason to keep its folder.
 *
 * A worktree that has just started sits on a commit already in the default
 * branch, so it looks merged. Recent activity therefore outranks merged.
 * @param {{inUse: boolean, changes: number, merged: boolean, onGitHub: boolean, recent: boolean}} facts what is
 *   known about the worktree: a process works in it, its count of changed files, whether its commit is merged or
 *   a branch tip on GitHub, and whether it was active lately
 * @returns {string} one of the `STATUS` values
 */
export function statusOf({ inUse, changes, merged, onGitHub, recent }) {
  if (inUse) {
    return STATUS.inUse;
  }

  if (changes > 0) {
    return STATUS.changes;
  }

  if (!merged && !onGitHub) {
    return STATUS.unpushed;
  }

  if (recent) {
    return STATUS.recent;
  }

  return merged ? STATUS.merged : STATUS.pushed;
}

/**
 * Whether a date falls within the days a worktree still counts as active.
 * @param {string} isoDate the date to test, such as `2026-11-05`
 * @param {number} nowMs the time of the audit, in milliseconds
 * @returns {boolean} true when the date is at most `RECENT_DAYS` before now
 */
export function isRecent(isoDate, nowMs) {
  return nowMs - Date.parse(isoDate) <= RECENT_DAYS * DAY_IN_MS;
}

/**
 * Whether `folder` is, or sits inside, one of `workingFolders`' worktree.
 * @param {string} folder the worktree's folder
 * @param {Set<string>} workingFolders the current folder of each running process
 * @returns {boolean} true when a running process works in the worktree
 */
export function isInUse(folder, workingFolders) {
  return [...workingFolders].some((working) => working === folder || working.startsWith(`${folder}/`));
}

/**
 * Standard output of a command, or null when it fails.
 * @param {string} program the command to run, such as `git`
 * @param {string[]} args the arguments passed to the program
 * @param {string} [folder] the folder to run it in; the current folder by default
 * @returns {string | null} what the command printed, trimmed, or null when it failed
 */
function output(program, args, folder) {
  try {
    return execFileSync(program, args, {
      cwd: folder,
      encoding: "utf8",
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
      maxBuffer: OUTPUT_BYTES,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * The main checkouts under `root`, down to `depth` levels.
 * @param {string} root the folder to search
 * @param {number} [depth] how many folder levels below `root` to look
 * @returns {string[]} the folder of each main checkout found
 */
function mainCheckouts(root, depth = DEEPEST_REPO) {
  if (depth === 0 || !existsSync(root)) {
    return [];
  }

  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules")
    .flatMap((entry) => {
      const folder = join(root, entry.name);

      return existsSync(join(folder, ".git")) ? [folder] : mainCheckouts(folder, depth - 1);
    });
}

/**
 * The main checkouts that Codex worktrees belong to, wherever they live.
 * @returns {string[]} the folder of each main checkout
 */
function checkoutsOfCodexWorktrees() {
  return mainCheckouts(CODEX_WORKTREES).flatMap((worktree) => {
    const commonGitFolder = output("git", ["-C", worktree, "rev-parse", "--path-format=absolute", "--git-common-dir"]);

    return commonGitFolder ? [dirname(commonGitFolder)] : [];
  });
}

/**
 * The current folder of each running process.
 * @returns {Set<string>} the folders, each once
 */
function processFolders() {
  const listing = output("lsof", ["-d", "cwd", "-Fn"]) ?? "";

  return new Set(listing.split("\n").filter((line) => line.startsWith("n")).map((line) => line.slice(1)));
}

/**
 * When each folder's newest open Codex conversation changed, by folder.
 * @returns {Map<string, string>} folder to date, such as `2026-11-05`; empty when Codex has no state file
 */
function openCodexConversations() {
  const rows = output("sqlite3", ["-separator", "\t", `file:${CODEX_STATE}?immutable=1`,
    "select cwd, date(max(updated_at), 'unixepoch', 'localtime') from threads where archived = 0 group by cwd;"]);

  return new Map((rows ?? "").split("\n").filter(Boolean).map((row) => row.split("\t")));
}

/**
 * How much disk the folder takes.
 * @param {string} folder the folder to measure
 * @returns {string} the size in gigabytes with one decimal; `0.0` when `du` fails
 */
function sizeInGigabytes(folder) {
  const [kilobytes] = (output("du", ["-sk", folder]) ?? "0").split("\t");

  return (Number(kilobytes) / KILOBYTES_PER_GIGABYTE).toFixed(1);
}

/**
 * Whether the commit in `folder` reached the default branch.
 * @param {string} folder the worktree's folder
 * @param {string} commit the worktree's commit hash
 * @returns {boolean} true when the commit is in the default branch or in a merged pull request
 */
function isMerged(folder, commit) {
  const inDefaultBranch = DEFAULT_BRANCHES.some((branch) =>
    output("git", ["-C", folder, "merge-base", "--is-ancestor", commit, branch]) !== null);

  if (inDefaultBranch) {
    return true;
  }

  const pullRequests = output("gh", ["pr", "list", "--search", commit, "--state", "merged", "--limit", "1",
    "--json", "number", "--jq", "length"], folder);

  return Number(pullRequests) > 0;
}

/**
 * Every fact the report shows about one worktree.
 * @param {{folder: string, branch: string | null}} worktree the worktree's folder and branch
 * @param {Set<string>} tipsOnGitHub the commit at the tip of each branch on GitHub
 * @param {Set<string>} workingFolders the current folder of each running process
 * @param {Map<string, string>} conversations folder to the date its newest open Codex conversation changed
 * @returns {{status: string, size: string, touched: string, conversation: string, branch: string, folder: string}}
 *   one report row: the status, size in gigabytes, the dates, the branch and the folder with the home folder as `~`
 */
function audited({ folder, branch }, tipsOnGitHub, workingFolders, conversations) {
  const commit = output("git", ["-C", folder, "rev-parse", "HEAD"]);
  const changes = (output("git", ["-C", folder, "status", "--porcelain"]) ?? "").split("\n").filter(Boolean).length;
  const touched = statSync(folder).mtime.toISOString().slice(0, ISO_DATE_LENGTH);
  const conversation = conversations.get(folder) ?? "-";
  const status = statusOf({
    inUse: isInUse(folder, workingFolders),
    changes,
    merged: commit !== null && isMerged(folder, commit),
    onGitHub: tipsOnGitHub.has(commit),
    recent: [touched, conversation].some((date) => date !== "-" && isRecent(date, Date.now())),
  });

  return {
    status,
    size: sizeInGigabytes(folder),
    touched,
    conversation,
    branch: branch ?? "detached",
    folder: folder.replace(HOME, "~"),
  };
}

/**
 * Prints one row per worktree, the strongest reason to keep it first.
 * @param {string[]} givenRoots the folders holding repos named on the command line; `~/projects` when none
 */
function main(givenRoots) {
  const roots = givenRoots.length > 0 ? givenRoots : [join(HOME, "projects")];
  const checkouts = new Set([...roots.flatMap((root) => mainCheckouts(root)), ...checkoutsOfCodexWorktrees()]);
  const workingFolders = processFolders();
  const conversations = openCodexConversations();
  const rows = [];
  const missing = [];

  for (const checkout of checkouts) {
    const worktrees = parseWorktrees(output("git", ["-C", checkout, "worktree", "list", "--porcelain"]) ?? "").slice(1);

    if (worktrees.length > 0) {
      const remote = output("git", ["-C", checkout, "ls-remote", "origin"]) ?? "";
      const tips = new Set(remote.split("\n").map((line) => {
        const [tipCommit] = line.split("\t");

        return tipCommit;
      }));

      for (const worktree of worktrees) {
        if (worktree.prunable || !existsSync(worktree.folder)) {
          missing.push(worktree.folder);
        } else {
          rows.push(audited(worktree, tips, workingFolders, conversations));
        }
      }
    }
  }

  rows.sort((left, right) => STATUS_ORDER.indexOf(left.status) - STATUS_ORDER.indexOf(right.status));
  console.log(["STATUS", "GB", "TOUCHED", "CODEX CHAT", "BRANCH", "FOLDER"].join("\t"));

  for (const row of rows) {
    console.log([row.status, row.size, row.touched, row.conversation, row.branch, row.folder].join("\t"));
  }

  for (const folder of missing) {
    console.log(`Stale record, folder is gone: ${folder}. git worktree prune clears it.`);
  }
}

const [, startedScript, ...givenRoots] = process.argv;

if (startedScript === fileURLToPath(import.meta.url)) {
  main(givenRoots);
}
