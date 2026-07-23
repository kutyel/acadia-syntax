# Acadia Syntax

Syntax highlighting and basic editor configuration for the
[Acadia database programming language](https://acadia.engineering/documentation).

The extension associates `*.db` files with Acadia and recognizes the syntax
used by the examples in this repository and the documented language API:

- Elm-style modules, imports, types, records, functions, pattern matching, and
  pipelines
- Acadia's `database`, `endpoint`, and transactional `:=` constructs
- line comments, nested block comments, strings, characters, and numbers
- documented numeric and time types, time units, constructors, and operators
- qualified module functions such as `Time.now` and types such as `Time.Posix`

The grammar intentionally uses the same base TextMate scopes as the Elm VS Code
extension for module paths, type declarations, type variables, constructors,
record fields, and top-level values. Themes should therefore color equivalent
Elm and Acadia constructs consistently.

This is a TextMate grammar only. It has no runtime code and does not provide
completion, type checking, formatting, or diagnostics.

## Try it locally

1. Open this `acadia-syntax` directory in VS Code.
2. Press `F5` and choose **VS Code Extension Development Host** if prompted.
3. Open any of the repository's `examples/*/src/Backend.db` files.

Create a VSIX with the pinned Microsoft publishing tool:

```sh
pnpm vsce:package
code --install-extension acadia-syntax-0.1.1.vsix
```

Install the TypeScript development tools and run the structural checks with:

```sh
pnpm install
pnpm test
```

## `.db` file association

Acadia currently uses the broad `.db` extension, which is also commonly used
for binary SQLite databases. VS Code may therefore select Acadia for an unrelated
`.db` file. Use **Change Language Mode** in the status bar when that happens.

## Publishing to the Marketplace

The extension is configured for the `kvothe` Visual Studio Marketplace
publisher. The source repository is intentionally private, so the VSCE scripts
use `--allow-missing-repository` and do not expose a repository URL.

After authenticating VSCE as `kvothe`, publish with:

```sh
pnpm vsce:publish
```

## Support and license

See `SUPPORT.md` for help. Acadia Syntax is available under the MIT License in
`LICENSE`.
