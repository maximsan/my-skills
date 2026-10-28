// @ts-check
// The foundations everything else relies on: stopping a question, killing a stuck child, atomic writes, locked
// writes during the plan stage, and git's answers never being guessed.

import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, test } from "node:test";
import { createAsker } from "../lib/ask.mjs";
import { NeedsTerminalError, StepFailure, StoppedError } from "../lib/errors.mjs";
import { runProcess } from "../lib/exec.mjs";
import { createFiles, TEMPORARY_SUFFIX, withoutWindowsPrefix } from "../lib/files.mjs";
import { createGit } from "../lib/git.mjs";
import { createUi } from "../lib/ui.mjs";
import { makeRecordingUi, makeSandbox, runGit } from "./helpers.mjs";

/**
 * A real asker over fake input and output, with a way to type into it and abort it.
 * @param {Partial<import("../lib/ask.mjs").AskerOptions>} [overrides] asker options that differ from a person at a
 *   terminal
 * @returns {{ asker: import("../lib/ask.mjs").Asker, input: import("node:stream").PassThrough,
 *   controller: AbortController, said: string[] }} the asker, its input, its abort controller, and the lines it said
 */
const makeAsker = (overrides = {}) => {
  const input = new PassThrough();
  const output = new PassThrough();
  const controller = new AbortController();

  const ui = makeRecordingUi();
  const asker = createAsker({
    input,
    output,
    signal: controller.signal,
    isInteractive: true,
    assumeDefaults: false,
    onInterrupt: () => controller.abort(),
    ui,
    ...overrides,
  });

  return { asker, input, controller, said: ui.lines };
};

/** A pick list's items, for the asker's tests. */
const APPS = [{ label: "web" }, { label: "shop" }, { label: "admin" }];

describe("asking questions", () => {
  test("Ctrl+C rejects a waiting question within 100 ms", async () => {
    const { asker, controller } = makeAsker();
    const pending = asker.confirm("Go ahead?");
    const startedAt = Date.now();

    setTimeout(() => controller.abort(), 10);
    await assert.rejects(pending, StoppedError);
    assert.ok(Date.now() - startedAt < 100, "the question should give up at once");
    asker.close();
  });

  test("closing the input (Ctrl+D) counts as stopping", async () => {
    const { asker, input } = makeAsker();
    const pending = asker.confirm("Go ahead?");

    input.end();
    await assert.rejects(pending, StoppedError);
    asker.close();
  });

  test("Esc stops a typed question, as it stops a pick list", async () => {
    const { asker, input } = makeAsker();
    const pending = asker.text("File to copy");

    input.emit("keypress", undefined, { name: "escape" });
    await assert.rejects(pending, StoppedError);
    assert.equal(input.listenerCount("keypress"), 0, "the question stops listening for keys");
    asker.close();
  });

  test("a question asked after the run was stopped fails at once", async () => {
    const { asker, controller } = makeAsker();

    controller.abort();
    await assert.rejects(asker.confirm("Go ahead?"), StoppedError);
    asker.close();
  });

  test("with no terminal, a question fails at once instead of waiting", async () => {
    const { asker } = makeAsker({ isInteractive: false });

    await assert.rejects(asker.confirm("Go ahead?"), NeedsTerminalError);
  });

  test("--yes answers with the default, says so, and never opens stdin", async () => {
    const { asker, said } = makeAsker({ assumeDefaults: true, isInteractive: false });

    assert.equal(await asker.confirm("Replace it?", false), false);
    assert.equal(await asker.pickOne("Which app?", APPS, 1), 1);
    assert.deepEqual(await asker.pickMany("Stack rules:", APPS, [0, 2]), [0, 2]);
    assert.deepEqual(said, ["Replace it? no (--yes)", "Which app? shop (--yes)", "Stack rules: web, admin (--yes)"]);
  });

  test("without single key presses, a list is answered by typing its keys", async () => {
    const { asker, input, said } = makeAsker();
    const pending = asker.pickOne("Which app?", APPS, 0);

    input.write("4\n");
    setTimeout(() => input.write("3\n"), 20);
    assert.equal(await pending, 2);
    assert.ok(said.includes("  3  admin"), said.join("\n"));
    assert.ok(said.includes("Please type one of: 1, 2, 3."), said.join("\n"));
    asker.close();
  });

  test("a typed list of several keeps the marked items on Enter, and takes none or a range", async () => {
    const { asker, input } = makeAsker();

    for (const [typed, expected] of /** @type {const} */ ([["", [1]], ["none", []], ["1-2", [0, 1]]])) {
      const pending = asker.pickMany("Stack rules:", APPS, [1]);

      input.write(`${typed}\n`);
      assert.deepEqual(await pending, expected, `typed "${typed}"`);
    }

    asker.close();
  });

  test("an unclear answer is asked again", async () => {
    const { asker, input, said } = makeAsker();
    const pending = asker.confirm("Go ahead?");

    input.write("maybe\n");
    setTimeout(() => input.write("n\n"), 20);
    assert.equal(await pending, false);
    assert.deepEqual(said, ["Please answer y or n."]);
    asker.close();
  });
});

describe("pick lists in a terminal", () => {
  const DOWN = "\x1b[B";
  const SPACE = " ";
  const ENTER = "\r";
  const ESC = "\x1b";
  const CTRL_C = "\x03";
  const CTRL_D = "\x04";

  /**
   * An asker over a fake keyboard that says it is a terminal, and records each switch into and out of raw mode.
   * @returns {{ asker: import("../lib/ask.mjs").Asker, type: (keys: string) => void, rawModes: boolean[],
   *   controller: AbortController, lines: string[], interrupts: () => number, keyListeners: () => number }} the asker,
   *   a way to press keys, the raw-mode switches, the abort controller, what was printed, how many interrupts it
   *   passed on, and how many listeners the keyboard has
   */
  const makeKeyAsker = () => {
    const keyboard = Object.assign(new PassThrough(), { isTTY: true, setRawMode: (/** @type {boolean} */ isRaw) => {
      rawModes.push(isRaw);
    } });
    const controller = new AbortController();
    const ui = makeRecordingUi();
    let interruptCount = 0;

    /** @type {boolean[]} */
    const rawModes = [];
    const asker = createAsker({
      input: keyboard,

      // A terminal too, so Node's line reader reads key by key, as it does for a person.
      output: Object.assign(new PassThrough(), { isTTY: true, columns: 80 }),
      signal: controller.signal,
      isInteractive: true,
      assumeDefaults: false,
      onInterrupt: () => {
        interruptCount += 1;
        controller.abort();
      },
      ui,
    });

    return {
      asker,
      type: (keys) => {
        keyboard.write(keys);
      },
      rawModes,
      controller,
      lines: ui.lines,
      interrupts: () => interruptCount,
      keyListeners: () => keyboard.listenerCount("keypress"),
    };
  };

  test("arrow keys pick one item, and the list folds into one line naming it", async () => {
    const { asker, type, rawModes, lines } = makeKeyAsker();
    const pending = asker.pickOne("Which app?", APPS, 0);

    type(`${DOWN}${DOWN}${ENTER}`);
    assert.equal(await pending, 2);
    assert.equal(lines.at(-1), "Which app? admin");
    assert.equal(rawModes.at(-1), false, "raw mode is switched off");
    asker.close();
  });

  test("Space marks items in a list of several", async () => {
    const { asker, type } = makeKeyAsker();
    const pending = asker.pickMany("Stack rules:", APPS, [0]);

    type(`${SPACE}${DOWN}${DOWN}${SPACE}${ENTER}`);
    assert.deepEqual(await pending, [2]);
    asker.close();
  });

  test("Ctrl+C in a list is passed on as an interrupt, stops, and leaves raw mode", async () => {
    const { asker, type, rawModes, interrupts } = makeKeyAsker();
    const pending = asker.pickOne("Which app?", APPS, 0);

    type(CTRL_C);
    await assert.rejects(pending, StoppedError);
    assert.equal(interrupts(), 1);
    assert.equal(rawModes.at(-1), false);
    asker.close();
  });

  test("Esc stops a list", async () => {
    const { asker, type, rawModes } = makeKeyAsker();
    const pending = asker.pickMany("Stack rules:", APPS, []);

    type(ESC);
    await assert.rejects(pending, StoppedError);
    assert.equal(rawModes.at(-1), false);
    asker.close();
  });

  test("after a typed question, a list's Ctrl+C counts once, and nothing is left on the keyboard", async () => {
    const { asker, type, interrupts, keyListeners } = makeKeyAsker();
    const question = asker.confirm("Go ahead?");

    type("y\r");
    assert.equal(await question, true);

    const pending = asker.pickOne("Which app?", APPS, 0);

    type(CTRL_C);
    await assert.rejects(pending, StoppedError);
    assert.equal(interrupts(), 1, "a second interrupt would make the CLI quit at once");
    asker.close();
    assert.equal(keyListeners(), 0);
  });

  test("after Ctrl+D, the next question stops too, instead of failing on a closed reader", async () => {
    const { asker, type } = makeKeyAsker();
    const first = asker.confirm("Go ahead?");

    type(CTRL_D);
    await assert.rejects(first, StoppedError);
    await assert.rejects(asker.confirm("Go ahead?"), StoppedError);
    asker.close();
  });

  test("close() ends an open list and leaves raw mode, so a crash never leaves the terminal broken", async () => {
    const { asker, rawModes } = makeKeyAsker();
    const pending = asker.pickOne("Which app?", APPS, 0);

    asker.close();
    await assert.rejects(pending, StoppedError);
    assert.equal(rawModes.at(-1), false);
  });
});

describe("running programs", () => {
  test("a child that hangs is killed at its timeout and reported", async () => {
    const result = await runProcess(process.execPath, ["-e", "setTimeout(() => {}, 10000)"], {
      cwd: tmpdir(),
      timeoutMs: 200,
    });

    assert.equal(result.timedOut, true);
    assert.ok(result.durationMs < 2000, `took ${result.durationMs}ms`);
  });

  test("a program that isn't installed is reported, not thrown", async () => {
    const result = await runProcess("claude-rules-no-such-program", [], { cwd: tmpdir(), timeoutMs: 1000 });

    assert.equal(result.failedToStart, true);
  });

  test("Ctrl+C kills a running child", async () => {
    const controller = new AbortController();

    setTimeout(() => controller.abort(), 50);

    const result = await runProcess(process.execPath, ["-e", "setTimeout(() => {}, 10000)"], {
      cwd: tmpdir(),
      timeoutMs: 5000,
      signal: controller.signal,
    });

    assert.equal(result.aborted, true);
    assert.equal(result.failedToStart, false);
  });
});

describe("writing files", () => {
  /** @type {string} */
  let directory;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "claude-rules-files-"));
  });
  afterEach(() => rmSync(directory, { recursive: true, force: true }));

  test("a write that fails before the rename leaves the old file intact", () => {
    const path = join(directory, "CLAUDE.md");

    writeFileSync(path, "original\n");

    // A folder where the temporary file should go makes the first half of the write fail.
    mkdirSync(`${path}${TEMPORARY_SUFFIX}`);
    assert.throws(() => createFiles({ platform: process.platform }).writeTextAtomic(path, "new\n"));
    assert.equal(readFileSync(path, "utf8"), "original\n");
  });

  test("a write that fails at the rename leaves no temp file behind", () => {
    const path = join(directory, "notes");

    // A folder with something in it can't be replaced by a rename, so the second half of the write fails.
    mkdirSync(path);
    writeFileSync(join(path, "inside.md"), "x");
    assert.throws(() => createFiles({ platform: process.platform }).writeTextAtomic(path, "new\n"));
    assert.deepEqual(readdirSync(directory), ["notes"]);
  });

  test("a backup into a folder is timestamped there, and nothing is left beside the file", () => {
    const files = createFiles({ platform: process.platform });
    const path = join(directory, "CLAUDE.local.md");

    writeFileSync(path, "mine\n");

    const backupPath = files.backUp(path, { intoFolder: join(directory, ".git", "claude-rules-backups") });

    assert.match(backupPath, /claude-rules-backups[\\/]CLAUDE\.local\.md\..+\.bak$/);
    assert.equal(readFileSync(backupPath, "utf8"), "mine\n");
    assert.equal(existsSync(`${path}.bak`), false);
  });

  test("files remember whether anything was written, so a stop can say so truthfully", () => {
    const files = createFiles({ platform: process.platform });

    assert.equal(files.hasChanged(), false);
    files.createDirectory(join(directory, "folder"));
    assert.equal(files.hasChanged(), true);
  });

  test("on Windows, paths compare case-insensitively, and a junction's \\\\?\\ prefix is dropped", () => {
    assert.equal(createFiles({ platform: "win32" }).isSamePath("/Projects/Prompts/", "/projects/prompts"), true);
    assert.equal(createFiles({ platform: "linux" }).isSamePath("/Projects/Prompts", "/projects/prompts"), false);
    assert.equal(withoutWindowsPrefix("\\\\?\\C:\\Users\\me\\skills"), "C:\\Users\\me\\skills");
  });

  test("while checking, every write throws and nothing is written", async () => {
    const files = createFiles({ platform: process.platform });
    const path = join(directory, "notes.md");

    await files.withWritesLocked(async () => {
      assert.throws(() => files.writeTextAtomic(path, "x"), /while only checking/);
      assert.throws(() => files.createDirectory(join(directory, "folder")), /while only checking/);
    });
    assert.equal(files.exists(path), false);
    files.writeTextAtomic(path, "allowed again\n");
    assert.equal(readFileSync(path, "utf8"), "allowed again\n");
  });

  test("a backup never overwrites an earlier backup", () => {
    const files = createFiles({ platform: process.platform });
    const path = join(directory, "CLAUDE.md");

    writeFileSync(path, "first\n");

    const firstBackup = files.backUp(path);

    writeFileSync(path, "second\n");

    const secondBackup = files.backUp(path);

    assert.notEqual(firstBackup, secondBackup);
    assert.equal(readFileSync(firstBackup, "utf8"), "first\n");
  });

  test("a link is reported as a link, with its target", () => {
    const files = createFiles({ platform: process.platform });
    const target = join(directory, "skills");

    mkdirSync(target);
    files.createDirectoryLink(target, join(directory, "link"));

    const found = files.inspectPath(join(directory, "link"));

    assert.equal(found.kind, "link");
    assert.ok(found.kind === "link" && files.isSamePath(found.target, target));
  });
});

describe("printing", () => {
  test("the plan styles each label by its status, including 'worth a look'", () => {
    let printed = "";
    const output = Object.assign(new PassThrough(), { isTTY: true, hasColors: () => true });

    output.on("data", (chunk) => (printed += chunk.toString()));

    const ui = createUi({ output, env: {}, platform: "linux", isDebug: false });

    ui.plan([
      { status: "warn", title: "a", label: "worth a look" },
      { status: "blocked", title: "b", label: "can't do" },
    ]);
    assert.ok(printed.includes("\x1b[33mworth a look\x1b[0m"), JSON.stringify(printed));
    assert.ok(printed.includes("\x1b[31mcan't do\x1b[0m"), JSON.stringify(printed));
  });

  test("in a narrow terminal, the progress line is cut so it never wraps, and is replaced by the step's result", () => {
    /** @type {string[]} */
    const writes = [];
    const output = Object.assign(new PassThrough(), { isTTY: true, columns: 30, hasColors: () => false });

    output.on("data", (chunk) => writes.push(chunk.toString()));

    const ui = createUi({ output, env: {}, platform: "linux", isDebug: false });
    const { finish } = ui.progress(1, 3, "Keep your notes out of git for this repo only");

    finish({ tone: "ok", title: "Keep your notes out of git for this repo only", label: "done", detail: "added" });
    ui.dispose();

    const [running] = writes.map((text) => text.replace("\r\x1b[2K", ""));

    assert.ok(running.length < 30, JSON.stringify(running));
    assert.match(running, /^· \[1\/3\] Keep your notes .*\(0s\)$/);
    assert.equal(writes.at(-1), "  ✔ Keep your notes out of git for this repo only — added\n", "a quick step: no time");
  });
});

describe("asking git", () => {
  /** @type {import("./helpers.mjs").Sandbox} */
  let sandbox;

  beforeEach(() => {
    sandbox = makeSandbox();
  });
  afterEach(() => sandbox.cleanUp());

  const makeGit = () => createGit({ env: sandbox.env, signal: new AbortController().signal });

  test("a folder outside any repo is 'not a repository', as an answer", async () => {
    assert.equal(await makeGit().isRepository(sandbox.home), false);
  });

  test("check-ignore that git can't answer (exit 128) is a failure, never 'ignored'", async () => {
    await assert.rejects(makeGit().checkIgnore(sandbox.home, ["CLAUDE.local.md"]), StepFailure);
  });

  test("a repository with a broken config is a failure with git's message, not 'not a repository'", async () => {
    const directory = join(sandbox.projectsDirectory, "web-shop");

    mkdirSync(directory);
    runGit(["init", "-q"], directory, sandbox.env);
    writeFileSync(join(directory, ".git", "config"), "[core\n");
    await assert.rejects(makeGit().isRepository(directory), (error) => {
      assert.ok(error instanceof StepFailure);
      assert.match(error.message, /git can't read the repository/);

      return true;
    });
  });
});
