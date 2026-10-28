// @ts-check
// How the runner words its results: the labels in the plan, the rows in the recap and in doctor's report, and the
// lines that close a run.
//
// The runner in runner.mjs decides what happens. This file only turns what happened into rows and lines, so the
// wording of every command's plan and recap lives in one place.

import { EXIT_CODES } from "./errors.mjs";

/**
 * @typedef {import("./contract.mjs").StepStatus} StepStatus
 * @typedef {import("./contract.mjs").CheckResult} CheckResult
 * @typedef {import("./contract.mjs").Step} Step
 * @typedef {import("./contract.mjs").Context} Context
 * @typedef {import("./ui.mjs").ReportRow} ReportRow
 */

/**
 * @template Facts, Answers
 * @typedef {import("./contract.mjs").Command<Facts, Answers>} Command
 */

/**
 * How each check result reads in the plan. "can't do" reads the same in the recap.
 * @type {Record<StepStatus, string>}
 */
export const PLAN_LABEL = {
  todo: "will do",
  done: "already done",
  blocked: "can't do",
  skipped: "skipped",
  warn: "worth a look",
};

/**
 * How each check result reads in doctor's report.
 * @type {Record<StepStatus, { tone: import("./ui.mjs").Tone, label: string }>}
 */
const READ_ONLY_ROW = {
  done: { tone: "ok", label: "OK" },
  warn: { tone: "warn", label: "worth a look" },
  blocked: { tone: "fail", label: "problem" },
  skipped: { tone: "skip", label: "skipped" },
  todo: { tone: "fail", label: "not set up" },
};

/**
 * The parts of a check result that a plan or report row shows under the step's title.
 * @param {CheckResult} check what the step's check found
 * @returns {{ detail: string | undefined, points: string[] | undefined, fix: string | undefined }} the reason, any
 *   points listed under it, and the fix, if the check gave them
 */
export const detailAndFix = (check) => ({ detail: check.reason, points: check.points, fix: check.fix });

/**
 * The recap row for a step that had nothing to do, or couldn't be done.
 * @param {string} title the step's title
 * @param {CheckResult} check what the step's check found
 * @returns {ReportRow} the row to show in the recap
 */
export const rowForUnchangedStep = (title, check) => {
  if (check.status === "done") {
    return { tone: "info", title, label: "already done", detail: check.reason };
  }

  if (check.status === "skipped") {
    return { tone: "skip", title, label: "skipped", detail: check.reason };
  }

  return { tone: "fail", title, label: PLAN_LABEL.blocked, detail: check.reason, fix: check.fix };
};

/**
 * The exit code a recap stands for: failed if any row failed, otherwise OK.
 * @param {ReportRow[]} rows the recap's rows
 * @returns {number} one of EXIT_CODES
 */
export const exitCodeFor = (rows) => (rows.some((row) => row.tone === "fail") ? EXIT_CODES.FAILED : EXIT_CODES.OK);

/**
 * Stages 4–6 for a command that only checks (doctor): show every result, change nothing.
 * @param {Step[]} steps the command's steps
 * @param {CheckResult[]} checks what each step's check found, in the same order as the steps
 * @param {Context} context the run's printing, among the rest
 * @returns {ReportRow[]} the rows shown, one per step
 */
export const reportChecks = (steps, checks, context) => {
  const rows = steps.map((step, index) => ({
    ...READ_ONLY_ROW[checks[index].status],
    ...detailAndFix(checks[index]),
    title: step.title,
  }));

  context.ui.heading("Results");
  context.ui.report(rows);

  return rows;
};

/**
 * The command's own extra recap lines, then the single "Next:" line. After a failure, neither: they'd describe a
 * finished run. The one thing to do then is fix what failed, so that's all it says.
 * @template Facts, Answers
 * @param {Command<Facts, Answers>} command the command that ran
 * @param {Context} context everything the command may use
 * @param {import("./contract.mjs").ReadySurvey<Facts>} survey what "Looking around" found
 * @param {Answers} answers the answers to the command's questions
 * @param {number} exitCode how the run ended, one of EXIT_CODES
 */
export const printClosingLines = (command, context, survey, answers, exitCode) => {
  const { ui } = context;

  if (exitCode === EXIT_CODES.FAILED) {
    ui.line();
    ui.line(`Fix the ${ui.symbols.fail} lines above, then run the same command again.`);

    return;
  }

  const extraLines = command.afterwards?.(context, survey, answers) ?? [];

  if (extraLines.length > 0) {
    ui.line();
  }

  for (const text of extraLines) {
    ui.line(text);
  }

  const next = command.nextStep?.(context, survey, answers);

  if (next) {
    ui.line();
    ui.next(next);
  }
};
