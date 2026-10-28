// @ts-check
// `claude-rules add-app [name|path]`: once per app.
//
// Creates your personal notes (CLAUDE.local.md), docs/ai/ and one link per skill in .claude/skills/ inside one app,
// and keeps all of them out of that repo's commits. The project's own files (CLAUDE.md, the rest of
// .claude/, AGENTS.md, .gitignore) and anything git tracks are never changed. The questions live in
// add-app-questions.mjs, the steps in add-app-steps.mjs.

import { join } from "node:path";
import { describeLeftover, leftoverBySection } from "../lib/app-notes.mjs";
import { APP_FOLDER_NAMES, NOTES_FILE, SKILLS_FOLDER } from "../lib/app-paths.mjs";
import { listAppFolders, readAppFacts } from "../lib/apps.mjs";
import { COMMAND_NAME } from "../lib/constants.mjs";
import { detectStacks, listStacks } from "../lib/stacks.mjs";
import {
  chooseApp,
  chooseStacks,
  describeApp,
  stacksInNotes,
  refuseRepoSubfolder,
  refuseNonApp,
} from "./add-app-questions.mjs";
import {
  createFolders,
  excludeFromGit,
  linkSkills,
  readRepositoryFacts,
  verifyIgnored,
  writeNotes,
} from "./add-app-steps.mjs";

/**
 * What looking around found about the chosen app.
 * @typedef {object} AddAppFacts
 * @property {import("../lib/apps.mjs").AppFacts} app what was read from the app's folder
 * @property {import("./add-app-steps.mjs").RepositoryFacts} repository what git and the disk say about the app's folder
 * @property {import("../lib/stacks.mjs").DetectedStack[]} stacks every stack file, with why it was detected or null
 */

/**
 * @typedef {object} AddAppAnswers
 * @property {import("../lib/stacks.mjs").Stack[]} chosenStacks the stacks whose rules the app gets
 */

/**
 * The add-app command: once per app.
 * @type {import("../lib/contract.mjs").Command<AddAppFacts, AddAppAnswers>}
 */
export const addApp = {
  name: "add-app",
  title: "Add an app",
  summary:
    `Prepares one app folder: your notes (${NOTES_FILE}), ${APP_FOLDER_NAMES.join(" and ")}, and the skill links, `
    + "kept out of git for that repo only. Never changes the project's own files.",
  usage: "[name|path]",
  flags: ["yes", "dry-run"],
  mayChange: () => [
    `the app's ${NOTES_FILE}`,
    ...APP_FOLDER_NAMES,
    `skill links in ${SKILLS_FOLDER}/`,
    ".git/info/exclude",
    "backups in .git/",
  ],

  lookAround: async (context) => {
    const { layout, files, git } = context;
    const target = await chooseApp(context);

    if ("stop" in target) {
      return { findings: [], stop: target.stop };
    }

    const nonAppStop = refuseNonApp(context, target.directory);

    if (nonAppStop) {
      return { findings: [], stop: nonAppStop };
    }

    const repository = await readRepositoryFacts(context, target.directory);
    const subfolderStop = repository.isRepository ? await refuseRepoSubfolder(context, target.directory) : null;

    if (subfolderStop) {
      return { findings: [], stop: subfolderStop };
    }

    const app = readAppFacts(target.directory, files);
    const stacks = detectStacks(listStacks(layout, files), app);
    const findings = describeApp(context, app, repository, stacks);
    const isNotesTracked
      = repository.isRepository && app.notesText !== null && (await git.isTracked(app.directory, NOTES_FILE));

    if (isNotesTracked) {
      const reason
        = `${NOTES_FILE} is committed to this repo, so it's the team's file, `
          + "and this tool never changes tracked files.";

      return { findings, stop: { reason, fix: "Ask the team why it's committed." } };
    }

    return { findings, facts: { app, repository, stacks } };
  },

  askQuestions: async (context, survey) => ({
    chosenStacks:
      stacksInNotes(context, survey.facts.app, survey.facts.stacks)
      ?? (await chooseStacks(context.ask, survey.facts.stacks)),
  }),

  steps: (context, survey, answers) => {
    const { app, repository } = survey.facts;

    return [
      createFolders(context, app.directory),
      writeNotes(context, app, repository, answers.chosenStacks),
      linkSkills(context, app.directory, repository),
      excludeFromGit(context, app.directory, repository),
      ...(repository.isRepository ? [verifyIgnored(context, app.directory, repository)] : []),
    ];
  },

  afterwards: ({ files, layout }, survey) => {
    const { app } = survey.facts;
    const notes = files.readText(join(app.directory, NOTES_FILE)) ?? "";
    const sections = leftoverBySection(notes, files.readText(layout.notesTemplate) ?? "");

    if (sections.length === 0) {
      return [];
    }

    return [
      `Still empty in ${NOTES_FILE}. Claude fills these in on its first task in ${app.name}, then asks you to check:`,
      ...sections.map((section) => `  - ${describeLeftover([section])}`),
    ];
  },

  followUp: {
    question: ({ layout, files }) => {
      const left = listAppFolders(layout, files).filter((app) => !app.hasOurNotes).length;

      return left > 0 ? `Add another app? ${left} left.` : null;
    },
    command: "add-app",
  },

  nextStep: ({ layout }, survey) =>
    `start a task: ${COMMAND_NAME} new-task ${survey.facts.app.name}. The first time Claude starts in `
    + `${survey.facts.app.name}, it asks to approve imports from ${layout.repoFolderName}/rules/…: choose Yes.`,
};
