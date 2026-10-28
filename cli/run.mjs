// @ts-check
// The program itself, loaded by main.mjs once the Node version is known to be new enough: reads the command line,
// opens the menu or runs one command, and turns the outcome into an exit code.
//
// With main.mjs, this is the only file that talks to the process itself: what happens when you press Ctrl+C, the
// exit code, and process.exit. It also owns the safety net, so that however a run ends (finished, failed, Ctrl+C, a
// bug) the terminal is left clean and the process exits instead of hanging.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { COMMANDS, findCommand } from "./commands/index.mjs";
import { parseArguments, renderHelp } from "./lib/arguments.mjs";
import { createAsker } from "./lib/ask.mjs";
import { COMMAND_NAME } from "./lib/constants.mjs";
import { EXIT_CODES, NeedsTerminalError, StoppedError, UsageError } from "./lib/errors.mjs";
import { createFiles } from "./lib/files.mjs";
import { createGit } from "./lib/git.mjs";
import { resolveLayout } from "./lib/layout.mjs";
import { readSetupProgress } from "./lib/machine-setup.mjs";
import { MENU_EXTRAS, menuItems, renderMenuStatus, suggestedIndex } from "./lib/menu.mjs";
import { runCommandWithOutcome } from "./lib/runner.mjs";
import { createUi } from "./lib/ui.mjs";

/**
 * This file is cli/run.mjs, so the repo is one folder up. Even when started through the command npm installed,
 * this path is the real file inside your clone.
 */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * After the recap, a process still alive this long is still held open by something we forgot to close (a timer, a
 * started program). So it's ended.
 */
const WATCHDOG_MS = 500;

/** Lets the tests drive questions through a pipe. Not for everyday use: without a terminal, prefer --yes. */
const ASSUME_TERMINAL_VARIABLE = "CLAUDE_RULES_ASSUME_TERMINAL";

/**
 * The --version line: the command name and the version from package.json.
 * @param {import("./lib/layout.mjs").Layout} layout where this repo's package.json is
 * @returns {string} e.g. "claude-rules 1.0.0"
 */
const describeVersion = (layout) => {
  const { version } = JSON.parse(readFileSync(layout.packageFile, "utf8"));

  return `${COMMAND_NAME} ${version}`;
};

/**
 * Runs a command, then offers its follow-up (setup → add-app, add-app → the next app) when there's a person to ask,
 * and so on while each one is accepted. Only a run that got to its end with nothing failed counts: declining "Go
 * ahead?" or a dry run never leads on to the next command.
 * @param {import("./lib/contract.mjs").Command} command the command to run first
 * @param {import("./lib/contract.mjs").Context} context everything the command may use
 * @returns {Promise<number>} the exit code of the last command that ran
 */
const runWithFollowUp = async (command, context) => {
  const { exitCode, isFinished } = await runCommandWithOutcome(command, context);
  const { followUp } = command;
  const canOffer
    = followUp
      && isFinished
      && exitCode === EXIT_CODES.OK
      && context.isInteractive
      && !context.options.yes
      && !context.options.dryRun;

  if (!canOffer) {
    return exitCode;
  }

  const next = findCommand(followUp.command);
  const question = followUp.question(context);

  if (!next || !question) {
    return exitCode;
  }

  context.ui.line();

  if (!(await context.ask.confirm(question, true))) {
    return exitCode;
  }

  // The follow-up picks its own target; it never inherits this command's arguments.
  return runWithFollowUp(next, { ...context, args: [] });
};

/**
 * The menu: shows where you are, runs the one command you pick, then exits. Help prints the help and exits too, as
 * `--help` does: shown again below the help, the menu pushed the help's top off the screen.
 * @param {import("./lib/contract.mjs").Context} context everything a command may use
 * @returns {Promise<number>} the exit code: OK after Quit, otherwise that of the last command that ran
 */
const runMenu = async (context) => {
  const { ui, ask, layout, files, platform } = context;

  if (!context.isInteractive) {
    const commandLines = COMMANDS.map(({ name }) => `${COMMAND_NAME} ${name}`).join(" | ");

    throw new UsageError(`The menu needs a terminal. Name a command instead: ${commandLines}.`);
  }

  const progress = readSetupProgress(layout, files, platform);

  ui.line();

  for (const text of renderMenuStatus(progress)) {
    ui.line(text);
  }

  ui.line();

  const items = menuItems(COMMANDS);
  const index = await ask.pickOne("What next?", items, suggestedIndex(COMMANDS, progress));
  const choice = items[index];

  if (choice === MENU_EXTRAS.quit) {
    return EXIT_CODES.OK;
  }

  if (choice === MENU_EXTRAS.help) {
    ui.line();

    for (const text of renderHelp(COMMANDS)) {
      ui.line(text);
    }

    ui.next(`run ${COMMAND_NAME} again for the menu.`);

    return EXIT_CODES.OK;
  }

  return runWithFollowUp(COMMANDS[index], context);
};

/**
 * Turns an error that ended the run into a message and an exit code. Expected problems never get here: they are
 * step results. This is for stopping, wrong usage, and bugs.
 * @param {unknown} error what was thrown
 * @param {import("./lib/ui.mjs").Ui} ui prints the message
 * @param {boolean} hasChanged whether anything was written in this process, e.g. by setup before its follow-up
 * @returns {number} one of EXIT_CODES
 */
const reportError = (error, ui, hasChanged) => {
  ui.line();

  if (error instanceof StoppedError) {
    ui.warn(
      hasChanged
        ? "Stopped by you. Changes already made are kept; run the command again to continue."
        : "Stopped by you. Nothing was changed.",
    );

    return EXIT_CODES.STOPPED;
  }

  if (error instanceof NeedsTerminalError || error instanceof UsageError) {
    ui.error(error.message);

    return EXIT_CODES.USAGE;
  }

  // Set by withStepTitle() in the runner when a step's check() crashes.
  const stepTitle = /** @type {{ stepTitle?: string }} */ (error)?.stepTitle;
  const message = error instanceof Error ? error.message : String(error);

  ui.error(`Something unexpected went wrong${stepTitle ? ` in step "${stepTitle}"` : ""}: ${message}`);
  ui.debug(error instanceof Error && error.stack ? error.stack : "");
  ui.line("Run again with --debug for details.");

  return EXIT_CODES.FAILED;
};

const argv = process.argv.slice(2);
const ui = createUi({
  output: process.stdout,
  env: process.env,
  platform: process.platform,
  isDebug: argv.includes("--debug"),
});

/** Every file write goes through this one instance, so it knows whether anything changed before a stop. */
const files = createFiles({ platform: process.platform });

/**
 * Everything a command may use, built from the real process: the real files, git, questions and printing.
 * @param {import("./lib/arguments.mjs").ParsedArguments} parsed the command line, read by parseArguments
 * @param {AbortSignal} signal fires on Ctrl+C
 * @param {import("./lib/ask.mjs").Asker} ask asks the person questions
 * @param {boolean} isInteractive whether a person at a terminal can answer questions
 * @returns {import("./lib/contract.mjs").Context} the context every command runs with
 */
const buildContext = (parsed, signal, ask, isInteractive) => ({
  layout: resolveLayout(REPO_ROOT),
  files,
  git: createGit({ env: process.env, signal, onCommand: (summary) => ui.debug(summary) }),
  ask,
  ui,
  signal,
  options: { yes: parsed.options.yes, dryRun: parsed.options.dryRun, debug: parsed.options.debug },
  args: parsed.args,
  cwd: process.cwd(),
  env: process.env,
  platform: process.platform,
  nodeVersion: process.version,
  homeDirectory: homedir(),
  isInteractive,
});

/**
 * Does what the command line asked for: show the version, show help, run one command, or open the menu.
 * @param {import("./lib/arguments.mjs").ParsedArguments} parsed the command line, read by parseArguments
 * @param {import("./lib/contract.mjs").Command | undefined} command the command named on the command line, if any
 * @param {import("./lib/contract.mjs").Context} context everything a command may use
 * @returns {Promise<number>} the exit code
 */
const dispatch = async (parsed, command, context) => {
  if (parsed.options.version) {
    context.ui.line(describeVersion(context.layout));

    return EXIT_CODES.OK;
  }

  if (parsed.options.help) {
    for (const text of renderHelp(COMMANDS, command)) {
      context.ui.line(text);
    }

    return EXIT_CODES.OK;
  }

  if (command) {
    return runWithFollowUp(command, context);
  }

  return runMenu(context);
};

const main = async () => {
  const controller = new AbortController();
  let interruptCount = 0;
  const isInteractive = Boolean(process.stdin.isTTY) || process.env[ASSUME_TERMINAL_VARIABLE] === "1";

  /** @type {import("./lib/ask.mjs").Asker | null} */
  let ask = null;

  const cleanUp = () => {
    ask?.close();
    ui.dispose();
  };

  // First Ctrl+C: stop gracefully, finishing the current file write and printing a recap. Second: leave now.
  const onInterrupt = () => {
    interruptCount += 1;

    if (interruptCount > 1) {
      cleanUp();
      process.exit(EXIT_CODES.STOPPED);
    }

    controller.abort();
  };

  process.on("SIGINT", onInterrupt);

  let exitCode = EXIT_CODES.OK;

  try {
    const parsed = parseArguments(argv, COMMANDS);

    ask = createAsker({
      input: process.stdin,
      output: process.stdout,
      signal: controller.signal,
      isInteractive,
      assumeDefaults: parsed.options.yes,
      onInterrupt,
      ui,
    });

    const context = buildContext(parsed, controller.signal, ask, isInteractive);
    const command = parsed.commandName ? findCommand(parsed.commandName) : undefined;

    exitCode = await dispatch(parsed, command, context);
  } catch (error) {
    exitCode = reportError(error, ui, files.hasChanged());
  } finally {
    cleanUp();
    process.off("SIGINT", onInterrupt);
  }

  process.exitCode = exitCode;

  // This timer never keeps the program running by itself. It only ends one that something else (a timer, a started
  // program) is still holding open.
  setTimeout(() => process.exit(exitCode), WATCHDOG_MS).unref();
};

/**
 * A bug that escapes everything above still gets a readable message, not a raw stack trace.
 * @param {unknown} error what was thrown or rejected
 */
const exitOnUnexpected = (error) => {
  ui.dispose();
  process.exit(reportError(error, ui, files.hasChanged()));
};

process.on("uncaughtException", exitOnUnexpected);
process.on("unhandledRejection", exitOnUnexpected);

main();
