// @ts-check
// The skill-home gate: writes into the folders agents read skills from must land in this repo's skills folder.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { realPathOf, skillWriteRefusal } from "../lib/skill-home.mjs";

const GATE = fileURLToPath(new URL("../hooks/skill-home-gate.mjs", import.meta.url));

describe("skill-home gate", () => {
  const root = mkdtempSync(join(tmpdir(), "skill-home-"));
  const ownSkills = join(root, "repo", "skills");
  const agentSkills = join(root, "home", ".agents", "skills");
  const claudeSkills = join(root, "home", ".claude", "skills");
  const folders = { ownSkills, agentSkillFolders: [agentSkills, claudeSkills] };

  mkdirSync(join(ownSkills, "check-prose"), { recursive: true });
  mkdirSync(join(agentSkills, "tdd"), { recursive: true });
  mkdirSync(claudeSkills, { recursive: true });
  symlinkSync(join(ownSkills, "check-prose"), join(agentSkills, "check-prose"));
  symlinkSync(join(agentSkills, "check-prose"), join(claudeSkills, "check-prose"));
  after(() => rmSync(root, { recursive: true, force: true }));

  /**
   * The gate's refusal for writing one file in the test folders.
   * @param {string} path the file about to be written
   * @returns {string | null} the refusal, or null when the write may go ahead
   */
  const refusalFor = (path) => skillWriteRefusal(path, folders, realPathOf);

  test("lets through a write into an own skill, through either agent folder", () => {
    assert.equal(refusalFor(join(agentSkills, "check-prose", "SKILL.md")), null);
    assert.equal(refusalFor(join(claudeSkills, "check-prose", "SKILL.md")), null);
  });

  test("refuses a change to a packaged skill", () => {
    assert.match(refusalFor(join(agentSkills, "tdd", "SKILL.md")) ?? "", /replaced on its next update/);
  });

  test("refuses a new skill created straight in an agent folder, and names where it goes", () => {
    const refusal = refusalFor(join(agentSkills, "new-skill", "SKILL.md")) ?? "";

    assert.match(refusal, /isn't a link into the skills repo/);
    assert.ok(refusal.includes(join(ownSkills, "new-skill")));
  });

  test("lets through writes anywhere else", () => {
    assert.equal(refusalFor(join(root, "home", "notes.md")), null);
    assert.equal(refusalFor(join(ownSkills, "check-prose", "SKILL.md")), null);
  });

  test("the hook refuses with exit code 2 and passes other writes", () => {
    const home = join(root, "home");

    /**
     * Runs the hook on one write, the way Claude Code does.
     * @param {string} filePath the file about to be written
     * @returns {import("node:child_process").SpawnSyncReturns<string>} the finished hook
     */
    const run = (filePath) =>
      spawnSync(process.execPath, [GATE], {
        input: JSON.stringify({ tool_name: "Write", tool_input: { file_path: filePath } }),
        env: { ...process.env, HOME: home },
        encoding: "utf8",
      });

    assert.equal(run(join(agentSkills, "tdd", "SKILL.md")).status, 2);
    assert.equal(run(join(home, "notes.md")).status, 0);
  });

  test("the hook lets the write through on input it can't read", () => {
    const result = spawnSync(process.execPath, [GATE], { input: "not json", encoding: "utf8" });

    assert.equal(result.status, 0);
  });
});
