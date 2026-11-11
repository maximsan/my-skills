/**
 * What the tracker scripts share: one call to `gh`, and the shapes of an
 * issue and a pull request as it prints them.
 */
import { outputOf } from "./shared.mjs";

/**
 * Runs `gh` with `args`, which must ask for `--json`, and returns what it
 * printed, decoded.
 * @param {string[]} args the `gh` arguments, such as `["issue", "list", "--json", ISSUE_FIELDS]`
 * @returns {unknown} the decoded JSON, not yet checked for shape
 */
export function github(args) {
  return JSON.parse(outputOf("gh", args));
}

/**
 * How many rows one listing asks for: more than the tracker holds, so the
 * listing is the whole tracker. `gh` lists thirty unless told otherwise.
 */
export const WHOLE_TRACKER = 1000;

/**
 * The rows `listed` as records, through `fromJson`. A listing as long as
 * `WHOLE_TRACKER` may have been cut, and the script stops rather than answer
 * from part of the tracker.
 * @template T
 * @param {unknown} listed the decoded JSON array `gh` printed for a listing
 * @param {(json: Record<string, unknown>) => T} fromJson turns one row into a record, such as `issueFrom`
 * @returns {T[]} one record per row, in the listing's order
 */
export function rows(listed, fromJson) {
  const jsons = /** @type {Record<string, unknown>[]} */ (listed);

  if (jsons.length >= WHOLE_TRACKER) {
    throw new Error(`The tracker has outgrown a listing of ${WHOLE_TRACKER} rows.`);
  }

  return jsons.map(fromJson);
}

/** The fields of an issue the scripts read, for `gh issue list/view --json`. */
export const ISSUE_FIELDS = "number,state,title,body,assignees,labels";

/** The fields of a pull request the scripts read, for `gh pr list --json`. */
export const PULL_FIELDS = "number,title,headRefName,body";

/**
 * @typedef {object} Issue
 * @property {number} number the issue's number, as in `#846`
 * @property {string} state `OPEN` or `CLOSED`
 * @property {string} title the issue's title
 * @property {string} body the issue's description, in Markdown
 * @property {string[]} assignees logins
 * @property {string[]} labels names
 */

/**
 * @typedef {object} Pull
 * @property {number} number the pull request's number, as in `#846`
 * @property {string} title the pull request's title
 * @property {string} branch what `gh` calls `headRefName`
 * @property {string} body the pull request's description, in Markdown
 */

/**
 * An issue as the scripts read it, from one row `gh` printed.
 * @param {Record<string, unknown>} json one issue as `gh` printed it, with the `ISSUE_FIELDS` fields
 * @returns {Issue} the issue, with assignees as logins and labels as names
 */
export function issueFrom(json) {
  return {
    number: /** @type {number} */ (json.number),
    state: /** @type {string} */ (json.state),
    title: /** @type {string} */ (json.title),
    body: /** @type {string} */ (json.body),
    assignees: fieldOfEach(json.assignees, "login"),
    labels: fieldOfEach(json.labels, "name"),
  };
}

/**
 * A pull request as the scripts read it, from one row `gh` printed.
 * @param {Record<string, unknown>} json one pull request as `gh` printed it, with the `PULL_FIELDS` fields
 * @returns {Pull} the pull request, with its branch under `branch`
 */
export function pullFrom(json) {
  return {
    number: /** @type {number} */ (json.number),
    title: /** @type {string} */ (json.title),
    branch: /** @type {string} */ (json.headRefName),
    body: /** @type {string} */ (json.body),
  };
}

/**
 * Whether `text` holds `word` in any case.
 * @param {string} text where to look, such as an issue's title
 * @param {string} word what to look for
 * @returns {boolean} true when `text` holds `word`, ignoring case
 */
export function mentions(text, word) {
  return text.toLowerCase().includes(word.toLowerCase());
}

/**
 * Whether `text` holds ticket `number` as a whole number: `#846` or a
 * branch's `-846-`, never the 846 inside 1846.
 * @param {string} text where to look, such as a pull request's branch
 * @param {number} number the ticket's number
 * @returns {boolean} true when `text` holds the number with no digit on either side
 */
export function namesTicket(text, number) {
  return new RegExp(`(?<!\\d)${number}(?!\\d)`).test(text);
}

/**
 * One field from each object in a list `gh` printed, such as each assignee's login.
 * @param {unknown} listed the list of objects
 * @param {string} field the field to take from each
 * @returns {string[]} the field's value from each object, in order
 */
function fieldOfEach(listed, field) {
  return /** @type {Record<string, string>[]} */ (listed).map((json) => json[field]);
}
