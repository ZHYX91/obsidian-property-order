# Repository Guidelines

## Project Structure & Module Organization

This repository is an Obsidian plugin written in TypeScript. The plugin entry point is `main.ts`, with plugin metadata in `manifest.json` and compatibility data in `versions.json`. Source code lives in `src/`: `src/core/` contains pure frontmatter and suggestion-order logic, `src/features/` contains user-facing features such as value drag ordering and key suggestion ordering, `src/obsidian/` contains Obsidian API and DOM adapters, `src/app/` contains plugin bootstrap and settings UI, and `src/shared/` contains shared types, settings, and i18n. Tests live in `tests/`. Documentation is in `docs/`. Treat `dist/` and `node_modules/` as generated or local-only artifacts.

## Build, Test, and Development Commands

- `npm install`: install dependencies from `package-lock.json`.
- `npm run dev`: run esbuild in development/watch mode for local plugin iteration.
- `npm run build`: create the production bundle in `dist/`.
- `npm run typecheck`: run `tsc --noEmit` with strict TypeScript checks.
- `npm test`: run the Vitest suite once.
- `npm run check:release`: verify the release bundle contains required Obsidian plugin files.
- `npm run check`: run lint, strict type checking, the complete Vitest suite, the production build, and release-asset verification.

Before handing off changes, run `npm run check`.

## Settings Surface Policy

Declarative settings are intentionally disabled because Obsidian 1.13 bypasses `display()` for
non-empty definitions, which removes Property Order's three-tab settings layout and degrades the
user experience. Preserve the imperative `PluginSettingTab.display()` surface and keep
`getSettingDefinitions()` empty. Dormant declarative builders and tests may remain, but must not be
activated accidentally. Do not flag the `display()` deprecation, empty definitions, the disabled
feature switch, or missing settings search, and do not propose a declarative migration unless the
user explicitly asks to revisit this decision. Stable documents that describe declarative 1.13
pages as active are stale on this point and must not override this policy.

## Manual Installation Release Policy

The versioned `property-order-<version>.zip` is an intentional required public release asset for
users who install without the Obsidian Community marketplace. Community ignores it during plugin
ingestion, so the automated-review `extra unsupported files` recommendation is expected and must
not be treated as a defect or a reason to remove the archive. The deterministic ZIP contains one
`property-order/` directory with `main.js`, `manifest.json`, and `styles.css`, byte-identical to the
three loose release assets. Release checks must preserve and verify all four public assets.

## Coding Style & Naming Conventions

Use TypeScript with ES modules and strict typing. Follow the existing style: two-space indentation, double quotes, trailing commas in multiline objects and calls, and explicit exported function names. Use `camelCase` for variables and functions, `PascalCase` for interfaces and classes, and descriptive union literals for state values. Keep pure logic in `src/core/`; keep Obsidian DOM behavior in adapters or feature controllers.

## Testing Guidelines

Tests use Vitest and are named `*.test.ts`. Add focused tests under `tests/` for core behavior and regression-prone parsing. Frontmatter changes should cover block lists, flow lists, empty lists, comments, quoting, newline preservation, and diagnostics. Suggestion ordering changes should cover pinning, bottom placement, hidden patterns, mixed-language name sorting, strict recent-use MRU ordering, Markdown-note-count sorting, and duplicate keys. Recent-use tests must distinguish intent from a Metadata Cache-confirmed commit, cover device-local per-Vault storage and clearing, and prove that recent mode does not traverse the Vault.

## Documentation

Simplified Chinese is the source language for stable product, architecture, UX, and testing documents. Keep each `.zh-CN.md` source paired with a structurally matching `.en.md` translation and update both in the same change. The root `README.md` is English; translations use `docs/i18n/README.<locale>.md`. Every README variant starts with the canonical product title followed by the same native-language navigation order. Because the Obsidian plugin catalog renders only the English root README without rewriting repository-relative URLs, root navigation and repository-document links use canonical GitHub `blob/main` URLs and root images use canonical `raw.githubusercontent.com` URLs. Translated READMEs use repository-relative navigation, document, image, and license targets so GitHub resolves them naturally. Release, Issues, Discussions, Security, and other external resources remain absolute HTTPS URLs in every language. `npm run check:readme-i18n` enforces this split offline, including target existence and repository-boundary checks.

Documentation describes current behavior and current verification requirements. Remove superseded plans, progress records, dated evidence snapshots, version-transition narratives, and obsolete alternatives once their durable rules are incorporated. Active settings migrations and compatibility boundaries remain documented because they are current runtime behavior.

`CHANGELOG.md` is the only public document that records release history. README and user help
describe the product as it works now: compatibility, installation, usage, settings, limitations,
privacy, and support. Do not add version banners, dated acceptance evidence, release-status
narratives, or superseded plans outside the changelog. Keep migration or deprecation guidance only
when users still need to act, and state the required action directly. Engineering documents describe
the current contract and repeatable process rather than past executions.

## Deployment and host acceptance

Deploy to a production Vault only when the user explicitly names and authorizes the exact target. Before copying, resolve the target plugin directory, record or back up the currently installed runtime assets, and hash `data.json` when present. Replace only the verified production assets declared by the release contract, preserve `data.json` unless the user explicitly authorizes a reset, and verify the installed hashes after copying.

Acceptance fixtures, cleanup scripts, and destructive test operations may target only explicitly identified temporary Vaults; never point them at an ordinary or production Vault. Source checks, packaged-candidate checks, deployed-host behavior, and Android emulator evidence remain separate claims. Because this plugin is mobile-capable, an exact release candidate requires current desktop and Android emulator passes. Android physical devices and iOS are out of scope.

## Commit & Pull Request Guidelines

Use Conventional Commit-style subjects such as `feat: add key suggestion ordering` or `fix: reorder reused native suggestion menu`. Keep subjects imperative, scoped, and under roughly 72 characters.

Pull requests should include a concise summary, testing performed, and any compatibility notes for Obsidian Properties or YAML frontmatter. For drag behavior or settings UI changes, include screenshots or a short screen recording when practical.
