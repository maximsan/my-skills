// @ts-check
// `claude-rules new-task [app] [ticket]`: once per ticket.
//
// Creates the ticket's task folder, investigations/<app>/<TICKET>/ in the projects folder, with task.md copied from
// the template, then prints the line to give Claude. An existing task.md is never replaced.

import { basename, join } from "node:path";
import { INVESTIGATIONS_FOLDER } from "../lib/app-paths.mjs";
import { appDirectoryFromWorkingDirectory, listAppFolders } from "../lib/apps.mjs";
import { COMMAND_NAME } from "../lib/constants.mjs";
import { EXIT_CODES } from "../lib/errors.mjs";
import { homePath } from "../lib/layout.mjs";

/** A ticket name that's safe as one folder name: letters, digits, dots, dashes and underscores. */
const TICKET_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** The template's placeholder for the ticket, in its first line. */
const TICKET_PLACEHOLDER = "<Ticket>";

/**
 * @typedef {{ appName: string, appDirectory: string }} NewTaskFacts
 * @typedef {{ ticket: string }} NewTaskAnswers
 */

/**
 * Why a ticket name can't be a folder name, or null when it can.
 * @param {string} ticket the ticket, as typed
 * @returns {string | null} the problem, or null
 */
const ticketProblem = (ticket) =>
  TICKET_PATTERN.test(ticket)
    ? null
    : "Use the ticket's ID, e.g. ORD-123: letters, digits, dots, dashes and underscores, with no spaces or slashes.";

/**
 * The task folder's path from the projects folder, the way skills are given it.
 * @param {string} appName the app's folder name
 * @param {string} ticket the ticket's ID
 * @returns {string} e.g. "investigations/web-shop/ORD-123"
 */
const taskFolder = (appName, ticket) => `${INVESTIGATIONS_FOLDER}/${appName}/${ticket}`;

/**
 * Works out which app the ticket is about: the first argument, else the app folder you're standing in, else a pick
 * list.
 * @param {import("../lib/contract.mjs").Context} context everything the command may use
 * @returns {Promise<{ app: import("../lib/apps.mjs").AppFolder } | { stop: import("../lib/contract.mjs").Stop }>}
 *   the app, or why to stop
 */
const chooseApp = async (context) => {
  const { layout, files, ask, ui, options, args, cwd } = context;
  const apps = listAppFolders(layout, files);
  const [argument] = args;

  if (apps.length === 0) {
    return {
      stop: { reason: "There are no app folders next to this repo yet.", fix: "Clone an app there first." },
    };
  }

  if (argument) {
    const named = apps.find((app) => app.name === argument);

    return named
      ? { app: named }
      : {
          stop: {
            reason: `There's no app called ${argument}. The apps are: ${apps.map((app) => app.name).join(", ")}.`,
            fix: `Check the name, or run ${COMMAND_NAME} new-task with no name to pick from a list.`,
            exitCode: EXIT_CODES.USAGE,
          },
        };
  }

  const current = appDirectoryFromWorkingDirectory(layout, cwd);
  const standingIn = apps.find((app) => app.directory === current);

  if (standingIn) {
    return { app: standingIn };
  }

  if (options.yes) {
    return {
      stop: {
        reason: "--yes can't pick an app for you.",
        fix: `Name it: ${COMMAND_NAME} new-task <app> <ticket> --yes`,
        exitCode: EXIT_CODES.USAGE,
      },
    };
  }

  ui.line();

  const choice = await ask.pickOne(
    "Which app is the ticket about?",
    apps.map((app) => ({ label: app.name })),
    0,
  );

  return { app: apps[choice] };
};

/**
 * The new-task command: once per ticket.
 * @type {import("../lib/contract.mjs").Command<NewTaskFacts, NewTaskAnswers>}
 */
export const newTask = {
  name: "new-task",
  title: "Start a task",
  summary:
    `Creates a ticket's folder, ${INVESTIGATIONS_FOLDER}/<app>/<ticket>/ in the projects folder, with task.md from `
    + "the template. Then shows the line to give Claude.",
  usage: "[app] [ticket]",
  flags: ["yes", "dry-run"],
  mayChange: () => [`a new task.md in ${INVESTIGATIONS_FOLDER}/<app>/<ticket>/`],

  lookAround: async (context) => {
    const chosen = await chooseApp(context);

    if ("stop" in chosen) {
      return { findings: [], stop: chosen.stop };
    }

    return {
      findings: [{ tone: "ok", text: `App: ${chosen.app.name}` }],
      facts: { appName: chosen.app.name, appDirectory: chosen.app.directory },
    };
  },

  askQuestions: async ({ args, ask, options }) => {
    const [, argument] = args;

    // --yes answers a free-text question with an empty default, which would put task.md in the app's folder.
    if (!argument && options.yes) {
      return {
        stop: {
          reason: "--yes can't name the ticket for you.",
          fix: `Name it: ${COMMAND_NAME} new-task <app> <ticket> --yes`,
          exitCode: EXIT_CODES.USAGE,
        },
      };
    }

    if (argument) {
      const problem = ticketProblem(argument);

      return problem
        ? { stop: { reason: `"${argument}" can't be a folder name.`, fix: problem, exitCode: EXIT_CODES.USAGE } }
        : { ticket: argument };
    }

    return { ticket: await ask.text("Ticket ID, e.g. ORD-123", { validate: (answer) => ticketProblem(answer) }) };
  },

  steps: ({ layout, files }, survey, { ticket }) => {
    const folder = join(layout.investigationsDirectory, survey.facts.appName, ticket);
    const taskFile = join(folder, "task.md");

    return [
      {
        title: `Task file ${taskFolder(survey.facts.appName, ticket)}/task.md`,
        check: () => {
          if (files.exists(taskFile)) {
            return { status: "done", reason: "it's already there, and it's never replaced" };
          }

          if (!files.exists(layout.taskTemplate)) {
            return {
              status: "blocked",
              reason: "this repo's templates/task.md.template is missing",
              fix: "Copy this repo again, whole.",
            };
          }

          return { status: "todo", reason: "there's no task.md yet", action: "create it from the template" };
        },
        apply: () => {
          const template = files.readText(layout.taskTemplate) ?? "";

          files.writeTextAtomic(taskFile, template.replace(TICKET_PLACEHOLDER, ticket));

          return "created";
        },
      },
    ];
  },

  afterwards: ({ layout, homeDirectory }, survey, { ticket }) => {
    const { appName } = survey.facts;
    const taskFile = homePath(join(layout.investigationsDirectory, appName, ticket, "task.md"), homeDirectory);

    return [
      `Write the task first, in ${taskFile}: what's wrong, how to see it, and how you'll know it's done.`,
      "Five minutes there saves an hour later.",
      "",
      `Started inside ${appName} instead? Put ../ in front: `
      + `/task-investigate ../${taskFolder(appName, ticket)}/task.md`,
    ];
  },

  nextStep: ({ layout }, survey, { ticket }) =>
    `in Claude, started in ${basename(layout.projectsDirectory)}: `
    + `/task-investigate ${taskFolder(survey.facts.appName, ticket)}/task.md`,
};
