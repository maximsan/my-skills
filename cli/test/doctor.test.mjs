// @ts-check
// `doctor` against a throwaway projects folder: it reports, and never changes anything.

import assert from "node:assert/strict";
import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { addApp } from "../commands/add-app.mjs";
import { doctor } from "../commands/doctor.mjs";
import { setup } from "../commands/setup.mjs";
import { EXIT_CODES } from "../lib/errors.mjs";
import { runCommand } from "../lib/runner.mjs";
import { makeApp, makeContext, makeSandbox, snapshotFolder } from "./helpers.mjs";

/** @type {import("./helpers.mjs").Sandbox} */
let sandbox;

beforeEach(() => {
  // With the CLI copied, the bug-fix reminder's script exists, so doctor can run it.
  sandbox = makeSandbox({ withCli: true });
});
afterEach(() => sandbox.cleanUp());

const runDoctor = async () => {
  const { context, ui } = makeContext(sandbox);
  const exitCode = await runCommand(doctor, context);

  return { exitCode, output: ui.text() };
};

/**
 * Sets up the computer and one app the normal way.
 * @param {{ files?: Record<string, string>, commit?: string[] }} [appOptions] extra files for the app, and which to
 *   commit
 * @returns {Promise<string>} the app's folder
 */
const setUpEverything = async (appOptions = {}) => {
  const directory = makeApp(sandbox, "web-shop", { packageJson: { dependencies: { react: "^18" } }, ...appOptions });

  await runCommand(setup, makeContext(sandbox, { options: { yes: true } }).context);
  await runCommand(addApp, makeContext(sandbox, { args: ["web-shop"], options: { yes: true } }).context);

  return directory;
};

test("on an empty projects folder, everything that's missing is a problem with a fix", async () => {
  const { exitCode, output } = await runDoctor();

  assert.equal(exitCode, EXIT_CODES.FAILED);
  assert.match(output, /^Check everything works\n {2}Changes nothing\.\n\nLooking around/m, "a one-line header");
  assert.match(output, /✖ Shared rules in .* — not set up: .*doesn't exist yet/);
  assert.match(output, /Fix: Run claude-rules setup\./);
  assert.match(output, /✖ Skills link .* — not set up/);
  assert.match(output, /✖ Apps — not set up: no app is set up yet/);
  assert.match(output, /Fix the ✖ lines above, then run the same command again\./);
});

test("the bug-fix reminder is missing before setup, with setup as the fix, and OK after it", async () => {
  const before = await runDoctor();

  assert.match(before.output, /Bug-fix reminder in .*\/\.claude\/settings\.json — not set up: add the reminder/);
  assert.match(before.output, /Fix: Run claude-rules setup\./);

  await setUpEverything();

  const after = await runDoctor();

  assert.match(
    after.output,
    /✔ Bug-fix reminder in .* — the reminder runs on each message, .*; a test message got the reminder/,
  );
});

test("a reminder entry that is right but can't run is a problem, with where to see its error", async () => {
  // As on a managed Windows environment: the settings entry checked out, while the hook failed on every message.
  sandbox.cleanUp();
  sandbox = makeSandbox();
  await setUpEverything();

  const { exitCode, output } = await runDoctor();

  assert.equal(exitCode, EXIT_CODES.FAILED, output);
  assert.match(output, /✖ Bug-fix reminder .* — problem: the entry is right, but running it, it failed: /);
  assert.match(output, /it failed: Error: Cannot find module/, "the error's own line, not where Node threw it");
  assert.match(output, /Fix: Start Claude with claude --debug, send a message, and look for UserPromptSubmit/);
});

test("after setup and add-app, the app is kept out of git, and its unfilled notes are left to Claude", async () => {
  await setUpEverything();

  const { exitCode, output } = await runDoctor();

  assert.match(output, /✔ Shared rules in .* — the line is there/);
  assert.match(output, /✔ App web-shop — kept out of git: CLAUDE\.local\.md, docs\/ai\/, the skill links/);
  assert.match(output, /Claude fills in the rest of CLAUDE\.local\.md on its first task here/);
  assert.doesNotMatch(output, /App web-shop — worth a look/, "unfilled notes aren't a warning");
  assert.notEqual(exitCode, EXIT_CODES.FAILED);
});

test("an app whose exclude lines were removed is not set up, with add-app as the fix", async () => {
  const directory = await setUpEverything();

  writeFileSync(join(directory, ".git", "info", "exclude"), "");

  const { exitCode, output } = await runDoctor();

  assert.equal(exitCode, EXIT_CODES.FAILED);
  assert.match(
    output,
    new RegExp(
      String.raw`✖ App web-shop — not set up: add CLAUDE\.local\.md, docs/ai/, `
      + String.raw`the skill links in \.claude/skills/ to \.git/info/exclude`,
    ),
  );
  assert.match(output, /Fix: Run claude-rules add-app web-shop/);
});

test("a skill added to this repo after add-app leaves the app not set up, with add-app as the fix", async () => {
  await setUpEverything();
  mkdirSync(join(sandbox.layout.skillsSource, "brand-new"));
  writeFileSync(join(sandbox.layout.skillsSource, "brand-new", "SKILL.md"), "---\nname: brand-new\n---\n");

  const { exitCode, output } = await runDoctor();

  assert.equal(exitCode, EXIT_CODES.FAILED);
  assert.match(output, /✖ App web-shop — not set up/);
  assert.match(output, /· link 1 skill/);
  assert.match(output, /Fix: Run claude-rules add-app web-shop/);
});

test("an app whose docs/ai is committed by the team is fine, the same way add-app sees it", async () => {
  await setUpEverything({ files: { "docs/ai/NOTES.md": "Team.\n" }, commit: ["docs/ai/NOTES.md"] });

  const { output } = await runDoctor();

  assert.match(output, /App web-shop — kept out of git: CLAUDE\.local\.md, the skill links/);
  assert.match(output, /docs\/ai\/ is committed by the team — left alone/);
});

test("a No to Claude's import question fails doctor, names the app, and drops the fallback note", async () => {
  const directory = await setUpEverything();

  writeFileSync(
    join(sandbox.home, ".claude.json"),
    JSON.stringify({
      projects: {
        [directory]: { hasClaudeMdExternalIncludesApproved: false, hasClaudeMdExternalIncludesWarningShown: true },
      },
    }),
  );

  const { exitCode, output } = await runDoctor();

  assert.equal(exitCode, EXIT_CODES.FAILED);
  assert.match(output, /✖ Rules allowed in Claude Code — problem: you chose No in web-shop, so the rules don't load/);
  assert.match(output, /Fix: Close Claude\. In .*\.claude\.json, under "projects"/);
  assert.doesNotMatch(output, /Not checked:/, "the file answered, so the reminder isn't needed");
});

test("without Claude Code's state file, the question is a can't-tell row, and the reminder stays", async () => {
  await setUpEverything();

  const { output } = await runDoctor();

  assert.match(output, /– Rules allowed in Claude Code — skipped: can't tell/);
  assert.match(output, /Not checked: whether you chose Yes when Claude asked to load the rules/);
});

test("the shared investigations and docs folders aren't counted as apps", async () => {
  await setUpEverything();
  mkdirSync(join(sandbox.layout.projectsDirectory, "investigations", "web-shop", "ORD-1"), { recursive: true });
  mkdirSync(join(sandbox.layout.projectsDirectory, "docs"));

  const { output } = await runDoctor();

  assert.match(output, /Apps set up: 1 of 1/);
});

test("a repo path with a space is a warning about @ imports, not a line that points at nothing", async () => {
  sandbox.cleanUp();
  sandbox = makeSandbox({ folderName: "claude rules test " });
  await setUpEverything();

  const { output } = await runDoctor();

  assert.match(output, /! Shared rules in .* — worth a look: This repo's path has a space in it/);
  assert.doesNotMatch(output, /point at nothing/);
});

test("doctor never writes anything", async () => {
  await setUpEverything();

  const before = snapshotFolder(sandbox.root);

  await runDoctor();
  assert.deepEqual(snapshotFolder(sandbox.root), before);
});

test("a link elsewhere at the projects-level skills folder is pointed out, for setup to ask about", async () => {
  const elsewhere = join(sandbox.root, "other-skills");

  mkdirSync(elsewhere);
  mkdirSync(join(sandbox.projectsDirectory, ".claude"));
  symlinkSync(elsewhere, sandbox.layout.skillsLink, "junction");

  const { output } = await runDoctor();

  assert.match(output, /Skills link .* — .*other-skills/);
});
