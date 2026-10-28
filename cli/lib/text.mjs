// @ts-check
// Small text helpers shared by the menu, --help and the commands' messages. All pure.

/**
 * Breaks text into lines no longer than `width`, at spaces.
 * @param {string} text the text to break
 * @param {number} width the longest a line may be, in characters; a single longer word gets a line of its own
 * @returns {string[]} the lines, in order
 */
export const wrapText = (text, width) => {
  const lines = [];
  let current = "";

  for (const word of text.split(" ")) {
    if (current && `${current} ${word}`.length > width) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
};

/**
 * "1 item", "2 items".
 * @param {number} count how many there are
 * @param {string} noun the singular word, e.g. "item"
 * @returns {string} the count and the noun, with an s unless the count is 1
 */
export const plural = (count, noun) => `${count} ${noun}${count === 1 ? "" : "s"}`;

/**
 * Whether two lines say the same thing. On Windows they may hold paths, and paths there match whatever their case.
 * @param {string} first one line
 * @param {string} second the line to compare it with
 * @param {NodeJS.Platform} platform the operating system, which decides whether case matters
 * @returns {boolean} whether the lines match
 */
export const isSameLine = (first, second, platform) =>
  platform === "win32" ? first.toLowerCase() === second.toLowerCase() : first === second;

/**
 * The widest a line may be in a terminal that is `columns` wide. The last column stays free: writing into it wraps the
 * line in some terminals, and a redraw in place then leaves part of the old line behind.
 * @param {number} columns the terminal's width
 * @returns {number} the most characters a line may hold
 */
export const usableWidth = (columns) => columns - 1;
