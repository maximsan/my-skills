// @ts-check
// The functions that decide things. They take plain data and return plain data, so no folders are needed.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  NOTES_MARKER,
  commandsFromScripts,
  importTargets,
  insertImportLines,
  leftoverPlaceholders,
  missingImportLines,
  renderNotes,
} from "../lib/app-notes.mjs";
import { parseArguments } from "../lib/arguments.mjs";
import { describeImportAnswers, hasUnknownAnswers, readImportAnswers } from "../lib/claude-approvals.mjs";
import { UsageError } from "../lib/errors.mjs";
import { EXCLUDE_COMMENT, missingExcludeLines, withExcludeLines } from "../lib/exclude-lines.mjs";
import { notIgnoredPaths, parseCheckIgnoreLine } from "../lib/git.mjs";
import { homePath, isInsideFolder } from "../lib/layout.mjs";
import { hasLine } from "../lib/machine-setup.mjs";
import { describeProgress, MENU_EXTRAS, menuItems, suggestedIndex } from "../lib/menu.mjs";
import { openPick, parseNumbers, pickedIndexes, pressKey, renderPick, renderTypedList } from "../lib/picker.mjs";
import { wrapText } from "../lib/text.mjs";
import { detectStacks, labelFromHeading } from "../lib/stacks.mjs";
import { DEFAULT_SIZE, renderRecapCounts } from "../lib/ui.mjs";
import { COMMANDS } from "../commands/index.mjs";

/**
 * App facts for a plain app called web-shop, with some of them changed.
 * @param {Partial<import("../lib/apps.mjs").AppFacts>} overrides the facts that differ
 * @returns {import("../lib/apps.mjs").AppFacts} the full set of facts
 */
const facts = (overrides) => ({
  name: "web-shop",
  directory: "/projects/web-shop",
  rootFileNames: [],
  dependencyNames: [],
  scripts: {},
  webpackConfigs: [],
  projectClaudeMdText: null,
  projectInstructionFiles: [],
  hasAgentsFile: false,
  notesText: null,
  ...overrides,
});

const STACKS = ["microfrontend", "react", "typescript"].map((name) => ({
  name,
  label: name,
  file: `/rules/${name}.md`,
}));
const detectedNames = (/** @type {import("../lib/apps.mjs").AppFacts} */ appFacts) =>
  detectStacks(STACKS, appFacts)
    .filter((stack) => stack.reason)
    .map((stack) => stack.name);

describe("stack detection", () => {
  test("a React + TypeScript app gets both, with the reason for each", () => {
    const appFacts = facts({ dependencyNames: ["react", "typescript"] });

    assert.deepEqual(detectedNames(appFacts), ["react", "typescript"]);
    assert.equal(detectStacks(STACKS, appFacts)[1].reason, "react in package.json");
  });

  test("tsconfig.json alone means TypeScript", () => {
    assert.deepEqual(detectedNames(facts({ rootFileNames: ["tsconfig.json"] })), ["typescript"]);
  });

  test("webpack's built-in ModuleFederationPlugin means microfrontend, with no extra package", () => {
    const webpackConfigs = [{ name: "webpack.config.js", text: "new ModuleFederationPlugin({ name: 'shell' })" }];

    assert.deepEqual(detectedNames(facts({ webpackConfigs })), ["microfrontend"]);
  });

  test("a plain Java app gets nothing", () => {
    assert.deepEqual(detectedNames(facts({ rootFileNames: ["pom.xml"] })), []);
  });

  test("a stack file with no detector is offered, unticked", () => {
    const withUnknown = [...STACKS, { name: "java", label: "Java", file: "/rules/java.md" }];

    assert.equal(detectStacks(withUnknown, facts({})).find((stack) => stack.name === "java")?.reason, null);
  });

  test("the label comes from the file's heading", () => {
    assert.equal(labelFromHeading("<!-- x -->\n\n# TypeScript conventions\n", "typescript"), "TypeScript");
  });
});

describe("app notes", () => {
  const template = [
    NOTES_MARKER,
    "# <Project name>",
    "## Rules for this app",
    "",
    "<stack rules>",
    "",
    "## Commands",
    "",
    "```",
    "<build>",
    "<run one test>       the command that saves the most time",
    "<lint>               e.g. npx eslint .",
    "```",
    "- <folder> — <what's in it>",
    "",
  ].join("\n");

  test("fills the name, the rules and the commands it can, and leaves the rest for you", () => {
    const commands = commandsFromScripts({ build: "vite build", lint: "eslint ." }, "npm");
    const notes = renderNotes(template, {
      projectName: "web-shop",
      importLines: ["@/rules/react.md"],
      commands,
      commandsLiveInProjectFile: false,
    });

    assert.match(notes, /^# web-shop$/m);
    assert.match(notes, /^@\/rules\/react\.md$/m);
    assert.match(notes, /^npm run build$/m);
    assert.match(notes, /^npm run lint$/m, "the e.g. hint goes with the placeholder");
    assert.deepEqual(leftoverPlaceholders(notes, template), ["<run one test>", "<folder>", "<what's in it>"]);
  });

  test("points at the project's CLAUDE.md when it already lists commands", () => {
    const notes = renderNotes(template, {
      projectName: "x",
      importLines: [],
      commands: new Map(),
      commandsLiveInProjectFile: true,
    });

    assert.match(notes, /See the project's own `CLAUDE.md`\./);
    assert.doesNotMatch(notes, /<build>/);
  });

  test("uses the app's package manager", () => {
    assert.equal(commandsFromScripts({ test: "vitest" }, "pnpm").get("<run all tests>"), "pnpm test");
  });

  test("adds only missing rule lines, under the rules heading, and keeps CRLF line endings", () => {
    const existing = `${NOTES_MARKER}\r\n## Rules for this app\r\n\r\n@/rules/react.md\r\n\r\nMy own notes.\r\n`;
    const missing = missingImportLines(existing, ["@/rules/react.md", "@/rules/typescript.md"], "linux");

    assert.deepEqual(missing, ["@/rules/typescript.md"]);

    const updated = insertImportLines(existing, missing);

    assert.ok(updated.includes("@/rules/typescript.md\r\n@/rules/react.md\r\n"));
    assert.ok(updated.includes("My own notes."));
    assert.doesNotMatch(updated.replace(/\r\n/g, ""), /\n/, "no bare LF was introduced");
  });

  test("a path holding $& or $` goes under the rules heading exactly as written", () => {
    const line = "@/Users/a$&b/projects/prompts/rules/react.md";
    const updated = insertImportLines(`${NOTES_MARKER}\n## Rules for this app\n\n## Commands\n`, [line]);

    assert.equal(updated, `${NOTES_MARKER}\n## Rules for this app\n\n${line}\n## Commands\n`);
  });

  test("a notes file someone else wrote gets our marker and the lines at the top, and keeps everything else", () => {
    const updated = insertImportLines("My notes.\n", ["@/rules/react.md"]);

    assert.equal(updated, `${NOTES_MARKER}\n@/rules/react.md\n\nMy notes.\n`);
  });

  test("imports inside code fences don't count, as Claude skips them", () => {
    assert.deepEqual(importTargets("@a.md\n```\n@b.md\n```\n  @c.md\n"), ["a.md", "c.md"]);
  });

  test("an import path is read to the end of its line, so a space doesn't cut it short", () => {
    assert.deepEqual(importTargets("@C:/Users/Jo Smith/projects/prompts/rules/common.md  \n"), [
      "C:/Users/Jo Smith/projects/prompts/rules/common.md",
    ]);
  });

  test("a project name with $ in it goes into the notes as it is", () => {
    const notes = renderNotes(template, {
      projectName: "shop-$&-$1",
      importLines: [],
      commands: new Map(),
      commandsLiveInProjectFile: false,
    });

    assert.match(notes, /^# shop-\$&-\$1$/m);
  });

  test("on Windows, a rule line that differs only in case is already there, and isn't added twice", () => {
    const existing = `${NOTES_MARKER}\n@c:/users/me/projects/prompts/rules/react.md\n`;
    const line = "@C:/Users/me/projects/prompts/rules/react.md";

    assert.deepEqual(missingImportLines(existing, [line], "win32"), []);
    assert.deepEqual(missingImportLines(existing, [line], "linux"), [line]);
    assert.equal(hasLine(existing, line, "win32"), true);
    assert.equal(hasLine(existing, line, "linux"), false);
  });
});

describe("Claude Code's import question", () => {
  const FOLDERS = [
    { name: "one-app", path: "C:\\Users\\me\\projects\\one-app" },
    { name: "web-shop", path: "C:\\Users\\me\\projects\\one-app\\web-shop" },
    { name: "admin", path: "C:\\Users\\me\\projects\\one-app\\admin" },
  ];

  /**
   * Claude Code's state file with these entries under "projects".
   * @param {Record<string, unknown>} projects the entries, by folder path
   * @returns {string} the file's text
   */
  const stateFile = (projects) => JSON.stringify({ numStartups: 3, projects });

  const readFrom = (/** @type {Record<string, unknown>} */ projects) =>
    readImportAnswers(stateFile(projects), FOLDERS, "win32");

  const answered = (/** @type {boolean} */ approved, /** @type {boolean} */ shown) => ({
    hasClaudeMdExternalIncludesApproved: approved,
    hasClaudeMdExternalIncludesWarningShown: shown,
  });

  test("Yes, No and never asked are read from each folder's entry, whatever its slashes and case", () => {
    const text = stateFile({
      "c:/users/me/projects/one-app/web-shop": answered(true, true),
      "C:/Users/me/projects/one-app/admin/": answered(false, true),
    });

    assert.deepEqual(readImportAnswers(text, FOLDERS, "win32"), {
      kind: "read",
      answers: [
        { name: "one-app", answer: "not-asked" },
        { name: "web-shop", answer: "yes" },
        { name: "admin", answer: "no" },
      ],
    });
  });

  test("a No blocks, names the folder, and says how to get the question back", () => {
    const answers = readFrom({ "C:/Users/me/projects/one-app/admin": answered(false, true) });
    const result = describeImportAnswers(answers, "~/.claude.json");

    assert.equal(result.status, "blocked");
    assert.match(result.reason ?? "", /you chose No in admin/);
    assert.match(result.fix ?? "", /set "hasClaudeMdExternalIncludesApproved" and .* to false/);
  });

  test("folders never asked are normal, and only counted", () => {
    const answers = readFrom({ "C:/Users/me/projects/one-app/web-shop": answered(true, true) });

    assert.deepEqual(describeImportAnswers(answers, "~/.claude.json"), {
      status: "done",
      reason: "allowed in 1 folder; not asked in 2 folders",
    });
  });

  test("a missing or unexpected file means can't tell, never a failure", () => {
    for (const text of [null, "not json", JSON.stringify({ other: {} })]) {
      const answers = readImportAnswers(text, FOLDERS, "win32");

      assert.equal(describeImportAnswers(answers, "~/.claude.json").status, "skipped", String(text));
      assert.equal(hasUnknownAnswers(answers), true);
    }

    const odd = readFrom({ "C:/Users/me/projects/one-app": { other: 1 } });

    assert.equal(describeImportAnswers(odd, "~/.claude.json").status, "skipped");
    assert.equal(hasUnknownAnswers(odd), true);
  });
});

describe("paths", () => {
  test("on Windows, 'inside the projects folder' ignores case", () => {
    assert.equal(isInsideFolder("C:\\Users\\me\\projects", "c:\\users\\ME\\projects\\web-shop", "win32"), true);
    assert.equal(isInsideFolder("/home/me/projects", "/home/me/Projects/web-shop", "linux"), false);
    assert.equal(isInsideFolder("/home/me/projects", "/home/me/projects-old/web-shop", "linux"), false);
  });

  test("a location in a message is shown from the home folder, and stays whole outside it", () => {
    assert.equal(homePath("/home/me/projects/web-shop", "/home/me"), "~/projects/web-shop");
    assert.equal(homePath("/home/me", "/home/me"), "~");
    assert.equal(homePath("/srv/projects", "/home/me"), "/srv/projects");
  });
});

describe("git's answers", () => {
  test("a check-ignore source with a Windows drive colon is read whole", () => {
    const match = parseCheckIgnoreLine("C:/Users/me/web-shop/.git/info/exclude:3:CLAUDE.local.md\tCLAUDE.local.md");

    assert.deepEqual(match, {
      path: "CLAUDE.local.md",
      isIgnored: true,
      source: "C:/Users/me/web-shop/.git/info/exclude:3",
      pattern: "CLAUDE.local.md",
    });
  });

  test("a '!' rule un-ignores, and '::' means nothing matched", () => {
    assert.equal(parseCheckIgnoreLine(".gitignore:1:!CLAUDE.local.md\tCLAUDE.local.md").isIgnored, false);
    assert.equal(parseCheckIgnoreLine("::\tdocs/ai/").isIgnored, false);
  });

  test("a path missing from git's answer counts as not ignored", () => {
    const matches = [parseCheckIgnoreLine(".git/info/exclude:1:CLAUDE.local.md\tCLAUDE.local.md")];
    const problems = notIgnoredPaths(["CLAUDE.local.md", "docs/ai/"], matches);

    assert.deepEqual(
      problems.map((match) => match.path),
      ["docs/ai/"],
    );
  });
});

describe("exclude lines", () => {
  test("adds only what's missing, under the comment, and keeps existing lines", () => {
    const existing = "# git's own comment\n*.log\ndocs/ai/\n";
    const wanted = ["CLAUDE.local.md", "docs/ai/", "investigations/"];
    const missing = missingExcludeLines(existing, wanted);

    assert.deepEqual(missing, ["CLAUDE.local.md", "investigations/"]);

    const updated = withExcludeLines(existing, missing);

    assert.ok(updated.startsWith(existing));
    assert.ok(updated.endsWith(`\n${EXCLUDE_COMMENT}\nCLAUDE.local.md\ninvestigations/\n`));
    assert.deepEqual(missingExcludeLines(updated, wanted), []);
  });

  test("a file with an older wording of our comment doesn't get a second one", () => {
    const older
      = "# added by claude-rules: keeps your personal Claude notes out of commits. "
        + "Like .gitignore, but only for this clone. See prompts/v2/SETUP.md\nCLAUDE.local.md\n";

    assert.equal(withExcludeLines(older, ["investigations/"]), `${older}investigations/\n`);
  });

  test("a file with no trailing newline still gets clean lines", () => {
    assert.equal(withExcludeLines("*.log", ["CLAUDE.local.md"]), `*.log\n\n${EXCLUDE_COMMENT}\nCLAUDE.local.md\n`);
  });
});

describe("the command line", () => {
  test("a typo in a flag is an error, never ignored", () => {
    assert.throws(() => parseArguments(["setup", "--dry-rn"], COMMANDS), UsageError);
  });

  test("a flag a command doesn't take is an error", () => {
    assert.throws(() => parseArguments(["doctor", "--yes"], COMMANDS), /doesn't apply to doctor/);
  });

  test("--yes with no command is an error, since the menu can't answer for you", () => {
    assert.throws(() => parseArguments(["--yes"], COMMANDS), /needs a command/);
  });

  test("a command without a usage takes no arguments", () => {
    assert.throws(() => parseArguments(["doctor", "extra"], COMMANDS), /doctor takes no arguments/);
    assert.throws(() => parseArguments(["setup", "web-shop"], COMMANDS), /setup takes no arguments/);
  });

  test("add-app takes the app as an argument", () => {
    const parsed = parseArguments(["add-app", "web-shop", "--dry-run"], COMMANDS);

    assert.equal(parsed.commandName, "add-app");
    assert.deepEqual(parsed.args, ["web-shop"]);
    assert.equal(parsed.options.dryRun, true);
  });
});

describe("the menu", () => {
  test("the default is always the obvious next command", () => {
    assert.equal(describeProgress({ isSetUp: false, appCount: 3, addedAppCount: 0 }).nextCommand, "setup");
    assert.equal(describeProgress({ isSetUp: true, appCount: 3, addedAppCount: 0 }).nextCommand, "add-app");
    assert.equal(describeProgress({ isSetUp: true, appCount: 3, addedAppCount: 1 }).nextCommand, "new-task");
  });

  test("the menu's order comes from COMMANDS alone, and the suggestion follows the command wherever it sits", () => {
    const reordered = [...COMMANDS].reverse();
    const items = menuItems(reordered);
    const suggested = suggestedIndex(reordered, { isSetUp: false, appCount: 0, addedAppCount: 0 });

    assert.deepEqual(
      items.map((item) => item.label),
      [...reordered.map((command) => command.title), MENU_EXTRAS.help.label, MENU_EXTRAS.quit.label],
    );
    assert.equal(reordered[suggested].name, "setup");

    const plain = (/** @type {string} */ _style, /** @type {string} */ text) => text;
    const view = { ...DEFAULT_SIZE, mode: /** @type {const} */ ("one"), paint: plain };

    const numbers = reordered.map((_command, index) => String(index + 1));

    assert.deepEqual(renderTypedList("", items, [], view).keys, [...numbers, "h", "q"]);
  });
});

describe("the pick list", () => {
  const ITEMS = [{ label: "web" }, { label: "shop", hint: "react in package.json" }, { label: "admin" }];
  const VIEW = { ...DEFAULT_SIZE, paint: (/** @type {string} */ _style, /** @type {string} */ text) => text };

  /**
   * Presses keys one after another, from a list's opening state.
   * @param {import("../lib/picker.mjs").PickMode} mode whether the list picks one item or several
   * @param {import("../lib/picker.mjs").Key[]} keys the key presses, in order
   * @param {{ cursor?: number, selected?: number[] }} [start] where the list opens
   * @returns {import("../lib/picker.mjs").PickState} the list after the last key
   */
  const press = (mode, keys, start = {}) =>
    keys.reduce((state, key) => pressKey(state, key, ITEMS.length, mode), openPick(start));

  test("Up and Down wrap around the ends", () => {
    assert.equal(press("one", [{ name: "up" }]).cursor, 2);
    assert.equal(press("one", [{ name: "down" }], { cursor: 2 }).cursor, 0);
  });

  test("picking one: Enter takes the highlighted item, and Space and a do nothing", () => {
    const state = press("one", [{ name: "space" }, { name: "a" }, { name: "down" }, { name: "return" }]);

    assert.equal(state.done, "accept");
    assert.deepEqual(pickedIndexes(state), [1]);
  });

  test("picking several: Space marks and unmarks, a marks all then none, and Enter may accept none", () => {
    const marked = press("many", [{ name: "space" }, { name: "down" }, { name: "down" }, { name: "space" }]);

    assert.deepEqual(pickedIndexes(marked), [0, 2]);
    assert.deepEqual(pickedIndexes(press("many", [{ name: "a" }])), [0, 1, 2]);
    assert.deepEqual(pickedIndexes(press("many", [{ name: "a" }, { name: "a" }])), []);

    const none = press("many", [{ name: "space" }, { name: "return" }], { selected: [0] });

    assert.equal(none.done, "accept");
    assert.deepEqual(pickedIndexes(none), []);
  });

  test("Esc, Ctrl+C and Ctrl+D cancel", () => {
    for (const key of [{ name: "escape" }, { name: "c", ctrl: true }, { name: "d", ctrl: true }]) {
      assert.equal(press("many", [key]).done, "cancel", JSON.stringify(key));
    }
  });

  test("the list shows marks, and the highlighted item's hint beside it, after the longest label", () => {
    const lines = renderPick(openPick({ cursor: 1, selected: [1] }), "Stack rules:", ITEMS, { ...VIEW, mode: "many" });

    assert.deepEqual(lines.slice(2), [
      "  [ ] web",
      "> [x] shop    react in package.json",
      "  [ ] admin",
      "  1 of 3 marked",
    ]);
  });

  test("a long hint wraps onto the lines below its item, in the same column", () => {
    const items = [{ label: "Help", hint: "word ".repeat(20).trim() }, { label: "Quit" }];
    const lines = renderPick(openPick({ cursor: 0 }), "What next?", items, { ...VIEW, mode: "one", columns: 40 });
    const column = "> Help   ".length;

    assert.ok(lines[2].startsWith("> Help   word"), lines.join("\n"));
    assert.ok(lines[3].startsWith(`${" ".repeat(column)}word`), lines.join("\n"));
    assert.ok(lines.every((line) => line.length < 40), lines.join("\n"));
    assert.ok(lines.includes("  Quit"), lines.join("\n"));
  });

  test("in a terminal too narrow for the hint beside its item, the hint goes under the list", () => {
    const items = [{ label: "Check everything works", hint: "Changes nothing." }, { label: "Quit" }];
    const lines = renderPick(openPick({ cursor: 0 }), "What next?", items, { ...VIEW, mode: "one", columns: 40 });

    assert.equal(lines[2], "> Check everything works");
    assert.equal(lines.at(-1), "    Changes nothing.");
  });

  test("the keys, the highlighted line and the hint each get a colour, and the green mark keeps the highlight", () => {
    const tag = (/** @type {string} */ style, /** @type {string} */ text) => `<${style}>${text}</>`;
    const lines = renderPick(openPick({ cursor: 1, selected: [1] }), "Stack rules:", ITEMS, {
      ...VIEW,
      mode: "many",
      paint: tag,
    });

    assert.match(lines[1], /^ {2}<cyan>Up\/Down<\/> move {2}<cyan>Space<\/> mark/);
    assert.equal(lines[3], "<highlight>> </><green>[x] </><highlight>shop</>    <hint>react in package.json</>");
    assert.equal(lines[2], "  [ ] web", "other lines stay plain");
  });

  test("in a short, narrow terminal, only the items around the highlight show and no line wraps", () => {
    const many = Array.from({ length: 20 }, (_item, index) => ({ label: `app-${index + 1}-${"x".repeat(50)}` }));
    const lines = renderPick(openPick({ cursor: 10 }), "Which app?", many, {
      ...VIEW,
      mode: "one",
      rows: 8,
      columns: 30,
    });

    assert.ok(lines.every((line) => line.length < 30), lines.join("\n"));
    assert.ok(lines.some((line) => line.startsWith("> app-11-")), lines.join("\n"));
    assert.ok(lines.includes("  9-12 of 20 shown"), lines.join("\n"));
    assert.equal(lines[1], "  Up/Down move  Enter choose", "a key that doesn't fit is left out whole");
  });

  test("the list never fills the last row, however short the terminal, so its redraw doesn't scroll", () => {
    const many = Array.from({ length: 30 }, (_item, index) => ({ label: `app-${index + 1}`, hint: "x ".repeat(100) }));

    for (const rows of [24, 8, 5]) {
      const lines = renderPick(openPick({ cursor: 15 }), "Which app?", many, { ...VIEW, mode: "one", rows });

      assert.ok(lines.length <= rows - 1, `${lines.length} lines in ${rows} rows`);
      assert.ok(lines.some((line) => line.startsWith("> app-16")), `${rows} rows: the highlighted item shows`);
    }
  });

  test("a typed list wraps each hint in its own column, so no line runs past the terminal", () => {
    const items = [{ label: "Set up", hint: "word ".repeat(30).trim() }, { label: "Quit" }];
    const { lines } = renderTypedList("What next?", items, [], { ...VIEW, mode: "one", columns: 60 });
    const column = "  1  Set up   ".length;

    assert.ok(lines[1].startsWith("  1  Set up   word"), lines.join("\n"));
    assert.ok(lines[2].startsWith(`${" ".repeat(column)}word`), lines.join("\n"));
    assert.ok(lines.every((line) => line.length < 60), lines.join("\n"));
    assert.ok(lines.includes("  2  Quit"), lines.join("\n"));
  });

  test("typed numbers take single numbers and ranges, and refuse anything outside the list", () => {
    assert.deepEqual(parseNumbers("3, 1-2", 3), [0, 1, 2]);
    assert.deepEqual(parseNumbers("", 3), []);
    assert.equal(parseNumbers("4", 3), null);
    assert.equal(parseNumbers("2-1", 3), null);
    assert.equal(parseNumbers("web", 3), null);
  });
});

describe("text and recap", () => {
  test("the recap counts each outcome on its own, and always says how many failed", () => {
    /** @type {import("../lib/ui.mjs").ReportRow[]} */
    const rows = [
      { tone: "ok", title: "a", label: "done" },
      { tone: "skip", title: "b", label: "skipped" },
      { tone: "skip", title: "c", label: "stopped" },
      { tone: "skip", title: "d", label: "not run" },
      { tone: "skip", title: "e", label: "not run" },
      { tone: "fail", title: "f", label: "can't do" },
    ];

    assert.equal(renderRecapCounts(rows), "1 done, 1 skipped, 1 can't do, 1 stopped, 2 not run, 0 failed");
  });

  test("a run that did everything it planned just says so", () => {
    const done = (/** @type {string} */ title) => ({ tone: /** @type {const} */ ("ok"), title, label: "done" });

    const alreadyDone = { tone: /** @type {const} */ ("info"), title: "c", label: "already done" };

    assert.equal(renderRecapCounts([done("a"), done("b"), alreadyDone]), "All 2 done");
    assert.equal(renderRecapCounts([done("a")]), "Done");
  });

  test("long summaries wrap at spaces", () => {
    assert.deepEqual(wrapText("one two three four", 9), ["one two", "three", "four"]);
  });
});
