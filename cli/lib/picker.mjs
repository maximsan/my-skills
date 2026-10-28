// @ts-check
// The pick list's logic: what a key press does, and what lines show. All pure; ask.mjs reads the keys and ui.mjs
// prints.
//
// A list picks one item (the menu, the app) or several (stack rules). Up and Down move the highlight; with several,
// Space marks the highlighted item and `a` marks all. Enter accepts. Esc, Ctrl+C and Ctrl+D cancel.

import { usableWidth, wrapText } from "./text.mjs";

/**
 * One line of a pick list.
 * @typedef {object} PickItem
 * @property {string} label the line's text
 * @property {string} [hint] more about the item, shown under the list while it is highlighted
 * @property {string} [key] what to type for it where the list falls back to typed answers; its number otherwise
 */

/**
 * Whether the list picks one item or several.
 * @typedef {"one" | "many"} PickMode
 */

/**
 * The list between key presses: the highlighted item, the marked items, and how it ended (null while it is open).
 * @typedef {{ cursor: number, selected: Set<number>, done: "accept" | "cancel" | null }} PickState
 */

/**
 * One key press, as Node reports it to ask.mjs.
 * @typedef {{ name?: string, ctrl?: boolean }} Key
 */

/**
 * A text style the list asks for; ui.mjs turns it into a colour, or nothing where the terminal shows none.
 * @typedef {"cyan" | "green" | "highlight" | "hint"} PickStyle
 */

/** Lines of the list that are neither items nor the hint: the title, the key help, and the count or a blank line. */
const RESERVED_ROWS = 3;

/** The items the hint makes room for in a short terminal: it is cut first, down to nothing if need be. */
const MIN_VISIBLE_ITEMS = 3;

/** The terminal's last row stays free: the line break after the list moves the cursor onto it. */
const CURSOR_ROW = 1;

/** The highlighted item stays in the middle of the shown items while it can. */
const HALF = 2;

/** Each key, and what it does. The keys are coloured, so they stand out from the words. */
const KEY_HELP = {
  one: [["Up/Down", "move"], ["Enter", "choose"], ["Esc", "stop"]],
  many: [["Up/Down", "move"], ["Space", "mark"], ["a", "all"], ["Enter", "accept"], ["Esc", "stop"]],
};
const KEY_HELP_INDENT = "  ";
const KEY_HELP_GAP = "  ";
const POINTER = ">";
const MARKED = "[x]";
const UNMARKED = "[ ]";
const HINT_INDENT = "    ";

/** The space between the longest label and the hint beside the highlighted item. */
const HINT_GAP = 3;

/** The narrowest a hint beside its item may be; a narrower terminal gets the hint under the list. */
const MIN_HINT_WIDTH = 24;

/** Typed instead of numbers, to pick none of a list's items; also shown when none was picked. */
export const NONE_WORD = "none";

const LABEL_SEPARATOR = ", ";

/** Room for a typed list's key and the space after it, e.g. "1  " or "h  ". */
const KEY_WIDTH = 3;
const ITEM_INDENT = "  ";

/** One part of typed numbers: a number, or a range such as 5-7. */
const NUMBER_PART = /^(\d+)(?:-(\d+))?$/;
const NUMBER_SEPARATORS = /[\s,]+/;

/** Keys that end the list without an answer, as Ctrl plus the letter. */
const CANCEL_CTRL_KEYS = ["c", "d"];

/**
 * The list as it opens.
 * @param {{ cursor?: number, selected?: readonly number[] }} start the item to highlight first, and the items marked
 *   from the start
 * @returns {PickState} the open list
 */
export const openPick = ({ cursor = 0, selected = [] }) => ({ cursor, selected: new Set(selected), done: null });

/**
 * Applies one key press. Up and Down wrap around. `a` marks all items, or none when all are marked. With one item to
 * pick, Enter takes the highlighted one; with several, Enter takes the marked ones, which may be none.
 * @param {PickState} state the list before the key press
 * @param {Key} key the key press
 * @param {number} count how many items the list has
 * @param {PickMode} mode whether it picks one item or several
 * @returns {PickState} the list after the key press
 */
export const pressKey = (state, key, count, mode) => {
  const { cursor, selected } = state;

  if (key.name === "escape" || (key.ctrl && CANCEL_CTRL_KEYS.includes(key.name ?? ""))) {
    return { ...state, done: "cancel" };
  }

  if (key.name === "return" || key.name === "enter") {
    return { ...state, selected: mode === "one" ? new Set([cursor]) : selected, done: "accept" };
  }

  if (key.name === "up" || key.name === "down") {
    const step = key.name === "up" ? count - 1 : 1;

    return { ...state, cursor: (cursor + step) % count };
  }

  if (mode === "one") {
    return state;
  }

  if (key.name === "space") {
    const next = new Set(selected);

    if (!next.delete(cursor)) {
      next.add(cursor);
    }

    return { ...state, selected: next };
  }

  if (key.name === "a") {
    return { ...state, selected: new Set(selected.size === count ? [] : [...Array(count).keys()]) };
  }

  return state;
};

/**
 * The picked items, in list order.
 * @param {PickState} state a list that was accepted
 * @returns {number[]} the picked items' places in the list, counting from 0
 */
export const pickedIndexes = (state) => [...state.selected].sort((left, right) => left - right);

/**
 * The key help line: each key in colour, then what it does. A pair that doesn't fit the width is left out whole,
 * rather than cut in the middle of a word.
 * @param {readonly string[][]} pairs each key and what it does
 * @param {number} width the widest the line may be
 * @param {(style: PickStyle, text: string) => string} paint how to style text
 * @returns {string} e.g. "  Up/Down move  Enter choose  Esc stop"
 */
const renderKeyHelp = (pairs, width, paint) => {
  const parts = [];
  let used = KEY_HELP_INDENT.length;

  for (const [key, action] of pairs) {
    const length = (parts.length > 0 ? KEY_HELP_GAP.length : 0) + key.length + 1 + action.length;

    if (used + length > width) {
      break;
    }

    used += length;
    parts.push(`${paint("cyan", key)} ${action}`);
  }

  return `${KEY_HELP_INDENT}${parts.join(KEY_HELP_GAP)}`;
};

/**
 * The lines of the list, which fit in the terminal's height while it has room for one item. When the items don't fit,
 * only the ones around the highlighted item show. The highlighted item's hint sits next to it, wrapped onto the lines
 * below in the same column. In a terminal too narrow for that column, the hint goes under the list instead. Either
 * way it's cut in a short terminal. Every line is cut to the terminal's width, so none wraps and the list can be
 * redrawn in place.
 * @param {PickState} state the list
 * @param {string} title the line above the items
 * @param {readonly PickItem[]} items the items
 * @param {{ mode: PickMode, rows: number, columns: number, paint: (style: PickStyle, text: string) => string }} view
 *   whether it picks one item or several, the terminal's size, and how to style text
 * @returns {string[]} the lines to print
 */
export const renderPick = (state, title, items, { mode, rows, columns, paint }) => {
  const width = usableWidth(columns);
  const hint = items[state.cursor]?.hint;
  const markWidth = mode === "many" ? MARKED.length + 1 : 0;
  const hintColumn = POINTER.length + 1 + markWidth + Math.max(...items.map((item) => item.label.length)) + HINT_GAP;
  const isBeside = width - hintColumn >= MIN_HINT_WIDTH;

  // A list taller than the terminal scrolls, and the redraw, which moves up by the lines it drew, lands too low.
  // A hint beside its item takes no row for its first line.
  const room = rows - CURSOR_ROW - RESERVED_ROWS;
  const extraRows = Math.max(room - MIN_VISIBLE_ITEMS, 0);
  const hintWidth = isBeside ? width - hintColumn : width - HINT_INDENT.length;
  const hintLines = hint ? wrapText(hint, hintWidth).slice(0, extraRows + (isBeside ? 1 : 0)) : [];
  const visible = Math.max(room - Math.max(hintLines.length - (isBeside ? 1 : 0), 0), 1);
  const first = Math.min(Math.max(state.cursor - Math.floor(visible / HALF), 0), Math.max(items.length - visible, 0));
  const shown = items.slice(first, first + visible);

  /**
   * Cuts a line to the terminal's width.
   * @param {string} line the full line
   * @returns {string} the line as shown
   */
  const cut = (line) => line.slice(0, width);

  const itemLines = shown.flatMap((item, offset) => {
    const index = first + offset;
    const isCursor = index === state.cursor;
    const isMarked = state.selected.has(index);
    const mark = mode === "many" ? `${isMarked ? MARKED : UNMARKED} ` : "";
    const line = cut(`${isCursor ? POINTER : " "} ${mark}${item.label}`);

    // Styled in parts after cutting, so the style codes never count against the width, and the green mark doesn't
    // end the highlight before the label.
    const markStart = POINTER.length + 1;
    const markEnd = markStart + mark.length;
    const paintLine = (/** @type {string} */ text) => (isCursor && text ? paint("highlight", text) : text);
    const markText = line.slice(markStart, markEnd);
    const styled = [
      paintLine(line.slice(0, markStart)),
      isMarked && markText ? paint("green", markText) : paintLine(markText),
      paintLine(line.slice(markEnd)),
    ].join("");

    if (!isCursor || !isBeside || hintLines.length === 0) {
      return [styled];
    }

    const [firstHint, ...restHint] = hintLines;
    const indent = " ".repeat(hintColumn);

    return [
      `${styled}${" ".repeat(hintColumn - line.length)}${paint("hint", firstHint)}`,
      ...restHint.map((text) => `${indent}${paint("hint", text)}`),
    ];
  });

  const hidden = items.length > shown.length ? `${first + 1}-${first + shown.length} of ${items.length} shown` : "";
  const counts = mode === "many" ? [`${state.selected.size} of ${items.length} marked`, hidden] : [hidden];
  const footer = counts.filter(Boolean).join(", ");

  return [
    cut(title),
    renderKeyHelp(KEY_HELP[mode], width, paint),
    ...itemLines,
    footer ? cut(`  ${footer}`) : "",
    ...(isBeside ? [] : hintLines.map((text) => `${HINT_INDENT}${paint("hint", text)}`)),
  ];
};

/**
 * What was picked, as one line of text: the labels, or "none".
 * @param {readonly PickItem[]} items the list's items
 * @param {readonly number[]} indexes the picked items' places in the list
 * @returns {string} e.g. "React, TypeScript"
 */
export const describePicked = (items, indexes) =>
  indexes.map((index) => items[index].label).join(LABEL_SEPARATOR) || NONE_WORD;

/**
 * A list laid out for typing, where the terminal can't send single key presses: each item with the key to type for it.
 * Each hint wraps onto the lines below it, in its own column, rather than where the terminal happens to break it.
 * @param {string} title the line above the items
 * @param {readonly PickItem[]} items the items
 * @param {readonly number[]} marked the items to show as marked; none for a list that picks one item
 * @param {{ mode: PickMode, columns: number, paint: (style: PickStyle, text: string) => string }} view whether it
 *   picks one item or several, the terminal's width, and how to style text
 * @returns {{ lines: string[], keys: string[] }} the lines to print, and each item's key in list order: its own `key`,
 *   or its number
 */
export const renderTypedList = (title, items, marked, { mode, columns, paint }) => {
  const keys = items.map((item, index) => item.key ?? String(index + 1));
  const width = Math.max(...items.map((item) => item.label.length));
  const markWidth = mode === "many" ? MARKED.length + 1 : 0;
  const hintColumn = ITEM_INDENT.length + KEY_WIDTH + markWidth + width + HINT_GAP;
  const hintWidth = Math.max(usableWidth(columns) - hintColumn, MIN_HINT_WIDTH);
  const itemLines = items.flatMap((item, index) => {
    const mark = mode === "many" ? `${marked.includes(index) ? MARKED : UNMARKED} ` : "";
    const key = `${paint("cyan", keys[index])}${" ".repeat(Math.max(KEY_WIDTH - keys[index].length, 0))}`;
    const line = `${ITEM_INDENT}${key}${mark}${item.label.padEnd(width)}`;
    const [firstHint, ...restHint] = item.hint ? wrapText(item.hint, hintWidth) : [];

    return [
      firstHint ? `${line}${" ".repeat(HINT_GAP)}${paint("hint", firstHint)}` : line.trimEnd(),
      ...restHint.map((text) => `${" ".repeat(hintColumn)}${paint("hint", text)}`),
    ];
  });

  return { lines: [title, ...itemLines, ""], keys };
};

/**
 * Reads typed item numbers, such as "1,3,5-7".
 * @param {string} text what was typed
 * @param {number} count how many items the list has, numbered from 1
 * @returns {number[] | null} the picked items' places in the list, counting from 0, in list order; null when the
 *   text isn't a list of numbers from 1 to `count`
 */
export const parseNumbers = (text, count) => {
  const picked = new Set();

  for (const part of text.split(NUMBER_SEPARATORS).filter(Boolean)) {
    const match = part.match(NUMBER_PART);

    if (!match) {
      return null;
    }

    const [, first, last = first] = match;
    const from = Number(first);
    const until = Number(last);

    if (from < 1 || until > count || from > until) {
      return null;
    }

    for (let number = from; number <= until; number += 1) {
      picked.add(number - 1);
    }
  }

  return [...picked].sort((left, right) => left - right);
};
