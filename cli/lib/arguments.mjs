// @ts-check
// Reading the command line, and the --help text. Both are pure: the command list comes in as a parameter.
//
// Unknown commands and flags are errors, never ignored. A typo like `--dry-rn` that silently did a real run would be
// exactly the unpredictable behaviour this tool exists to avoid. Which command takes which flag is said once, in the
// command's own `flags`, and everything here reads it from there. The same goes for positional arguments: a command
// without a `usage` takes none.

import { parseArgs } from "node:util";
import { UsageError } from "./errors.mjs";
import { COMMAND_NAME } from "./constants.mjs";
import { wrapText } from "./text.mjs";

/**
 * @typedef {object} Flag
 * @property {string} name what you type after `--`
 * @property {string} [short] a one-letter alias, e.g. -h
 * @property {boolean} isGlobal works with every command; otherwise a command lists it in its own `flags`
 * @property {string} description shown in --help
 */

/**
 * Every flag, with what it's for.
 * @type {Flag[]}
 */
const FLAGS = [
  {
    name: "yes",
    isGlobal: false,
    description: "Answer every question with its shown default and skip \"Go ahead?\". Never approves anything risky.",
  },
  {
    name: "dry-run",
    isGlobal: false,
    description: "Look around, ask the questions, show the plan, then stop. Nothing is written.",
  },
  {
    name: "debug",
    isGlobal: true,
    description: "Show stack traces for unexpected errors, and each git command with its time.",
  },
  { name: "help", short: "h", isGlobal: true, description: "Show this help, or one command's help after its name." },
  { name: "version", isGlobal: true, description: "Show the CLI version." },
];

/** The column where help descriptions start, and how wide they may run. */
const HELP_NAME_WIDTH = 12;
const HELP_TEXT_WIDTH = 80;

/** Spaces before each help entry. */
const HELP_INDENT = "  ";

/** Node's parseArgs error names the unknown flag between single quotes. */
const QUOTED_NAME = /'([^']+)'/;

/**
 * @typedef {object} ParsedArguments
 * @property {string | null} commandName null means "show the menu"
 * @property {string[]} args positional arguments after the command name
 * @property {{ yes: boolean, dryRun: boolean, debug: boolean, help: boolean, version: boolean }} options each flag,
 *   true when it was given
 */

/**
 * Reads the command line into a command name, its arguments and its flags, and checks they fit together.
 * @param {string[]} argv the arguments after `claude-rules`
 * @param {import("./contract.mjs").Command[]} commands every command the CLI has, to check the name and flags against
 * @returns {ParsedArguments} the command name, its arguments and its flags
 * @throws {UsageError} for an unknown command or flag, a flag the command doesn't take, or an argument it doesn't
 */
export const parseArguments = (argv, commands) => {
  /** @type {Record<string, { type: "boolean", short?: string }>} */
  const options = {};

  for (const flag of FLAGS) {
    options[flag.name] = flag.short ? { type: "boolean", short: flag.short } : { type: "boolean" };
  }

  let parsed;

  try {
    parsed = parseArgs({ args: argv, options, allowPositionals: true, strict: true });
  } catch (error) {
    const unknown = String(error instanceof Error ? error.message : error).match(QUOTED_NAME)?.[1] ?? argv.join(" ");

    throw new UsageError(`Unknown option "${unknown}". Run ${COMMAND_NAME} --help.`);
  }

  const [commandName = null, ...args] = parsed.positionals;
  const values = /** @type {Record<string, boolean | undefined>} */ (parsed.values);
  const result = {
    commandName,
    args,
    options: {
      yes: Boolean(values.yes),
      dryRun: Boolean(values["dry-run"]),
      debug: Boolean(values.debug),
      help: Boolean(values.help),
      version: Boolean(values.version),
    },
  };

  if (result.options.help || result.options.version) {
    return result;
  }

  const command = commandName ? commands.find((candidate) => candidate.name === commandName) : null;

  if (commandName && !command) {
    throw new UsageError(`Unknown command "${commandName}". Run ${COMMAND_NAME} --help to see the commands.`);
  }

  for (const flag of FLAGS.filter((candidate) => !candidate.isGlobal && values[candidate.name])) {
    if (!command) {
      throw new UsageError(`--${flag.name} needs a command, e.g. ${COMMAND_NAME} setup --${flag.name}.`);
    }

    if (!command.flags.includes(flag.name)) {
      throw new UsageError(`--${flag.name} doesn't apply to ${command.name}.`);
    }
  }

  if (command && !command.usage && args.length > 0) {
    throw new UsageError(`${command.name} takes no arguments, but got "${args.join(" ")}".`);
  }

  return result;
};

/**
 * One aligned help entry, with the description wrapped under itself.
 * @param {string} name the command or flag, shown on the left
 * @param {string} description what it does, wrapped on the right
 * @returns {string[]} the entry's lines, the first one holding the name
 */
const helpEntry = (name, description) => {
  const [first = "", ...rest] = wrapText(description, HELP_TEXT_WIDTH);
  const indent = " ".repeat(HELP_INDENT.length + HELP_NAME_WIDTH);

  return [`${HELP_INDENT}${name.padEnd(HELP_NAME_WIDTH)}${first}`, ...rest.map((line) => `${indent}${line}`)];
};

/**
 * The --help text: every command and flag, or just one command's.
 * @param {import("./contract.mjs").Command[]} commands every command the CLI has
 * @param {import("./contract.mjs").Command} [command] show just this one
 * @returns {string[]} the help text, one string per printed line
 */
export const renderHelp = (commands, command) => {
  if (command) {
    const flags = FLAGS.filter((flag) => flag.isGlobal || command.flags.includes(flag.name));

    return [
      `Usage: ${COMMAND_NAME} ${command.name}${command.usage ? ` ${command.usage}` : ""} [flags]`,
      "",
      ...wrapText(command.summary, HELP_TEXT_WIDTH).map((line) => `  ${line}`),
      "",
      "Flags:",
      ...flags.flatMap((flag) => helpEntry(`--${flag.name}`, flag.description)),
    ];
  }

  /**
   * A flag's help description, naming the commands that take it unless it works with every command.
   * @param {Flag} flag the flag to describe
   * @returns {string} the description shown in --help
   */
  const describeFlag = (flag) => {
    if (flag.isGlobal) {
      return flag.description;
    }

    const takers = commands.filter((entry) => entry.flags.includes(flag.name)).map((entry) => entry.name);

    return `${flag.description} Works with: ${takers.join(", ")}.`;
  };

  return [
    `Usage: ${COMMAND_NAME} [command] [flags]`,
    "",
    "With no command, a menu opens.",
    "",
    "Commands:",
    ...commands.flatMap((entry) => helpEntry(entry.name, entry.summary)),
    "",
    "Flags:",
    ...FLAGS.flatMap((flag) => helpEntry(`--${flag.name}`, describeFlag(flag))),
    "",
    "Examples:",
    ...["", " setup", " add-app web-shop", " doctor"].map((example) => `  ${COMMAND_NAME}${example}`),
  ];
};
