// @ts-check
// Runs every *.test.mjs in this folder and in each skill's folder: `npm test`.
//
// A script rather than a glob in package.json, because Node before 21 doesn't expand globs itself, and neither does
// the Windows shell npm uses. Passing the folder alone doesn't work on newer Node either.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const skillsFolder = join(here, "..", "..", "skills");

/**
 * The test files directly inside a folder.
 * @param {string} folder the folder to look in
 * @returns {string[]} their paths, sorted
 */
const testFilesIn = (folder) =>
  readdirSync(folder)
    .filter((name) => name.endsWith(".test.mjs"))
    .sort()
    .map((name) => join(folder, name));

// A skill keeps its tests beside its scripts: in the skill's folder, or in its scripts folder.
const skillTestFolders = readdirSync(skillsFolder, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((entry) => [join(skillsFolder, entry.name), join(skillsFolder, entry.name, "scripts")])
  .filter((folder) => existsSync(folder));

const testFiles = [here, ...skillTestFolders].flatMap(testFilesIn);

const result = spawnSync(process.execPath, ["--test", ...testFiles], { stdio: "inherit" });

process.exit(result.status ?? 1);
