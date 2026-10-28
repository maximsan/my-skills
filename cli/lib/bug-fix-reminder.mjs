// @ts-check
// The bug-fix reminder: what the hook adds to Claude's context when a message mentions a bug. All functions here are
// pure; cli/hooks/bug-fix-reminder.mjs reads the hook's input and writes the answer.
//
// Claude Code runs the hook on every message, in every folder, because it sits in your personal settings. So the
// reminder scopes itself: it answers only inside the projects folder, and never inside this repo.

import { posix, win32 } from "node:path";
import { isInsideFolder } from "./layout.mjs";

/**
 * The words that mark a bug report, as whole words in any case. "fix" and "error" are left out on purpose: they also
 * come in "fix the typo" and "add error handling", which aren't bugs.
 */
const BUG_WORDS = /\b(?:bugs?|broken|regression|crash(?:es)?|does(?:n['’]t| not) work|not working)\b/i;

/** What Claude is told, in its context. The user doesn't see it in the chat. */
export const REMINDER
  = "This message mentions a bug. Load `failing-test-first` before changing code: write a test that fails on the bug "
    + "and paste its failing output, then fix the code and paste the passing output.";

/** The message doctor sends the installed hook, to see the reminder come back. */
const SAMPLE_BUG_MESSAGE = "The login is broken.";

/**
 * What Claude Code would send the hook for a bug message, for doctor to run the installed hook with.
 * @param {string} cwd a folder the reminder answers in, e.g. the projects folder
 * @returns {string} the hook's input
 */
export const sampleHookInput = (cwd) =>
  JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt: SAMPLE_BUG_MESSAGE, cwd });

/**
 * Whether a hook's output is the reminder, as reminderFor prints it.
 * @param {string} output what the hook printed
 * @returns {boolean} true for the reminder
 */
export const isReminderAnswer = (output) => {
  try {
    return JSON.parse(output)?.hookSpecificOutput?.additionalContext === REMINDER;
  } catch {
    return false;
  }
};

/**
 * Whether a message reads like a bug report.
 * @param {string} prompt the message the user sent
 * @returns {boolean} true when it holds one of the bug words
 */
export const mentionsBug = (prompt) => BUG_WORDS.test(prompt);

/**
 * The hook's answer to one message: the reminder as Claude Code's JSON, or null for no reminder. Anything it can't
 * read gets no reminder, so a surprise in the input never gets in the user's way.
 * @param {string} input what Claude Code sent on stdin: JSON with the message as `prompt` and the folder as `cwd`
 * @param {import("./layout.mjs").Layout} layout where the projects folder and this repo are
 * @param {NodeJS.Platform} platform on Windows, folders match whatever their case
 * @returns {string | null} the JSON to print, or null
 */
export const reminderFor = (input, { projectsDirectory, repoRoot }, platform) => {
  let message;

  try {
    message = JSON.parse(input);
  } catch {
    return null;
  }

  const { prompt, cwd } = message ?? {};

  if (typeof prompt !== "string" || typeof cwd !== "string") {
    return null;
  }

  // Resolved first, with the platform's own rules: on Windows that turns "/" into "\" and collapses "..", so
  // "C:/Users/me/projects/app" is the app, and "…\app\..\prompts" is this repo.
  const { resolve } = platform === "win32" ? win32 : posix;
  const [folder, projects, repo] = [resolve(cwd), resolve(projectsDirectory), resolve(repoRoot)];

  // The projects folder itself counts: Claude is often started there, to reach every app at once.
  const isInScope = isInsideFolder(projects, folder, platform) && !isInsideFolder(repo, folder, platform);

  if (!isInScope || !mentionsBug(prompt)) {
    return null;
  }

  return JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: REMINDER } });
};
