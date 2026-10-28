// @ts-check
// `claude-rules doctor`: checks everything the other commands set up, and changes nothing.
//
// Each check says what's right, or what's wrong and the exact fix. It doesn't decide anything on its own: the
// computer's state is described by the same functions `setup` uses, and each app is checked by `add-app`'s own step
// checks. So "doctor says it's fine" and "setup has nothing to do" always agree. Doctor only adds the fix to run.

import { basename } from "node:path";
import { listAppFolders } from "../lib/apps.mjs";
import { isReminderAnswer, sampleHookInput } from "../lib/bug-fix-reminder.mjs";
import {
  claudeStateFile,
  describeImportAnswers,
  hasUnknownAnswers,
  readImportAnswers,
} from "../lib/claude-approvals.mjs";
import { claudeSettingsFile, describeReminder, readReminderState, reminderHook } from "../lib/claude-settings.mjs";
import { COMMAND_NAME } from "../lib/constants.mjs";
import { runProcess } from "../lib/exec.mjs";
import {
  homePath,
  installCommand,
  shortPath,
  spaceInPathWarning,
} from "../lib/layout.mjs";
import {
  checkTools,
  countSkills,
  describeSharedRules,
  describeSkillsLink,
  readCommandState,
  readSharedRulesState,
  readSkillsLinkState,
} from "../lib/machine-setup.mjs";
import { appStep, findImportProblems, runAddApp } from "./doctor-app-check.mjs";

/** @typedef {{ addedApps: import("../lib/apps.mjs").AppFolder[] }} DoctorFacts */

/**
 * Claude Code's answer to its import question, for the projects folder and each added app.
 * @param {import("../lib/contract.mjs").Context} context the run's files, layout, home folder and platform
 * @param {import("../lib/apps.mjs").AppFolder[]} addedApps the apps add-app has prepared
 * @returns {import("../lib/claude-approvals.mjs").ImportAnswers} one answer per folder, or unreadable
 */
const readAnswers = ({ files, layout, homeDirectory, platform }, addedApps) =>
  readImportAnswers(
    files.readText(claudeStateFile(homeDirectory)),
    [
      { name: basename(layout.projectsDirectory), path: layout.projectsDirectory },
      ...addedApps.map((app) => ({ name: app.name, path: app.directory })),
    ],
    platform,
  );

const RUN_SETUP = `Run ${COMMAND_NAME} setup.`;

/**
 * A setup check result as doctor reports it: the same status and reason, with "run setup" as the fix for anything
 * setup would do.
 * @param {import("../lib/contract.mjs").CheckResult} result what setup's check found
 * @returns {import("../lib/contract.mjs").CheckResult} the same result, with the fix doctor shows
 */
const withSetupFix = (result) => (result.status === "todo" ? { ...result, fix: RUN_SETUP } : result);

/** The line of an error that says what went wrong, e.g. "Error: Cannot find module …" or "SyntaxError: …". */
const ERROR_LINE = /\bError\b/;

/** Milliseconds in a second, for the hook's timeout, which settings give in seconds. */
const MS_PER_SECOND = 1000;

/** Where to see why a hook fails: Claude Code's debug log, which names the hook and prints its error. */
const SEE_HOOK_ERROR = "Start Claude with claude --debug, send a message, and look for UserPromptSubmit in the newest "
  + "file in ~/.claude/debug/.";

/**
 * Runs the installed reminder the way Claude Code does: its command through the shell, with a bug message on its
 * input. A correct settings entry can still fail to run if Claude Code drops part of it, as seen on managed Windows.
 * @param {import("../lib/contract.mjs").Context} context the layout, environment and abort signal
 * @param {import("../lib/contract.mjs").CheckResult} present what the settings check found: the entry is there
 * @returns {Promise<import("../lib/contract.mjs").CheckResult>} OK when the reminder came back, a ✖ otherwise
 */
const checkReminderRuns = async ({ layout, env, signal }, present) => {
  const { command, timeout } = reminderHook(layout);
  const result = await runProcess(command, [], {
    cwd: layout.projectsDirectory,
    timeoutMs: timeout * MS_PER_SECOND,
    signal,
    env,
    input: sampleHookInput(layout.projectsDirectory),
    shell: true,
  });

  if (result.code === 0 && isReminderAnswer(result.stdout)) {
    return { ...present, reason: `${present.reason}; a test message got the reminder` };
  }

  const errorLines = result.stderr.trim().split("\n");
  const errorLine = errorLines.find((line) => ERROR_LINE.test(line)) ?? errorLines[0];
  const why = result.timedOut
    ? `it took longer than ${timeout} seconds`
    : result.code === 0
      ? "it ran but didn't print the reminder"
      : `it failed${errorLine ? `: ${errorLine.trim()}` : ` with exit code ${result.code}`}`;

  return { status: "blocked", reason: `the entry is right, but running it, ${why}`, fix: SEE_HOOK_ERROR };
};

/**
 * The shared rules as setup sees them, plus what only doctor looks at: `@` lines that point at nothing, and paths
 * with a space.
 * @param {import("../lib/contract.mjs").Context} context everything the command may use
 * @returns {import("../lib/contract.mjs").CheckResult} what doctor found in the shared rules
 */
const checkSharedRules = (context) => {
  const { layout, files, platform } = context;
  const state = readSharedRulesState(layout, files, platform);
  const result = withSetupFix(describeSharedRules(state, layout));

  if (state.kind !== "present") {
    return result;
  }

  const { broken, withSpace } = findImportProblems(state.text, layout.projectsDirectory, context);

  if (broken.length > 0) {
    return {
      status: "blocked",
      reason: `these @ lines point at nothing: ${broken.join(", ")}`,
      fix: "Fix or delete those lines.",
    };
  }

  if (withSpace.length > 0) {
    return {
      status: "warn",
      reason: spaceInPathWarning(layout) ?? `these paths have a space: ${withSpace.join(", ")}`,
    };
  }

  return { status: "done", reason: "the line is there, and every @ line points at a real file" };
};

/**
 * The checks for this computer: the shared rules, the skills link, the bug-fix reminder, and the command.
 * @param {import("../lib/contract.mjs").Context} context everything the command may use
 * @returns {import("../lib/contract.mjs").Step[]} one check step for each
 */
const checkMachine = (context) => {
  const { layout, files, env, platform, homeDirectory } = context;

  return [
    {
      title: `Shared rules in ${shortPath(layout, layout.sharedRulesFile)}`,
      check: () => checkSharedRules(context),
    },
    {
      title: `Skills link ${shortPath(layout, layout.skillsLink)}`,
      check: () =>
        withSetupFix(
          describeSkillsLink(readSkillsLinkState(layout, files), layout, {
            mayReplaceOtherLink: false,
            skillCount: countSkills(layout, files),
          }),
        ),
    },
    {
      title: `Bug-fix reminder in ${homePath(claudeSettingsFile(context.homeDirectory), context.homeDirectory)}`,
      check: async () => {
        const settingsFile = claudeSettingsFile(context.homeDirectory);
        const state = readReminderState(files.readText(settingsFile), layout);
        const described = withSetupFix(describeReminder(state, homePath(settingsFile, context.homeDirectory)));

        return state.kind === "present" ? checkReminderRuns(context, described) : described;
      },
    },
    {
      title: `The ${COMMAND_NAME} command`,
      check: () => {
        const state = readCommandState(layout, files, { env, platform });
        const command = installCommand(layout, homeDirectory);
        const fix = `${command.charAt(0).toUpperCase()}${command.slice(1)}.`;

        if (state.kind === "ours") {
          return { status: "done", reason: "runs this copy" };
        }

        if (state.kind === "missing") {
          return { status: "warn", reason: "not installed, so it only runs by path", fix };
        }

        const shownPath = homePath(state.path, homeDirectory);

        return { status: "warn", reason: `${shownPath} runs a different copy of this repo`, fix };
      },
    },
  ];
};

/**
 * The doctor command: checks everything, changes nothing.
 * @type {import("../lib/contract.mjs").Command<DoctorFacts, Record<string, never>>}
 */
export const doctor = {
  name: "doctor",
  title: "Check everything works",
  summary: "Changes nothing. Lists what's right, what's wrong, and how to fix each one.",
  flags: [],
  isReadOnly: true,
  mayChange: () => [],

  lookAround: async (context) => {
    const { layout, files, homeDirectory } = context;
    const apps = listAppFolders(layout, files);
    const addedApps = apps.filter((app) => app.hasOurNotes);

    return {
      findings: [
        { tone: "info", text: `Projects folder: ${homePath(layout.projectsDirectory, homeDirectory)}` },
        { tone: "info", text: `Apps set up: ${addedApps.length} of ${apps.length}` },
      ],
      facts: { addedApps },
    };
  },

  steps: (context, survey) => {
    const { addedApps } = survey.facts;
    const tools = checkTools(context);

    /** @type {import("../lib/contract.mjs").Step[]} */
    const noApps = [
      {
        title: "Apps",
        check: () => ({ status: "todo", reason: "no app is set up yet", fix: runAddApp() }),
      },
    ];

    return [
      tools.node,
      tools.git,
      ...checkMachine(context),
      ...(addedApps.length > 0 ? addedApps.map((app) => appStep(context, app)) : noApps),
      {
        title: "Rules allowed in Claude Code",
        check: () =>
          describeImportAnswers(
            readAnswers(context, addedApps),
            homePath(claudeStateFile(context.homeDirectory), context.homeDirectory),
          ),
      },
    ];
  },

  // The reminder is the fallback for when Claude Code's state file can't answer the question.
  afterwards: (context, survey) =>
    hasUnknownAnswers(readAnswers(context, survey.facts.addedApps))
      ? [
          "Not checked: whether you chose Yes when Claude asked to load the rules in each app.",
          `If the rules don't load, see ${context.layout.repoFolderName}/docs/TROUBLESHOOTING.md → `
          + `"The rules don't load".`,
        ]
      : [],
};
