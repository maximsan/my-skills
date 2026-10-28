// @ts-check
// The only module that reads from the keyboard.
//
// Three rules make questions safe to stop. Every question listens to the run's abort signal, so Ctrl+C rejects it
// instead of leaving it waiting forever. Closing the input (Ctrl+D, or a pipe ending) counts as stopping too. And Esc
// stops a question, as it stops a pick list.
// The readline interface is created on the first question only. So commands that never ask (doctor, --yes) never
// keep the keyboard input open, which would stop the program from exiting. It is closed in `close()`, which `run.mjs`
// always calls.
//
// A pick list reads single key presses, which needs the terminal in raw mode: every key goes straight to the program,
// Ctrl+C included. So in a list, Ctrl+C is handled as a key and passed on as an interrupt, and raw mode is switched
// off however the list ends, `close()` included. Where the terminal refuses raw mode, or the input is a pipe, the
// list is printed with numbers to type instead.

import { emitKeypressEvents } from "node:readline";
import { createInterface } from "node:readline/promises";
import { NeedsTerminalError, StoppedError } from "./errors.mjs";
import {
  describePicked, NONE_WORD, openPick, parseNumbers, pickedIndexes, pressKey, renderPick, renderTypedList,
} from "./picker.mjs";

/** @typedef {import("./picker.mjs").PickItem} PickItem */
/** @typedef {import("./picker.mjs").PickMode} PickMode */

const KEY_SEPARATOR = ", ";

/**
 * @typedef {object} AskerOptions
 * @property {NodeJS.ReadableStream} input where answers are read from, usually the keyboard
 * @property {NodeJS.WritableStream} output where the questions are printed, usually the terminal
 * @property {AbortSignal} signal the run's signal; aborting it rejects the pending question
 * @property {boolean} isInteractive whether there is a person at a terminal to answer
 * @property {boolean} assumeDefaults `--yes`: answer every question with its default, without asking
 * @property {() => void} onInterrupt called on Ctrl+C while a question is showing
 * @property {Pick<import("./ui.mjs").Ui, "line" | "paint" | "size" | "liveBlock">} ui prints the pick lists, retry
 *   hints, and the answers `--yes` chose
 */

/**
 * The question-asker every command uses. Tests swap it for makeScriptedAsker().
 * @param {AskerOptions} options the input and output streams, the stop signal, and how to answer
 * @returns {Asker} the questions a command can ask, and a way to release the keyboard
 */
export const createAsker = ({ input, output, signal, isInteractive, assumeDefaults, onInterrupt, ui }) => {
  /** @type {import("node:readline/promises").Interface | null} */
  let readline = null;

  /** @type {Promise<never> | null} */
  let inputClosed = null;

  /** Ends the pick list on screen, if one is open, as if it were stopped. */
  let stopOpenList = () => {};

  const say = ui.line;
  const keyboard = /** @type {NodeJS.ReadStream} */ (input);

  const requireTerminal = () => {
    if (!isInteractive) {
      throw new NeedsTerminalError();
    }
  };

  const open = () => {
    if (readline) {
      return readline;
    }

    requireTerminal();

    const lineReader = createInterface({ input, output });

    // In a terminal, readline takes Ctrl+C itself, so the program's own Ctrl+C handler never hears about it. This
    // passes it on.
    lineReader.on("SIGINT", onInterrupt);

    // Only the line reader in use counts as the input closing. releaseLineReader() detaches it first, so its close
    // is not mistaken for Ctrl+D.
    inputClosed = new Promise((_resolve, reject) => {
      lineReader.once("close", () => {
        if (readline === lineReader) {
          reject(new StoppedError());
        }
      });
    });

    // Nobody may be awaiting it when the input closes; a rejection with no listener would crash the process.
    inputClosed.catch(() => {});
    readline = lineReader;

    return lineReader;
  };

  /**
   * Closes the line reader, so a pick list can read single keys. Its close runs in full, which detaches it from the
   * keyboard: a reader left attached would echo every key and pass on every Ctrl+C a second time.
   */
  const releaseLineReader = () => {
    const lineReader = readline;

    readline = null;
    inputClosed = null;
    lineReader?.close();
  };

  /**
   * Shows one prompt and returns the trimmed answer. Esc stops it, as it stops a pick list.
   * @param {string} prompt the text shown before the cursor
   * @returns {Promise<string>} the answer without surrounding spaces
   */
  const ask = async (prompt) => {
    const lineReader = open();
    const stopQuestion = new AbortController();

    const onStop = () => {
      stopQuestion.abort();
    };

    /**
     * Stops the question on Esc. In a terminal, the line reader reports every key press as well as whole lines.
     * @param {string | undefined} _text the typed character, unused: the key's name says enough
     * @param {import("./picker.mjs").Key | undefined} key the key press
     */
    const onKeypress = (_text, key) => {
      if (key?.name === "escape") {
        onStop();
      }
    };

    if (signal.aborted) {
      onStop();
    }

    signal.addEventListener("abort", onStop);
    input.on("keypress", onKeypress);

    try {
      // The closed input comes first: after Ctrl+D, it has already said so, and the question would fail differently.
      const answer = await Promise.race([inputClosed, lineReader.question(prompt, { signal: stopQuestion.signal })]);

      return String(answer).trim();
    } catch (error) {
      if (stopQuestion.signal.aborted || error instanceof StoppedError) {
        throw new StoppedError();
      }

      throw error;
    } finally {
      signal.removeEventListener("abort", onStop);
      input.off("keypress", onKeypress);
    }
  };

  /**
   * A yes/no question. Enter picks the default, which is shown as the capital letter.
   * @param {string} question the question shown to the user
   * @param {boolean} [defaultYes] whether Enter means yes
   * @returns {Promise<boolean>} true for yes, false for no
   */
  const confirm = async (question, defaultYes = true) => {
    if (assumeDefaults) {
      say(`${question} ${defaultYes ? "yes" : "no"} (--yes)`);

      return defaultYes;
    }

    const hint = defaultYes ? "[Y/n]" : "[y/N]";

    for (;;) {
      const answer = (await ask(`${question} ${hint} `)).toLowerCase();

      if (answer === "") {
        return defaultYes;
      }

      if (answer === "y" || answer === "yes") {
        return true;
      }

      if (answer === "n" || answer === "no") {
        return false;
      }

      say("Please answer y or n.");
    }
  };

  /**
   * Shows a pick list that reads single key presses, and waits for it to end. Needs a terminal that accepts raw mode.
   * @param {string} title the line above the items
   * @param {readonly PickItem[]} items the items
   * @param {PickMode} mode whether it picks one item or several
   * @param {{ cursor?: number, selected?: readonly number[] }} start the item highlighted first, and the items marked
   *   from the start
   * @returns {Promise<number[]> | null} the picked items' places in the list, counting from 0; null at once when the
   *   terminal refuses raw mode, so the list is typed instead
   */
  const pickWithKeys = (title, items, mode, start) => {
    // First: closing the line reader switches raw mode off.
    releaseLineReader();

    try {
      keyboard.setRawMode(true);
    } catch {
      return null;
    }

    emitKeypressEvents(keyboard);

    const block = ui.liveBlock();
    let state = openPick(start);

    const draw = () => {
      block.draw(renderPick(state, title, items, { mode, ...ui.size(), paint: ui.paint }));
    };

    return new Promise((resolve, reject) => {
      const finish = () => {
        keyboard.off("keypress", onKeypress);
        signal.removeEventListener("abort", onAbort);
        keyboard.setRawMode(false);
        keyboard.pause();

        stopOpenList = () => {};

        if (state.done !== "accept") {
          reject(new StoppedError());

          return;
        }

        const picked = pickedIndexes(state);

        // The list folds into one line saying what was picked, as a typed answer would.
        block.draw([`${title} ${ui.paint("bold", describePicked(items, picked))}`]);
        resolve(picked);
      };

      const onAbort = () => {
        state = { ...state, done: "cancel" };
        finish();
      };

      /**
       * Applies one key press and redraws the list.
       * @param {string | undefined} _text the typed character, unused: the key's name says enough
       * @param {import("./picker.mjs").Key | undefined} key the key press
       */
      const onKeypress = (_text, key) => {
        // Raw mode hides Ctrl+C from the program's own handler. Passing it on aborts the run, which ends the list.
        if (key?.ctrl && key.name === "c") {
          onInterrupt();

          return;
        }

        state = pressKey(state, key ?? {}, items.length, mode);

        if (state.done) {
          finish();
        } else {
          draw();
        }
      };

      stopOpenList = onAbort;
      keyboard.on("keypress", onKeypress);
      signal.addEventListener("abort", onAbort);
      keyboard.resume();
      draw();
    });
  };

  /**
   * Prints a list laid out for typing.
   * @param {string} title the line above the items
   * @param {readonly PickItem[]} items the items
   * @param {readonly number[]} marked the items to show as marked; none for a list that picks one item
   * @param {PickMode} mode whether it picks one item or several
   * @returns {string[]} each item's key, in list order
   */
  const printTypedList = (title, items, marked, mode) => {
    const view = { mode, columns: ui.size().columns, paint: ui.paint };
    const { lines, keys } = renderTypedList(title, items, marked, view);

    for (const line of lines) {
      say(line);
    }

    return keys;
  };

  /**
   * Whether a pick list may try reading single key presses: the keyboard is a terminal, and the run isn't stopped.
   * @returns {boolean} true when the list should try raw mode before falling back to typing
   */
  const mayReadKeys = () => Boolean(keyboard.isTTY) && !signal.aborted;

  /**
   * Picks one item from a list. Enter alone takes the default.
   * @param {string} title the line above the items
   * @param {readonly PickItem[]} items the items
   * @param {number} defaultIndex the item highlighted first, and the one --yes takes
   * @returns {Promise<number>} the picked item's place in the list, counting from 0
   */
  const pickOne = async (title, items, defaultIndex) => {
    if (assumeDefaults) {
      say(`${title} ${describePicked(items, [defaultIndex])} (--yes)`);

      return defaultIndex;
    }

    requireTerminal();

    const picked = mayReadKeys() ? await pickWithKeys(title, items, "one", { cursor: defaultIndex }) : null;

    if (picked) {
      return picked[0];
    }

    const keys = printTypedList(title, items, [], "one");
    const defaultKey = keys[defaultIndex];

    for (;;) {
      const answer = (await ask(`Choose [${defaultKey}]: `)).toLowerCase() || defaultKey;
      const index = keys.indexOf(answer);

      if (index !== -1) {
        return index;
      }

      say(`Please type one of: ${keys.join(KEY_SEPARATOR)}.`);
    }
  };

  /**
   * Picks any number of items from a list, none included. Enter alone keeps the items marked from the start.
   * @param {string} title the line above the items
   * @param {readonly PickItem[]} items the items
   * @param {readonly number[]} marked the items marked from the start, and the ones --yes takes
   * @returns {Promise<number[]>} the picked items' places in the list, counting from 0, in list order
   */
  const pickMany = async (title, items, marked) => {
    if (assumeDefaults) {
      say(`${title} ${describePicked(items, marked)} (--yes)`);

      return [...marked];
    }

    requireTerminal();

    const pickedWithKeys = mayReadKeys() ? await pickWithKeys(title, items, "many", { selected: marked }) : null;

    if (pickedWithKeys) {
      return pickedWithKeys;
    }

    printTypedList(title, items, marked, "many");

    const defaultText = marked.map((index) => index + 1).join(",") || NONE_WORD;

    for (;;) {
      const answer = (await ask(`Numbers, e.g. 1,3, or ${NONE_WORD} [${defaultText}]: `)).toLowerCase();

      if (answer === "") {
        return [...marked];
      }

      const picked = answer === NONE_WORD ? [] : parseNumbers(answer, items.length);

      if (picked) {
        return picked;
      }

      say(`Please type numbers from 1 to ${items.length}, such as 1,3 or 2-4, or ${NONE_WORD}.`);
    }
  };

  /**
   * A free-text answer, asked again until `validate` accepts it.
   * @param {string} question the question shown to the user
   * @param {TextOptions} [options] the answer Enter gives, and the check each answer must pass
   * @returns {Promise<string>} the accepted answer
   */
  const text = async (question, { defaultValue = "", validate = () => null } = {}) => {
    if (assumeDefaults) {
      say(`${question} ${defaultValue || "(skipped)"} (--yes)`);

      return defaultValue;
    }

    const hint = defaultValue ? ` [${defaultValue}]` : "";

    for (;;) {
      const answer = (await ask(`${question}${hint}: `)) || defaultValue;
      const problem = validate(answer);

      if (!problem) {
        return answer;
      }

      say(problem);
    }
  };

  /**
   * Releases the keyboard input, and switches raw mode off if a pick list is open. Safe to call more than once, and
   * when no question was ever asked.
   */
  const close = () => {
    stopOpenList();
    releaseLineReader();
  };

  return { confirm, pickOne, pickMany, text, close };
};

/**
 * The questions a command can ask. Written out, rather than taken from createAsker(), so tests' scripted asker has one
 * shape to match.
 * @typedef {object} Asker
 * @property {(question: string, defaultYes?: boolean) => Promise<boolean>} confirm a yes/no question
 * @property {(title: string, items: PickItem[], defaultIndex: number) => Promise<number>} pickOne one item from a
 *   list
 * @property {(title: string, items: PickItem[], marked: number[]) => Promise<number[]>} pickMany any number of items
 *   from a list
 * @property {(question: string, options?: TextOptions) => Promise<string>} text a free-text answer
 * @property {() => void} close releases the keyboard input
 */

/**
 * @typedef {{ defaultValue?: string, validate?: (answer: string) => string | null }} TextOptions validate returns an
 *   error message, or null when the answer is fine
 */
