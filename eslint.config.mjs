// @ts-check
// eslint.config.mjs - lint and formatting rules for the CLI. `npm run lint` checks, `npm run format` fixes.

import eslintJs from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import jsdoc from "eslint-plugin-jsdoc";
import globals from "globals";

const INDENT_SPACES = 2;
const MAX_LINE_LENGTH = 120;
const MIN_NAME_LENGTH = 3;

// Short names that read as words; every other name of one or two letters is short for something.
const SHORT_WORDS = ["ui"];

// Names that are short for something; spell out what they hold instead.
const UNCLEAR_NAMES = [
  "arr", "buf", "cb", "cfg", "ctx", "fn", "idx", "num", "obj", "opts", "rel", "res", "ret", "str", "tmp", "val",
];

// Numbers and regexes live in named module-level constants. ESLint's no-magic-numbers can't express
// this: it also flags the parts of a constant such as `2 * 60 * 1000`. So the rule is "no number
// other than 0 or 1, and no regex, inside a function".
const NO_INLINE_VALUES = [
  {
    selector: ":function Literal[regex]",
    message: "Move this regex to a named constant at the top of the file.",
  },
  {
    selector: String.raw`:function Literal[raw=/^(?![01]$)\d/]`,
    message: "Move this number to a named constant at the top of the file.",
  },
];

// Only the entry points talk to the process: run.mjs for the tool, each script Claude Code runs as a hook, and each
// script a skill runs. The rest takes the operating system and the home folder from the context.
const PROCESS_MESSAGE = "Take this from the command's context; only the entry points read it from the process.";
const NO_PROCESS_READS = [
  { selector: "MemberExpression[object.name='process'][property.name='platform']", message: PROCESS_MESSAGE },
  { selector: "ImportSpecifier[imported.name='homedir']", message: PROCESS_MESSAGE },
];

// Blank lines separate the logical parts of a function: declarations, blocks, and the final return.
const PADDING_LINES = [
  { blankLine: "always", prev: ["const", "let"], next: "*" },
  { blankLine: "always", prev: "*", next: ["const", "let"] },
  { blankLine: "any", prev: ["const", "let"], next: ["const", "let"] },
  { blankLine: "always", prev: "*", next: ["block-like", "return", "throw"] },
  { blankLine: "always", prev: "block-like", next: "*" },
  { blankLine: "always", prev: "import", next: "*" },
  { blankLine: "any", prev: "import", next: "import" },
];

export default [
  // The changelog checker is a repo tool, not part of the CLI. Worktrees under .claude/ are other checkouts of this
  // repo: eslint doesn't read .gitignore, so it would lint them as part of this one.
  { ignores: ["node_modules/", "scripts/", ".claude/worktrees/"] },
  eslintJs.configs.recommended,
  jsdoc.configs["flat/recommended-typescript-flavor-error"],
  stylistic.configs.customize({
    indent: INDENT_SPACES,
    quotes: "double",
    semi: true,
    jsx: false,
    arrowParens: true,
    braceStyle: "1tbs",
    commaDangle: "always-multiline",
    quoteProps: "as-needed",
  }),
  {
    languageOptions: { globals: globals.node },
    settings: { jsdoc: { mode: "typescript" } },
    rules: {
      // Every body in braces, and a brace body never on one line: `return` always starts its own line.
      curly: ["error", "all"],
      "@stylistic/brace-style": ["error", "1tbs", { allowSingleLine: false }],
      "@stylistic/max-statements-per-line": ["error", { max: 1 }],
      "@stylistic/max-len": ["error", { code: MAX_LINE_LENGTH, ignoreUrls: true }],
      "@stylistic/padding-line-between-statements": ["error", ...PADDING_LINES],

      // A comment sits on its own line above the code it explains, after a blank line.
      "@stylistic/line-comment-position": ["error", { position: "above" }],
      "@stylistic/lines-around-comment": ["error", {
        beforeLineComment: true,
        allowBlockStart: true,
        allowObjectStart: true,
        allowArrayStart: true,
        allowClassStart: true,
      }],

      "id-length": ["error", { min: MIN_NAME_LENGTH, properties: "never", exceptions: SHORT_WORDS }],
      "id-denylist": ["error", ...UNCLEAR_NAMES],
      "no-restricted-syntax": ["error", ...NO_INLINE_VALUES, ...NO_PROCESS_READS],

      // Every exported function has a doc comment: other files use it without reading its body.
      // A function used only in its own file gets one only when its name and code don't explain it.
      "jsdoc/require-jsdoc": ["error", {
        publicOnly: true,
        require: { FunctionDeclaration: true },
        contexts: ["VariableDeclarator > ArrowFunctionExpression", "VariableDeclarator > FunctionExpression"],
      }],
      "jsdoc/require-description": "error",

      // Types are checked by `npm run typecheck`, which knows Node's types; this rule doesn't.
      "jsdoc/no-undefined-types": "off",
    },
  },
  {
    files: ["cli/run.mjs", "cli/hooks/*.mjs", "skills/*/scripts/*.mjs"],
    rules: { "no-restricted-syntax": ["error", ...NO_INLINE_VALUES] },
  },
  {
    // Tests keep fixture values and expected-output patterns inline, where they read best, and may ask the
    // process which operating system they run on.
    files: ["cli/test/**/*.mjs"],
    rules: { "no-restricted-syntax": "off" },
  },
];
