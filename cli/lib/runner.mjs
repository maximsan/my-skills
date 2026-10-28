// @ts-check
// The runner that takes every command through the same six stages. The shapes it runs are in contract.mjs, and the
// wording of its plan and recap is in recap.mjs.
//
// Every command goes through them, so the CLI behaves the same way whichever one you run:
//   1. What this does   title, and what it may change
//   2. Looking around   read-only findings
//   3. Questions        all asked up front, never mid-progress
//   4. The plan         every step's check(), with writes locked
//   5. Go ahead?        then each step's apply(), with progress
//   6. Recap            one line per step, then a single "Next:" line
// A command only describes its steps. How they are checked, confirmed, applied, stopped and reported lives here once.

import { EXIT_CODES, StepFailure, StoppedError } from "./errors.mjs";
import {
  PLAN_LABEL,
  detailAndFix,
  exitCodeFor,
  printClosingLines,
  reportChecks,
  rowForUnchangedStep,
} from "./recap.mjs";
import { wrapText } from "./text.mjs";
import { renderRecapCounts } from "./ui.mjs";

/**
 * @typedef {import("./contract.mjs").Step} Step
 * @typedef {import("./contract.mjs").CheckResult} CheckResult
 * @typedef {import("./contract.mjs").Stop} Stop
 * @typedef {import("./contract.mjs").Context} Context
 * @typedef {import("./ui.mjs").ReportRow} ReportRow
 */

/**
 * @template Facts, Answers
 * @typedef {import("./contract.mjs").Command<Facts, Answers>} Command
 */

/** The label of a step that a failure or Ctrl+C left out. */
const NOT_RUN = "not run";

/** How wide the header's summary may run, after its two-space indent. */
const HEADER_WIDTH = 100;

/**
 * Tags a crash with the step it happened in, so the message can say "in step …".
 * @param {unknown} error what the step threw
 * @param {string} stepTitle the title of the step it was thrown in
 * @returns {Error & { stepTitle: string }} the error, with the step's title on it
 */
const withStepTitle = (error, stepTitle) =>
  Object.assign(error instanceof Error ? error : new Error(String(error)), { stepTitle });

/**
 * Runs every step's check(). A StepFailure from a check means "can't do this here", not a crash.
 * @param {Step[]} steps the steps to check, in order
 * @param {Context} context the run's files, git, questions, options and printing
 * @returns {Promise<CheckResult[]>} one result for each step, in the same order
 */
const checkEach = async (steps, context) => {
  /** @type {CheckResult[]} */
  const results = [];

  for (const step of steps) {
    if (context.signal.aborted) {
      throw new StoppedError();
    }

    try {
      results.push(await step.check());
    } catch (error) {
      if (!(error instanceof StepFailure)) {
        throw withStepTitle(error, step.title);
      }

      results.push({ status: "blocked", reason: error.message, fix: error.fix });
    }
  }

  return results;
};

/**
 * Applies one step, turning every way it can end into a result row.
 * @param {Step} step the step to apply
 * @param {Context} context the run's files, git, questions, options and printing
 * @returns {Promise<{ row: ReportRow, ending: "done" | "failed" | "stopped" }>} the step's result row, and how it
 *   ended
 */
const applyOne = async (step, context) => {
  const { title } = step;

  try {
    const detail = (await step.apply?.()) || undefined;

    return { row: { tone: "ok", title, label: "done", detail }, ending: "done" };
  } catch (error) {
    if (error instanceof StoppedError) {
      return { row: { tone: "skip", title, label: "stopped" }, ending: "stopped" };
    }

    if (error instanceof StepFailure) {
      return { row: { tone: "fail", title, label: "failed", detail: error.message, fix: error.fix }, ending: "failed" };
    }

    context.ui.debug(error instanceof Error && error.stack ? error.stack : String(error));

    const message = error instanceof Error ? error.message : String(error);
    const detail = `Something unexpected went wrong: ${message}`;

    return {
      row: { tone: "fail", title, label: "failed", detail, fix: "Run again with --debug for details." },
      ending: "failed",
    };
  }
};

/**
 * Applies every step that needs doing, in order, printing each one's result row as it ends. Stops at the first
 * failure, since later steps may depend on it, and at Ctrl+C; the steps after that are "not run". Steps with nothing
 * to do aren't printed: the plan has just shown them.
 * @param {Step[]} steps every step, in order
 * @param {CheckResult[]} checks each step's check result, in the same order
 * @param {Context} context the run's files, git, questions, options and printing
 * @returns {Promise<{ rows: ReportRow[], wasStopped: boolean }>} one result row for each step, and whether Ctrl+C
 *   stopped the run
 */
const applyEach = async (steps, checks, context) => {
  const total = checks.filter((check) => check.status === "todo").length;

  /** @type {ReportRow[]} */
  const rows = [];
  let position = 0;

  /** @type {"running" | "failed" | "stopped"} */
  let state = "running";

  for (const [index, step] of steps.entries()) {
    const check = checks[index];

    if (check.status !== "todo") {
      rows.push(rowForUnchangedStep(step.title, check));
      continue;
    }

    if (state === "running" && context.signal.aborted) {
      state = "stopped";
    }

    if (state !== "running") {
      rows.push({ tone: "skip", title: step.title, label: NOT_RUN });
      continue;
    }

    position += 1;

    const progress = context.ui.progress(position, total, step.title);
    const { row, ending } = await applyOne(step, context);

    progress.finish(row);
    rows.push(row);

    if (ending !== "done") {
      state = ending;
    }
  }

  return { rows, wasStopped: state === "stopped" };
};

/**
 * Stage 1: the title, and the promise of what the command may change. The summary isn't repeated here: the menu and
 * --help show it before the command is chosen.
 * @template Facts, Answers
 * @param {Command<Facts, Answers>} command the command whose title to print
 * @param {Context} context the run's files, git, questions, options and printing
 */
const printHeader = (command, context) => {
  const mayChange = command.mayChange(context);
  const promise = mayChange.length > 0 ? `May change: ${mayChange.join(", ")}. Nothing else.` : "Changes nothing.";

  context.ui.heading(command.title);

  for (const text of wrapText(promise, HEADER_WIDTH)) {
    context.ui.line(`  ${text}`);
  }
};

/**
 * Prints why a command stopped before changing anything.
 * @param {Stop} stop the reason, any fix, and any exit code
 * @param {Context} context the run's files, git, questions, options and printing
 * @returns {number} the exit code to end with
 */
const printStop = (stop, context) => {
  context.ui.line();
  context.ui.error(stop.reason);

  if (stop.fix) {
    context.ui.line(`Fix: ${stop.fix}`);
  }

  context.ui.line("Nothing was changed.");

  return stop.exitCode ?? EXIT_CODES.FAILED;
};

/**
 * Stages 4–6 for a command that changes things: plan, confirm, apply, recap.
 * @param {Step[]} steps every step, in order
 * @param {CheckResult[]} checks each step's check result, in the same order
 * @param {Context} context the run's files, git, questions, options and printing
 * @returns {Promise<{ exitCode: number, isFinished: boolean }>} isFinished is false for a dry run, a declined
 *   "Go ahead?", or a run stopped with Ctrl+C
 */
const planConfirmApply = async (steps, checks, context) => {
  const { ui, options } = context;

  ui.heading("Plan");
  ui.plan(
    steps.map((step, index) => {
      const check = checks[index];

      // A step to do says what it will do, and its title already says it's in the plan.
      const row = { status: check.status, title: step.title, ...detailAndFix(check) };

      return check.status === "todo"
        ? { ...row, label: "", detail: check.action ?? check.reason }
        : { ...row, label: PLAN_LABEL[check.status] };
    }),
  );

  if (options.dryRun) {
    ui.line();
    ui.line("Dry run: nothing was changed.");

    return { exitCode: EXIT_CODES.OK, isFinished: false };
  }

  const hasWork = checks.some((check) => check.status === "todo");

  if (hasWork && !options.yes) {
    ui.line();

    if (!(await context.ask.confirm("Go ahead?", true))) {
      ui.line("Nothing was changed.");

      return { exitCode: EXIT_CODES.OK, isFinished: false };
    }
  }

  if (hasWork) {
    ui.line();
  }

  const { rows, wasStopped } = await applyEach(steps, checks, context);

  // The steps that ran printed their own rows. The ones that need attention and didn't run are listed after them:
  // those that can't be done, and those a failure or Ctrl+C left out.
  ui.report(rows.filter((row) => row.label === PLAN_LABEL.blocked || row.label === NOT_RUN));

  if (wasStopped) {
    ui.heading("Stopped by you.");
    ui.line("Nothing is half-written. Run the same command again to continue — it skips what's done.");

    return { exitCode: EXIT_CODES.STOPPED, isFinished: false };
  }

  // Only a plan of "already done" and "skipped" is nothing to do. Its rows were just shown in the plan.
  const isAllInPlace = checks.every((check) => check.status === "done" || check.status === "skipped");

  ui.heading(isAllInPlace ? "Nothing to do — everything is already in place." : `${renderRecapCounts(rows)}.`);

  return { exitCode: exitCodeFor(rows), isFinished: true };
};

/**
 * Whether a stage answered with a reason to stop, rather than with its answers.
 * @param {unknown} value what the stage answered
 * @returns {value is { stop: Stop }} true when it is a reason to stop
 */
const isStop = (value) => Boolean(value && typeof value === "object" && "stop" in value && value.stop);

/**
 * Runs `stage`, turning a StepFailure (say, git refusing to read a repository) into a reason to stop.
 * @template T
 * @param {() => Promise<T>} stage the stage to run
 * @returns {Promise<T | { stop: Stop }>} what the stage gave back, or the reason to stop
 */
const stoppingOnFailure = async (stage) => {
  try {
    return await stage();
  } catch (error) {
    if (!(error instanceof StepFailure)) {
      throw error;
    }

    return { stop: { reason: error.message, fix: error.fix } };
  }
};

/**
 * Runs one command through all six stages.
 * @template Facts, Answers
 * @param {Command<Facts, Answers>} command the command to run
 * @param {Context} context the run's files, git, questions, options and printing
 * @returns {Promise<{ exitCode: number, isFinished: boolean }>} isFinished: it got to the recap, rather than
 *   stopping early, being declined at "Go ahead?", or being a dry run
 */
export const runCommandWithOutcome = async (command, context) => {
  const { ui, files } = context;
  const endedEarly = (/** @type {Stop} */ stop) => ({ exitCode: printStop(stop, context), isFinished: false });

  printHeader(command, context);

  const survey = await stoppingOnFailure(() => command.lookAround(context));
  const findings = "findings" in survey ? survey.findings : [];

  if (findings.length > 0) {
    ui.heading("Looking around");
  }

  for (const finding of findings) {
    ui.finding(finding.tone, finding.text);
  }

  if (survey.stop) {
    return endedEarly(survey.stop);
  }

  const readySurvey = /** @type {import("./contract.mjs").ReadySurvey<Facts>} */ (survey);

  // Questions start on their own line, so they're never mistaken for one more finding.
  if (command.askQuestions) {
    ui.line();
  }

  const { askQuestions } = command;
  const answers = askQuestions
    ? await stoppingOnFailure(() => askQuestions(context, readySurvey))
    : /** @type {Answers} */ ({});

  if (isStop(answers)) {
    return endedEarly(answers.stop);
  }

  const readyAnswers = /** @type {Answers} */ (answers);

  const steps = command.steps(context, readySurvey, readyAnswers);
  const checks = await files.withWritesLocked(() => checkEach(steps, context));

  if (command.isReadOnly) {
    const exitCode = exitCodeFor(reportChecks(steps, checks, context));

    printClosingLines(command, context, readySurvey, readyAnswers, exitCode);

    return { exitCode, isFinished: true };
  }

  const outcome = await planConfirmApply(steps, checks, context);

  if (outcome.isFinished) {
    printClosingLines(command, context, readySurvey, readyAnswers, outcome.exitCode);
  }

  return outcome;
};

/**
 * Runs one command through all six stages and returns the exit code. For tests, which only need the exit code:
 * run.mjs uses runCommandWithOutcome, since it also needs to know whether to offer the follow-up.
 * @template Facts, Answers
 * @param {Command<Facts, Answers>} command the command to run
 * @param {Context} context the run's files, git, questions, options and printing
 * @returns {Promise<number>} the exit code
 */
export const runCommand = async (command, context) => (await runCommandWithOutcome(command, context)).exitCode;
