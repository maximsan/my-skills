/**
 * Tells a script started by Node from one imported by a test.
 */
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Whether the module at `importMetaUrl` is the script Node was started with,
 * rather than an import. Both paths are compared with links followed, so a
 * script started through a symlink counts.
 * @param {string} importMetaUrl the calling module's `import.meta.url`
 * @returns {boolean} true when Node was started with that module
 */
export function runsAsScript(importMetaUrl) {
  const [, started] = process.argv;

  try {
    return started !== undefined && realpathSync(started) === realpathSync(fileURLToPath(importMetaUrl));
  } catch {
    // A start path that isn't a file means this module was imported.
    return false;
  }
}
