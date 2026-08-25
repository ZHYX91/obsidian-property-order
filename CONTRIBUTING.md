# Contributing to Property Order

Thank you for helping improve Property Order. Keep every contribution understandable and
verifiable from a standalone clone of this repository.

## Development setup

The repository pins Node.js 24.19.0 in `.node-version` and npm 11.17.0 in `package.json`. Use those
exact versions, then install the lockfile without updating it:

```sh
npm ci
```

Do not run test fixtures or cleanup commands against an ordinary Vault. Repository tests use
isolated fixtures; real-host testing requires a deliberately selected disposable Vault.

## Making a change

1. Start from a clean branch and keep unrelated changes out of the patch.
2. Add or update focused regression tests for changed behavior.
3. Keep Obsidian-dependent orchestration outside `src/core/`; the lint gate enforces the core
   import boundary.
4. Preserve the Chinese source and synchronized English structure when changing a stable document
   pair under `docs/`.
5. Add user-visible changes under `[Unreleased]` in `CHANGELOG.md`.

The repository uses Conventional Commit subjects such as `fix:`, `feat:`, `docs:`, `test:`, and
`chore:`. Do not include local paths, private Vault names, credentials, or machine-specific
evidence in commits or public artifacts.

## Verification

Run the complete gate before requesting review:

```sh
npm run check
```

The gate verifies the runtime pins, lint rules, deterministic text format, bilingual documentation,
TypeScript, unit and integration tests with V8 coverage, the production bundle, and release assets.
`npm run format:check` is intentionally a checker rather than a rewriting formatter: repository
text must be valid UTF-8 without a BOM, use LF line endings, contain no NUL or trailing whitespace,
and end with a newline.

The unified gate runs `npm run test:coverage` and produces its report without imposing a global
percentage threshold. Coverage output, a successful local build, or isolated fixtures do not prove
real Obsidian host behavior.

## Documentation and release changes

Simplified Chinese is the source language for stable paired documents. Keep their frontmatter,
heading levels, code-fence languages, table shapes, relative links, and required contract tokens in
sync; `npm run check:docs-i18n` enforces those rules.

Release preparation and publication are separate actions. Contributors may prepare version and
documentation changes, but a pull request or local `npm run release:check` does not authorize a tag,
GitHub Release, or Vault deployment. Maintainers follow the canonical
[release guide](docs/release.en.md) only after explicit publication approval.

## Reporting problems

Use the repository issue templates for reproducible bugs and feature proposals. Do not disclose a
suspected vulnerability in a public issue; follow [SECURITY.md](SECURITY.md) instead.
