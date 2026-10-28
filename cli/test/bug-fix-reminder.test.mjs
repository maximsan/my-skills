// @ts-check
// The bug-fix reminder: which messages get it, in which folders, and the hook script run the way Claude Code runs it.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join, sep } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { mentionsBug, REMINDER, reminderFor } from "../lib/bug-fix-reminder.mjs";
import { reminderHook } from "../lib/claude-settings.mjs";
import { resolveLayout } from "../lib/layout.mjs";

const LAYOUT = resolveLayout("/home/me/projects/prompts");
const APP = "/home/me/projects/web-shop";

/**
 * What Claude Code sends the hook for one message.
 * @param {string} prompt the message
 * @param {string} [cwd] the folder Claude works in
 * @returns {string} the hook's stdin
 */
const input = (prompt, cwd = APP) => JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt, cwd });

describe("which messages mention a bug", () => {
  test("the bug words match as whole words, in any case", () => {
    for (const prompt of [
      "there's a bug in the basket",
      "Two BUGS left",
      "the login is broken",
      "a regression since Friday",
      "it crashes on save",
      "checkout doesn't work",
      "checkout doesn’t work",
      "the filter does not work",
      "search is not working",
    ]) {
      assert.equal(mentionsBug(prompt), true, prompt);
    }
  });

  test("fix, error and words that only contain a bug word don't match", () => {
    for (const prompt of ["fix the typo", "add error handling", "add a button", "debug this", "the crashpad config"]) {
      assert.equal(mentionsBug(prompt), false, prompt);
    }
  });
});

describe("the hook's answer", () => {
  test("a bug message in an app gets the reminder as Claude Code's JSON", () => {
    const answer = JSON.parse(reminderFor(input("the login is broken"), LAYOUT, "linux") ?? "null");

    assert.deepEqual(answer, {
      hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: REMINDER },
    });
  });

  test("a sub-folder of an app counts as the app", () => {
    assert.notEqual(reminderFor(input("the login is broken", `${APP}/src/auth`), LAYOUT, "linux"), null);
  });

  test("Claude started in the projects folder itself gets the reminder", () => {
    assert.notEqual(reminderFor(input("the login is broken", "/home/me/projects"), LAYOUT, "linux"), null);
  });

  test("outside the projects folder, and inside this repo, there is no reminder", () => {
    assert.equal(reminderFor(input("the login is broken", "/home/me/personal/blog"), LAYOUT, "linux"), null);
    assert.equal(reminderFor(input("the login is broken", "/home/me/projects/prompts"), LAYOUT, "linux"), null);
    assert.equal(reminderFor(input("the login is broken", "/home/me/projects-old/app"), LAYOUT, "linux"), null);
  });

  test("on Windows, the folder matches whatever its case", () => {
    // Given directly: these tests may run on macOS, whose path functions don't read Windows paths.
    const projectsDirectory = "C:\\Users\\me\\projects";
    const layout = { ...LAYOUT, projectsDirectory, repoRoot: `${projectsDirectory}\\prompts` };
    const cwd = "c:\\users\\ME\\Projects\\web-shop";

    assert.notEqual(reminderFor(input("the login is broken", cwd), layout, "win32"), null);
  });

  test("on Windows, forward slashes and .. are resolved before the folder check", () => {
    const projectsDirectory = "C:\\Users\\me\\projects";
    const layout = { ...LAYOUT, projectsDirectory, repoRoot: `${projectsDirectory}\\prompts` };
    const answer = (/** @type {string} */ cwd) => reminderFor(input("the login is broken", cwd), layout, "win32");

    assert.notEqual(answer("C:/Users/me/projects/web-shop"), null);
    assert.equal(answer("C:/Users/me/projects/prompts"), null);
    assert.equal(answer(`${projectsDirectory}\\web-shop\\..\\prompts`), null);
  });

  test("a message with no bug word, or input it can't read, gets nothing", () => {
    assert.equal(reminderFor(input("add a button"), LAYOUT, "linux"), null);
    assert.equal(reminderFor("not json", LAYOUT, "linux"), null);
    assert.equal(reminderFor(JSON.stringify({ prompt: "broken" }), LAYOUT, "linux"), null);
  });
});

describe("the command setup writes", () => {
  test("is node and the script's path in double quotes, with forward slashes", () => {
    const { command } = reminderHook(LAYOUT);

    assert.equal(command, `node "${LAYOUT.bugFixReminderScript.split(sep).join("/")}"`);
  });

  test("escapes the characters a shell still reads inside double quotes", () => {
    const layout = { ...LAYOUT, bugFixReminderScript: "/home/me/$work/a\"b`c/bug-fix-reminder.mjs" };

    assert.equal(reminderHook(layout).command, "node \"/home/me/\\$work/a\\\"b\\`c/bug-fix-reminder.mjs\"");
  });
});

describe("the hook script", () => {
  const script = join(dirname(fileURLToPath(import.meta.url)), "..", "hooks", "bug-fix-reminder.mjs");
  const projectsDirectory = dirname(join(dirname(script), "..", ".."));

  /**
   * Runs the script as Claude Code does: `node <script>`, with the input on stdin.
   * @param {string} stdin the hook's input
   * @returns {{ status: number | null, stdout: string, stderr: string }} what the script did
   */
  const runScript = (stdin) => spawnSync(process.execPath, [script], { input: stdin, encoding: "utf8" });

  test("prints the reminder for a bug message in an app next to this repo", () => {
    const { status, stdout } = runScript(input("the login is broken", join(projectsDirectory, "web-shop")));

    assert.equal(status, 0);
    assert.equal(JSON.parse(stdout).hookSpecificOutput.additionalContext, REMINDER);
  });

  test("the command setup writes runs the script through a shell, as Claude Code runs it", () => {
    const { command } = reminderHook(resolveLayout(dirname(dirname(dirname(script)))));
    const stdin = input("the login is broken", join(projectsDirectory, "web-shop"));
    const { status, stdout, stderr } = spawnSync(command, { input: stdin, encoding: "utf8", shell: true });

    assert.equal(status, 0, stderr);
    assert.equal(JSON.parse(stdout).hookSpecificOutput.additionalContext, REMINDER);
  });

  test("prints nothing and exits 0 for other messages, and for input it can't read", () => {
    for (const stdin of [input("add a button", join(projectsDirectory, "web-shop")), "not json", ""]) {
      const { status, stdout, stderr } = runScript(stdin);

      assert.equal(status, 0, stdin);
      assert.equal(stdout, "", stdin);
      assert.equal(stderr, "", stdin);
    }
  });
});
