/**
 * Tells a script started by Node from one imported by a test.
 */
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Whether the module at `importMetaUrl` is the script Node was started with,
 * rather than an import of a test. `import.meta.url` names the real file, so a
 * script started through a symlink compares by its real path.
 * @param {string} importMetaUrl the calling module's `import.meta.url`
 * @returns {boolean} true when Node was started with that module
 */
export function runsAsScript(importMetaUrl) {
  const [, started] = process.argv;

  return started !== undefined && fileURLToPath(importMetaUrl) === realpathSync(started);
}
