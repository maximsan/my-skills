// @ts-check
// `new-task`: the ticket's folder and task.md, and the line to give Claude.

import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { newTask } from "../commands/new-task.mjs";
import { EXIT_CODES } from "../lib/errors.mjs";
import { runCommand } from "../lib/runner.mjs";
import { makeApp, makeContext, makeSandbox } from "./helpers.mjs";

/** @type {import("./helpers.mjs").Sandbox} */
let sandbox;

beforeEach(() => {
  sandbox = makeSandbox();
  makeApp(sandbox, "web-shop");
  makeApp(sandbox, "admin");
});
afterEach(() => sandbox.cleanUp());

const taskFile = () => join(sandbox.layout.projectsDirectory, "investigations", "web-shop", "ORD-123", "task.md");

const GO_AHEAD = { "Go ahead": true };

/**
 * Runs new-task with these arguments and answers.
 * @param {string[]} args the app and the ticket, either or both
 * @param {import("./helpers.mjs").ScriptedAnswer[]} [answers] the answers to its questions
 * @returns {Promise<{ exitCode: number, output: string }>} how it ended, and what it printed
 */
const run = async (args, answers = []) => {
  const { context, ui } = makeContext(sandbox, { args, answers });
  const exitCode = await runCommand(newTask, context);

  return { exitCode, output: ui.text() };
};

test("creates the ticket's task.md from the template, and gives the line for Claude", async () => {
  const { exitCode, output } = await run(["web-shop", "ORD-123"], [GO_AHEAD]);

  assert.equal(exitCode, EXIT_CODES.OK, output);
  assert.match(readFileSync(taskFile(), "utf8"), /^# ORD-123 — /, "the ticket goes in the first line");
  assert.match(output, /Next: in Claude, started in projects: \/task-investigate investigations\/web-shop\/ORD-123\//);
  assert.match(output, /Started inside web-shop instead\? .*\/task-investigate \.\.\/investigations\/web-shop\//);
});

test("asks for the app and the ticket when they aren't given", async () => {
  const { exitCode, output } = await run([], [{ "Which app": "web-shop" }, { "Ticket ID": "ORD-123" }, GO_AHEAD]);

  assert.equal(exitCode, EXIT_CODES.OK, output);
  assert.ok(existsSync(taskFile()));
});

test("never replaces a task.md that's already there", async () => {
  await run(["web-shop", "ORD-123"], [GO_AHEAD]);
  writeFileSync(taskFile(), "# ORD-123 — my own words\n");

  const { exitCode, output } = await run(["web-shop", "ORD-123"]);

  assert.equal(exitCode, EXIT_CODES.OK, output);
  assert.equal(readFileSync(taskFile(), "utf8"), "# ORD-123 — my own words\n");
  assert.match(output, /already there, and it's never replaced/);
});

test("with --yes, a missing ticket stops before anything is written", async () => {
  const { context, ui } = makeContext(sandbox, { args: ["web-shop"], options: { yes: true } });

  assert.equal(await runCommand(newTask, context), EXIT_CODES.USAGE, ui.text());
  assert.match(ui.text(), /--yes can't name the ticket for you/);
  assert.ok(!existsSync(join(sandbox.layout.projectsDirectory, "investigations")));
});

test("refuses a ticket that can't be a folder name, and an app that doesn't exist", async () => {
  const badTicket = await run(["web-shop", "../escape"]);

  assert.equal(badTicket.exitCode, EXIT_CODES.USAGE);
  assert.match(badTicket.output, /can't be a folder name/);

  const badApp = await run(["shop", "ORD-123"]);

  assert.equal(badApp.exitCode, EXIT_CODES.USAGE);
  assert.match(badApp.output, /There's no app called shop\. The apps are: admin, web-shop\./);
});
