// @ts-check
// Where the owner's skills live. Agents read skills from ~/.agents/skills and ~/.claude/skills, and the owner's own
// skills there are links into this repo. A write that lands anywhere else in those folders either creates a skill
// outside the repo or changes a packaged one, which its next update replaces.

import { existsSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, sep } from "node:path";

/**
 * @typedef {object} SkillFolders
 * @property {string} ownSkills this repo's skills folder, where the owner's skills live
 * @property {string[]} agentSkillFolders the folders agents read skills from, such as ~/.agents/skills
 */

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
 * The real path of a file that may not exist yet: its nearest existing folder with links followed, then the rest.
 * @param {string} path an absolute path
 * @returns {string} the path with every link in its existing part followed
 */
export const realPathOf = (path) => {
  if (existsSync(path)) {
    return realpathSync(path);
  }

  const parent = dirname(path);

  return parent === path ? path : join(realPathOf(parent), basename(path));
};

/**
 * Why a file write must not happen, or null when it may.
 * @param {string} filePath the absolute path the agent is about to write
 * @param {SkillFolders} folders where the owner's skills live, and where agents read skills from
 * @param {(path: string) => string} toRealPath follows links, such as realPathOf
 * @returns {string | null} the refusal for a write into an agent skill folder outside this repo, null otherwise
 */
export const skillWriteRefusal = (filePath, folders, toRealPath) => {
  const agentFolder = folders.agentSkillFolders.find((folder) => isInside(folder, filePath));

  if (agentFolder === undefined || isInside(toRealPath(folders.ownSkills), toRealPath(filePath))) {
    return null;
  }

  const [skillName] = relative(agentFolder, filePath).split(sep);

  return (
    `This writes into ${agentFolder}/${skillName}, which isn't a link into the skills repo. `
    + `Create or change your own skill in ${folders.ownSkills}/${skillName}, then link it: `
    + `ln -s ${folders.ownSkills}/${skillName} ~/.agents/skills/${skillName}. `
    + "A skill installed from a package is replaced on its next update, so change it upstream instead."
  );
};
