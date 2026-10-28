// @ts-check
// Every command, in menu order. The menu, the argument parser and --help all read this list, so adding a command
// is one new file in this folder plus one line here.
//
// Keep a command in one file; split it into <name>-questions.mjs and <name>-steps.mjs once it passes ~250 lines, as
// add-app does.

import { addApp } from "./add-app.mjs";
import { doctor } from "./doctor.mjs";
import { newTask } from "./new-task.mjs";
import { setup } from "./setup.mjs";

/**
 * Every command, in menu order.
 * @type {import("../lib/contract.mjs").Command[]}
 */
export const COMMANDS = [setup, addApp, newTask, doctor];

/**
 * The command with this name, or undefined if there isn't one.
 * @param {string} name the command name, as typed
 * @returns {import("../lib/contract.mjs").Command | undefined} the matching command
 */
export const findCommand = (name) => COMMANDS.find((command) => command.name === name);
