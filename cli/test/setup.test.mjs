// @ts-check
// `setup` end to end, against a throwaway projects folder.

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { doctor } from "../commands/doctor.mjs";
import { setup } from "../commands/setup.mjs";
import { NOTES_MARKER } from "../lib/app-notes.mjs";
import { EXIT_CODES } from "../lib/errors.mjs";
import { toImportLine } from "../lib/layout.mjs";
import { runCommand } from "../lib/runner.mjs";
import { makeApp, makeContext, makeSandbox, snapshotFolder } from "./helpers.mjs";

/** @type {import("./helpers.mjs").Sandbox} */
let sandbox;

beforeEach(() => {
  sandbox = makeSandbox();
  makeApp(sandbox, "web-shop");
});
afterEach(() => sandbox.cleanUp());

const RIGHT_FOLDER = { "Your apps live in": true };
const GO_AHEAD = { "Go ahead?": true };

const sharedRulesLine = () => toImportLine(sandbox.layout.commonRulesFile);

/**
 * Whether a link ends up at a folder. Both sides are resolved, since macOS's temp folder is itself behind a link.
 * @param {string} link the link's path
 * @param {string} folder the folder it should reach
 * @returns {boolean} whether both lead to the same place
 */
const linksTo = (link, folder) => realpathSync(link) === realpathSync(folder);

test("a fresh computer: every step done, and the global git config untouched", async () => {
  const { context, ui } = makeContext(sandbox, { answers: [RIGHT_FOLDER, GO_AHEAD] });
  const exitCode = await runCommand(setup, context);

  assert.equal(exitCode, EXIT_CODES.OK, ui.text());
  assert.match(ui.text(), /All 3 done\./);
  assert.match(ui.text(), /Next: add your first app: claude-rules add-app$/m);
  assert.equal(readFileSync(sandbox.layout.sharedRulesFile, "utf8"), `${sharedRulesLine()}\n`);
  assert.ok(linksTo(sandbox.layout.skillsLink, sandbox.layout.skillsSource));
  assert.equal(readFileSync(sandbox.globalGitConfig, "utf8"), "", "setup must never change git settings");
});

test("a second run finds everything already done, asks no confirmation, and doesn't repeat the rows", async () => {
  await runCommand(setup, makeContext(sandbox, { answers: [RIGHT_FOLDER, GO_AHEAD] }).context);

  const { context, ui, scriptedAsk } = makeContext(sandbox);

  assert.equal(await runCommand(setup, context), EXIT_CODES.OK);

  const output = ui.text();

  assert.match(output, /Nothing to do — everything is already in place\./);
  assert.deepEqual(scriptedAsk.questions, [], "the projects folder was confirmed on the first run");
  assert.equal(output.match(/Shared rules line in/g)?.length, 1, "the rows are shown in the plan only");
  assert.doesNotMatch(output, /\n\n\nNothing to do/, "one blank line between the plan and the heading");
});

test("setup offers to add an app only while one is left to add", async () => {
  const { context } = makeContext(sandbox);

  assert.equal(setup.followUp?.question(context), "Add an app now?");

  writeFileSync(join(sandbox.layout.projectsDirectory, "web-shop", "CLAUDE.local.md"), `${NOTES_MARKER}\n`);

  assert.equal(setup.followUp?.question(context), null);
});

test("an existing CLAUDE.md keeps its content, gets the line once, and is backed up", async () => {
  writeFileSync(sandbox.layout.sharedRulesFile, "My own rules.\n");
  await runCommand(setup, makeContext(sandbox, { answers: [RIGHT_FOLDER, GO_AHEAD] }).context);
  await runCommand(setup, makeContext(sandbox).context);
  assert.equal(readFileSync(sandbox.layout.sharedRulesFile, "utf8"), `${sharedRulesLine()}\nMy own rules.\n`);
  assert.equal(readFileSync(`${sandbox.layout.sharedRulesFile}.bak`, "utf8"), "My own rules.\n");
});

test("a real skills folder with files in it is blocked, never deleted, and doctor gives the same reason", async () => {
  mkdirSync(sandbox.layout.skillsLink, { recursive: true });
  writeFileSync(join(sandbox.layout.skillsLink, "my-skill.md"), "mine");

  const { context, ui } = makeContext(sandbox, { answers: [RIGHT_FOLDER, GO_AHEAD] });

  assert.equal(await runCommand(setup, context), EXIT_CODES.FAILED);

  const output = ui.text();
  const reason = "it's a real folder with 1 item in it, so it's never deleted";

  assert.ok(output.includes(`can't do: ${reason}`), output);
  assert.match(output, /2 done, 1 can't do, 0 failed\./);
  assert.match(output, /Fix the ✖ lines above, then run the same command again\./);
  assert.doesNotMatch(output, /Next:/, "a run that failed has no next step");
  assert.equal(readFileSync(join(sandbox.layout.skillsLink, "my-skill.md"), "utf8"), "mine");
  assert.equal(
    readFileSync(sandbox.layout.sharedRulesFile, "utf8"),
    `${sharedRulesLine()}\n`,
    "the other step still ran",
  );

  const doctorRun = makeContext(sandbox);

  await runCommand(doctor, doctorRun.context);
  assert.ok(doctorRun.ui.text().includes(`problem: ${reason}`), doctorRun.ui.text());
});

test("--yes never replaces a link that points somewhere else", async () => {
  const elsewhere = join(sandbox.root, "someone-elses-skills");

  mkdirSync(elsewhere);
  mkdirSync(join(sandbox.projectsDirectory, ".claude"));
  symlinkSync(elsewhere, sandbox.layout.skillsLink, "junction");

  const { context, ui } = makeContext(sandbox, { options: { yes: true } });

  assert.equal(await runCommand(setup, context), EXIT_CODES.FAILED);
  assert.match(ui.text(), /Replace it with a link to this repo's skills\? no \(--yes\)/);
  assert.match(ui.text(), /not to this repo's skills/);
  assert.ok(linksTo(sandbox.layout.skillsLink, elsewhere));
});

test("--dry-run shows the plan and writes nothing", async () => {
  const before = snapshotFolder(sandbox.root);
  const { context, ui } = makeContext(sandbox, { answers: [RIGHT_FOLDER], options: { dryRun: true } });

  assert.equal(await runCommand(setup, context), EXIT_CODES.OK);
  assert.match(ui.text(), /^ {2}1 {2}Shared rules line in projects\/CLAUDE\.md — create it, with the line$/m);
  assert.match(ui.text(), /^ {2}2 {2}Link .* — create the link$/m, "the plan says what it will do, once");
  assert.match(ui.text(), /Dry run: nothing was changed\./);
  assert.deepEqual(snapshotFolder(sandbox.root), before);
});

test("answering 'no' to the projects folder stops before anything changes", async () => {
  const before = snapshotFolder(sandbox.root);
  const { context, ui } = makeContext(sandbox, { answers: [{ "Your apps live in": false }] });

  assert.equal(await runCommand(setup, context), EXIT_CODES.FAILED);
  assert.match(ui.text(), /Nothing was changed\./);
  assert.deepEqual(snapshotFolder(sandbox.root), before);
});

test("a repo path with a space in it gets a warning about @ imports", async () => {
  const spaced = makeSandbox({ folderName: "claude rules test " });

  try {
    const { context, ui } = makeContext(spaced, { answers: [RIGHT_FOLDER], options: { dryRun: true } });

    await runCommand(setup, context);
    assert.match(ui.text(), /! This repo's path has a space in it .* Claude may not load @ imports from it/);
  } finally {
    spaced.cleanUp();
  }
});

/**
 * Your personal Claude Code settings file, in the sandbox's home folder.
 * @returns {string} its path
 */
const settingsFile = () => join(sandbox.home, ".claude", "settings.json");

/**
 * The sandbox's copy of the hook script, with forward slashes as the command line holds it on Windows too.
 * @returns {string} the path
 */
const scriptPath = () => sandbox.layout.bugFixReminderScript.split(sep).join("/");

/**
 * The hook entry setup writes for this sandbox.
 * @returns {object} the entry
 */
const ourEntry = () => ({ type: "command", command: `node "${scriptPath()}"`, timeout: 5 });

/**
 * The parsed settings file.
 * @returns {{ model?: string, hooks: { UserPromptSubmit: object[] } }} the settings
 */
const readSettings = () => JSON.parse(readFileSync(settingsFile(), "utf8"));

test("with no settings file, the reminder hook is the whole new file", async () => {
  await runCommand(setup, makeContext(sandbox, { answers: [RIGHT_FOLDER, GO_AHEAD] }).context);

  assert.deepEqual(readSettings(), { hooks: { UserPromptSubmit: [{ hooks: [ourEntry()] }] } });
});

test("your own settings and hooks are kept, the old file is backed up, and a second run changes nothing", async () => {
  const own = { model: "opus", hooks: { UserPromptSubmit: [{ hooks: [{ type: "command", command: "my-hook" }] }] } };

  mkdirSync(dirname(settingsFile()), { recursive: true });
  writeFileSync(settingsFile(), JSON.stringify(own));
  await runCommand(setup, makeContext(sandbox, { answers: [RIGHT_FOLDER, GO_AHEAD] }).context);

  const settings = readSettings();

  assert.equal(settings.model, "opus");
  assert.deepEqual(settings.hooks.UserPromptSubmit, [...own.hooks.UserPromptSubmit, { hooks: [ourEntry()] }]);
  assert.equal(readFileSync(`${settingsFile()}.bak`, "utf8"), JSON.stringify(own));

  const { context, ui } = makeContext(sandbox);

  assert.equal(await runCommand(setup, context), EXIT_CODES.OK);
  assert.match(ui.text(), /Nothing to do — everything is already in place\./);
});

test("an entry in the old form, with the script in args, becomes one command line", async () => {
  const old = { type: "command", command: "node", args: [sandbox.layout.bugFixReminderScript], timeout: 5 };

  mkdirSync(dirname(settingsFile()), { recursive: true });
  writeFileSync(settingsFile(), JSON.stringify({ hooks: { UserPromptSubmit: [{ hooks: [old] }] } }));

  const { context, ui } = makeContext(sandbox, { answers: [RIGHT_FOLDER, GO_AHEAD] });

  assert.equal(await runCommand(setup, context), EXIT_CODES.OK, ui.text());
  assert.deepEqual(readSettings(), { hooks: { UserPromptSubmit: [{ hooks: [ourEntry()] }] } });
});

test("a bare node left by Claude Code 2.1.39 beside a hand-fixed entry becomes the one entry", async () => {
  // Claude Code dropped `args` on managed Windows; the fixed entry was added beside it.
  const bare = { type: "command", command: "node", timeout: 5 };
  const groups = [{ hooks: [bare] }, { hooks: [ourEntry()] }];

  mkdirSync(dirname(settingsFile()), { recursive: true });
  writeFileSync(settingsFile(), JSON.stringify({ model: "opus", hooks: { UserPromptSubmit: groups } }));

  const { context, ui } = makeContext(sandbox, { answers: [RIGHT_FOLDER, GO_AHEAD] });

  assert.equal(await runCommand(setup, context), EXIT_CODES.OK, ui.text());
  assert.match(ui.text(), /keep one reminder entry and remove the copies/);
  assert.deepEqual(readSettings(), { model: "opus", hooks: { UserPromptSubmit: [{ hooks: [ourEntry()] }] } });
});

test("node with arguments of your own is your hook, and is kept", async () => {
  const own = { type: "command", command: "node", args: ["/home/me/my-hook.mjs"] };

  mkdirSync(dirname(settingsFile()), { recursive: true });
  writeFileSync(settingsFile(), JSON.stringify({ hooks: { UserPromptSubmit: [{ hooks: [own] }] } }));
  await runCommand(setup, makeContext(sandbox, { answers: [RIGHT_FOLDER, GO_AHEAD] }).context);

  assert.deepEqual(readSettings().hooks.UserPromptSubmit, [{ hooks: [own] }, { hooks: [ourEntry()] }]);
});

test("an entry pointing at an old copy of the script is replaced in place, never doubled", async () => {
  const old = { type: "command", command: "node", args: ["/old/place/prompts/cli/hooks/bug-fix-reminder.mjs"] };

  mkdirSync(dirname(settingsFile()), { recursive: true });
  writeFileSync(settingsFile(), JSON.stringify({ hooks: { UserPromptSubmit: [{ hooks: [old] }] } }));

  const { context, ui } = makeContext(sandbox, { answers: [RIGHT_FOLDER, GO_AHEAD] });

  assert.equal(await runCommand(setup, context), EXIT_CODES.OK, ui.text());
  assert.match(ui.text(), /update the reminder's entry to this copy of the script/);
  assert.deepEqual(readSettings(), { hooks: { UserPromptSubmit: [{ hooks: [ourEntry()] }] } });
});

test("a settings file that isn't valid JSON is left byte-for-byte alone, with the fix", async () => {
  mkdirSync(dirname(settingsFile()), { recursive: true });
  writeFileSync(settingsFile(), "{ \"model\": ");

  const { context, ui } = makeContext(sandbox, { answers: [RIGHT_FOLDER, GO_AHEAD] });

  assert.notEqual(await runCommand(setup, context), EXIT_CODES.OK);
  assert.match(ui.text(), /it isn't valid JSON, so it was left as it is/);
  assert.match(ui.text(), /Fix .*\/\.claude\/settings\.json, then run this again\./);
  assert.equal(readFileSync(settingsFile(), "utf8"), "{ \"model\": ");
});

test("a settings file saved with Windows line endings keeps them", async () => {
  mkdirSync(dirname(settingsFile()), { recursive: true });
  writeFileSync(settingsFile(), "{\r\n  \"model\": \"opus\"\r\n}\r\n");
  await runCommand(setup, makeContext(sandbox, { answers: [RIGHT_FOLDER, GO_AHEAD] }).context);

  const text = readFileSync(settingsFile(), "utf8");

  assert.ok(text.includes("\r\n"));
  assert.doesNotMatch(text, /[^\r]\n/, "every line break is CRLF");
});

test("a hook entry that isn't an object leaves the file alone, rather than crashing setup", async () => {
  const text = JSON.stringify({ hooks: { UserPromptSubmit: [{ hooks: [null] }] } });

  mkdirSync(dirname(settingsFile()), { recursive: true });
  writeFileSync(settingsFile(), text);

  const { context, ui } = makeContext(sandbox, { answers: [RIGHT_FOLDER, GO_AHEAD] });

  assert.equal(await runCommand(setup, context), EXIT_CODES.FAILED, ui.text());
  assert.match(ui.text(), /its "hooks\.UserPromptSubmit" isn't a list of hook groups, so it was left as it is/);
  assert.equal(readFileSync(settingsFile(), "utf8"), text);
});

test("a settings file that starts with a byte-order mark is read, and keeps the mark", async () => {
  const bom = "\uFEFF";

  mkdirSync(dirname(settingsFile()), { recursive: true });
  writeFileSync(settingsFile(), `${bom}{ "model": "opus" }\r\n`);

  const { context, ui } = makeContext(sandbox, { answers: [RIGHT_FOLDER, GO_AHEAD] });

  assert.equal(await runCommand(setup, context), EXIT_CODES.OK, ui.text());

  const text = readFileSync(settingsFile(), "utf8");

  assert.ok(text.startsWith(`${bom}{`), "the mark stays first");
  assert.equal(JSON.parse(text.slice(bom.length)).model, "opus");
});

test("a field you added to the reminder's entry is kept, and the entry counts as up to date", async () => {
  const withMessage = { ...ourEntry(), statusMessage: "checking for bugs" };
  const text = JSON.stringify({ hooks: { UserPromptSubmit: [{ hooks: [withMessage] }] } });

  mkdirSync(dirname(settingsFile()), { recursive: true });
  writeFileSync(settingsFile(), text);

  const { context, ui } = makeContext(sandbox, { answers: [RIGHT_FOLDER, GO_AHEAD] });

  assert.equal(await runCommand(setup, context), EXIT_CODES.OK, ui.text());
  assert.equal(readFileSync(settingsFile(), "utf8"), text, "left byte-for-byte as it was");
  assert.equal(existsSync(`${settingsFile()}.bak`), false, "nothing to change, so nothing backed up");
});

test("copies of the reminder's entry become one; an emptied group goes, an empty one of yours stays", async () => {
  const old = { type: "command", command: "node", args: ["/old/prompts/cli/hooks/bug-fix-reminder.mjs"], note: "mine" };
  const copy = { ...ourEntry(), timeout: 9 };
  const own = { type: "command", command: "my-hook" };
  const groups = [{ hooks: [old, own] }, { hooks: [copy] }, { hooks: [] }];

  mkdirSync(dirname(settingsFile()), { recursive: true });
  writeFileSync(settingsFile(), JSON.stringify({ hooks: { UserPromptSubmit: groups } }));

  const { context, ui } = makeContext(sandbox, { answers: [RIGHT_FOLDER, GO_AHEAD] });

  assert.equal(await runCommand(setup, context), EXIT_CODES.OK, ui.text());
  assert.match(ui.text(), /keep one reminder entry and remove the copies/);
  assert.deepEqual(readSettings().hooks.UserPromptSubmit, [
    { hooks: [{ ...ourEntry(), note: "mine" }, own] },
    { hooks: [] },
  ]);
});
