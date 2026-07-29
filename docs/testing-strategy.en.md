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

- flow/block/empty lists, scalar source/target and all-item normalization under a host text-list type, original number/boolean/null token text conversion, duplicate preservation, duplicate-key refusal, BOM, LF/CRLF/CR, quoting, comments, blank lines, and unsupported-structure fail closed;
- desktop mouse/touch/pen state, mobile native-menu extension and one-shot arming, four-state drop resolution, empty-list versus empty-scalar classification, positively evidenced non-list rejection, no Notice while passing over, one Notice on release, no-op, cancellation, content conflict, pane/file/editor/DOM identity, unsaved editor text, one atomic editor transaction whose changes share original-text coordinates, exact `"set"` origin compatibility for 1.12.x, ignored/thrown/partial/diverged outcomes without automatic rollback, document-identity revalidation after the host turn and after `setViewData()`, persistence of exact commits even after blur cleans up drag UI, `requestSave()` only after exact verification, a distinct persistence-scheduling result and Notice, normal and mismatch-list UI reconciliation, and no native property setters, direct Vault write, or manual host-pill mutation;
- Properties and suggestion DOM adapters, visible ordering, all-hidden behavior, keyboard navigation, focus departure, usage-cache invalidation without a Vault scan when no menu is open, and fail open;
- settings migration, immediate application, persistence failure, Retry, pre-1.13 tab semantics, 1.13 declarative pages/search, custom control storage, and narrow-layout CSS;
- release tags, three loose assets, the manual-install archive, and idempotent Release updates.

Injectable failure paths rely primarily on automated evidence: rejected settings persistence, host-DOM mismatch, selection-sync failure, Escape/blur, component removal, external conflict, and asynchronous reordering. Real hosts verify actual Obsidian DOM, input, visuals, and disk results without duplicating failures that cannot be injected reliably.

## Isolated Vault

Real acceptance uses only an isolated Vault. Fixture commands are:

```powershell
npm run acceptance:fixtures -- --vault <isolated-vault> --initialize-types
npm run acceptance:fixtures -- --vault <isolated-vault> --force
npm run acceptance:conflict -- --vault <isolated-vault> --file <fixture> --mode <source|target|unrelated|body> --expected-sha256 <sha256> --delay-ms 55
```

Scripts validate the Obsidian Vault, resolve real paths, reject links and non-regular targets, and constrain writes to the shared fixture specification. The six fixtures cover LF/CRLF/CR, ordinary and empty lists, confirmed non-lists, scalar and mixed type-mismatch rows, comments, quotes, duplicates, unrelated content, and all conflict modes. Type initialization is explicit and exclusive; an existing compatible `.obsidian/types.json` is byte-preserved, while missing, incompatible, invalid, linked, or non-regular declarations fail before note writes. Real-editor scenarios verify final YAML, preserved body text, one-step undo/redo, and deployed artifact plus fixture SHA-256 values, while separately recording the host's newline serialization.

## Real-host release matrix

Desktop Obsidian verifies:

- enable, disable, reload, and full restart;
- same-property forward/backward/first/last/no-op and cross-property enabled/disabled behavior; a host-defined list stored as `[]`, an empty value, or a supported scalar participates in moves; the real type-mismatch DOM permits a sole scalar source and an aligned scalar or unambiguous mixed target while refusing stale, unreadable, ambiguous, or mixed source values; successful operations normalize affected items under `preserve`/`flow`/`block`, a no-op does not format, and a host non-list target rejects the move;
- multiple leaves, cross-file refusal, real content conflict, and `preserve`/`flow`/`block` writeback;
- a non-list target shows a warning outline and `not-allowed` cursor without an insertion line in both themes, leaving it shows no Notice, and releasing on it shows exactly one Notice without writeback;
- one `Ctrl+Z` undo and one redo for every successful same-property or cross-property drag, restoring all affected properties together without overwriting unsaved body edits; wait at least three seconds after writeback before verifying disk YAML and SHA-256 so host-delayed persistence is not mistaken for failure;
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
- Desktop acceptance uses isolated Windows 11 Vaults with Obsidian 1.12.7 and the current supported 1.13.x release. Both hosts must prove same- and cross-property one-step undo/redo, editor and visible-Properties agreement after one host turn, disk-YAML agreement after at least three seconds, scalar mismatch drag grip behavior, non-list rejection, and `preserve`/`flow`/`block` output. The 1.12.7 host also covers all three legacy settings tabs; the current 1.13.x host covers native page navigation, settings search, custom rule editors, conditional controls, language rerendering, persistence, and Retry.
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
