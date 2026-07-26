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

## Coding Style & Naming Conventions

Use TypeScript with ES modules and strict typing. Follow the existing style: two-space indentation, double quotes, trailing commas in multiline objects and calls, and explicit exported function names. Use `camelCase` for variables and functions, `PascalCase` for interfaces and classes, and descriptive union literals for state values. Keep pure logic in `src/core/`; keep Obsidian DOM behavior in adapters or feature controllers.

## Testing Guidelines

Tests use Vitest and are named `*.test.ts`. Add focused tests under `tests/` for core behavior and regression-prone parsing. Frontmatter changes should cover block lists, flow lists, empty lists, comments, quoting, newline preservation, and diagnostics. Suggestion ordering changes should cover pinning, bottom placement, hidden patterns, mixed-language name sorting, usage sorting, and duplicate keys.

## Documentation

Simplified Chinese is the source language for stable product, architecture, UX, and testing documents. Keep each `.zh-CN.md` source paired with a structurally matching `.en.md` translation and update both in the same change. The root `README.md` is English; its Simplified Chinese counterpart lives at `docs/i18n/README.zh-CN.md`, and language links use absolute GitHub URLs so they work in the Obsidian plugin catalog.

Documentation describes current behavior and current verification requirements. Remove superseded plans, progress records, dated evidence snapshots, version-transition narratives, and obsolete alternatives once their durable rules are incorporated. Active settings migrations and compatibility boundaries remain documented because they are current runtime behavior.

## Commit & Pull Request Guidelines

Use Conventional Commit-style subjects such as `feat: add key suggestion ordering` or `fix: reorder reused native suggestion menu`. Keep subjects imperative, scoped, and under roughly 72 characters.

Pull requests should include a concise summary, testing performed, and any compatibility notes for Obsidian Properties or YAML frontmatter. For drag behavior or settings UI changes, include screenshots or a short screen recording when practical.
