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

The unified gate runs `npm run test:coverage` and enforces global minimum coverage of 86% statements,
83% branches, 88% functions, and 86% lines, as configured in `vitest.config.mts`. Coverage output,
a successful local build, or isolated fixtures do not prove real Obsidian host behavior.

## Documentation and release changes

Simplified Chinese is the source language for stable paired documents. Keep their content,
frontmatter, heading levels, code-fence languages, table shapes, relative links, and required
contract tokens in sync. `npm run check:docs-i18n` checks the structural contract; review the
meaning of each translation as well.

The interface and complete README support the same 12 languages, listed in
`src/shared/locale-catalog.ts`. Engineering documents remain paired Simplified Chinese and English.
When changing translations or adding a language:

1. Update the catalog when a language is added. Give it a stable ID and its native name; preserve
   the existing `auto`, `en`, `zh-CN`, and `zh-TW` settings IDs.
2. Provide a complete dictionary under `src/shared/locales/` that satisfies
   `TranslationDictionary`. Translate every key in the English source, preserving each string's
   placeholder names and counts, along with literal technical examples. Do not spread English
   strings or leave missing keys to fallback.
3. Translate the entire root README into `docs/i18n/README.<locale>.md`, including every section,
   subsection, setup step, limitation, and support link. Use the same control names as the UI and
   keep the title `# Property Order`. Register the complete translated H2 sequence and required
   phrase for property-type grouping in `scripts/check-readme-i18n.mjs`.
4. Keep the shared navigation's native names and language order. The English root README uses
   canonical GitHub `blob/main` URLs for navigation and repository documents, and
   `raw.githubusercontent.com` URLs for images. Translated READMEs use relative links for
   navigation, repository documents, images, and the license. Release, Issues, Discussions,
   Security, and other external destinations remain absolute HTTPS URLs in every language.

Run `npm run check:readme-i18n`, `npm run check:docs-i18n`, and
`npx vitest run tests/shared/i18n.test.ts` after translation changes. These checks verify structure, links, keys, and placeholders; they do not replace a
review for natural language and agreement between the UI and README.

Write each document for its intended reader:

- README explains what users can do, how to configure it, and the practical limitations.
- Product requirements describe observable product behavior and boundaries, not implementation steps.
- UX specification describes visible interaction, accessibility, and recovery behavior.
- Architecture owns internal APIs, state machines, adapters, lifecycle details, and compatibility mechanisms.
- Testing strategy explains what evidence is required and how it is grouped; prefer readable categories over audit-style sentences that concatenate dozens of checks.

Release preparation and publication are separate actions. Contributors may prepare version and
documentation changes, but a pull request or local `npm run release:check` does not authorize a tag,
GitHub Release, or Vault deployment. Maintainers follow the canonical
repository-owned release commands only after explicit publication approval.

## Reporting problems

Use the repository issue templates for reproducible bugs and feature proposals. Do not disclose a
suspected vulnerability in a public issue; follow [SECURITY.md](SECURITY.md) instead.
