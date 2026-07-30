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
2. README navigation plus frontmatter, heading hierarchy, critical-token, table-shape, and relative-link contracts for every stable Chinese/English document pair;
3. strict TypeScript checking;
4. the complete current Vitest suite;
5. the production bundle;
6. reproducible bundle verification plus static-asset, manifest, and version-contract checks.

The lint gate uses current Obsidian API typings while `manifest.json` remains the compatibility contract. Native DOM creation is retained only where the target `ownerDocument` is required for popout support. Settings use dual support: Obsidian 1.12.x keeps the imperative three-tab UI, while 1.13+ uses native declarative pages and search. Automated contracts require both definitions to cover the same persisted settings, preserve custom rule editors, and avoid Vault enumeration while the declarative search index is built.

Tests are organized under `tests/core/`, `tests/features/`, `tests/obsidian/`, `tests/shared/`, `tests/app/`, and `tests/scripts/`. Stable contracts cover:

- flow/block/empty lists, scalar source/target and all-item normalization under a host text-list type, original number/boolean/null token text conversion, duplicate preservation, duplicate-key refusal, BOM, LF/CRLF/CR, quoting, comments, blank lines, and unsupported-structure fail closed;
- desktop mouse/touch/pen state, mobile native-menu extension and one-shot arming, four-state drop resolution, empty-list versus empty-scalar classification, positively evidenced non-list rejection, no Notice while passing over, one Notice on release, no-op, cancellation, content conflict, pane/file/editor/DOM identity, unsaved editor text, one atomic editor transaction whose changes share original-text coordinates, exact `"set"` origin compatibility for 1.12.x, ignored/thrown/partial/diverged outcomes without automatic rollback, coordinate-matched suppression of only the drag's trailing click while unrelated clicks remain native, document-identity revalidation after the host turn and after `setViewData()`, persistence of exact commits even after blur cleans up drag UI, `requestSave()` only after exact verification, a distinct persistence-scheduling result and Notice, normal and mismatch-list UI reconciliation, guarded `metadataEditor.synchronize()` success/missing/throw/foreign-owner/post-sync text-divergence paths, one-shot actionable refresh invalidated by unload or context change, independent recovery actions across panes, and no native property setters, direct Vault write, or manual host-pill mutation;
- first editor focus after an exact commit, guarded repair after host reconstruction loses focus, no focus reclaim after deliberate user transfer before or after commit, no forced focus for no-op/rejection/conflict/ineffective transactions, undo access after a committed buffer whose save scheduling failed, and original/committed undo-redo states during asynchronous or manual refresh without false divergence;
- Properties and suggestion DOM adapters, visible ordering, all-hidden behavior, keyboard navigation, focus departure, usage-cache invalidation without a Vault scan when no menu is open, and fail open;
- settings migration, immediate application, persistence failure, Retry, pre-1.13 tab semantics, 1.13 declarative pages/search, custom control storage, and narrow-layout CSS;
- release tags, three loose assets, the manual-install archive, and idempotent Release updates.

`npm run test:coverage` is a separate diagnostic command. It uses V8 coverage with explicit inclusion of `main.ts` and `src/**/*.ts`, so runtime source that no test imports still appears at 0% in the inventory. No hastily chosen global percentage threshold currently blocks `npm run check`; the report exposes omitted files and guides targeted tests, but does not replace real-host evidence.

Injectable failure paths rely primarily on automated evidence: rejected settings persistence, host-DOM mismatch, selection-sync failure, Escape/blur, component removal, external conflict, and asynchronous reordering. Real hosts verify actual Obsidian DOM, input, visuals, and disk results without duplicating failures that cannot be injected reliably.

## Isolated Vault

Real acceptance uses only an isolated Vault. Fixture commands are:

```powershell
npm run acceptance:fixtures -- --vault <isolated-vault> --initialize-types
npm run acceptance:fixtures -- --vault <isolated-vault> --force
npm run acceptance:conflict -- --vault <isolated-vault> --file <fixture> --mode <source|target|unrelated|body> --expected-sha256 <sha256> --delay-ms 55
```

Scripts require the target to be under the permitted temporary acceptance root and to carry a dedicated marker, run ID, and fixture-hash manifest produced by initialization. An ordinary or production Vault is rejected even when it contains `.obsidian`. Fixture resets and conflict injection stage a unique lock file and acquire the canonical per-Vault lock with exclusive hard-link creation across the complete marker-plus-fixture transaction; an existing or stale lock fails closed and must be inspected and removed manually. Canonical lock, marker, generated `types.json`, and fixture names are never deleted or overwritten after a separate check: the current path is first moved into a same-volume private directory, the held identity and SHA-256 are verified, and installation or restoration uses exclusive hard-link creation. Fixture rollback similarly quarantines the current destination before an exclusive restore. A pathname writer arriving at a guarded replacement or cleanup boundary therefore remains at the canonical destination or in a reported preservation path. Successful staging cleanup checks every held inode again, uses no recursive deletion, and retains plus reports an old fixture changed through an already-open handle. The guarantee cannot prevent a non-cooperating process from writing through such a handle after the final verification instant. If rollback or cleanup cannot be proved safe, every unique backup remains in the Vault and the error lists its exact path; cleanup failure after a verified marker commit is reported without reclassifying that commit as uncommitted. Both fixture and conflict CLIs reject unknown, repeated, or valueless flags before Vault access; conflict delay additionally accepts only safe integers from `0` through `0x7fffffff`. The six fixtures cover LF/CRLF/CR, ordinary and empty lists, confirmed non-lists, scalar and mixed type-mismatch rows, comments, quotes, duplicates, unrelated content, and all conflict modes. Type initialization is explicit and exclusive; an existing compatible `.obsidian/types.json` is byte-preserved, while missing, incompatible, invalid, linked, or non-regular declarations fail before note writes. Real-editor scenarios verify final YAML, preserved body text, one-step undo/redo, and deployed artifact plus fixture SHA-256 values, while separately recording the host's newline serialization.

## Real-host release matrix

Desktop Obsidian verifies:

- enable, disable, reload, and full restart;
- same-property forward/backward/first/last/no-op and cross-property enabled/disabled behavior; a host-defined list stored as `[]`, an empty value, or a supported scalar participates in moves; the real type-mismatch DOM permits a sole scalar source and an aligned scalar or unambiguous mixed target while refusing stale, unreadable, ambiguous, or mixed source values; successful operations normalize affected items under `preserve`/`flow`/`block`, a no-op does not format, and a host non-list target rejects the move;
- multiple leaves, cross-file refusal, real content conflict, and `preserve`/`flow`/`block` writeback;
- a non-list target shows a warning outline and `not-allowed` cursor without an insertion line in both themes, leaving it shows no Notice, and releasing on it shows exactly one Notice without writeback;
- a list-type-mismatch row has no persistent grip covering its warning, and the warning icon itself does not advertise a drag cursor. After a same-property drag, normal Properties immediately shows the committed order and can start another drag. When automatic reconstruction is deliberately blocked, the Notice's Refresh Properties action targets only the captured pane and disappears on success; recovery Notices in different panes remain independent, and reopening is recommended only after refresh failure. The action follows the valid undo/redo state at click time and must not create another transaction, save request, or YAML change;
- one immediate `Ctrl+Z` undo and one redo for every successful same-property or cross-property drag without first clicking the note body, restoring all affected properties together with Properties, editor, and disk agreement; repeat undo/redo after waiting at least three seconds for delayed persistence, and verify visible Properties changes after the first shortcut before any second history shortcut is sent. Another drag immediately after undo must not report out-of-sync state, and deliberate focus on another input, pane, or window before reconciliation finishes must not be reclaimed. Wait at least three seconds after writeback before verifying disk YAML and SHA-256 so host-delayed persistence is not mistaken for failure;
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
- Every candidate-build acceptance record separates commit/version identity, SHA-256 values for the three deployed artifacts and install archive, automated-gate results, per-host/device acceptance evidence, and still-missing visual, input, or platform evidence. No layer is inferred from another, and Release notes never claim real-host or physical-device evidence that was not obtained.
- Desktop acceptance uses isolated Windows 11 Vaults with Obsidian 1.12.7 and the current supported 1.13.x release. Both hosts must prove immediate same- and cross-property one-step undo/redo without an intervening body click, another drag immediately after undo, no focus reclaim after deliberate user transfer, editor and visible-Properties agreement after one host turn, disk-YAML agreement after at least three seconds, scalar mismatch drag grip behavior, non-list rejection, and `preserve`/`flow`/`block` output. The 1.12.7 host also covers all three legacy settings tabs; the current 1.13.x host covers native page navigation, settings search, custom rule editors, conditional controls, language rerendering, persistence, and Retry.
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

The install archive fixes entry order, timestamps, permissions, and irrelevant metadata so identical inputs produce identical bytes. The repository must first enable an active tag ruleset matching release-version tags that restricts both updates and deletions without a bypass for the release actor. This external prerequisite closes the race between verification and publication; the workflow never modifies the rule. Before querying a Release, before creating its draft, before publishing that draft, and after publication, the workflow resolves the remote lightweight or annotated tag to its commit and requires equality with the push event's `GITHUB_SHA`; a missing, ambiguous, moved, or unresolvable tag fails closed. The maintainer keeps repository-level immutable Releases enabled in GitHub settings. The workflow holds no repository Administration credential and neither reads nor changes that setting; after publication it instead requires the Release to report `immutable: true`. The exact tagged-Release REST query treats only HTTP `404` as absence and fails closed for authorization, transport, rate-limit, server, or malformed-response failures. If a same-tag Release exists, it must report `immutable: true`; the remote asset names must be unique and exactly equal the three loose files plus the current-version ZIP, after which matching hashes for those four assets make the run a no-op. A mutable legacy Release or any missing, different, duplicate, or extra asset requires a version increase. A missing Release is first created as a draft with all four assets. Before publication, the workflow queries and downloads that remote set to prove unique names, exact inventory, and SHA-256 equality with the candidate build; after immutable publication it repeats the same remote verification, and any difference emits an explicit supply-chain failure instead of inferring asset correctness from upload arguments or the server immutable flag alone. Before any version tag, the worktree is clean, the version-tag rule is active, the real-host matrix matches the current product scope, and CI is green. After publication, download all four assets and verify the tag commit, version, archive layout, and hashes.
