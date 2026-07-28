---
source_language: zh-CN
translation_of: testing-strategy.zh-CN.md
translation_status: synced
---

# Property Order Testing Strategy

This document mirrors the authoritative current automated gates, real-host matrix, release contract, and verification boundary for Property Order.

## Automated gate

Run `npm run check` before handoff. It performs, in order:

1. the official `eslint-plugin-obsidianmd` recommended rule set, with documented compatibility exceptions, against plugin entry and source files, plus environment-appropriate static rules for tests, Node scripts, and tool configuration; all enabled warnings are treated as failures;
2. strict TypeScript checking;
3. the complete current Vitest suite;
4. the production bundle;
5. reproducible bundle verification plus static-asset, manifest, and version-contract checks.

The lint gate uses current Obsidian API typings while `manifest.json` remains the compatibility contract. Native DOM creation is retained only where the target `ownerDocument` is required for popout support. Settings use dual support: Obsidian 1.12.x keeps the imperative three-tab UI, while 1.13+ uses native declarative pages and search. Automated contracts require both definitions to cover the same persisted settings, preserve custom rule editors, and avoid Vault enumeration while the declarative search index is built.

Tests are organized under `tests/core/`, `tests/features/`, `tests/obsidian/`, `tests/shared/`, `tests/app/`, and `tests/scripts/`. Stable contracts cover:

- flow/block/empty lists, safe null/scalar coercion under a host list type, BOM, LF/CRLF/CR, quoting, comments, blank lines, YAML core scalar types, and unsupported-structure fail closed;
- desktop mouse/touch/pen state, mobile native-menu extension and one-shot arming, drop geometry, empty-list versus empty-scalar classification, non-list rejection, no Notice while passing over, one Notice on release, no-op, cancellation, content conflict, pane/file/editor identity, unsaved editor text, one editor transaction, ineffective transactions, and no manual mutation of host pill DOM;
- Properties and suggestion DOM adapters, visible ordering, all-hidden behavior, keyboard navigation, focus departure, usage-cache invalidation without a Vault scan when no menu is open, and fail open;
- settings migration, immediate application, persistence failure, Retry, pre-1.13 tab semantics, 1.13 declarative pages/search, custom control storage, and narrow-layout CSS;
- release tags, three loose assets, the manual-install archive, and idempotent Release updates.

Injectable failure paths rely primarily on automated evidence: rejected settings persistence, host-DOM mismatch, selection-sync failure, Escape/blur, component removal, external conflict, and asynchronous reordering. Real hosts verify actual Obsidian DOM, input, visuals, and disk results without duplicating failures that cannot be injected reliably.

## Isolated Vault

Real acceptance uses only an isolated Vault. Fixture commands are:

```powershell
npm run acceptance:fixtures -- --vault <isolated-vault> --force
npm run acceptance:conflict -- --vault <isolated-vault> --file <fixture> --delay-ms 55
```

Scripts validate the Obsidian Vault, resolve real paths, and constrain writes. LF, CRLF, and CR fixtures verify the generator and pure rewrite contract byte-for-byte. Real-editor scenarios verify final YAML, preserved body text, and undo/redo on disk, while separately recording the host's newline serialization instead of attributing Obsidian's native CRLF/CR-to-LF save behavior to the plugin.

## Real-host release matrix

Desktop Obsidian verifies:

- enable, disable, reload, and full restart;
- same-property forward/backward/first/last/no-op and cross-property enabled/disabled behavior; a host-defined list target accepts and correctly formats `[]`, an empty value, or a supported scalar in YAML, while a host non-list target rejects the move;
- multiple leaves, cross-file refusal, real content conflict, and `preserve`/`flow`/`block` writeback;
- a non-list target shows a warning outline and `not-allowed` cursor without an insertion line in both themes, leaving it shows no Notice, and releasing on it shows exactly one Notice without writeback;
- one `Ctrl+Z` undo and one redo for each successful drag, without overwriting unsaved body edits;
- pinned/hidden/bottom, name/usage, menu reuse, all-hidden, hover-to-keyboard, arrows/Home/End/PageUp/PageDown/Enter/Escape, and focus departure;
- immediate settings, three-tab keyboard semantics, light/dark themes, and narrow layout.

The Android emulator verifies:

- the native Edit, Remove from list, and Copy actions remain present alongside Reorder or Reorder or move;
- selecting the added action arms only that pill, the next same-pill touch drag can reorder or move it, and outside tap, Escape, timeout, backgrounding, or plugin disable cancels cleanly;
- a non-list target shows rejection feedback, releasing on it shows one Notice without writeback, and leaving it clears all feedback;
- touch suggestion selection, roughly 394px settings layout, rotation, and active-tab reveal;
- background/foreground recovery, plugin disable/re-enable, and absence of crash or ANR.

## Verification boundary

- Automated gates cover pure rules, injectable failures, and release contracts.
- Desktop acceptance uses an isolated Windows 11 / Obsidian 1.12.7 Vault and covers block- and flow-style writeback on disk, pinned/hidden/bottom suggestion ordering, keyboard selection and cancellation, and all three legacy settings tabs. Before publishing a dual-settings release, a separate isolated current Obsidian 1.13 Catalyst or Public environment must verify native page navigation, settings search, custom rule editors, conditional controls, language rerendering, persistence, and Retry.
- New CRLF fixtures must remain CRLF when merely opened. Both a Property Order editor transaction and an ordinary manual body edit may then serialize the note as LF under Obsidian 1.12.7; acceptance attributes that behavior to the host and verifies logical text plus one-step undo instead of adding a non-undoable second Vault write.
- Android acceptance uses an independent Android 15 / API 35 emulator Vault, verifies deployed production files by SHA-256, preserves Obsidian's Edit, Copy, and Remove from list actions beside Reorder or move, exercises same-property reorder and cross-property move on disk, and verifies cancellation plus background/foreground recovery without plugin error, crash, or ANR.
- Automated tests cover the 15-second timeout, Escape, unsupported-menu fail open, and cleanup paths that routine host acceptance does not inject.
- Physical-device input stacks, haptics, pens, system font scaling, and large-Vault behavior require separate physical Android evidence before they may be claimed.
- Keyboard property-value reorder and screen-reader drag announcements remain explicit product non-goals.
- The language contract proves that Auto uses Obsidian's configured interface language through the public `getLanguage()` API. The minimum supported Obsidian version is 1.12.7, and `versions.json` remains the compatibility contract for published versions.
- CR-only byte preservation is automated; Obsidian 1.12.7 exposes no matching Properties UI, so a nonexistent host path is not required.

## CI and Release

CI runs `npm ci` and `npm run check` on Node 20 and uploads top-level `dist/main.js`, `dist/manifest.json`, and `dist/styles.css`. The release workflow accepts only an exact `x.y.z` tag matching `manifest.json`, without a `v` prefix, reruns the complete gate, and publishes:

- `main.js`;
- `manifest.json`;
- `styles.css`;
- `property-order-<version>.zip`, containing only one `property-order/` directory with those files.

Before any version tag, the worktree is clean, the real-host matrix matches the current product scope, and CI is green. After publication, download all four assets and verify version, archive layout, and hashes.
