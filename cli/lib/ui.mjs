// @ts-check
// The only module that prints, apart from the question prompts ask.mjs shows and main.mjs's "Node is too old" line.
//
// Everything a person sees goes through here, so the look stays consistent and tests can swap in a recorder. It
// formats and prints; it never decides anything. The render* functions are pure (data in, lines out) so the layout
// can be tested without a terminal.

import { usableWidth } from "./text.mjs";

/** @typedef {"ok" | "fail" | "warn" | "info" | "skip"} Tone */

/** The symbol for each tone. Tests lay their recorded output out with the same table. */
export const UNICODE_SYMBOLS = { ok: "✔", fail: "✖", warn: "!", info: "·", skip: "–", ellipsis: "…" };

// The old Windows command window prints ✔ as garbage, so it gets plain text.
const ASCII_SYMBOLS = { ok: "OK", fail: "X", warn: "!", info: "-", skip: "-", ellipsis: "..." };

/** The progress line's spinning symbol, one frame at a time; plain text where the symbols above are. */
const UNICODE_FRAMES = ["·", "✢", "✳", "✶", "✻", "✽"];
const ASCII_FRAMES = ["|", "/", "-", "\\"];

/** How often the progress line's symbol turns. */
const FRAME_MS = 120;

/** Where the progress line can't be redrawn (a pipe, a log file), a plain line this often shows the step is alive. */
const PLAIN_LINE_EVERY_MS = 5000;

/** Pink needs a terminal with this many colours; one with fewer gets magenta. */
const PALETTE_COLORS = 256;

/** Codes that tell a terminal to change text colour or weight. */
const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  highlight: "\x1b[1;36m",
  hint: "\x1b[35m",
  yellow: "\x1b[33m",
  magenta: "\x1b[1;35m",
  pink: "\x1b[1;38;5;205m",
};

/** Go back to the start of the line and wipe it, so the progress line can be redrawn. */
const CLEAR_LINE = "\r\x1b[2K";

/** Wipe from the cursor to the end of the screen, so a block of lines can be redrawn. */
const CLEAR_DOWN = "\x1b[J";

/**
 * Moves the cursor up to the start of a block of lines printed before.
 * @param {number} lines how many lines the block has
 * @returns {string} the code that moves the cursor
 */
const cursorUp = (lines) => `\r\x1b[${lines}A`;

/** Used when the terminal doesn't say how big it is. */
export const DEFAULT_SIZE = { rows: 24, columns: 80 };

const MS_PER_SECOND = 1000;

/**
 * Whether the terminal can show symbols such as ✔. Only the old Windows command window can't.
 * @param {NodeJS.ProcessEnv} env the environment variables, which name the terminal on Windows
 * @param {NodeJS.Platform} platform the operating system, e.g. "win32" or "darwin"
 * @returns {boolean} true when the Unicode symbols print correctly
 */
const supportsUnicode = (env, platform) =>
  platform !== "win32" || Boolean(env.WT_SESSION || env.TERM_PROGRAM === "vscode");

/**
 * One row of a run's results, or of doctor's. `points` are listed one per line under the row.
 * @typedef {{ tone: Tone, title: string, label: string, detail?: string, points?: string[], fix?: string }} ReportRow
 */

/** Labels the ✔ in front of the row already says, so the row leaves them out. */
const SILENT_LABELS = new Set(["done", "OK"]);

/**
 * What a row says after its title: the label and the detail, either of which may be empty.
 * @param {string} label e.g. "worth a look"; "done" and "OK" aren't shown
 * @param {string} [detail] e.g. "created"
 * @returns {string} e.g. " — worth a look: not installed", or "" when there's nothing to add
 */
const describeOutcome = (label, detail) => {
  const text = [SILENT_LABELS.has(label) ? "" : label, detail].filter(Boolean).join(": ");

  return text ? ` — ${text}` : "";
};

/**
 * Lays out result rows, or doctor's results: symbol, title, what happened, any points under it, and a fix line
 * underneath when there is one.
 * @param {ReportRow[]} rows the steps to show, one row each
 * @param {typeof UNICODE_SYMBOLS} symbols the symbol for each tone, Unicode or plain text
 * @param {(tone: Tone, text: string) => string} [paintTone] colours a symbol; plain text by default
 * @returns {string[]} the lines to print, without line breaks
 */
export const renderReport = (rows, symbols, paintTone = (_tone, text) => text) =>
  rows.flatMap((row) => [
    `  ${paintTone(row.tone, symbols[row.tone])} ${row.title}${describeOutcome(row.label, row.detail)}`,
    ...(row.points ?? []).map((point) => `      ${symbols.info} ${point}`),
    ...(row.fix ? [`      Fix: ${row.fix}`] : []),
  ]);

/**
 * One row of the plan: what a step will do, before anything runs. The status picks the label's style.
 * @typedef {{ status: import("./contract.mjs").StepStatus, title: string, label: string, detail?: string,
 *             fix?: string }} PlanRow
 */

/**
 * Lays out the plan as a numbered list, so "step 2" means the same thing in the plan and the progress lines.
 * @param {PlanRow[]} rows the steps of the plan, in the order they run
 * @param {(row: PlanRow) => string} [paintLabel] styles a row's label; plain text by default
 * @returns {string[]} the lines to print, without line breaks
 */
export const renderPlan = (rows, paintLabel = (row) => row.label) =>
  rows.flatMap((row, index) => {
    const outcome = [row.label && paintLabel(row), row.detail].filter(Boolean).join(": ");
    const lines = [`  ${index + 1}  ${row.title}${outcome ? ` — ${outcome}` : ""}`];

    if (row.fix) {
      lines.push(`       Fix: ${row.fix}`);
    }

    return lines;
  });

/** The result labels in the order they're counted. "failed" comes last and is always shown. */
const RECAP_COUNT_ORDER = ["done", "already done", "skipped", "can't do", "stopped", "not run"];

/** Labels that mean the run didn't do everything it planned. */
const SHORTFALL_LABELS = ["failed", "can't do", "stopped", "not run"];

/**
 * The line that closes a run, e.g. "All 4 done" or "2 done, 1 failed". The rows were printed as each step ended, so
 * a run that did everything it planned just says so. Otherwise each label is counted on its own, so "stopped" and
 * "not run" never hide inside "skipped", and "failed" is always shown, even at zero.
 * @param {ReportRow[]} rows the result rows to count
 * @returns {string} the counts, joined by commas
 */
export const renderRecapCounts = (rows) => {
  const count = (/** @type {string} */ label) => rows.filter((row) => row.label === label).length;

  if (SHORTFALL_LABELS.every((label) => count(label) === 0)) {
    return count("done") === 1 ? "Done" : `All ${count("done")} done`;
  }

  const parts = RECAP_COUNT_ORDER.filter((label) => count(label) > 0).map((label) => `${count(label)} ${label}`);

  return [...parts, `${count("failed")} failed`].join(", ");
};

/**
 * The printer every command uses. Tests swap it for makeRecordingUi().
 * @param {{ output: NodeJS.WriteStream | NodeJS.WritableStream, env: NodeJS.ProcessEnv, platform: NodeJS.Platform,
 *           isDebug: boolean }} options where to print, the environment and operating system that decide colours and
 *   symbols, and whether to show debug lines
 * @returns {Ui} the printing functions a command uses
 */
export const createUi = ({ output, env, platform, isDebug }) => {
  const terminal = /** @type {NodeJS.WriteStream} */ (output);
  const isTerminal = Boolean(terminal.isTTY);

  // Node's own check: it reads NO_COLOR, FORCE_COLOR and the terminal's type from `env`.
  const useColor = isTerminal && Boolean(terminal.hasColors?.(env));
  const accent = terminal.hasColors?.(PALETTE_COLORS, env) ? "pink" : "magenta";
  const isUnicode = supportsUnicode(env, platform);
  const symbols = isUnicode ? UNICODE_SYMBOLS : ASCII_SYMBOLS;
  const frames = isUnicode ? UNICODE_FRAMES : ASCII_FRAMES;

  /** @type {NodeJS.Timeout | null} */
  let elapsedTimer = null;

  /**
   * Wraps text in a colour or weight code, when the output is a terminal that shows colour.
   * @param {keyof typeof ANSI} style the colour or weight to use
   * @param {string} text the text to style
   * @returns {string} the styled text, or the same text when colour is off
   */
  const paint = (style, text) => (useColor ? `${ANSI[style]}${text}${ANSI.reset}` : text);

  /** @type {Record<Tone, keyof typeof ANSI>} */
  const TONE_STYLE = { ok: "green", fail: "red", warn: "yellow", info: "dim", skip: "dim" };

  /**
   * Prints one line.
   * @param {string} [text] the line to print; an empty line by default
   */
  const line = (text = "") => {
    output.write(`${text}\n`);
  };

  /**
   * Prints a bold heading after an empty line.
   * @param {string} text the heading
   */
  const heading = (text) => {
    line();
    line(paint("bold", text));
  };

  /**
   * Prints one indented line with the symbol for its tone.
   * @param {Tone} tone how the finding went, which picks the symbol and its colour
   * @param {string} text what was found
   */
  const finding = (tone, text) => {
    line(`  ${paint(TONE_STYLE[tone], symbols[tone])} ${text}`);
  };

  /**
   * Prints result rows, or doctor's results, laid out by renderReport().
   * @param {ReportRow[]} rows the steps to show, one row each
   */
  const report = (rows) => {
    for (const text of renderReport(rows, symbols, (tone, symbol) => paint(TONE_STYLE[tone], symbol))) {
      line(text);
    }
  };

  /** @type {Record<import("./contract.mjs").StepStatus, keyof typeof ANSI>} */
  const PLAN_STATUS_STYLE = { todo: "bold", done: "dim", skipped: "dim", blocked: "red", warn: "yellow" };

  /**
   * Prints the numbered plan, laid out by renderPlan().
   * @param {PlanRow[]} rows the steps of the plan, in the order they run
   */
  const plan = (rows) => {
    for (const text of renderPlan(rows, (row) => paint(PLAN_STATUS_STYLE[row.status], row.label))) {
      line(text);
    }
  };

  /**
   * Starts a progress line for one step and returns how to finish it. In a terminal the line is redrawn in place: a
   * turning symbol, the step, and the time so far. Elsewhere nothing shows until the step ends, apart from a plain
   * line every few seconds while it runs. Either way, finishing replaces the line with the step's result row, so
   * each step is reported once.
   * @param {number} index 1-based
   * @param {number} total how many steps the run has
   * @param {string} title the step's name
   * @returns {{ finish: (row: ReportRow) => void }} finish() replaces the line with the step's result
   */
  const progress = (index, total, title) => {
    const counter = `[${index}/${total}]`;
    const label = `${counter} ${title}${symbols.ellipsis}`;
    const startedAt = Date.now();
    const elapsed = () => `(${Math.floor((Date.now() - startedAt) / MS_PER_SECOND)}s)`;
    let frame = 0;

    const draw = () => {
      const symbol = frames[frame % frames.length];
      const time = elapsed();

      // Only the title is cut, so the line never wraps.
      const room = Math.max(usableWidth(size().columns) - `${symbol} ${counter}  ${time}`.length, 0);
      const shown = title.slice(0, room);
      const wordEnd = shown.includes(" ") ? shown.indexOf(" ") : shown.length;
      const word = paint(accent, shown.slice(0, wordEnd));
      const rest = shown.slice(wordEnd) && paint("bold", shown.slice(wordEnd));

      const parts = [paint("yellow", symbol), paint("dim", counter), `${word}${rest}`, paint("dim", time)];

      output.write(`${CLEAR_LINE}${parts.join(" ")}`);
    };

    if (isTerminal) {
      draw();
      elapsedTimer = setInterval(() => {
        frame += 1;
        draw();
      }, FRAME_MS);
    } else {
      elapsedTimer = setInterval(() => {
        line(`${label} ${elapsed()}`);
      }, PLAIN_LINE_EVERY_MS);
    }

    // This timer is marked so it never keeps the program running by itself.
    elapsedTimer.unref();

    /**
     * Replaces the progress line with the step's result row. A step that took a second or more says how long.
     * @param {ReportRow} row how the step went
     */
    const finish = (row) => {
      stopElapsedTimer();

      const seconds = (Date.now() - startedAt) / MS_PER_SECOND;
      const time = `${seconds.toFixed(1)}s`;
      const timed = seconds >= 1 ? { ...row, detail: [row.detail, time].filter(Boolean).join(", ") } : row;

      if (isTerminal) {
        output.write(CLEAR_LINE);
      }

      report([timed]);
    };

    return { finish };
  };

  const stopElapsedTimer = () => {
    if (elapsedTimer) {
      clearInterval(elapsedTimer);
    }

    elapsedTimer = null;
  };

  /**
   * Prints what the user should do next, after a bold "Next:".
   * @param {string} text the next thing to do
   */
  const next = (text) => {
    line(`${paint("bold", "Next:")} ${text}`);
  };

  /**
   * Prints a warning in yellow.
   * @param {string} text the warning
   */
  const warn = (text) => {
    line(paint("yellow", text));
  };

  /**
   * Prints an error in red.
   * @param {string} text the error message
   */
  const error = (text) => {
    line(paint("red", text));
  };

  /**
   * Prints a dim debug line, only when debug output is on.
   * @param {string} text the debug message
   */
  const debug = (text) => {
    if (isDebug) {
      line(paint("dim", `  debug: ${text}`));
    }
  };

  /** Stops anything still animating. `run.mjs` calls it on every exit path. */
  const dispose = () => {
    stopElapsedTimer();
  };

  /**
   * The terminal's size, so a pick list can fit in it.
   * @returns {{ rows: number, columns: number }} its lines and columns, or a usual size when it doesn't say
   */
  const size = () => {
    const { rows, columns } = /** @type {NodeJS.WriteStream} */ (output);

    return { rows: rows || DEFAULT_SIZE.rows, columns: columns || DEFAULT_SIZE.columns };
  };

  /**
   * Starts a block of lines that is redrawn in place each time it changes, such as a pick list. Each line must fit
   * the terminal's width: a line that wraps takes two rows, and the redraw would leave its top half behind. Printing
   * after the last draw goes on below the block.
   * @returns {LiveBlock} how to draw the block
   */
  const liveBlock = () => {
    let drawnLines = 0;

    return {
      draw: (lines) => {
        output.write(`${drawnLines ? cursorUp(drawnLines) : ""}${CLEAR_DOWN}${lines.join("\n")}\n`);
        drawnLines = lines.length;
      },
    };
  };

  return {
    symbols, line, heading, finding, report, plan, progress, next, warn, error, debug, dispose, paint, size, liveBlock,
  };
};

/**
 * A block of lines redrawn in place.
 * @typedef {object} LiveBlock
 * @property {(lines: string[]) => void} draw replaces the block's lines with these
 */

/**
 * The printer a command uses. Written out, rather than taken from createUi(), so tests' recording printer has one
 * shape to match.
 * @typedef {object} Ui
 * @property {typeof UNICODE_SYMBOLS} symbols the symbol for each tone, Unicode or plain text
 * @property {(text?: string) => void} line prints one line
 * @property {(text: string) => void} heading prints a bold heading after an empty line
 * @property {(tone: Tone, text: string) => void} finding prints one line with the symbol for its tone
 * @property {(rows: ReportRow[]) => void} report prints result rows, or doctor's results
 * @property {(rows: PlanRow[]) => void} plan prints the numbered plan
 * @property {(index: number, total: number, title: string) => { finish: (row: ReportRow) => void }} progress
 *   starts a progress line for one step, which its result row replaces
 * @property {(text: string) => void} next prints what the user should do next
 * @property {(text: string) => void} warn prints a warning
 * @property {(text: string) => void} error prints an error
 * @property {(text: string) => void} debug prints a debug line, only when debug output is on
 * @property {() => void} dispose stops anything still animating
 * @property {(style: keyof typeof ANSI, text: string) => string} paint styles text, when the terminal shows colour
 * @property {() => { rows: number, columns: number }} size the terminal's size
 * @property {() => LiveBlock} liveBlock starts a block of lines that is redrawn in place
 */
