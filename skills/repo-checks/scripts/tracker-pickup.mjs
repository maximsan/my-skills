#!/usr/bin/env node
/**
 * Prints a ticket's assignee and the open pull requests that name it: the
 * pickup check before the first edit on a ticket.
 *
 * Usage: node tracker-pickup.mjs <number>, run inside the checkout.
 */
import {
  ISSUE_FIELDS,
  PULL_FIELDS,
  WHOLE_TRACKER,
  github,
  issueFrom,
  namesTicket,
  pullFrom,
  rows,
} from "./github.mjs";
import { exitCodeOf, runsAsScript } from "./shared.mjs";

const DECIMAL = 10;

/**
 * The pull requests in `pulls` whose title, branch or body names ticket
 * `number`.
 * @param {number} number the ticket's number
 * @param {import('./github.mjs').Pull[]} pulls the pull requests to search
 * @returns {import('./github.mjs').Pull[]} the pull requests that name the ticket, in their listed order
 */
export function pullsNaming(number, pulls) {
  return pulls.filter(
    (pull) =>
      namesTicket(pull.title, number)
      || namesTicket(pull.branch, number)
      || namesTicket(pull.body, number),
  );
}

/**
 * A list for one line of the report: the values joined by commas, or `none` when there are none.
 * @param {string[]} values the names to print, such as assignee logins
 * @param {string} none what to print for an empty list
 * @returns {string} the text to print
 */
function listed(values, none) {
  return values.length === 0 ? none : values.join(", ");
}

/**
 * Prints the ticket's state, assignee, labels and the open pull requests that name it.
 * @param {string[]} argv the command-line arguments after the script's path: just the ticket's number
 * @returns {number} the exit code: 0 once the report is printed
 */
export function main(argv) {
  const [givenNumber] = argv;
  const number = argv.length === 1 ? Number.parseInt(givenNumber, DECIMAL) : Number.NaN;

  if (Number.isNaN(number)) {
    throw new Error("Usage: node tracker-pickup.mjs <number>");
  }

  const issue = issueFrom(
    /** @type {Record<string, unknown>} */ (
      github(["issue", "view", String(number), "--json", ISSUE_FIELDS])
    ),
  );
  const pulls = rows(
    github(["pr", "list", "--state", "open", "--limit", String(WHOLE_TRACKER), "--json", PULL_FIELDS]),
    pullFrom,
  );

  console.log(`#${issue.number} ${issue.state.toLowerCase()} ${issue.title}`);
  console.log(`assignee: ${listed(issue.assignees, "nobody")}`);
  console.log(`labels: ${listed(issue.labels, "none")}`);
  console.log("open pull requests naming it:");

  const naming = pullsNaming(number, pulls);

  if (naming.length === 0) {
    console.log("  none");
  }

  for (const pull of naming) {
    console.log(`  #${pull.number} ${pull.title} (${pull.branch})`);
  }

  return 0;
}

const [, , ...scriptArgs] = process.argv;

if (runsAsScript(import.meta.url)) {
  process.exitCode = exitCodeOf(() => main(scriptArgs));
}
