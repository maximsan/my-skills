// @ts-check
// The shapes every command and step follows. Types only: nothing here runs.
//
// Read this first when adding a command or a step. A command is a plain object (`Command`) whose `steps()` returns a
// list of `Step`s. The runner in runner.mjs takes it through the six stages; a command never prints a plan, asks
// "Go ahead?", or handles Ctrl+C itself. Each command names the shape of its own survey facts and answers, so
// `steps()` gets typed data rather than `any`.

/**
 * What a step's read-only check found.
 * - todo: needs doing, and apply() will do it
 * - done: already in place
 * - blocked: can't be done safely; the reason and fix say why and what to do
 * - skipped: doesn't apply here
 * - warn: works, but worth a look (doctor only)
 * @typedef {"todo" | "done" | "blocked" | "skipped" | "warn"} StepStatus
 * @typedef {{ status: StepStatus, reason?: string, action?: string, points?: string[], fix?: string }} CheckResult
 *   reason: what was found, e.g. "there's no link yet"; action: for todo, what apply() will do, e.g. "create the
 *   link", which the plan shows instead of the reason; points: several findings, listed one per line under the step
 */

/**
 * @typedef {object} Step
 * @property {string} title shown in the plan, the progress line and the recap
 * @property {() => CheckResult | Promise<CheckResult>} check looks only: every write throws while it runs
 * @property {() => string | void | Promise<string | void>} [apply] makes the change; may return a detail for the recap
 */

/**
 * @typedef {{ tone: import("./ui.mjs").Tone, text: string }} Finding one line under "Looking around"
 * @typedef {{ reason: string, fix?: string, exitCode?: number }} Stop a reason to end before any step runs; its
 *   exitCode defaults to EXIT_CODES.FAILED
 */

/**
 * What "Looking around" found: either a reason to stop, or the facts the later stages use.
 * @template Facts
 * @typedef {{ findings: Finding[], stop: Stop } | { findings: Finding[], stop?: undefined, facts: Facts }} Survey
 */

/**
 * A survey that didn't stop, which is all that questions, steps and the recap ever see.
 * @template Facts
 * @typedef {{ findings: Finding[], facts: Facts }} ReadySurvey
 */

/**
 * @typedef {object} Context everything a command may use; tests build one with fakes
 * @property {import("./layout.mjs").Layout} layout where this repo, the projects folder and the rule files are
 * @property {import("./files.mjs").Files} files reads and writes files; every write goes through it
 * @property {import("./git.mjs").Git} git runs git commands
 * @property {import("./ask.mjs").Asker} ask asks the person questions
 * @property {import("./ui.mjs").Ui} ui prints to the terminal
 * @property {AbortSignal} signal fires when the person presses Ctrl+C
 * @property {{ yes: boolean, dryRun: boolean, debug: boolean }} options the flags given on the command line
 * @property {string[]} args positional arguments after the command name
 * @property {string} cwd the folder the command was started in
 * @property {NodeJS.ProcessEnv} env the environment variables, e.g. PATH
 * @property {NodeJS.Platform} platform the operating system, e.g. "win32"
 * @property {string} nodeVersion e.g. "v20.11.0"
 * @property {string} homeDirectory for resolving `@~/…` imports
 * @property {boolean} isInteractive whether a person at a terminal can answer questions
 */

/**
 * @template [Facts=any]
 * @template [Answers=any]
 * @typedef {object} Command
 * @property {string} name what you type: `claude-rules <name>`
 * @property {string} title the menu label
 * @property {string} summary one or two sentences, shown in the menu and --help
 * @property {string} [usage] its positional arguments for --help, e.g. "[name|path]"; without it, it takes none
 * @property {string[]} flags which of "yes" and "dry-run" it accepts
 * @property {(context: Context) => string[]} mayChange only controls the header's "May change" line, shown before
 *   anything runs; empty means it changes nothing. setup lists its two paths. add-app can't name the app's paths,
 *   because the header prints before the app is chosen, so it names what it creates instead
 * @property {boolean} [isReadOnly] only checks and reports (doctor): the runner skips the plan and "Go ahead?", and
 *   nothing is applied
 * @property {(context: Context) => Promise<Survey<Facts>>} lookAround may ask one question: which target to work on
 * @property {(context: Context, survey: ReadySurvey<Facts>) => Promise<Answers | { stop: Stop }>} [askQuestions]
 *   without it, the answers are `{}`
 * @property {(context: Context, survey: ReadySurvey<Facts>, answers: Answers) => Step[]} steps the
 *   changes or checks to make, in order
 * @property {(context: Context, survey: ReadySurvey<Facts>, answers: Answers) => string[]} [afterwards] extra recap
 *   lines, shown only when nothing failed
 * @property {(context: Context, survey: ReadySurvey<Facts>, answers: Answers) => string} [nextStep] the single
 *   "Next:" line, shown only when nothing failed
 * @property {{ question: (context: Context) => string | null, command: string }} [followUp] offered after a run
 *   that finished, e.g. setup → add-app, or add-app → the next app; a null question means there's nothing to offer,
 *   e.g. every app is added
 */

export {};
