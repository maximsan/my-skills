// @ts-check
// The menu `claude-rules` opens with no command: a pick list of the commands, then Help and Quit, with the suggested
// next command highlighted.

/** @typedef {import("./machine-setup.mjs").SetupProgress} SetupProgress */

/**
 * Where you are, and the command that comes next. It names the command, not its place in the menu.
 * @param {SetupProgress} progress how far this computer has got with setup and add-app
 * @returns {{ status: string, nextCommand: string }} the status line's text, and the name of the command to suggest
 */
export const describeProgress = ({ isSetUp, appCount, addedAppCount }) => {
  if (!isSetUp) {
    return { status: "this computer is not set up yet.", nextCommand: "setup" };
  }

  if (addedAppCount === 0) {
    return { status: "this computer is set up, with no apps added yet.", nextCommand: "add-app" };
  }

  return { status: `set up, with ${addedAppCount} of ${appCount} apps added.`, nextCommand: "new-task" };
};

/** The menu's own entries after the commands, with the letter typed for each where the list falls back to typing. */
export const MENU_EXTRAS = {
  help: { key: "h", label: "Help", hint: "What each command does, and how to run it without the menu." },
  quit: { key: "q", label: "Quit" },
};

/**
 * The menu's items: one per command, then Help and Quit. Where the list is typed, a command's key is its number.
 * @param {import("./contract.mjs").Command[]} commands every command, in menu order
 * @returns {import("./picker.mjs").PickItem[]} the items, in menu order
 */
export const menuItems = (commands) => [
  ...commands.map((command) => ({ label: command.title, hint: command.summary })),
  MENU_EXTRAS.help,
  MENU_EXTRAS.quit,
];

/**
 * The menu's place for the suggested next command. It is found by name, so the order of COMMANDS stays the only thing
 * that decides where each command sits.
 * @param {import("./contract.mjs").Command[]} commands every command, in menu order
 * @param {SetupProgress} progress how far this computer has got with setup and add-app
 * @returns {number} the command's place in the menu, counting from 0
 */
export const suggestedIndex = (commands, progress) => {
  const { nextCommand } = describeProgress(progress);

  return commands.findIndex((command) => command.name === nextCommand);
};

/**
 * The lines above the menu: its name, and where this computer is.
 * @param {SetupProgress} progress how far this computer has got, for the status line
 * @returns {string[]} the lines to print
 */
export const renderMenuStatus = (progress) => [
  "Claude rules & skills — setup",
  `Status: ${describeProgress(progress).status}`,
];
