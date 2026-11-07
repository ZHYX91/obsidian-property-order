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

## Lint dependency maintenance

Caller-scoped overrides keep minimatch at 11.0.4 in the development dependency tree.
`npm ci` runs `scripts/prepare-lint-dependencies.mjs` to adapt the legacy callers to its
named exports and `Minimatch.match` API. The script accepts only reviewed package versions
and exact source fragments; it fails if upstream changes invalidate a patch. Review and
remove the corresponding adaptation when upgrading a caller that supports the new API.
These changes do not enter the plugin runtime bundle.

`npm run lint` first reapplies the adaptations idempotently, then runs
`scripts/check-lint-dependencies.mjs`. The check verifies every locked and resolved minimatch
version and exercises matching and nonmatching cases through the installed callers. Rule
probes use each caller's installed ESLint peer; they do not establish compatibility with a
different ESLint major. The normal lint command independently checks the active repository
configuration without disabling rules. If installation used `--ignore-scripts`, run
`npm run prelint` before invoking ESLint directly.

## Shared maintenance tool snapshots

`scripts/shared-tools.lock.json` records the source repository, one full reviewed commit,
and SHA-256 values for `runtime-contract.mjs`, `prepare-lint-dependencies.mjs` and
`check-lint-dependencies.mjs`. Their existing paths are the snapshots; there is no second
copy or runtime dependency on another plugin. The source is
[Property Order](https://github.com/ZHYX91/obsidian-property-order).

`npm run check:tools` compares the checked-in files with this local lock. It runs offline;
it does not query GitHub or authenticate the recorded commit remotely. Runtime checks,
installation hooks, lint preparation and build entry points reject drift before loading
these tools. Runtime checks require the exact Node/npm versions and agreement between
`.node-version`, `engines.node` and `packageManager`. With dependencies installed, builds
need no network connection or sibling repository to obtain maintenance code.

To update a snapshot:

1. Review changes to the three source files in Property Order and select the full commit
   containing those changes. Preserve the reviewed lint adaptations until their upstream
   callers support the newer API.
2. Copy all three files from that exact commit into the same paths in each consuming
   repository. Update the lock's commit and SHA-256 values from those exact bytes together;
   an arbitrary local edit and a new hash are not evidence of reviewed upstream source.
3. For Property Order itself, commit the reviewed source changes first, then update its
   lock to that existing commit in a follow-up commit. This keeps the source identity
   concrete without requiring a commit to name itself.
4. Run `npm run check:tools`, `npm run check:runtime`, `npm run test:tools`, and
   `npm run check`. Review the installed lint-caller probes as part of the normal lint gate.

The source snapshot and dependency lock serve different purposes. Updating these scripts
alone does not authorize changing dependency versions, publishing packages or releasing a plugin.
