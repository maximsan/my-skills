// @ts-check
// The skills each app links to: one link per folder in this repo's skills, at <app>/.claude/skills/<name>.
// That's each skill, plus skills/shared, which skills read through "../shared/". Claude Code resolves "../" from the
// link's own path, so shared needs a link beside the skills.
//
// Claude Code reads skills from a folder above the app only when the app isn't its own git repo, so every app
// gets its own links. One link per skill rather than one for the folder, so a team's own skills
// in .claude/skills stay where they are.

import { dirname, join } from "node:path";
import { SKILLS_FOLDER, skillLinkPath } from "./app-paths.mjs";

/**
 * A link in an app's .claude/skills that isn't one of ours: one with a skill's name pointing somewhere else, or one
 * into this repo's skills for a skill that's gone.
 * @typedef {{ name: string, target: string }} StrayLink
 */

/**
 * What an app's .claude/skills holds, measured against this repo's skills.
 * @typedef {{ kind: "folder-link", target: string, ours: boolean }
 *   | { kind: "in-the-way", path: string }
 *   | { kind: "folder", linked: string[], toLink: string[], appOwn: string[], stray: StrayLink[] }} SkillLinks
 *   folder-link: .claude/skills is itself one link; ours when it points at this repo's skills, directly or through
 *   the projects folder's skills link, as the manual setup made it. in-the-way: a file, or a link at .claude, stops
 *   links being made; path is relative to the app.
 *   folder: linked are our links, toLink have nothing yet, appOwn are the app's own skill folders with the same name
 *   as one of ours, left alone
 */

/**
 * Whether a link's target is this repo's skills folder, or a folder inside it. The projects folder's skills link,
 * projects/.claude/skills, counts as this repo's: setup points it there, and the manual setup linked apps through it.
 * @param {import("./layout.mjs").Layout} layout where this repo's skills and the projects folder's link are
 * @param {import("./files.mjs").Files} files compares paths
 * @param {string} target the link's target
 * @param {string} [name] a folder inside the skills folder, e.g. "debug"; none for the skills folder itself
 * @returns {boolean} true when the target is ours
 */
const isOurTarget = (layout, files, target, name = "") =>
  [layout.skillsSource, layout.skillsLink].some((folder) => files.isSamePath(target, join(folder, name)));

/**
 * The folders each app links to: every sub-folder of this repo's skills, whether it holds a skill or shared files.
 * @param {import("./layout.mjs").Layout} layout where this repo's skills folder is
 * @param {import("./files.mjs").Files} files reads the skills folder
 * @returns {string[]} the folder names, sorted
 */
export const listSkillFolders = (layout, files) =>
  files
    .listDirectory(layout.skillsSource)
    .filter((name) => files.isDirectory(join(layout.skillsSource, name)))
    .sort();

/**
 * Reads what's at each skill's link path in one app, without following links.
 * @param {import("./layout.mjs").Layout} layout where this repo's skills are
 * @param {import("./files.mjs").Files} files looks at the app's folder without following links
 * @param {string} appDirectory the app's folder
 * @returns {SkillLinks} what the app's .claude/skills holds
 */
export const readSkillLinks = (layout, files, appDirectory) => {
  const [claudeFolder] = SKILLS_FOLDER.split("/");
  const atClaude = files.inspectPath(join(appDirectory, claudeFolder));

  // Links made through a linked .claude would land in the folder it points at, and git won't look past it.
  if (atClaude.kind === "link" || atClaude.kind === "file") {
    return { kind: "in-the-way", path: claudeFolder };
  }

  const found = files.inspectPath(join(appDirectory, ...SKILLS_FOLDER.split("/")));

  if (found.kind === "link") {
    return { kind: "folder-link", target: found.target, ours: isOurTarget(layout, files, found.target) };
  }

  if (found.kind === "file") {
    return { kind: "in-the-way", path: SKILLS_FOLDER };
  }

  const skills = listSkillFolders(layout, files);
  const entries = found.kind === "directory" ? found.entries : [];

  /** @type {{ linked: string[], toLink: string[], appOwn: string[], stray: StrayLink[] }} */
  const links = { linked: [], toLink: [], appOwn: [], stray: [] };

  for (const name of [...new Set([...skills, ...entries])].sort()) {
    const atPath = files.inspectPath(join(appDirectory, ...skillLinkPath(name).split("/")));
    const isOurs = atPath.kind === "link" && isOurTarget(layout, files, atPath.target, name);

    if (!skills.includes(name)) {
      if (atPath.kind === "link" && isOurTarget(layout, files, dirname(atPath.target))) {
        links.stray.push({ name, target: atPath.target });
      }
    } else if (atPath.kind === "missing") {
      links.toLink.push(name);
    } else if (isOurs) {
      links.linked.push(name);
    } else if (atPath.kind === "link") {
      links.stray.push({ name, target: atPath.target });
    } else {
      links.appOwn.push(name);
    }
  }

  return { kind: "folder", ...links };
};

/**
 * The link paths this tool owns in one app: the links it made and the ones it's about to make.
 * @param {SkillLinks} links what the app's .claude/skills holds
 * @returns {string[]} the paths relative to the app, e.g. ".claude/skills/debug"
 */
export const ownedSkillPaths = (links) =>
  links.kind === "folder" ? [...links.linked, ...links.toLink].sort().map(skillLinkPath) : [];

/**
 * Whether a path is one of the skill links, for messages that name them as a group rather than one by one.
 * @param {string} path a path relative to the app
 * @returns {boolean} true for a path inside .claude/skills
 */
export const isSkillLinkPath = (path) => path.startsWith(`${SKILLS_FOLDER}/`);

/**
 * The command that removes a link and leaves the folder it points at alone.
 * @param {string} path the link's full path
 * @param {NodeJS.Platform} platform the operating system, which decides the command
 * @returns {string} the command to run
 */
export const removeLinkCommand = (path, platform) =>
  platform === "win32" ? `cmd /c rmdir "${path}"` : `rm "${path}"`;
