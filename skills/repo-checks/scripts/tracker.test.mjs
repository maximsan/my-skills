import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { WHOLE_TRACKER, issueFrom, namesTicket, rows } from "./github.mjs";
import { issueLine, issuesMentioning } from "./tracker-find.mjs";
import { pullsNaming } from "./tracker-pickup.mjs";

// Real rows of the BrewPath tracker, as read on 24 October 2026.
const checks = {
  number: 846,
  state: "OPEN",
  title: "Three checks sessions repeat by hand become programs",
  body: "## Why\n\nEvery session repeats three checks by hand.",
  assignees: ["maximsan"],
  labels: ["enhancement", "ready-for-agent"],
};

const languageSheet = {
  number: 841,
  state: "CLOSED",
  title: "The Language sheet closes with a delay and its animation freezes on a switch",
  body: "In Settings, the learner taps a language in the Language sheet.",
  assignees: ["maximsan"],
  labels: ["bug", "ready-for-agent"],
};

const languageFix = {
  number: 845,
  title: "fix: a language pick no longer freezes the sheet as it closes",
  branch: "fix/language-switch-stall",
  body: "Picking a language froze the Language sheet as it closed, and the Language row changed late. Closes #841.",
};

const restoredMerge = {
  number: 681,
  title: "Restore the #680 merge that a force push of main dropped",
  branch: "fix/restore-680-merge",
  body: "#680 was merged at 18:51 UTC on 26 Sep.",
};

describe("tracker-find", () => {
  test("an issue is found by a word in its title or body, in any case", () => {
    assert.deepEqual(issuesMentioning("SHEET", [checks, languageSheet]), [languageSheet]);
    assert.deepEqual(issuesMentioning("by hand", [checks, languageSheet]), [checks]);
  });

  test("an issue line carries the number, the state and the title", () => {
    assert.equal(issueLine(checks), "#846 open   Three checks sessions repeat by hand become programs");
  });
});

describe("tracker-pickup", () => {
  test("a pull request names a ticket in its body, branch or title", () => {
    assert.deepEqual(pullsNaming(841, [languageFix, restoredMerge]), [languageFix]);
    assert.deepEqual(pullsNaming(680, [languageFix, restoredMerge]), [restoredMerge]);
    assert.deepEqual(pullsNaming(846, [languageFix, restoredMerge]), []);
  });

  test("a ticket is named by its whole number only", () => {
    assert.equal(namesTicket(restoredMerge.title, 680), true);
    assert.equal(namesTicket(restoredMerge.branch, 68), false);
    assert.equal(namesTicket(languageFix.branch, 841), false);
  });
});

describe("github", () => {
  test("an issue record is built from what gh prints", () => {
    const json = {
      number: 846,
      state: "OPEN",
      title: checks.title,
      body: checks.body,
      assignees: [{ login: "maximsan", name: "Maxim" }],
      labels: [{ name: "enhancement" }, { name: "ready-for-agent" }],
    };

    assert.deepEqual(issueFrom(json), checks);
  });

  test("a listing as long as the tracker limit is refused", () => {
    const cut = Array.from({ length: WHOLE_TRACKER }, () => ({}));

    assert.throws(() => rows(cut, issueFrom), /outgrown/);
    assert.deepEqual(rows([], issueFrom), []);
  });
});
