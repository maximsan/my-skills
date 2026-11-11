// @ts-check
// The hook that keeps skills in this repo. Claude Code runs it before every file write, as `node <this file>`, with
// the tool call as JSON on stdin. It refuses a write into a skill folder under ~/.agents/skills or ~/.claude/skills
// that lands outside this repo's skills folder, and lets every other write through. The logic lives in
// cli/lib/skill-home.mjs.
//
// Claude Code refuses a write only on exit code 2. Any other failure, even one before this file's own code runs,
// lets the write through.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { realPathOf, skillWriteRefusal } from "../lib/skill-home.mjs";

/** Claude Code's exit code that refuses a tool call and shows the agent the reason. */
const REFUSE = 2;

try {
  const toolCall = JSON.parse(readFileSync(0, "utf8"));
  const writtenPath = toolCall.tool_input?.file_path ?? toolCall.tool_input?.notebook_path;
  const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const folders = {
    ownSkills: join(repoRoot, "skills"),
    agentSkillFolders: [join(homedir(), ".agents", "skills"), join(homedir(), ".claude", "skills")],
  };

  if (typeof writtenPath === "string") {
    const filePath = resolve(toolCall.cwd ?? process.cwd(), writtenPath);
    const refusal = skillWriteRefusal(filePath, folders, realPathOf);

    if (refusal) {
      process.stderr.write(refusal);
      process.exitCode = REFUSE;
    }
  }
} catch {
  // Input the hook can't read: let the write through.
}
