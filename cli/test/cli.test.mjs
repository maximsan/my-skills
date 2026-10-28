// @ts-check
// The real process: exit codes, Ctrl+C, the follow-up offer, and that it always exits. These spawn main.mjs itself.
//
// Each test runs a copy of the CLI inside its own sandbox, with a fake HOME and an empty global git config, so even
// the tests that apply changes can't touch your real setup.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { COMMANDS } from "../commands/index.mjs";
import { findExecutable } from "../lib/exec.mjs";
import { makeApp, makeSandbox } from "./helpers.mjs";

/** @type {import("./helpers.mjs").Sandbox} */
let sandbox;

beforeEach(() => {
  sandbox = makeSandbox({ withCli: true });
});
afterEach(() => sandbox.cleanUp());

/**
 * @typedef {import("node:child_process").ChildProcessWithoutNullStreams} ChildProcess
 * @typedef {{ when: string, answer?: string, then?: (child: ChildProcess) => void }} Reaction
 *   when the output first contains `when`: do `then`, then type `answer` and Enter
 */

/**
 * Runs the sandbox's main.mjs and collects what happened. Fails the test instead of hanging if it doesn't exit.
 * @param {string[]} args the command-line arguments
 * @param {{ env?: NodeJS.ProcessEnv, reactions?: Reaction[], timeoutMs?: number, nodeOptions?: string[] }}
 *   [options] extra environment, what to type when, how long to wait, and flags for node
 * @returns {Promise<{ code: number | null, output: string, lastOutputAt: number, exitedAt: number,
 *   reactedAt: number[] }>} the exit code, everything printed, and when things happened
 */
const runCli = (args, { env = {}, reactions = [], timeoutMs = 15_000, nodeOptions = [] } = {}) =>
  new Promise((resolvePromise, reject) => {
    const main = join(sandbox.repoRoot, "cli", "main.mjs");
    const child = spawn(process.execPath, [...nodeOptions, main, ...args], {
      cwd: sandbox.root,
      env: { ...sandbox.env, NO_COLOR: "1", ...env },
      stdio: "pipe",
    });
    let output = "";
    let lastOutputAt = Date.now();
    const pending = [...reactions];

    /** @type {number[]} */
    const reactedAt = [];
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`claude-rules ${args.join(" ")} didn't exit within ${timeoutMs}ms. Output so far:\n${output}`));
    }, timeoutMs);
    let searchFrom = 0;

    const collect = (/** @type {Buffer} */ chunk) => {
      output += chunk.toString();
      lastOutputAt = Date.now();

      // Each reaction looks only at the output after the previous one, so an early "Go ahead?" can't set off a
      // later reaction.
      for (let next = pending[0]; next; next = pending[0]) {
        const found = output.indexOf(next.when, searchFrom);

        if (found === -1) {
          break;
        }

        pending.shift();
        searchFrom = found + next.when.length;
        reactedAt.push(Date.now());
        next.then?.(child);

        if (next.answer !== undefined) {
          child.stdin.write(`${next.answer}\n`);
        }
      }
    };

    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolvePromise({ code, output, lastOutputAt, exitedAt: Date.now(), reactedAt });
    });
  });

const AS_TERMINAL = { CLAUDE_RULES_ASSUME_TERMINAL: "1" };

/**
 * Sends Ctrl+C to the running CLI.
 * @param {ChildProcess} child the running CLI
 * @returns {boolean} whether the signal was sent
 */
const pressCtrlC = (child) => child.kill("SIGINT");

/** Windows has no signal to send: there `child.kill("SIGINT")` ends the process outright, so Ctrl+C can't be faked. */
const NO_CTRL_C = process.platform === "win32" ? "Windows can't send Ctrl+C to a child process" : false;

test("--help lists exactly the registered commands", async () => {
  const { code, output } = await runCli(["--help"]);

  assert.equal(code, 0);

  const listed = [...output.matchAll(/^ {2}(\S+) {2,}/gm)]
    .map((match) => match[1])
    .filter((name) => !name.startsWith("--"));

  assert.deepEqual(
    listed,
    COMMANDS.map((command) => command.name),
  );
});

test("an unknown flag exits 2 with a hint", async () => {
  const { code, output } = await runCli(["setup", "--dry-rn"]);

  assert.equal(code, 2);
  assert.match(output, /Unknown option "--dry-rn"\. Run claude-rules --help\./);
});

test("an argument to a command that takes none exits 2", async () => {
  const { code, output } = await runCli(["doctor", "web-shop"]);

  assert.equal(code, 2);
  assert.match(output, /doctor takes no arguments/);
});

/** `--import`, which the old-Node test fakes the version with, arrived in Node 18.18 and 20.6. */
const [major, minor] = process.versions.node.split(".").map(Number);
const hasImportFlag = major > 20 || (major === 20 && minor >= 6) || (major === 18 && minor >= 18) || major === 19;

test(
  "on a Node that's too old, it says so plainly and exits 1",
  {
    skip: hasImportFlag ? false : "this Node has no --import to fake an old version with",
  },
  async () => {
    const fakeOldNode = "Object.defineProperty(process.versions, \"node\", { value: \"16.20.0\" });";
    const { code, output } = await runCli(["--help"], {
      nodeOptions: ["--import", `data:text/javascript,${encodeURIComponent(fakeOldNode)}`],
    });

    assert.equal(code, 1);
    assert.match(output, /^claude-rules needs Node 18 or newer, and this is Node 16\.20\.0\.$/m);
    assert.doesNotMatch(output, /Usage:/, "the program itself never loaded");
  },
);

test("with no terminal, the menu exits 2 at once instead of waiting", async () => {
  const { code, output } = await runCli([]);

  assert.equal(code, 2);
  assert.match(output, /The menu needs a terminal/);
});

test("Help in the menu prints the help and exits, instead of showing the menu again below it", async () => {
  const { code, output } = await runCli([], { env: AS_TERMINAL, reactions: [{ when: "What next?", answer: "h" }] });

  assert.equal(code, 0, output);
  assert.match(output, /Flags:/);
  assert.match(output, /Next: run claude-rules again for the menu\./);
  assert.equal(output.match(/What next\?/g)?.length, 1, output);
});

test("with no terminal, a command that has to ask exits 2 at once", async () => {
  const { code, output } = await runCli(["setup", "--dry-run"]);

  assert.equal(code, 2);
  assert.match(output, /This needs answers — run it in a terminal, or add --yes\./);
});

test("Ctrl+C at a question exits 130 within 2 seconds, saying nothing changed", { skip: NO_CTRL_C }, async () => {
  const { code, output, exitedAt, reactedAt } = await runCli(["setup", "--dry-run"], {
    env: AS_TERMINAL,
    reactions: [{ when: "Your apps live in", then: pressCtrlC }],
  });

  assert.equal(reactedAt.length, 1, `the question never appeared:\n${output}`);
  assert.equal(code, 130);
  assert.match(output, /Stopped by you\. Nothing was changed\./);
  assert.ok(exitedAt - reactedAt[0] < 2000, `took ${exitedAt - reactedAt[0]}ms to stop`);
});

test("declining 'Go ahead?' changes nothing and offers no follow-up", async () => {
  makeApp(sandbox, "web-shop");

  const { code, output } = await runCli(["setup"], {
    env: AS_TERMINAL,
    reactions: [
      { when: "Your apps live in", answer: "y" },
      { when: "Go ahead?", answer: "n" },
    ],
  });

  assert.equal(code, 0, output);
  assert.match(output, /Nothing was changed\./);
  assert.doesNotMatch(output, /Add an app now\?/);
  assert.doesNotMatch(output, /Next:/);
});

test("after add-app, the next app is offered while any are left", async () => {
  makeApp(sandbox, "web-shop");
  makeApp(sandbox, "admin");

  const addOne = [
    { when: "Stack rules:", answer: "" },
    { when: "Go ahead?", answer: "y" },
  ];
  const first = await runCli(["add-app", "web-shop"], {
    env: AS_TERMINAL,
    reactions: [...addOne, { when: "Add another app? 1 left.", answer: "n" }],
  });

  assert.equal(first.code, 0, first.output);
  assert.match(first.output, /Add another app\? 1 left\./);

  const last = await runCli(["add-app", "admin"], { env: AS_TERMINAL, reactions: addOne });

  assert.equal(last.code, 0, last.output);
  assert.doesNotMatch(last.output, /Add another app/, "nothing left to offer");
});

test("Ctrl+C after setup made its changes says they're kept, not that nothing changed", {
  skip: NO_CTRL_C,
}, async () => {
  makeApp(sandbox, "web-shop");

  const { code, output } = await runCli(["setup"], {
    env: AS_TERMINAL,
    reactions: [
      { when: "Your apps live in", answer: "y" },
      { when: "Go ahead?", answer: "y" },
      { when: "Add an app now?", then: pressCtrlC },
    ],
  });

  assert.equal(code, 130, output);
  assert.match(output, /Stopped by you\. Changes already made are kept; run the command again to continue\./);
  assert.doesNotMatch(output, /Nothing was changed/);
});

test(
  "Ctrl+C while a step runs stops there: the rest are 'not run', and it exits 130",
  {
    skip: process.platform === "win32" ? "the slow git stand-in is a shell script" : false,
  },
  async () => {
    makeApp(sandbox, "web-shop", { packageJson: { dependencies: { react: "^18" } } });

    // A stand-in for git that is slow to find the exclude file once the marker exists, so Ctrl+C lands mid-step.
    const realGit = findExecutable("git", { env: process.env, platform: process.platform });
    const binDirectory = join(sandbox.root, "bin");
    const marker = join(sandbox.root, "slow-git");

    mkdirSync(binDirectory);
    writeFileSync(
      join(binDirectory, "git"),
      [
        "#!/bin/sh",
        `if [ -f "${marker}" ] && [ "$2" = "--git-path" ]; then`,
        "  trap 'kill $! 2>/dev/null; exit 143' TERM",
        "  sleep 5 & wait",
        "fi",
        `exec "${realGit}" "$@"`,
        "",
      ].join("\n"),
    );
    chmodSync(join(binDirectory, "git"), 0o755);

    const { code, output } = await runCli(["add-app", "web-shop"], {
      env: { ...AS_TERMINAL, PATH: `${binDirectory}:${sandbox.env.PATH}` },
      reactions: [
        { when: "Stack rules:", answer: "" },
        { when: "Go ahead?", answer: "y", then: () => writeFileSync(marker, "") },
        { when: "Keep your notes out of git…", then: pressCtrlC },
      ],
    });

    assert.equal(code, 130, output);
    assert.match(output, /Keep your notes out of git — stopped/);
    assert.match(output, /Check git ignores your notes — not run/);
    assert.match(output, /Run the same command again to continue/);
  },
);

test("after its last line, a normal run exits within a second", async () => {
  const { output, lastOutputAt, exitedAt } = await runCli(["doctor"]);

  assert.match(output, /Results/);
  assert.ok(exitedAt - lastOutputAt < 1000, `lingered ${exitedAt - lastOutputAt}ms after the recap`);
});
