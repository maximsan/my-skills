// @ts-check
// `claude-rules setup`: once per computer.
//
// Links the shared rules and the skills into the projects folder, and adds the bug-fix reminder hook to your personal
// Claude Code settings. Nothing else: no repo is touched, and neither are your git settings. Keeping each app's notes
// out of git happens per app, in `add-app`.

import { dirname } from "node:path";
import { listAppFolders } from "../lib/apps.mjs";
import { claudeSettingsFile, describeReminder, readReminderState, withReminderHook } from "../lib/claude-settings.mjs";
import { COMMAND_NAME } from "../lib/constants.mjs";
import { displayPath, homePath, installCommand, shortPath, spaceInPathWarning, toImportLine } from "../lib/layout.mjs";
import {
  checkTools,
  countSkills,
  describeSharedRules,
  describeSkillsLink,
  readCommandState,
  readSharedRulesState,
  readSkillsLinkState,
} from "../lib/machine-setup.mjs";
import { plural } from "../lib/text.mjs";

/** The "v" at the start of Node's version, e.g. "v20.11.0", which the findings line leaves out. */
const NODE_VERSION_PREFIX = /^v/;

/**
 * @typedef {{ skillsLink: import("../lib/machine-setup.mjs").SkillsLinkState }} SetupFacts
 * @typedef {{ mayReplaceOtherLink: boolean }} SetupAnswers
 */

/**
 * Adds the `@` line that loads the shared rules into projects/CLAUDE.md, creating the file if needed.
 * @param {import("../lib/contract.mjs").Context} context the run's layout, files and platform
 * @returns {import("../lib/contract.mjs").Step} the step that adds the line
 */
const addSharedRulesLine = ({ layout, files, platform }) => ({
  title: `Shared rules line in ${shortPath(layout, layout.sharedRulesFile)}`,
  check: () => describeSharedRules(readSharedRulesState(layout, files, platform), layout),
  apply: () => {
    const line = toImportLine(layout.commonRulesFile);
    const state = readSharedRulesState(layout, files, platform);

    if (state.kind === "present" || state.kind === "source-missing") {
      return undefined;
    }

    if (state.kind === "missing") {
      files.writeTextAtomic(layout.sharedRulesFile, `${line}\n`);

      return "created";
    }

    // projects/CLAUDE.md is outside every repo, so the backup can sit beside it.
    const backupPath = files.backUp(layout.sharedRulesFile);

    files.writeTextAtomic(layout.sharedRulesFile, `${line}\n${state.text}`);

    return `line added at the top; the old file is at ${displayPath(backupPath)}`;
  },
});

/**
 * Links projects/.claude/skills to this repo's skills. A real folder with files in it is never deleted: it may hold
 * someone's own skills.
 * @param {import("../lib/contract.mjs").Context} context the run's layout and files
 * @param {boolean} mayReplaceOtherLink the user agreed to replace a link that points somewhere else
 * @returns {import("../lib/contract.mjs").Step} the step that makes the link
 */
const linkSkillsFolder = ({ layout, files }, mayReplaceOtherLink) => ({
  title: `Link ${shortPath(layout, layout.skillsLink)} → ${shortPath(layout, layout.skillsSource)}`,
  check: () =>
    describeSkillsLink(readSkillsLinkState(layout, files), layout, {
      mayReplaceOtherLink,
      skillCount: countSkills(layout, files),
    }),
  apply: () => {
    const state = readSkillsLinkState(layout, files);

    if (state.kind === "ours") {
      return undefined;
    }

    if (state.kind === "empty-folder") {
      files.removeEmptyDirectory(layout.skillsLink);
    }

    if (state.kind === "other-link") {
      files.removeLink(layout.skillsLink);
    }

    files.createDirectoryLink(layout.skillsSource, layout.skillsLink);

    return `linked (${plural(countSkills(layout, files), "skill")})`;
  },
});

/**
 * Adds the bug-fix reminder hook to your personal Claude Code settings, or brings an old entry up to date. An existing
 * settings file is backed up first, and everything else in it is kept.
 * @param {import("../lib/contract.mjs").Context} context the run's layout, files and home folder
 * @returns {import("../lib/contract.mjs").Step} the step that adds the hook
 */
const addBugFixReminder = ({ layout, files, homeDirectory }) => {
  const settingsFile = claudeSettingsFile(homeDirectory);

  return {
    title: `Bug-fix reminder in ${homePath(settingsFile, homeDirectory)}`,
    check: () =>
      describeReminder(readReminderState(files.readText(settingsFile), layout), homePath(settingsFile, homeDirectory)),
    apply: () => {
      const text = files.readText(settingsFile);

      if (text === null) {
        files.createDirectory(dirname(settingsFile));
        files.writeTextAtomic(settingsFile, withReminderHook(null, layout));

        return "created";
      }

      // The settings file is in your home folder, outside every repo, so the backup can sit beside it.
      const backupPath = files.backUp(settingsFile);

      files.writeTextAtomic(settingsFile, withReminderHook(text, layout));

      return `the other settings are kept; the old file is at ${displayPath(backupPath)}`;
    },
  };
};

/**
 * The setup command: once per computer.
 * @type {import("../lib/contract.mjs").Command<SetupFacts, SetupAnswers>}
 */
export const setup = {
  name: "setup",
  title: "Set up this computer",
  summary:
    "Do this first, once. Links the rules and skills into your projects folder, and adds the bug-fix reminder to "
    + "your Claude settings. Doesn't touch any repo or your git settings.",
  flags: ["yes", "dry-run"],
  mayChange: ({ layout, homeDirectory }) => [
    shortPath(layout, layout.sharedRulesFile),
    shortPath(layout, layout.skillsLink),
    homePath(claudeSettingsFile(homeDirectory), homeDirectory),
  ],

  lookAround: async (context) => {
    const { layout, files, nodeVersion, homeDirectory } = context;
    const projectsFolder = homePath(layout.projectsDirectory, homeDirectory);

    /** @type {import("../lib/contract.mjs").Finding[]} */
    const findings = [];
    const gitCheck = await checkTools(context).git.check();

    if (gitCheck.status !== "done") {
      findings.push({ tone: "fail", text: gitCheck.reason ?? "" });

      return {
        findings,
        stop: { reason: "Some tools this needs are missing.", fix: `${gitCheck.fix} Then run setup again.` },
      };
    }

    findings.push({
      tone: "ok",
      text: `Node ${nodeVersion.replace(NODE_VERSION_PREFIX, "")} and git ${gitCheck.reason} found`,
    });
    findings.push({ tone: "ok", text: `This repo is at ${homePath(layout.repoRoot, homeDirectory)}` });

    const spaceWarning = spaceInPathWarning(layout);

    if (spaceWarning) {
      findings.push({ tone: "warn", text: spaceWarning });
    }

    const apps = listAppFolders(layout, files);

    findings.push(
      apps.length > 0
        ? {
            tone: "info",
            text: `Found ${plural(apps.length, "app folder")} next to it: ${apps.map((app) => app.name).join(", ")}`,
          }
        : {
            tone: "warn",
            text: `No app folders next to it yet. Clone your apps into ${projectsFolder}.`,
          },
    );

    const skillsLink = readSkillsLinkState(layout, files);

    if (skillsLink.kind === "other-link") {
      findings.push({
        tone: "warn",
        text: `${displayPath(layout.skillsLink)} already links to ${displayPath(skillsLink.target)}`,
      });
    }

    return { findings, facts: { skillsLink } };
  },

  askQuestions: async (context, survey) => {
    const { layout, files, ask, platform, homeDirectory } = context;
    const projectsFolder = homePath(layout.projectsDirectory, homeDirectory);

    // Once the shared rules line is in place, the projects folder was confirmed on an earlier run.
    const isSetUp = readSharedRulesState(layout, files, platform).kind === "present";
    const isRightFolder = isSetUp || (await ask.confirm(`Your apps live in ${projectsFolder}?`, true));

    if (!isRightFolder) {
      return {
        stop: {
          reason: "The projects folder is always the folder this repo is in, so the shared rules sit above every app.",
          fix:
            `Move this repo into the folder that holds your apps, as ${layout.repoFolderName}, `
            + "then run setup again.",
        },
      };
    }

    const hasOtherLink = survey.facts.skillsLink.kind === "other-link";
    const mayReplaceOtherLink
      = hasOtherLink && (await ask.confirm("Replace it with a link to this repo's skills?", false));

    return { mayReplaceOtherLink };
  },

  steps: (context, _survey, answers) => [
    addSharedRulesLine(context),
    linkSkillsFolder(context, answers.mayReplaceOtherLink),
    addBugFixReminder(context),
  ],

  afterwards: ({ layout, files, env, platform, homeDirectory }) =>
    readCommandState(layout, files, { env, platform }).kind === "missing"
      ? [`Tip: to use the ${COMMAND_NAME} command from any folder, ${installCommand(layout, homeDirectory)}.`]
      : [],

  nextStep: () => `add your first app: ${COMMAND_NAME} add-app`,

  followUp: {
    question: ({ layout, files }) =>
      listAppFolders(layout, files).some((app) => !app.hasOurNotes) ? "Add an app now?" : null,
    command: "add-app",
  },
};
