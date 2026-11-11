// @ts-check
// Where the owner's skills live. Agents read skills from ~/.agents/skills and ~/.claude/skills. The owner's skills
// there are links into this repo's skills folder. Any other skill folder there was either created outside the repo
// or installed from a package, and a package's next update replaces changes made in place.

import { existsSync, lstatSync, readlinkSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

/**
 * @typedef {object} SkillFolders
 * @property {string} ownSkills this repo's skills folder, where the owner's skills live
 * @property {string[]} agentSkillFolders the folders agents read skills from: ~/.agents/skills first, where the
 *   links into this repo go, then folders such as ~/.claude/skills that link to it
 * @property {string} packageRecord the file listing skills installed from a package, ~/.agents/.skill-lock.json
 */

/** Enough to follow any real chain of links, and to stop on a loop of links that point at each other. */
const MAX_LINK_HOPS = 40;

/**
 * Whether a path sits inside a folder, below it.
 * @param {string} folder an absolute folder path
 * @param {string} path an absolute path
 * @returns {boolean} true when the path is below the folder
 */
const isInside = (folder, path) => {
  const fromFolder = relative(folder, path);

  return fromFolder !== "" && !fromFolder.startsWith("..") && !isAbsolute(fromFolder);
};

/**
 * Where a link points, when the path is a link.
 * @param {string} path an absolute path
 * @returns {string | null} the link's target as an absolute path, or null when the path isn't a link
 */
const linkTargetOf = (path) => {
  try {
    return lstatSync(path).isSymbolicLink() ? resolve(dirname(path), readlinkSync(path)) : null;
  } catch {
    return null;
  }
};

/**
 * The real path of a file that may not exist yet, with every link followed and each name in its real case. A link
 * whose target doesn't exist yet is followed too.
 * @param {string} path an absolute path
 * @param {number} [hopsLeft] how many more links to follow, so a loop of links ends
 * @returns {string} the real path
 */
export const realPathOf = (path, hopsLeft = MAX_LINK_HOPS) => {
  if (existsSync(path)) {
    return realpathSync.native(path);
  }

  const linkTarget = linkTargetOf(path);

  if (linkTarget !== null && hopsLeft > 0) {
    return realPathOf(linkTarget, hopsLeft - 1);
  }

  const parent = dirname(path);

  return parent === path ? path : join(realPathOf(parent, hopsLeft), basename(path));
};

/**
 * Why a file write must not happen, or null when it may.
 * @param {string} filePath the absolute path the agent is about to write
 * @param {SkillFolders} folders where the owner's skills live, and where agents read skills from
 * @param {(path: string) => string} toRealPath follows links, such as realPathOf
 * @returns {string | null} the refusal for a write into a skill folder outside this repo, null otherwise
 */
export const skillWriteRefusal = (filePath, folders, toRealPath) => {
  const realFile = toRealPath(filePath);

  if (isInside(toRealPath(folders.ownSkills), realFile)) {
    return null;
  }

  // Match the path as written and its real path: a skill folder there may itself link somewhere outside the repo.
  const skillPath = folders.agentSkillFolders
    .flatMap((folder) => [{ folder, path: filePath }, { folder: toRealPath(folder), path: realFile }])
    .find(({ folder, path }) => isInside(folder, path));

  if (skillPath === undefined) {
    return null;
  }

  const [skillName, ...insideSkill] = relative(skillPath.folder, skillPath.path).split(sep);

  // A file at the top of the folder, such as a README, belongs to no skill.
  if (insideSkill.length === 0) {
    return null;
  }

  const ownSkill = join(folders.ownSkills, skillName);
  const [linkFolder, ...otherFolders] = folders.agentSkillFolders;
  const links = [
    `  ln -sn ${ownSkill} ${join(linkFolder, skillName)}`,
    ...otherFolders.map((folder) => `  ln -sn ${join(linkFolder, skillName)} ${join(folder, skillName)}`),
  ];

  return [
    `Refused: ${join(skillPath.folder, skillName)} is outside the skills repo, ${folders.ownSkills}.`,
    "If the skill is the owner's:",
    `- A new skill: mkdir ${ownSkill}, write it there, then link it.`,
    `- A skill folder already here: mv ${join(skillPath.folder, skillName)} ${ownSkill}, then link it.`,
    `  If ${ownSkill} already exists, stop and ask the owner.`,
    "Link it with these. An existing link makes `ln -sn` fail, and that's fine:",
    ...links,
    `If ${folders.packageRecord} lists the skill, it came from a package, and its next update replaces any change.`,
    "Then stop and tell the owner what you wanted to change.",
  ].join("\n");
};
