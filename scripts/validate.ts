import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface LanguageContribution {
  id: string;
  extensions?: string[];
  configuration: string;
}

interface GrammarContribution {
  language: string;
  scopeName: string;
  path: string;
}

interface ExtensionManifest {
  name: string;
  publisher?: string;
  author?: string;
  license?: string;
  homepage?: string;
  packageManager?: string;
  preview?: boolean;
  repository?: unknown;
  scripts?: Record<string, string>;
  contributes?: {
    languages?: LanguageContribution[];
    grammars?: GrammarContribution[];
  };
}

interface GrammarPattern {
  name?: string;
  match?: string;
  begin?: string;
  end?: string;
  captures?: Record<string, { name?: string }>;
  beginCaptures?: Record<string, { name?: string }>;
  patterns?: GrammarPattern[];
  [key: string]: unknown;
}

interface TextMateGrammar extends GrammarPattern {
  scopeName: string;
  repository: Record<string, GrammarPattern>;
}

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(extensionRoot, "..");

const readJson = <Value>(path: string): Value =>
  JSON.parse(readFileSync(path, "utf8")) as Value;

const manifest = readJson<ExtensionManifest>(join(extensionRoot, "package.json"));
const grammar = readJson<TextMateGrammar>(
  join(extensionRoot, "syntaxes", "acadia.tmLanguage.json")
);
readJson<unknown>(join(extensionRoot, "language-configuration.json"));

function fail(message: string): never {
  throw new Error(message);
}

if (manifest.name !== "acadia-syntax") {
  fail("The extension manifest must be named acadia-syntax.");
}

if (manifest.publisher !== "kvothe") {
  fail("The Marketplace publisher must be kvothe.");
}
if (manifest.author !== "Flavio Corpa <flaviocorpa@gmail.com> (https://flaviocorpa.com)") {
  fail("The author metadata is incomplete.");
}
if (manifest.license !== "MIT") {
  fail("The extension must declare the MIT license.");
}
if (manifest.homepage !== "https://flaviocorpa.com") {
  fail("The extension homepage is missing.");
}
if (!manifest.packageManager?.startsWith("pnpm@")) {
  fail("The extension must declare pnpm as its package manager.");
}
if (manifest.preview !== true) {
  fail("Pre-1.0 Marketplace releases must be marked as previews.");
}
if (manifest.repository !== undefined) {
  fail("Repository metadata must stay private until publication is authorized.");
}

for (const [script, command] of [
  ["vsce:package", "vsce package --allow-missing-repository"],
  ["vsce:publish", "vsce publish --allow-missing-repository"]
] as const) {
  if (manifest.scripts?.[script] !== command) {
    fail(`The ${script} script is not configured for a private repository.`);
  }
}

for (const filename of ["README.md", "CHANGELOG.md", "SUPPORT.md", "LICENSE"]) {
  if (!existsSync(join(extensionRoot, filename))) {
    fail(`Required Marketplace file ${filename} is missing.`);
  }
}

if (!readFileSync(join(extensionRoot, "LICENSE"), "utf8").startsWith("MIT License")) {
  fail("The LICENSE file does not contain the MIT License.");
}

const language = manifest.contributes?.languages?.find(({ id }) => id === "acadia");
if (!language) {
  fail("The extension manifest must contribute the Acadia language.");
}
if (!language.extensions?.includes(".db")) {
  fail("The Acadia language must register the .db extension.");
}

const grammarContribution = manifest.contributes?.grammars?.find(
  ({ language: id }) => id === "acadia"
);
if (!grammarContribution) {
  fail("The extension manifest must contribute an Acadia grammar.");
}
if (grammarContribution.scopeName !== grammar.scopeName) {
  fail("The manifest and TextMate grammar scope names do not match.");
}
if (!existsSync(resolve(extensionRoot, grammarContribution.path))) {
  fail("The contributed TextMate grammar path does not exist.");
}
if (!existsSync(resolve(extensionRoot, language.configuration))) {
  fail("The contributed language configuration path does not exist.");
}

let regexCount = 0;
const validateRegexes = (value: unknown, path = "grammar"): void => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateRegexes(item, `${path}[${index}]`));
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (["match", "begin", "end", "firstLineMatch"].includes(key)) {
      if (typeof child !== "string") {
        fail(`Expected a regular expression string at ${path}.${key}.`);
      }

      try {
        new RegExp(child);
        regexCount += 1;
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        fail(`Invalid regular expression at ${path}.${key}: ${detail}`);
      }
    } else {
      validateRegexes(child, `${path}.${key}`);
    }
  }
};

validateRegexes(grammar);

const getRule = (repositoryName: string): GrammarPattern => {
  const rule = grammar.repository[repositoryName];
  if (!rule || (!rule.match && !rule.begin)) {
    fail(`Missing testable grammar rule ${repositoryName}.`);
  }
  return rule;
};

const getPattern = (repositoryName: string, index: number): GrammarPattern => {
  const pattern = grammar.repository[repositoryName]?.patterns?.[index];
  if (!pattern?.match) {
    fail(`Missing testable grammar rule ${repositoryName}[${index}].`);
  }
  return pattern;
};

const grammarChecks: Array<readonly [string, GrammarPattern, string]> = [
  ["database module", getRule("module-declaration"), "database module Backend"],
  ["import", getRule("imports"), "import Acadia.Transaction"],
  ["endpoint", getPattern("module-exports", 0), "endpoint addFood"],
  ["type alias", getRule("type-alias-declaration"), "type alias Food"],
  ["type signature", getRule("type-signature"), "getFoods : Transaction Rows"],
  ["transaction binding", getPattern("operators", 0), ":="],
  ["pipeline", getPattern("operators", 2), "|>"],
  ["module prefix", getRule("module-prefix"), "Time."],
  ["record type field", getPattern("type-record", 0), "attemptedAt : Time.Posix"]
];

for (const [name, pattern, sample] of grammarChecks) {
  const expression = pattern.match ?? pattern.begin;
  if (!expression || !new RegExp(expression).test(sample)) {
    fail(`The ${name} grammar rule does not recognize ${JSON.stringify(sample)}.`);
  }
}

const scopeChecks: Array<readonly [string, string | undefined, string]> = [
  ["module name", getRule("module-chunk").name, "support.module.acadia"],
  [
    "type alias name",
    getRule("type-alias-declaration").beginCaptures?.["3"]?.name,
    "storage.type.acadia"
  ],
  [
    "type-signature type",
    getPattern("type-signature-chunk", 3).name,
    "storage.type.acadia"
  ],
  [
    "record type field",
    getPattern("type-record", 0).captures?.["1"]?.name,
    "entity.name.record.field.acadia"
  ],
  ["constructor", getRule("constructor").name, "constant.type-constructor.acadia"]
];

for (const [name, actual, expected] of scopeChecks) {
  if (actual !== expected) {
    fail(`The ${name} scope must be ${expected}, received ${String(actual)}.`);
  }
}

const findFiles = (directory: string, extension: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory()
      ? findFiles(path, extension)
      : path.endsWith(extension)
        ? [path]
        : [];
  });

const samples = findFiles(join(repositoryRoot, "examples"), ".db");
if (samples.length === 0) {
  fail("No Acadia .db examples were found for validation.");
}

const source = samples.map((path) => readFileSync(path, "utf8")).join("\n");
for (const construct of [
  "database module",
  "endpoint",
  "type alias",
  "import",
  "exposing",
  ":=",
  "|>",
  "\\"
]) {
  if (!source.includes(construct)) {
    fail(`The sample corpus does not exercise the ${JSON.stringify(construct)} construct.`);
  }
}

console.log(
  `Validated ${regexCount} grammar expressions, ${grammarChecks.length} core rules, and ${scopeChecks.length} Elm-compatible scopes against ${samples.length} Acadia .db examples.`
);
