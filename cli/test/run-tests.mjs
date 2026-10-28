// @ts-check
// Runs every *.test.mjs in this folder: `npm test`.
//
// A script rather than a glob in package.json, because Node before 21 doesn't expand globs itself, and neither does
// the Windows shell npm uses. Passing the folder alone doesn't work on newer Node either.

import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const testFiles = readdirSync(here)
  .filter((name) => name.endsWith(".test.mjs"))
  .sort()
  .map((name) => join(here, name));

const result = spawnSync(process.execPath, ["--test", ...testFiles], { stdio: "inherit" });

process.exit(result.status ?? 1);
