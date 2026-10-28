// @ts-check
// Which stack rule files exist, and which ones an app uses.
//
// The rule files themselves are the list: every `rules/*.md` but the common rules is offered. Detection is a small
// table in code, one entry per stack. A stack file with no detector is still offered, just unticked, so adding a rule
// file never needs a code change, and adding detection for it is one entry below.

import { basename, join } from "node:path";

/** A line break, on Windows (\r\n) or elsewhere (\n). */
const LINE_BREAK = /\r?\n/;

/** What a top-level Markdown heading starts with. */
const HEADING_PREFIX = "# ";

/** The " conventions" ending of a heading like "# React conventions", in any case. */
const CONVENTIONS_SUFFIX = /\s+conventions\s*$/i;

/**
 * @typedef {object} Stack
 * @property {string} name the file name without .md, e.g. "react"
 * @property {string} label for people, from the file's "# React conventions" heading
 * @property {string} file absolute path
 */

/**
 * @typedef {Stack & { reason: string | null }} DetectedStack reason says why it was detected, or null if it wasn't
 */

/**
 * Each detector returns why the stack applies ("react in package.json"), or null.
 * @type {Record<string, (facts: import("./apps.mjs").AppFacts) => string | null>}
 */
const STACK_DETECTORS = {
  react: (facts) => (facts.dependencyNames.includes("react") ? "react in package.json" : null),

  typescript: (facts) => {
    if (facts.dependencyNames.includes("typescript")) {
      return "typescript in package.json";
    }

    return facts.rootFileNames.includes("tsconfig.json") ? "tsconfig.json found" : null;
  },

  microfrontend: (facts) => {
    const federationPackage = facts.dependencyNames.find(
      (name) => name.startsWith("@module-federation/") || name === "@originjs/vite-plugin-federation",
    );

    if (federationPackage) {
      return `${federationPackage} in package.json`;
    }

    // Webpack 5 ships Module Federation built in, so a federated app may have no extra package at all.
    const config = facts.webpackConfigs.find(({ text }) => text.includes("ModuleFederationPlugin"));

    return config ? `ModuleFederationPlugin in ${config.name}` : null;
  },
};

/**
 * Every stack rule file, alphabetically: the rules folder without the common rules.
 * @param {import("./layout.mjs").Layout} layout where the rules folder and the common rules file are
 * @param {import("./files.mjs").Files} files reads the folder and each file's heading
 * @returns {Stack[]} one entry per stack rule file
 */
export const listStacks = ({ rulesDirectory, commonRulesFile }, files) =>
  files
    .listDirectory(rulesDirectory)
    .filter((fileName) => fileName.endsWith(".md") && fileName !== basename(commonRulesFile))
    .map((fileName) => {
      const file = join(rulesDirectory, fileName);
      const name = basename(fileName, ".md");

      return { name, file, label: labelFromHeading(files.readText(file) ?? "", name) };
    });

/**
 * "# React conventions" → "React". Falls back to the file name.
 * @param {string} text the rule file's text
 * @param {string} fallback used when there is no heading, usually the file name
 * @returns {string} the label, e.g. "React"
 */
export const labelFromHeading = (text, fallback) => {
  const heading = text.split(LINE_BREAK).find((line) => line.startsWith(HEADING_PREFIX));

  return heading
    ? heading
        .slice(HEADING_PREFIX.length)
        .replace(CONVENTIONS_SUFFIX, "")
        .trim()
    : fallback;
};

/**
 * Every stack, each with why it applies to this app, or null when its detector found nothing.
 * @param {Stack[]} stacks every stack, from listStacks
 * @param {import("./apps.mjs").AppFacts} facts what the app's folder holds, e.g. its package.json dependencies
 * @returns {DetectedStack[]} the same stacks, each with its reason
 */
export const detectStacks = (stacks, facts) =>
  stacks.map((stack) => ({ ...stack, reason: STACK_DETECTORS[stack.name]?.(facts) ?? null }));
