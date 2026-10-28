// @ts-check
// What `add-app` creates inside an app, said once.
//
// The notes file, the folders, the private ignore lines, add-app's summary, and doctor's per-app check all come
// from this one list, so they can't drift apart. Paths are written with forward slashes, the way git and the
// messages show them; join them with node:path before touching the disk.

/** The per-app notes file. */
export const NOTES_FILE = "CLAUDE.local.md";

/** The folder for lasting notes about the app, which skills read and `task-learn` writes. */
export const DOCS_FOLDER = "docs/ai";

/**
 * The folders this tool creates in each app. Task folders aren't among them: they live in the projects folder, in
 * investigations/<app>/<TICKET>/, so one ticket's work survives a re-clone and a search covers every app.
 */
export const APP_FOLDERS = [DOCS_FOLDER];

/** The task folders' home in the projects folder: investigations/<app>/<TICKET>/. */
export const INVESTIGATIONS_FOLDER = "investigations";

/**
 * Folders in the projects folder that belong to the setup, not to any app: the task folders, and the book of
 * knowledge shared across the apps. They're never listed as apps.
 */
export const SHARED_FOLDERS = [INVESTIGATIONS_FOLDER, "docs"];

/** The folders as people read them, with a trailing slash: "docs/ai/". */
export const APP_FOLDER_NAMES = APP_FOLDERS.map((folder) => `${folder}/`);

/**
 * Where backups of an app's notes go, inside the repo's git folder: `.git/claude-rules-backups/`. There a backup never
 * shows in `git status` and can't be committed.
 */
export const BACKUP_FOLDER_NAME = "claude-rules-backups";

/**
 * The private ignore line for a notes file or folder: folders get a trailing slash, as in `.gitignore`.
 * @param {string} path one of NOTES_FILE or APP_FOLDERS
 * @returns {string} the line to write to the private ignore file
 */
export const toExcludeLine = (path) => (APP_FOLDERS.includes(path) ? `${path}/` : path);

/** Where an app's skill links go, one per skill. */
export const SKILLS_FOLDER = ".claude/skills";

/**
 * Where one skill's link goes in an app. Its ignore line has no trailing slash: git sees a link as a file, so a
 * line ending in a slash never matches it.
 * @param {string} name the skill's folder name, e.g. "debug"
 * @returns {string} the link's path relative to the app, e.g. ".claude/skills/debug"
 */
export const skillLinkPath = (name) => `${SKILLS_FOLDER}/${name}`;

/** Everything `add-app` creates, in the order it's listed to people. */
export const APP_PATHS = [NOTES_FILE, ...APP_FOLDERS];
