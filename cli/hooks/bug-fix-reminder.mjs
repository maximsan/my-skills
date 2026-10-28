// @ts-check
// The bug-fix reminder hook. Claude Code runs it on every message you send, as `node <this file>`, with the message
// on stdin. It prints the reminder when the message mentions a bug inside an app; otherwise it prints nothing.
// `setup` adds it to ~/.claude/settings.json. The logic lives in cli/lib/bug-fix-reminder.mjs.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { reminderFor } from "../lib/bug-fix-reminder.mjs";
import { resolveLayout } from "../lib/layout.mjs";

// Any failure ends quietly. A hook that errors shows the user a notice on every message, and a missing reminder costs
// far less than that.
try {
  const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const answer = reminderFor(readFileSync(0, "utf8"), resolveLayout(repoRoot), process.platform);

  if (answer) {
    process.stdout.write(answer);
  }
} catch {
  // Nothing to print: the message goes through without the reminder.
}
