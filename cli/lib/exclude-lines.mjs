// @ts-check
// The lines that keep your personal notes out of an app's commits, and how to add them.
//
// They go in the repo's private ignore file (`.git/info/exclude`): the same format as `.gitignore`, but never
// committed and only on your machine. Git's own docs name that file for exactly this, "auxiliary files that live
// inside the repository but are specific to one user's workflow". All functions here are pure.

/**
 * How our comment starts. Matched on its own, so a file written when the comment said something else isn't given a
 * second one.
 */
const EXCLUDE_COMMENT_START = "# added by claude-rules:";

/** Written above our lines, so anyone who opens the file knows what they are and where they came from. */
export const EXCLUDE_COMMENT
  = `${EXCLUDE_COMMENT_START} keeps your personal Claude notes out of commits. `
    + "Like .gitignore, but only for this clone. See prompts/docs/SETUP.md";

/** A line break, on Windows (\r\n) or elsewhere (\n). */
const LINE_BREAK = /\r?\n/;

/**
 * The lines an app needs in its private ignore file that aren't there yet.
 * @param {string} text the exclude file's current text ("" if it doesn't exist)
 * @param {string[]} wantedLines the lines this app needs: one per path add-app creates, minus any folder the team owns
 * @returns {string[]} the wanted lines it doesn't have yet
 */
export const missingExcludeLines = (text, wantedLines) => {
  const present = new Set(text.split(LINE_BREAK).map((line) => line.trim()));

  return wantedLines.filter((line) => !present.has(line));
};

/**
 * Appends the missing lines under our comment. Existing lines are never changed or reordered.
 * @param {string} text the exclude file's current text ("" if it doesn't exist)
 * @param {string[]} missingLines the lines to add, from missingExcludeLines
 * @returns {string} the file's new text
 */
export const withExcludeLines = (text, missingLines) => {
  if (missingLines.length === 0) {
    return text;
  }

  const separator = text === "" || text.endsWith("\n") ? "" : "\n";
  const comment = text.includes(EXCLUDE_COMMENT_START) ? "" : `${text === "" ? "" : "\n"}${EXCLUDE_COMMENT}\n`;

  return `${text}${separator}${comment}${missingLines.join("\n")}\n`;
};
