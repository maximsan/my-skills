// @ts-check
// The steps `add-app` runs, one function per step. Each has a read-only check() and an apply(); see lib/contract.mjs.
//
// `doctor` runs the same checks for each app (`appSafetySteps`), so "add-app has nothing to do" and "doctor says
// it's fine" can't disagree.

import { join } from "node:path";
import {
  commandsFromScripts,
  hasCommandsSection,
  insertImportLines,
  missingImportLines,
  packageManagerFor,
  renderNotes,
} from "../lib/app-notes.mjs";
import {
  APP_FOLDER_NAMES,
  APP_FOLDERS,
  APP_PATHS,
  BACKUP_FOLDER_NAME,
  NOTES_FILE,
  SKILLS_FOLDER,
  toExcludeLine,
} from "../lib/app-paths.mjs";
import { isOurNotes } from "../lib/apps.mjs";
import { StepFailure } from "../lib/errors.mjs";
import { missingExcludeLines, withExcludeLines } from "../lib/exclude-lines.mjs";
import { notIgnoredPaths } from "../lib/git.mjs";
import { displayPath, relativeInside, toImportLine } from "../lib/layout.mjs";
import { isSkillLinkPath, ownedSkillPaths, readSkillLinks, removeLinkCommand } from "../lib/skill-links.mjs";
import { plural } from "../lib/text.mjs";

/**
 * What git and the disk say about an app folder, read once and shared by the steps.
 * @typedef {object} RepositoryFacts
 * @property {boolean} isRepository whether the app folder is a git repository
 * @property {string[]} teamFolders the entries of APP_FOLDERS the repo already tracks files in. They're the team's,
 *   so they're left alone: no ignore line, no Exemplars.
 * @property {import("../lib/skill-links.mjs").SkillLinks} skillLinks what the app's .claude/skills holds
 * @property {string[]} committedSkillPaths the link paths of ours that git tracks, or tracks files inside, e.g.
 *   ".claude/skills/debug"; for our one folder link, ".claude/skills" itself
 */

/**
 * Reads once whether the app is a repository, which of our folders its team already commits, and the skill links.
 * @param {import("../lib/contract.mjs").Context} context the run's layout, files and git
 * @param {string} directory the app's folder
 * @returns {Promise<RepositoryFacts>} what git and the disk say about the app's folder
 */
export const readRepositoryFacts = async ({ layout, files, git }, directory) => {
  const skillLinks = readSkillLinks(layout, files, directory);

  if (!(await git.isRepository(directory))) {
    return { isRepository: false, teamFolders: [], skillLinks, committedSkillPaths: [] };
  }

  const tracked = await git.trackedFiles(directory, [...APP_FOLDERS, SKILLS_FOLDER]);
  const teamFolders = APP_FOLDERS.filter((folder) => tracked.some((file) => file.startsWith(`${folder}/`)));

  const ourPaths = skillLinks.kind === "folder-link" && skillLinks.ours ? [SKILLS_FOLDER] : ownedSkillPaths(skillLinks);
  const committedSkillPaths = ourPaths.filter((path) =>
    tracked.some((file) => file === path || file.startsWith(`${path}/`)));

  return { isRepository: true, teamFolders, skillLinks, committedSkillPaths };
};

/**
 * The paths this tool keeps out of git in one app: everything it creates, minus the folders the team owns, plus the
 * skill links.
 * @param {RepositoryFacts} repository what git and the disk say about the app's folder
 * @returns {string[]} the paths, relative to the app
 */
const ownedPaths = (repository) => [
  ...APP_PATHS.filter((path) => !repository.teamFolders.includes(path)),
  ...ownedSkillPaths(repository.skillLinks),
];

/**
 * Paths as messages list them: the skill links go under one name rather than one each, so they fit on one line.
 * They aren't counted: a folder the skills share is linked too, so the count would differ from the skills'.
 * @param {string[]} paths paths relative to the app, or their ignore lines
 * @returns {string} e.g. "CLAUDE.local.md, docs/ai/, the skill links in .claude/skills/"
 */
const describePaths = (paths) => {
  const hasSkillLinks = paths.some(isSkillLinkPath);
  const others = paths.filter((path) => !isSkillLinkPath(path));

  return [...others, ...(hasSkillLinks ? [`the skill links in ${SKILLS_FOLDER}/`] : [])].join(", ");
};

/**
 * Skill folders as messages count them: only those with a SKILL.md, so the number matches setup's and doctor's. A
 * folder the skills share is linked as well, without being counted.
 * @param {import("../lib/layout.mjs").Layout} layout where this repo's skills are
 * @param {import("../lib/files.mjs").Files} files reads the skills folder
 * @param {string[]} names the skill folders' names
 * @returns {string} e.g. "12 skills"
 */
const countSkillFolders = (layout, files, names) =>
  plural(names.filter((name) => files.exists(join(layout.skillsSource, name, "SKILL.md"))).length, "skill");

/**
 * The ignore lines one app needs: one for each path it owns.
 * @param {RepositoryFacts} repository what git and the disk say about the app's folder
 * @returns {string[]} the lines for the ignore file
 */
const wantedExcludeLines = (repository) => ownedPaths(repository).map(toExcludeLine);

/**
 * Creates docs/ai/ in the app, if it isn't there yet.
 * @param {import("../lib/contract.mjs").Context} context the run's files
 * @param {string} directory the app's folder
 * @returns {import("../lib/contract.mjs").Step} the step that creates the folders
 */
export const createFolders = ({ files }, directory) => ({
  title: `Folder ${APP_FOLDER_NAMES.join(" and ")}`,
  check: () => {
    const missing = APP_FOLDERS.filter((folder) => !files.isDirectory(join(directory, folder)));

    return missing.length > 0
      ? { status: "todo", reason: `create ${missing.join(", ")}` }
      : { status: "done", reason: "all exist" };
  },
  apply: () => {
    for (const folder of APP_FOLDERS) {
      files.createDirectory(join(directory, folder));
    }
  },
});

/**
 * Creates the app's CLAUDE.local.md from the template, or adds the rule lines an existing one lacks. An existing
 * file is backed up first.
 * @param {import("../lib/contract.mjs").Context} context the run's layout, files, git and platform
 * @param {import("../lib/apps.mjs").AppFacts} app what was read from the app's folder
 * @param {RepositoryFacts} repository what git and the disk say about the app's folder
 * @param {import("../lib/stacks.mjs").Stack[]} chosenStacks the stacks whose rules the app gets
 * @returns {import("../lib/contract.mjs").Step} the step that writes the notes file
 */
export const writeNotes = ({ layout, files, git, platform }, app, repository, chosenStacks) => {
  const notesPath = join(app.directory, NOTES_FILE);
  const importLines = chosenStacks.map((stack) => toImportLine(stack.file));
  const ruleNames = chosenStacks.map((stack) => stack.label).join(", ") || "no stack";
  const backupPlace = repository.isRepository ? `.git/${BACKUP_FOLDER_NAME}/` : `${NOTES_FILE}.bak`;

  /**
   * A new notes file from the template, with the chosen rules and the commands package.json can fill in.
   * @returns {string} the detail for the recap
   */
  const createNotesFromTemplate = () => {
    const template = files.readText(layout.notesTemplate) ?? "";
    const commands = commandsFromScripts(app.scripts, packageManagerFor(app.rootFileNames));
    const commandsLiveInProjectFile = hasCommandsSection(app.projectClaudeMdText);

    files.writeTextAtomic(
      notesPath,
      renderNotes(template, { projectName: app.name, importLines, commands, commandsLiveInProjectFile }),
    );

    if (commandsLiveInProjectFile) {
      return "created; commands point at the project's CLAUDE.md";
    }

    return commands.size > 0 ? `created, with ${plural(commands.size, "command")} from package.json` : "created";
  };

  /**
   * Adds the rule lines an existing notes file lacks, after a backup. It also adds our marker if it's missing, and
   * drops the "no stack rules" line under our heading. The rest of the file stays as it is.
   * @param {string} current the notes file's text now
   * @returns {Promise<string>} the detail for the recap, naming where the backup went
   */
  const addMissingRuleLines = async (current) => {
    const intoFolder = repository.isRepository
      ? join(await git.gitDirectory(app.directory), BACKUP_FOLDER_NAME)
      : undefined;
    const backupPath = files.backUp(notesPath, { intoFolder });

    files.writeTextAtomic(notesPath, insertImportLines(current, missingImportLines(current, importLines, platform)));

    return `rule lines added; the old file is at ${displayPath(backupPath)}`;
  };

  return {
    title: `Your notes in ${NOTES_FILE}`,
    check: () => {
      if (!files.exists(layout.notesTemplate)) {
        return {
          status: "blocked",
          reason: `the template ${displayPath(layout.notesTemplate)} is missing`,
          fix: "Run git pull in this repo.",
        };
      }

      const current = files.readText(notesPath);

      if (current === null) {
        return { status: "todo", reason: `create it from the template, with ${ruleNames} rules` };
      }

      const missing = missingImportLines(current, importLines, platform);

      if (missing.length === 0 && isOurNotes(current)) {
        return { status: "done", reason: "it already has the chosen rules" };
      }

      const change
        = missing.length > 0
          ? `add ${plural(missing.length, "rule line")} at the top`
          : "add the claude-rules marker line at the top";

      return { status: "todo", reason: `${change}; a copy goes to ${backupPlace} first` };
    },
    apply: async () => {
      const current = files.readText(notesPath);

      return current === null ? createNotesFromTemplate() : addMissingRuleLines(current);
    },
  };
};

/**
 * Links each of this repo's skills into the app, one link per skill. A skill folder the app already has under the
 * same name is the app's own, and is left alone.
 * @param {import("../lib/contract.mjs").Context} context the run's layout, files and platform
 * @param {string} directory the app's folder
 * @param {RepositoryFacts} repository what git and the disk say about the app's folder
 * @returns {import("../lib/contract.mjs").Step} the step that makes the links
 */
export const linkSkills = ({ layout, files, platform }, directory, repository) => {
  const { skillLinks, committedSkillPaths } = repository;
  const folderPath = join(directory, ...SKILLS_FOLDER.split("/"));
  const untrack = `git rm -r --cached -- ${committedSkillPaths.join(" ")}`;
  const untrackNote
    = "It takes them out of the repo and leaves them on disk; the team sees the removal in your next commit.";

  return {
    title: `Skill links in ${SKILLS_FOLDER}/`,
    check: () => {
      if (skillLinks.kind === "folder-link" && !skillLinks.ours) {
        return {
          status: "skipped",
          reason: `${SKILLS_FOLDER} is the app's own link, to ${displayPath(skillLinks.target)}, so your skills `
            + "can't be linked inside it",
        };
      }

      if (skillLinks.kind === "folder-link") {
        const removeLink = `Remove that link, and only the link: ${removeLinkCommand(folderPath, platform)}`;
        const untrackFirst = committedSkillPaths.length > 0 ? `First, in the app: ${untrack}. ${untrackNote} ` : "";

        return {
          status: "blocked",
          reason: `${SKILLS_FOLDER} is one link to ${displayPath(skillLinks.target)}, but each skill needs its own`,
          fix: `${untrackFirst}${removeLink}. Then run add-app again.`,
        };
      }

      if (skillLinks.kind === "in-the-way") {
        const what = skillLinks.path === SKILLS_FOLDER ? "a file" : "a file or a link";

        return {
          status: "blocked",
          reason: `${what} is in the way at ${skillLinks.path}`,
          fix: `Make ${displayPath(join(directory, ...skillLinks.path.split("/")))} a plain folder, then run add-app `
            + "again.",
        };
      }

      if (committedSkillPaths.length > 0) {
        return {
          status: "blocked",
          reason: `your skill links are committed to this repo: ${describePaths(committedSkillPaths)}`,
          fix: `In the app: ${untrack}. ${untrackNote}`,
        };
      }

      const appOwn = skillLinks.appOwn.length > 0
        ? `; left alone, as the app's own: ${skillLinks.appOwn.join(", ")}`
        : "";

      if (skillLinks.toLink.length > 0) {
        return { status: "todo", reason: `link ${countSkillFolders(layout, files, skillLinks.toLink)}${appOwn}` };
      }

      if (skillLinks.stray.length > 0) {
        const stray = skillLinks.stray.map(({ name, target }) => `${name} → ${displayPath(target)}`).join(", ");
        const remove = skillLinks.stray
          .map(({ name }) => removeLinkCommand(join(folderPath, name), platform))
          .join("; ");

        return {
          status: "blocked",
          reason: `${plural(skillLinks.stray.length, "link")} not to this repo's skills: ${stray}`,
          fix: `If they're left from a moved prompts folder, or a removed skill, remove them, then run add-app `
            + `again: ${remove}`,
        };
      }

      return { status: "done", reason: `${countSkillFolders(layout, files, skillLinks.linked)} linked${appOwn}` };
    },
    apply: () => {
      if (skillLinks.kind !== "folder") {
        return undefined;
      }

      for (const name of skillLinks.toLink) {
        files.createDirectoryLink(join(layout.skillsSource, name), join(folderPath, name));
      }

      return `linked ${countSkillFolders(layout, files, skillLinks.toLink)}`;
    },
  };
};

/**
 * The exclude file's path as messages show it: relative to the app when it's inside it, e.g. `.git/info/exclude`.
 * @param {string} directory the app's folder
 * @param {string} excludePath the full path of the exclude file
 * @returns {string} the path to show
 */
const shownExcludePath = (directory, excludePath) => displayPath(relativeInside(directory, excludePath) ?? excludePath);

/**
 * Adds our lines to the repo's private ignore file. Existing lines are never changed.
 * @param {import("../lib/contract.mjs").Context} context the run's files and git
 * @param {string} directory the app's folder
 * @param {RepositoryFacts} repository what git and the disk say about the app's folder
 * @returns {import("../lib/contract.mjs").Step} the step that adds the ignore lines
 */
export const excludeFromGit = ({ files, git }, directory, repository) => {
  const wantedLines = wantedExcludeLines(repository);

  return {
    title: "Keep your notes out of git",
    check: async () => {
      if (!repository.isRepository) {
        return { status: "skipped", reason: "not a git repository" };
      }

      const excludePath = await git.excludeFilePath(directory);
      const missing = missingExcludeLines(files.readText(excludePath) ?? "", wantedLines);
      const shownPath = shownExcludePath(directory, excludePath);

      if (missing.length === 0) {
        return { status: "done", reason: `already in ${shownPath}` };
      }

      return {
        status: "todo",
        reason: `add ${describePaths(missing)} to ${shownPath} (this copy of the repo only)`,
        action: `add ${describePaths(missing)} to ${shownPath}`,
      };
    },
    apply: async () => {
      const excludePath = await git.excludeFilePath(directory);
      const current = files.readText(excludePath) ?? "";

      files.writeTextAtomic(excludePath, withExcludeLines(current, missingExcludeLines(current, wantedLines)));
    },
  };
};

/**
 * Asks git whether our files are really ignored. A rule in the project's own .gitignore can un-ignore a file, and
 * would otherwise win silently.
 * @param {import("../lib/contract.mjs").Context} context the run's files and git
 * @param {string} directory the app's folder
 * @param {RepositoryFacts} repository what git and the disk say about the app's folder
 * @returns {import("../lib/contract.mjs").Step} the step that checks git ignores our files
 */
export const verifyIgnored = ({ files, git }, directory, repository) => {
  const wantedLines = wantedExcludeLines(repository);

  // These messages name `.git/info/exclude`, where the ignore file is in an ordinary clone, instead of asking git for
  // the exact path. That keeps them short, and a worktree's file is still in its main clone's `.git/info/exclude`.
  const teamNote = repository.teamFolders.map((folder) => `; ${folder}/ is committed by the team — left alone`);
  const confirmation
    = `kept out of git: ${describePaths(wantedLines)} (rule in .git/info/exclude)${teamNote.join("")}`;

  /**
   * Asks git which of our paths it still doesn't ignore, and reads whether our lines are in the exclude file.
   * @returns {Promise<{ problems: import("../lib/git.mjs").IgnoreMatch[], areLinesIn: boolean }>} the paths git
   *   doesn't ignore, and whether every line is in
   */
  const look = async () => {
    const problems = notIgnoredPaths(wantedLines, await git.checkIgnore(directory, wantedLines));
    const excludeText = files.readText(await git.excludeFilePath(directory)) ?? "";

    return { problems, areLinesIn: missingExcludeLines(excludeText, wantedLines).length === 0 };
  };

  /**
   * Says why git doesn't ignore our paths, and what to do about it.
   * @param {import("../lib/git.mjs").IgnoreMatch[]} problems the paths git doesn't ignore
   * @returns {{ reason: string, fix: string }} what went wrong and how to fix it
   */
  const describeProblems = (problems) => {
    const unignored = problems.find((match) => match.pattern.startsWith("!"));

    if (unignored) {
      return {
        reason: `${unignored.path} is un-ignored by ${unignored.source} ("${unignored.pattern}")`,
        fix: "Ask the team to drop that line; this tool never edits tracked files.",
      };
    }

    return {
      reason: `git still doesn't ignore ${problems.map((match) => match.path).join(", ")}`,
      fix: "Run again with --debug, and look at .git/info/exclude.",
    };
  };

  return {
    title: "Check git ignores your notes",
    check: async () => {
      if (!repository.isRepository) {
        return { status: "skipped", reason: "not a git repository" };
      }

      const { problems, areLinesIn } = await look();

      if (problems.length === 0) {
        return { status: "done", reason: confirmation };
      }

      // Until the lines are in, "not ignored" is expected: the step before this one adds them.
      if (!areLinesIn) {
        return { status: "todo", reason: "checked once the lines are in" };
      }

      return { status: "blocked", ...describeProblems(problems) };
    },
    apply: async () => {
      const { problems } = await look();

      // The plan has just listed the paths, so the result only confirms them.
      if (problems.length === 0) {
        return `git ignores all of them${teamNote.join("")}. Check any time: git check-ignore -v ${NOTES_FILE}`;
      }

      const { reason, fix } = describeProblems(problems);

      throw new StepFailure(reason, fix);
    },
  };
};

/**
 * The steps that keep an app working and safe, which `doctor` re-checks for every app: the folders, the skill links,
 * the ignore lines, and the check that git really ignores them.
 * @param {import("../lib/contract.mjs").Context} context everything the command may use
 * @param {string} directory the app's folder
 * @param {RepositoryFacts} repository what git and the disk say about the app's folder
 * @returns {{ folders: import("../lib/contract.mjs").Step, skills: import("../lib/contract.mjs").Step,
 *             exclude: import("../lib/contract.mjs").Step, verify: import("../lib/contract.mjs").Step }} the four
 *   steps, by name
 */
export const appSafetySteps = (context, directory, repository) => ({
  folders: createFolders(context, directory),
  skills: linkSkills(context, directory, repository),
  exclude: excludeFromGit(context, directory, repository),
  verify: verifyIgnored(context, directory, repository),
});
