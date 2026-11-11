// @ts-check
// Every skill's header must parse in strict YAML readers too, such as the `skills` installer. An unquoted value that
// holds ": " or " #" is refused there: the first reads as a nested key, the second as a comment.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const SKILLS = fileURLToPath(new URL("../../skills", import.meta.url));
const HEADER = /^---\n(?<lines>[\s\S]*?)\n---\n/;
const PLAIN_VALUE = /^(?<key>[\w-]+): (?<value>[^'"|>].*)$/;
const BREAKS_STRICT_YAML = /: | #/;

const skillFiles = readdirSync(SKILLS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== "shared")
  .map((entry) => join(SKILLS, entry.name, "SKILL.md"));

for (const skillFile of skillFiles) {
  test(`${skillFile.slice(SKILLS.length + 1)}: every unquoted header value reads the same in strict YAML`, () => {
    const lines = readFileSync(skillFile, "utf8").match(HEADER)?.groups?.lines ?? "";
    const refused = lines
      .split("\n")
      .map((line) => line.match(PLAIN_VALUE)?.groups)
      .filter((field) => field !== undefined && BREAKS_STRICT_YAML.test(field.value))
      .map((field) => field?.key);

    assert.deepEqual(refused, []);
  });
}
