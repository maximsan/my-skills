// @ts-check
// The bug-fix reminder's entry in your personal Claude Code settings, ~/.claude/settings.json. `setup` adds it and
// `doctor` checks it, with the same functions. All functions here are pure.
//
// The file is yours: Claude Code and you both write to it. So only our one entry is ever added or updated, everything
// else stays as it is, and a file that isn't valid JSON is left alone.

import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { displayPath } from "./layout.mjs";

/** The hook event the reminder runs on: each message the user sends. */
const HOOK_EVENT = "UserPromptSubmit";

/** How our entry is told apart from the user's own hooks: the script's file name in its command. */
const REMINDER_SCRIPT_NAME = "bug-fix-reminder.mjs";

/** The characters a shell still reads inside double quotes, so they are escaped with a backslash. */
const SHELL_SPECIAL = /["$`\\]/g;

/** Seconds Claude Code waits for the hook. After that, the message goes through without the reminder. */
const TIMEOUT_SECONDS = 5;

const INDENT = 2;
const LINE_FEED = /\n/g;

/** The byte-order mark Windows PowerShell 5.1 puts at the start of a UTF-8 file. JSON.parse refuses it. */
const BOM = "\uFEFF";
const LEADING_BOM = /^\uFEFF/;

/**
 * Where your personal Claude Code settings live.
 * @param {string} homeDirectory your home folder
 * @returns {string} e.g. C:\Users\me\.claude\settings.json
 */
export const claudeSettingsFile = (homeDirectory) => join(homeDirectory, ".claude", "settings.json");

/**
 * The hook entry `setup` writes. The command is one line for the shell, with the path in double quotes. It isn't
 * `command: "node"` with the path in `args`: Claude Code 2.1.39, used on managed Windows, doesn't know `args`, and
 * drops it when it rewrites the file, which leaves a bare `node` that fails on every message.
 * @param {import("./layout.mjs").Layout} layout where this repo's copy of the script is
 * @returns {{ type: string, command: string, timeout: number }} the entry
 */
export const reminderHook = (layout) => ({
  type: "command",
  command: `node "${displayPath(layout.bugFixReminderScript).replace(SHELL_SPECIAL, "\\$&")}"`,
  timeout: TIMEOUT_SECONDS,
});

/**
 * What the settings file holds about the reminder.
 * @typedef {{ kind: "missing" } | { kind: "unreadable", reason: string } | { kind: "absent" }
 *   | { kind: "outdated" } | { kind: "duplicated" } | { kind: "present" }} ReminderState
 *   missing: no settings file. unreadable: not JSON, or not shaped as Claude Code's settings. absent: no reminder
 *   entry. outdated: the entry differs from what setup writes today in setup's own fields, e.g. after the repo moved.
 *   duplicated: more than one entry, so Claude would get the reminder more than once.
 */

/**
 * One hook entry, as the user or Claude Code wrote it. Its command tells ours apart; on ours, setup owns `type`,
 * `command`, `timeout` and the old `args`, and any other field is the user's.
 * @typedef {Record<string, unknown>} HookEntry
 */

/**
 * A group of hook entries under one event, as Claude Code's settings hold them.
 * @typedef {{ hooks: HookEntry[] } & Record<string, unknown>} HookGroup
 */

/**
 * The settings, once checked to have the shape the reminder is added to.
 * @typedef {{ hooks?: Record<string, HookGroup[]> } & Record<string, unknown>} Settings
 */

/**
 * Whether a value is a plain JSON object, rather than an array, null or a primitive.
 * @param {unknown} value a parsed JSON value
 * @returns {value is Record<string, unknown>} true for an object
 */
const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Whether a value is a list of hook groups, each with its own list of entries.
 * @param {unknown} value the settings' `hooks.UserPromptSubmit`
 * @returns {value is HookGroup[]} true when every group has a `hooks` list, and every entry in it is an object
 */
const isGroupList = (value) =>
  Array.isArray(value)
  && value.every((group) => isObject(group) && Array.isArray(group.hooks) && group.hooks.every(isObject));

/**
 * The parsed settings, or why they can't be changed safely.
 * @param {string} text the settings file's text
 * @returns {{ settings: Settings } | { reason: string }} the settings, or the reason
 */
const parseSettings = (text) => {
  /** @type {unknown} */
  let parsed;

  try {
    parsed = JSON.parse(text.replace(LEADING_BOM, ""));
  } catch {
    return { reason: "it isn't valid JSON" };
  }

  if (!isObject(parsed)) {
    return { reason: "it isn't a JSON object" };
  }

  if (parsed.hooks !== undefined && !isObject(parsed.hooks)) {
    return { reason: "its \"hooks\" isn't an object" };
  }

  const groups = parsed.hooks?.[HOOK_EVENT];

  if (groups !== undefined && !isGroupList(groups)) {
    return { reason: `its "hooks.${HOOK_EVENT}" isn't a list of hook groups` };
  }

  return { settings: /** @type {Settings} */ (parsed) };
};

/**
 * Whether an entry is the reminder's, in any form setup has written:
 * - today's: the script's name in the command;
 * - the old one: the script's name in `args`;
 * - the old one after Claude Code 2.1.39 dropped `args`: a bare `node`. It can only fail, since node then reads the
 *   message as code, so taking it over loses nothing.
 * @param {HookEntry} entry one hook entry
 * @returns {boolean} true for the reminder's entry
 */
const isReminderEntry = (entry) =>
  (typeof entry.command === "string" && entry.command.includes(REMINDER_SCRIPT_NAME))
  || (Array.isArray(entry.args) && entry.args.some((arg) => String(arg).endsWith(REMINDER_SCRIPT_NAME)))
  || (entry.command === "node" && entry.args === undefined);

/**
 * Our entries in the settings: normally none or one, more after a copy by hand or a bare `node` left beside a new one.
 * @param {Settings} settings the parsed settings
 * @returns {HookEntry[]} every entry that is the reminder's
 */
const findReminderEntries = (settings) =>
  (settings.hooks?.[HOOK_EVENT] ?? []).flatMap((group) => group.hooks).filter(isReminderEntry);

/**
 * Whether an entry holds what setup writes today, in the fields setup owns. Any other field is the user's.
 * @param {HookEntry} entry one of our entries
 * @param {import("./layout.mjs").Layout} layout where this repo's copy of the script is
 * @returns {boolean} true when type, command and timeout all match, and the old `args` is gone
 */
const isUpToDate = (entry, layout) =>
  !("args" in entry)
  && Object.entries(reminderHook(layout)).every(([key, value]) => isDeepStrictEqual(entry[key], value));

/**
 * What the settings file holds about the reminder.
 * @param {string | null} text the settings file's text, or null when there is no file
 * @param {import("./layout.mjs").Layout} layout where this repo's copy of the script is
 * @returns {ReminderState} the state, for describeReminder and for setup's apply
 */
export const readReminderState = (text, layout) => {
  if (text === null) {
    return { kind: "missing" };
  }

  const parsed = parseSettings(text);

  if ("reason" in parsed) {
    return { kind: "unreadable", reason: parsed.reason };
  }

  const entries = findReminderEntries(parsed.settings);

  if (entries.length === 0) {
    return { kind: "absent" };
  }

  if (entries.length > 1) {
    return { kind: "duplicated" };
  }

  return isUpToDate(entries[0], layout) ? { kind: "present" } : { kind: "outdated" };
};

/**
 * The settings text with the reminder entry added, or brought up to date if an old one is there. Everything else is
 * kept, and so are the file's line endings and a byte-order mark. Call it only on a state that isn't "unreadable".
 * @param {string | null} text the settings file's text, or null when there is no file
 * @param {import("./layout.mjs").Layout} layout where this repo's copy of the script is
 * @returns {string} the new text
 */
export const withReminderHook = (text, layout) => {
  const parsed = parseSettings(text ?? "{}");

  if ("reason" in parsed) {
    throw new Error(`Can't add the reminder: the settings file ${parsed.reason}.`);
  }

  const { settings } = parsed;
  const [kept, ...extra] = findReminderEntries(settings);

  settings.hooks ??= {};
  settings.hooks[HOOK_EVENT] ??= [];

  if (kept) {
    // setup's fields win; any field the user added to the entry stays.
    Object.assign(kept, reminderHook(layout));
    delete kept.args;

    // Extra copies would add the reminder more than once. A group left empty by removing them goes too.
    settings.hooks[HOOK_EVENT] = settings.hooks[HOOK_EVENT].flatMap((group) => {
      if (!group.hooks.some((hook) => extra.includes(hook))) {
        return [group];
      }

      const hooks = group.hooks.filter((hook) => !extra.includes(hook));

      return hooks.length > 0 ? [{ ...group, hooks }] : [];
    });
  } else {
    settings.hooks[HOOK_EVENT].push({ hooks: [reminderHook(layout)] });
  }

  const json = `${JSON.stringify(settings, null, INDENT)}\n`;
  const withLineEndings = text?.includes("\r\n") ? json.replace(LINE_FEED, "\r\n") : json;

  return text?.startsWith(BOM) ? `${BOM}${withLineEndings}` : withLineEndings;
};

/** Where the reminder answers, as setup's plan and doctor's results say it. */
const SCOPE = "runs on each message, in the projects folder and your apps";

/**
 * The reminder's state as a check result, with the same words in setup's plan and doctor's results.
 * @param {ReminderState} state what the settings file holds
 * @param {string} shownPath the settings file, as messages show it
 * @returns {import("./contract.mjs").CheckResult} the result
 */
export const describeReminder = (state, shownPath) => {
  switch (state.kind) {
    case "present":
      return { status: "done", reason: `the reminder ${SCOPE}` };
    case "outdated":
      return { status: "todo", reason: "update the reminder's entry to this copy of the script" };
    case "duplicated":
      return { status: "todo", reason: "keep one reminder entry and remove the copies, so it isn't added twice" };
    case "unreadable":
      return {
        status: "blocked",
        reason: `${state.reason}, so it was left as it is`,
        fix: `Fix ${shownPath}, then run this again.`,
      };
    default:
      return { status: "todo", reason: `add the reminder, which ${SCOPE}` };
  }
};
