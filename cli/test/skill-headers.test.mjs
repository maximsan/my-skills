// @ts-check
// Every skill's header must read the same in strict YAML readers, such as the `skills` installer. In an unquoted value,
// ": " or a closing ":" reads as a nested key, which those readers refuse, and " #" silently cuts the value short.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const SKILLS = fileURLToPath(new URL("../../skills", import.meta.url));
const HEADER = /^---\n(?<lines>[\s\S]*?)\n---\n/;
const KEY_LINE = /^(?<key>[\w-]+):(?<value>.*)$/;
const QUOTED_OR_BLOCK = /^\s*['"|>]/;
const CONTINUATION = /^\s+\S/;
const BREAKS_STRICT_YAML = /:(?: |$)| #/;

const skillFiles = readdirSync(SKILLS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== "shared")
  .map((entry) => join(SKILLS, entry.name, "SKILL.md"));

/**
 * The keys whose unquoted value strict YAML reads differently, including a value continued on indented lines.
 * @param {string} header the lines between the header's two `---` lines
 * @returns {string[]} the keys with such a value, none when every value reads the same
 */
const keysBreakingStrictYaml = (header) => {
  /** @type {{ key: string, value: string }[]} */
  const plainValues = [];

  for (const line of header.split("\n")) {
    const field = line.match(KEY_LINE)?.groups;
    const lastValue = plainValues.at(-1);

    if (field) {
      if (!QUOTED_OR_BLOCK.test(field.value)) {
        plainValues.push({ key: field.key, value: field.value });
      }
    } else if (lastValue && CONTINUATION.test(line)) {
      lastValue.value += ` ${line.trim()}`;
    }
  }

  return plainValues.filter(({ value }) => BREAKS_STRICT_YAML.test(value.trim())).map(({ key }) => key);
};

for (const skillFile of skillFiles) {
  test(`${skillFile.slice(SKILLS.length + 1)}: every unquoted header value reads the same in strict YAML`, () => {
    const header = readFileSync(skillFile, "utf8").replaceAll("\r\n", "\n").match(HEADER)?.groups?.lines;

    assert.ok(header !== undefined, "the file starts with a header between two --- lines");
    assert.deepEqual(keysBreakingStrictYaml(header), []);
  });
}

test("the check catches each way strict YAML misreads a value", () => {
  assert.deepEqual(keysBreakingStrictYaml("description: one: two"), ["description"]);
  assert.deepEqual(keysBreakingStrictYaml("description: ends:"), ["description"]);
  assert.deepEqual(keysBreakingStrictYaml("description: a #b"), ["description"]);
  assert.deepEqual(keysBreakingStrictYaml("description: a\n  cont: x"), ["description"]);
  assert.deepEqual(keysBreakingStrictYaml("description: 'one: two'\nname: fine"), []);
});
