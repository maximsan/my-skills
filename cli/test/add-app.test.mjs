// @ts-check
// `add-app` end to end, against a throwaway projects folder with fake apps.

import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { addApp } from "../commands/add-app.mjs";
import { setup } from "../commands/setup.mjs";
import { NOTES_MARKER } from "../lib/app-notes.mjs";
import { EXIT_CODES } from "../lib/errors.mjs";
import { EXCLUDE_COMMENT } from "../lib/exclude-lines.mjs";
import { displayPath, toImportLine } from "../lib/layout.mjs";
import { listSkillFolders, removeLinkCommand } from "../lib/skill-links.mjs";
import { runCommand } from "../lib/runner.mjs";
import { makeApp, makeContext, makeSandbox, runGit, snapshotFolder } from "./helpers.mjs";

/** @type {import("./helpers.mjs").Sandbox} */
let sandbox;

beforeEach(() => {
  sandbox = makeSandbox();
});
afterEach(() => sandbox.cleanUp());

const REACT_APP = {
  packageJson: {
    scripts: { build: "vite build", test: "vitest", lint: "eslint ." },
    dependencies: { react: "^18" },
    devDependencies: { typescript: "^5" },
  },

  // Committed, so `git status` shows only what add-app itself leaves behind.
  commit: ["package.json"],
};

const USE_DETECTED = { "Stack rules": true };
const NO_STACKS = { "Stack rules": [] };
const GO_AHEAD = { "Go ahead?": true };

// The usual answers: use the detected rules, go ahead.
const ACCEPT = [USE_DETECTED, GO_AHEAD];

/**
 * The `@` line that loads one stack's rules from the sandbox.
 * @param {string} name the stack's name, e.g. "react"
 * @returns {string} the import line
 */
const stackLine = (name) => toImportLine(join(sandbox.layout.rulesDirectory, `${name}.md`));

/**
 * Runs add-app on one app with scripted answers.
 * @param {string} app the app's folder name
 * @param {import("./helpers.mjs").ScriptedAnswer[]} answers the answers to give, in order
 * @param {Parameters<typeof makeContext>[1]} [overrides] other context settings, e.g. options or cwd
 * @returns {Promise<{ exitCode: number, output: string, questions: string[] }>} the exit code, the printed text, and
 *   the questions asked
 */
const addAppNamed = async (app, answers, overrides = {}) => {
  const { context, ui, scriptedAsk } = makeContext(sandbox, { args: [app], answers, ...overrides });
  const exitCode = await runCommand(addApp, context);

  return { exitCode, output: ui.text(), questions: scriptedAsk.questions };
};

/**
 * What git status says about a folder, in its short form.
 * @param {string} directory the repository's folder
 * @returns {string} one line per changed or untracked file
 */
const gitStatus = (directory) => runGit(["status", "--porcelain"], directory, sandbox.env);

test("a React + TypeScript app gets notes with both rules, its real scripts, and is kept out of git", async () => {
  const directory = makeApp(sandbox, "web-shop", REACT_APP);
  const { exitCode, output } = await addAppNamed("web-shop", ACCEPT);

  assert.equal(exitCode, EXIT_CODES.OK, output);

  const notes = readFileSync(join(directory, "CLAUDE.local.md"), "utf8");

  assert.ok(notes.startsWith(NOTES_MARKER));
  assert.ok(notes.includes(stackLine("react")) && notes.includes(stackLine("typescript")));
  assert.match(notes, /^npm run build$/m);
  assert.match(notes, /^npm test$/m);
  assert.ok(existsSync(join(directory, "docs", "ai")));
  assert.equal(existsSync(join(directory, "investigations")), false, "task folders live in the projects folder");

  const exclude = readFileSync(join(directory, ".git", "info", "exclude"), "utf8");

  assert.ok(exclude.includes(`${EXCLUDE_COMMENT}\nCLAUDE.local.md\ndocs/ai/\n`));
  assert.equal(gitStatus(directory), "");
  assert.match(output, /created, with 3 commands from package\.json/);
  assert.match(
    output,
    /Check git ignores your notes — git ignores all of them\. Check any time: git check-ignore -v CLAUDE\.local\.md/,
  );
  assert.match(output, /Still empty in CLAUDE\.local\.md\. Claude fills these in on its first task in web-shop/);
  assert.match(output, /Next: start a task: claude-rules new-task web-shop\. .*approve imports .*: choose Yes\./);
});

test("the project's own files are left byte-for-byte unchanged", async () => {
  const projectFiles = {
    "CLAUDE.md": "# Team rules\n\n## Commands\n\nnpm run everything\n",
    ".claude/rules/testing.md": "Use vitest.\n",
    "AGENTS.md": "For other tools.\n",
  };
  const directory = makeApp(sandbox, "web-shop", {
    ...REACT_APP,
    files: projectFiles,
    commit: ["CLAUDE.md", ".claude"],
  });
  const { output } = await addAppNamed("web-shop", ACCEPT);

  for (const [path, text] of Object.entries(projectFiles)) {
    assert.equal(readFileSync(join(directory, path), "utf8"), text);
  }

  assert.match(output, /Found the project's own CLAUDE\.md, \.claude\/rules\/ \(1 file\) — left as is/);
  assert.match(output, /Found AGENTS\.md — Claude won't read it with this setup/);
  assert.match(readFileSync(join(directory, "CLAUDE.local.md"), "utf8"), /See the project's own `CLAUDE\.md`\./);
});

test("the exclude file gains only the missing lines, keeps its own, and a second run adds none", async () => {
  const directory = makeApp(sandbox, "web-shop", REACT_APP);
  const excludePath = join(directory, ".git", "info", "exclude");
  const original = readFileSync(excludePath, "utf8");

  await addAppNamed("web-shop", ACCEPT);

  const afterFirst = readFileSync(excludePath, "utf8");

  assert.ok(afterFirst.startsWith(original));

  const { output } = await addAppNamed("web-shop", []);

  assert.equal(readFileSync(excludePath, "utf8"), afterFirst);
  assert.match(output, /Nothing to do — everything is already in place\./);
});

test("an added app isn't asked about stacks again, and keeps the rules its notes have", async () => {
  const directory = makeApp(sandbox, "web-shop", REACT_APP);

  await addAppNamed("web-shop", [{ "Stack rules": ["React"] }, GO_AHEAD]);

  const { exitCode, output, questions } = await addAppNamed("web-shop", []);
  const notes = readFileSync(join(directory, "CLAUDE.local.md"), "utf8");

  assert.equal(exitCode, EXIT_CODES.OK, output);
  assert.deepEqual(questions, []);
  assert.match(output, /Already added, with React stack rules\. To change them, edit its CLAUDE\.local\.md\./);
  assert.ok(!notes.includes(stackLine("typescript")), "the stack left out the first time stays out");
});

test("a project .gitignore that un-ignores the notes makes the check fail, with the reason", async () => {
  makeApp(sandbox, "web-shop", { ...REACT_APP, files: { ".gitignore": "!CLAUDE.local.md\n" } });

  const { exitCode, output } = await addAppNamed("web-shop", ACCEPT);

  assert.equal(exitCode, EXIT_CODES.FAILED);
  assert.match(output, /CLAUDE\.local\.md is un-ignored by \.gitignore:1 \("!CLAUDE\.local\.md"\)/);
  assert.match(output, /Fix: Ask the team to drop that line; this tool never edits tracked files\./);
  assert.match(output, /4 done, 1 failed\./);
  assert.doesNotMatch(output, /Next:|Still to fill in/, "a failed run has no recap extras");
});

test("a worktree writes to the exclude file it shares with the main clone", async () => {
  const main = makeApp(sandbox, "web-shop", { ...REACT_APP, files: { "README.md": "x" }, commit: ["README.md"] });

  runGit(["worktree", "add", "-q", join(sandbox.projectsDirectory, "web-shop-feature")], main, sandbox.env);

  // The worktree only has the committed README, so no stacks are detected.
  const { exitCode, output } = await addAppNamed("web-shop-feature", [NO_STACKS, GO_AHEAD]);

  assert.equal(exitCode, EXIT_CODES.OK, output);
  assert.ok(readFileSync(join(main, ".git", "info", "exclude"), "utf8").includes(EXCLUDE_COMMENT));
});

test("a folder that isn't a git repo skips the git steps, with the reason", async () => {
  makeApp(sandbox, "sketches", { isRepository: false });

  const { exitCode, output } = await addAppNamed("sketches", [NO_STACKS, GO_AHEAD]);

  assert.equal(exitCode, EXIT_CODES.OK, output);
  assert.match(output, /Keep your notes out of git — skipped: not a git repository/);
  assert.match(
    output,
    /Your notes in CLAUDE\.local\.md — created$/m,
    "no package.json, so no commands mentioned",
  );
  assert.match(output, /No stack detected\. Available: Microfrontend, React, TypeScript/);
  assert.match(output, /Skill links in \.claude\/skills\/ — linked \d+ skills/);
});

test("existing notes only gain the missing rule lines, after a backup that git never lists", async () => {
  const directory = makeApp(sandbox, "web-shop", { ...REACT_APP, files: { "CLAUDE.local.md": "My own notes.\n" } });
  const { output } = await addAppNamed("web-shop", ACCEPT);
  const notes = readFileSync(join(directory, "CLAUDE.local.md"), "utf8");

  assert.equal(notes, `${NOTES_MARKER}\n${stackLine("react")}\n${stackLine("typescript")}\n\nMy own notes.\n`);
  assert.match(output, /add 2 rule lines at the top; a copy goes to \.git\/claude-rules-backups\/ first/);

  const backupFolder = join(directory, ".git", "claude-rules-backups");
  const [backup] = readdirSync(backupFolder);

  assert.match(backup, /^CLAUDE\.local\.md\..+\.bak$/);
  assert.equal(readFileSync(join(backupFolder, backup), "utf8"), "My own notes.\n");
  assert.equal(existsSync(join(directory, "CLAUDE.local.md.bak")), false);
  assert.equal(gitStatus(directory), "", "no backup or temp file shows in git status");
});

test("committed notes belong to the team, so nothing is changed", async () => {
  const directory = makeApp(sandbox, "web-shop", {
    files: { "CLAUDE.local.md": "Team notes.\n" },
    commit: ["CLAUDE.local.md"],
  });
  const before = snapshotFolder(directory);
  const { exitCode, output } = await addAppNamed("web-shop", []);

  assert.equal(exitCode, EXIT_CODES.FAILED);
  assert.match(output, /committed to this repo, so it's the team's file/);
  assert.deepEqual(snapshotFolder(directory), before);
});

test("a committed docs/ai is the team's: left byte-for-byte alone, no Exemplars asked, and not ignored", async () => {
  const teamNotes = "# Team notes\n\nWritten by the team.\n";
  const directory = makeApp(sandbox, "web-shop", {
    ...REACT_APP,
    files: { "docs/ai/NOTES.md": teamNotes },
    commit: ["package.json", "docs/ai/NOTES.md"],
  });
  const { exitCode, output } = await addAppNamed("web-shop", [USE_DETECTED, GO_AHEAD]);

  assert.equal(exitCode, EXIT_CODES.OK, output);
  assert.equal(readFileSync(join(directory, "docs", "ai", "NOTES.md"), "utf8"), teamNotes);
  assert.match(output, /! docs\/ai is committed in this repo, so it's the team's/);
  assert.match(output, /docs\/ai\/ is committed by the team — left alone/);
  assert.doesNotMatch(readFileSync(join(directory, ".git", "info", "exclude"), "utf8"), /^docs\/ai\/$/m);
  assert.equal(gitStatus(directory), "");
});

test("a repository git can't read is reported as a failure, not as 'not a git repository'", async () => {
  const directory = makeApp(sandbox, "web-shop", REACT_APP);

  writeFileSync(join(directory, ".git", "config"), "[core\n\tthis is not config\n");

  const { exitCode, output } = await addAppNamed("web-shop", []);

  assert.equal(exitCode, EXIT_CODES.FAILED, output);
  assert.match(output, /git can't read the repository at .*web-shop/);
  assert.doesNotMatch(output, /isn't a git repository/);
});

test("the rules repo, the projects folder, and a folder inside a repo are refused", async () => {
  const directory = makeApp(sandbox, "web-shop", { ...REACT_APP, files: { "src/index.ts": "" } });

  for (const [argument, message] of [
    [sandbox.repoRoot, /is this rules repo, not an app/],
    [sandbox.projectsDirectory, /is the projects folder itself, not an app/],
    [
      join(directory, "src"),
      /is inside the repo at .*web-shop, not its top folder[\s\S]*Run add-app on the repo's top/,
    ],
  ]) {
    const before = snapshotFolder(sandbox.root);
    const { exitCode, output } = await addAppNamed(String(argument), []);

    assert.equal(exitCode, EXIT_CODES.USAGE, output);
    assert.match(output, /** @type {RegExp} */ (message));
    assert.deepEqual(snapshotFolder(sandbox.root), before);
  }
});

test("before setup has run, add-app says the shared rules won't load; after it, it doesn't", async () => {
  makeApp(sandbox, "web-shop", REACT_APP);

  const before = await addAppNamed("web-shop", [USE_DETECTED], { options: { dryRun: true } });

  assert.match(before.output, /! This computer isn't set up yet, so the shared rules and skills won't load/);

  await runCommand(setup, makeContext(sandbox, { options: { yes: true } }).context);

  const after = await addAppNamed("web-shop", [USE_DETECTED], { options: { dryRun: true } });

  assert.doesNotMatch(after.output, /This computer isn't set up yet/);
});

test("--yes with no app named stops with usage help instead of guessing", async () => {
  makeApp(sandbox, "web-shop");

  const { context, ui } = makeContext(sandbox, { options: { yes: true } });

  assert.equal(await runCommand(addApp, context), EXIT_CODES.USAGE);
  assert.match(ui.text(), /Name it: claude-rules add-app <name> --yes/);
});

test("--yes with an app named uses the detected rules, and applies", async () => {
  const directory = makeApp(sandbox, "web-shop", REACT_APP);
  const { context, ui } = makeContext(sandbox, { args: ["web-shop"], options: { yes: true } });

  assert.equal(await runCommand(addApp, context), EXIT_CODES.OK, ui.text());
  assert.match(ui.text(), /Stack rules: React, TypeScript \(--yes\)/);
  assert.ok(readFileSync(join(directory, "CLAUDE.local.md"), "utf8").includes(stackLine("react")));
});

test("run from inside an app folder, it picks that app with no question", async () => {
  const directory = makeApp(sandbox, "web-shop", REACT_APP);
  const { context, ui } = makeContext(sandbox, { cwd: join(directory, "src"), answers: ACCEPT });

  assert.equal(await runCommand(addApp, context), EXIT_CODES.OK, ui.text());
  assert.ok(existsSync(join(directory, "CLAUDE.local.md")));
});

test("each folder in this repo's skills gets its own link, and git ignores every link", async () => {
  const directory = makeApp(sandbox, "web-shop", REACT_APP);
  const { exitCode, output } = await addAppNamed("web-shop", ACCEPT);
  const skills = listSkillFolders(sandbox.layout, makeContext(sandbox).context.files);

  assert.equal(exitCode, EXIT_CODES.OK, output);
  assert.ok(skills.length > 0);

  for (const name of skills) {
    assert.equal(
      realpathSync(join(directory, ".claude", "skills", name)),
      realpathSync(join(sandbox.layout.skillsSource, name)),
    );
  }

  const skillCount = skills.filter((name) => existsSync(join(sandbox.layout.skillsSource, name, "SKILL.md"))).length;

  assert.match(output, new RegExp(`linked ${skillCount} skills`), "the count setup and doctor show, too");
  assert.equal(gitStatus(directory), "");
});

/**
 * Every Markdown file under a folder, found through the path given, so a link's own path is kept.
 * @param {string} folder the folder to walk
 * @returns {string[]} the files' paths
 */
const markdownFiles = (folder) =>
  readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);

    // statSync follows links: the app's skill folders are links, which a directory entry reports as links.
    if (statSync(path).isDirectory()) {
      return markdownFiles(path);
    }

    return name.endsWith(".md") ? [path] : [];
  });

test("every relative link in the skills reaches its file through the app's links", async () => {
  const directory = makeApp(sandbox, "web-shop", REACT_APP);

  await addAppNamed("web-shop", ACCEPT);

  // Claude Code resolves "../" from the link's path, the way join does, not from the folder the link points at.
  const broken = [];
  let checked = 0;
  const skillsFolder = join(directory, ".claude", "skills");

  for (const file of markdownFiles(skillsFolder)) {
    const text = readFileSync(file, "utf8").replaceAll(/```[\s\S]*?```/g, "");

    for (const [, target] of text.matchAll(/\]\(([^)\s#]+)(?:#[^)]*)?\)/g)) {
      if (/^(?:[a-z]+:|\/|~)/i.test(target)) {
        continue;
      }

      checked += 1;

      if (!existsSync(join(dirname(file), target))) {
        broken.push(`${relative(skillsFolder, file)} → ${target}`);
      }
    }
  }

  assert.ok(checked > 0, "found relative links to check");
  assert.deepEqual(broken, []);
});

test("the app's own skill with the same name as one of ours is left alone, and not ignored", async () => {
  const ownSkill = { ".claude/skills/debug/SKILL.md": "The team's debug skill.\n" };
  const directory = makeApp(sandbox, "web-shop", {
    ...REACT_APP,
    files: ownSkill,
    commit: ["package.json", ".claude"],
  });
  const { exitCode, output } = await addAppNamed("web-shop", ACCEPT);

  assert.equal(exitCode, EXIT_CODES.OK, output);
  assert.equal(
    readFileSync(join(directory, ".claude", "skills", "debug", "SKILL.md"), "utf8"),
    "The team's debug skill.\n",
  );
  assert.match(output, /left alone, as the app's own: debug/);
  assert.doesNotMatch(readFileSync(join(directory, ".git", "info", "exclude"), "utf8"), /^\.claude\/skills\/debug$/m);
});

test("one link for the whole skills folder is blocked, with the command that removes only the link", async () => {
  const directory = makeApp(sandbox, "web-shop", REACT_APP);
  const folderLink = join(directory, ".claude", "skills");

  mkdirSync(join(directory, ".claude"));
  symlinkSync(sandbox.layout.skillsSource, folderLink, "junction");

  const { exitCode, output } = await addAppNamed("web-shop", ACCEPT);

  assert.equal(exitCode, EXIT_CODES.FAILED, output);
  assert.match(output, /\.claude\/skills is one link to .*, but each skill needs its own/);
  assert.ok(
    output.includes(`Remove that link, and only the link: ${removeLinkCommand(folderLink, process.platform)}`),
    output,
  );
  assert.equal(realpathSync(folderLink), realpathSync(sandbox.layout.skillsSource), "the link is never removed");
});

/**
 * Makes the projects folder's skills link, projects/.claude/skills → this repo's skills, as setup does.
 */
const linkProjectsSkills = () => {
  mkdirSync(dirname(sandbox.layout.skillsLink), { recursive: true });
  symlinkSync(sandbox.layout.skillsSource, sandbox.layout.skillsLink, "junction");
};

test("one link for the whole skills folder through the projects folder's link is blocked the same way", async () => {
  // Left by the manual setup on a managed Windows environment: web-shop\.claude\skills → one-app\.claude\skills.
  const directory = makeApp(sandbox, "web-shop", REACT_APP);
  const folderLink = join(directory, ".claude", "skills");

  linkProjectsSkills();
  mkdirSync(join(directory, ".claude"));
  symlinkSync(sandbox.layout.skillsLink, folderLink, "junction");

  const { exitCode, output } = await addAppNamed("web-shop", ACCEPT);

  assert.equal(exitCode, EXIT_CODES.FAILED, output);
  assert.doesNotMatch(output, /the app's own link/);
  assert.match(output, /\.claude\/skills is one link to .*, but each skill needs its own/);
  assert.ok(output.includes(removeLinkCommand(folderLink, process.platform)), output);
});

test("skill links through the projects folder's link are this repo's; a removed skill's is still caught", async () => {
  // A manual setup linked web-shop\.claude\skills\debug → one-app\.claude\skills\debug.
  const directory = makeApp(sandbox, "web-shop", REACT_APP);
  const skillsFolder = join(directory, ".claude", "skills");

  linkProjectsSkills();
  await addAppNamed("web-shop", ACCEPT);
  rmSync(join(skillsFolder, "debug"));
  symlinkSync(join(sandbox.layout.skillsLink, "debug"), join(skillsFolder, "debug"), "junction");

  const settled = await addAppNamed("web-shop", []);

  assert.equal(settled.exitCode, EXIT_CODES.OK, settled.output);
  assert.doesNotMatch(settled.output, /not to this repo's skills/);

  symlinkSync(join(sandbox.layout.skillsLink, "gone"), join(skillsFolder, "gone"), "junction");

  const { exitCode, output } = await addAppNamed("web-shop", []);

  assert.equal(exitCode, EXIT_CODES.FAILED, output);
  assert.match(output, /1 link not to this repo's skills: gone → /);
});

test("committed skill links stop add-app, and the fix untracks only them, not the team's own skills", async () => {
  const directory = makeApp(sandbox, "web-shop", {
    ...REACT_APP,
    files: { ".claude/skills/team-only/SKILL.md": "The team's skill.\n" },
    commit: ["package.json", ".claude"],
  });

  await addAppNamed("web-shop", ACCEPT);
  runGit(["add", "-f", ".claude/skills/debug"], directory, sandbox.env);
  runGit(["commit", "-q", "-m", "oops"], directory, sandbox.env);

  const { exitCode, output } = await addAppNamed("web-shop", []);

  assert.equal(exitCode, EXIT_CODES.FAILED, output);
  assert.match(output, /your skill links are committed to this repo: the skill links in \.claude\/skills\//);
  assert.match(output, /In the app: git rm -r --cached -- \.claude\/skills\/debug\./);
});

test("a committed skill link that was deleted from disk is still found as committed", async () => {
  const directory = makeApp(sandbox, "web-shop", REACT_APP);

  await addAppNamed("web-shop", ACCEPT);
  runGit(["add", "-f", ".claude/skills/debug"], directory, sandbox.env);
  runGit(["commit", "-q", "-m", "oops"], directory, sandbox.env);
  rmSync(join(directory, ".claude", "skills", "debug"));

  const { exitCode, output } = await addAppNamed("web-shop", []);

  assert.equal(exitCode, EXIT_CODES.FAILED, output);
  assert.match(output, /your skill links are committed to this repo/);
});

test("the app's own link for the whole skills folder is left alone, and the skill links skipped", async () => {
  const directory = makeApp(sandbox, "web-shop", REACT_APP);
  const teamSkills = join(directory, "tools", "skills");

  mkdirSync(teamSkills, { recursive: true });
  mkdirSync(join(directory, ".claude"));
  symlinkSync(teamSkills, join(directory, ".claude", "skills"), "junction");

  const { exitCode, output } = await addAppNamed("web-shop", ACCEPT);

  assert.equal(exitCode, EXIT_CODES.OK, output);
  assert.match(output, /\.claude\/skills is the app's own link, to .*, so your skills can't be linked inside it/);
  assert.deepEqual(readdirSync(teamSkills), [], "nothing is linked into the team's folder");
});

test("a .claude that is a link or a file stops the skill links, without crashing the git checks", async () => {
  const linked = makeApp(sandbox, "linked", REACT_APP);
  const shared = join(sandbox.projectsDirectory, "shared-claude");

  mkdirSync(shared);
  symlinkSync(shared, join(linked, ".claude"), "junction");
  makeApp(sandbox, "with-file", { ...REACT_APP, files: { ".claude": "not a folder\n" } });

  for (const [name, path] of [["linked", "linked"], ["with-file", "with-file"]]) {
    const { exitCode, output } = await addAppNamed(name, ACCEPT);

    assert.equal(exitCode, EXIT_CODES.FAILED, output);
    assert.match(output, /a file or a link is in the way at \.claude\b/);

    const claudeFolder = displayPath(join(sandbox.projectsDirectory, path, ".claude"));

    assert.ok(output.includes(`Make ${claudeFolder} a plain folder`), output);
    assert.doesNotMatch(output, /Something unexpected went wrong/);
  }

  assert.deepEqual(readdirSync(shared), [], "nothing is linked into the shared folder");
});

test("links left from a moved prompts folder, or a removed skill, stop add-app, with the commands", async () => {
  const directory = makeApp(sandbox, "web-shop", REACT_APP);
  const oldCopy = join(sandbox.projectsDirectory, "old-prompts", "skills", "debug");

  await addAppNamed("web-shop", ACCEPT);
  mkdirSync(oldCopy, { recursive: true });
  rmSync(join(directory, ".claude", "skills", "debug"));
  symlinkSync(oldCopy, join(directory, ".claude", "skills", "debug"), "junction");
  symlinkSync(
    join(sandbox.layout.skillsSource, "gone"),
    join(directory, ".claude", "skills", "gone"),
    "junction",
  );

  const { exitCode, output } = await addAppNamed("web-shop", []);

  assert.equal(exitCode, EXIT_CODES.FAILED, output);
  assert.match(output, /2 links not to this repo's skills: debug → .*old-prompts.*, gone → /);

  for (const name of ["debug", "gone"]) {
    assert.ok(output.includes(removeLinkCommand(join(directory, ".claude", "skills", name), process.platform)), output);
  }
});
