---
source_language: zh-CN
translation_of: testing-strategy.zh-CN.md
translation_status: synced
---

# Property Order — Testing strategy

This document mirrors the authoritative current automated gates, real-host matrix, release contract, and verification boundary for Property Order.

## Automated gate

Run `npm run check` before delivery. It performs, in order:

1. the exact current Node.js/npm contract against `.node-version`, `engines.node`, and `packageManager`;
2. the official `eslint-plugin-obsidianmd` recommended rule set, with documented compatibility exceptions, against plugin entry and source files, including an enforced `src/core/` import boundary that rejects Obsidian runtime and upper-layer modules; environment-appropriate static rules also cover tests, Node scripts, and tool configuration, and all enabled warnings are treated as failures;
3. a deterministic UTF-8/LF format contract for source, documentation, and configuration, with no BOM, NUL, trailing whitespace, or missing final newline;
4. README navigation plus frontmatter, heading hierarchy, critical-token, table-shape, and relative-link contracts for every stable Chinese/English document pair;
5. strict TypeScript checking;
6. the complete current Vitest suite with V8 coverage;
7. the production bundle;
8. reproducible bundle verification plus static-asset, manifest, lockfile, and version-contract checks.

The lint gate uses current Obsidian API typings while `manifest.json` remains the compatibility contract. Native DOM creation is retained only where the target `ownerDocument` is required for popout support. Every supported Obsidian version uses the imperative three-tab settings UI. Automated contracts require declarative definitions to remain empty, preserve the custom rule editors, and avoid Vault enumeration while the settings surface is built.

Tests are organized under `tests/core/`, `tests/features/`, `tests/obsidian/`, `tests/shared/`, `tests/app/`, and `tests/scripts/`. Stable contracts cover:

- flow/block/empty lists, scalar source/target and all-item normalization under a host text-list type, original number/boolean/null token text conversion, duplicate preservation, duplicate-key refusal, BOM, LF/CRLF/CR, quoting, comments, blank lines, and unsupported-structure fail closed;
- desktop mouse/touch/pen state, mobile native-menu extension and one-shot arming, four-state drop resolution, empty-list versus empty-scalar classification, positively evidenced non-list rejection, no Notice while passing over, one Notice on release, no-op, cancellation, content conflict, pane/file/editor/DOM identity, unsaved editor text, one atomic editor transaction whose changes share original-text coordinates, exact `"set"` origin compatibility for 1.12.x, unchanged pre-transaction ownership aborts, exact post-transaction ownership loss as an applied but unscheduled result, ignored/thrown/partial/diverged outcomes without automatic rollback, coordinate-matched suppression of only the drag's trailing click while unrelated clicks remain native, document-identity revalidation after the host turn and after `setViewData()`, persistence of exact commits even after blur cleans up drag UI, `requestSave()` only after exact verification, a distinct persistence-scheduling result and Notice, normal and mismatch-list UI reconciliation, guarded `metadataEditor.synchronize()` success/missing/throw/foreign-owner/post-sync text-divergence paths, one-shot actionable refresh invalidated by unload or context change, independent recovery actions across panes, and no native property setters, direct Vault write, or manual host-pill mutation;
- first editor focus after an exact commit, guarded repair after host reconstruction loses focus, no focus reclaim after deliberate user transfer before or after commit, no forced focus for no-op/rejection/conflict/ineffective transactions, undo access after a committed buffer whose save scheduling failed, and original/committed undo-redo states during asynchronous or manual refresh without false divergence;
- Properties and suggestion DOM adapters, pane-scoped point-geometry fallback, visible ordering through hidden ancestors and computed display/visibility, focused suggestion-menu text observation without document-wide character-data observation, all-hidden behavior, keyboard navigation, focus departure, pinned/hidden/bottom precedence, strict MRU with name fallback for unrecorded items, note-count ties, menu reuse, and fail open on DOM mismatch;
- recent-tracker click and keyboard/input commit intent, successful Metadata Cache confirmation, no record for hover/navigation/cancellation/failure, file and document identity, and timeout/deletion/unload cleanup; recent-store exact case, deduplicating promotion, 100-entry cap, timestamp-free versioned format, malformed/read-failure fallback, write-failure fail open, current-Vault/device isolation, and clearing; zero Vault traversal in name/recent modes and no scan when usage-cache invalidation finds no open menu;
- schema 3-to-4 settings migration, valid `recent`, immediate application, persistence failure, Retry, public external-settings reload with a three-way merge and live-surface refresh, cross-instance storage serialization, rejection of saves started after unload, preservation of the cross-property preference while value drag is disabled, all three sorts, the clear action, and the non-persisted rule-test field in the imperative tabs on every supported host, custom control storage, diagnostic cleanup, zero Vault traversal, and narrow-layout CSS;
- exact Node.js/npm and lockfile-root contracts, read/write release-job permission isolation, default-branch and tag identity before repository code, read-only Candidate Bundle artifact transport and SHA-256, raw action-digest and REST-prefix compatibility, fail-closed outer/inner malicious ZIP handling, zero checkout/npm/repository scripts in the write-capable job, repository-wide release serialization, real-Release version and notes-baseline preflight, four-asset bytes and exact signer/repo/ref/commit provenance for both existing no-op and new publication paths, post-publication HTTP retry classification, three loose assets, the manual-install archive, and idempotent Release updates.

`npm run check` runs the complete Vitest suite through `npm run test:coverage`. V8 coverage explicitly includes `main.ts` and `src/**/*.ts`, so runtime source that no test imports still appears at 0% in the inventory. No hastily chosen global percentage threshold is currently imposed; the unified gate still generates the report to expose omitted files and guide targeted tests, but it does not replace real-host evidence.

`npm run bench:usage` and `npm run bench:usage:large` are deterministic Metadata Cache microbenchmarks outside `npm run check`. They construct 10,000 and 50,000 cached notes respectively, warm the real `getPropertyKeyUsage()`, take 25 samples, and report p50, p95, max, and cache-hit latency. Every performance decision records the operating system, CPU, Node.js and npm versions beside the raw output in its delivery evidence. This synthetic result proves neither real Obsidian main-thread, mobile-device, nor memory behavior and is not a timing gate by itself. Reassess incremental indexing only when real large-Vault evidence or repeated regression data exceeds the product budget.

Injectable failure paths rely primarily on automated evidence: rejected settings persistence, host-DOM mismatch, selection-sync failure, Escape/blur, component removal, external conflict, and asynchronous reordering. Real hosts verify actual Obsidian DOM, input, visuals, and disk results without duplicating failures that cannot be injected reliably.

## Isolated Vault

Real acceptance uses only a disposable Vault materialized from the exact Candidate Bundle v3. The public repository owns the static `acceptance/fixtures/Property Order.md` resource and the product scenario contract; the workspace-owned generic materializer verifies their Bundle-bound hashes, installs the exact candidate, enables only Property Order, and writes a host-specific manifest. The shared acceptance kit owns markers, input/output manifests, lifecycle transitions, reset, and archival. An ordinary or production Vault is never a valid target.

This repository deliberately has no fixture-installation, Vault-reset, or conflict-injection CLI. For the contract's guarded-write conflict step, the acceptance controller records the disposable fixture identity, starts the product action, performs the specified external edit, and records both resulting byte streams and the visible refusal. Automated unit tests remain the primary evidence for injected race boundaries; real-host evidence covers Obsidian DOM, interaction, persistence, undo/redo, and the visible fail-closed result without duplicating shared lifecycle machinery.

## Real-host release matrix

Desktop Obsidian verifies:

- enable, disable, reload, and full restart;
- same-property forward/backward/first/last/no-op and cross-property enabled/disabled behavior; a host-defined list stored as `[]`, an empty value, or a supported scalar participates in moves; the real type-mismatch DOM permits a sole scalar source and an aligned scalar or unambiguous mixed target while refusing stale, unreadable, ambiguous, or mixed source values; successful operations normalize affected items under `preserve`/`flow`/`block`, a no-op does not format, and a host non-list target rejects the move;
- multiple leaves, cross-file refusal, real content conflict, and `preserve`/`flow`/`block` writeback;
- a non-list target shows a warning outline and `not-allowed` cursor without an insertion line in both themes, leaving it shows no Notice, and releasing on it shows exactly one Notice without writeback;
- a list-type-mismatch row has no persistent grip covering its warning, and the warning icon itself does not advertise a drag cursor. After a same-property drag, normal Properties immediately shows the committed order and can start another drag. When automatic reconstruction is deliberately blocked, the Notice's Refresh Properties action targets only the captured pane and disappears on success; recovery Notices in different panes remain independent, and reopening is recommended only after refresh failure. The action follows the valid undo/redo state at click time and must not create another transaction, save request, or YAML change;
- one immediate `Ctrl+Z` undo and one redo for every successful same-property or cross-property drag without first clicking the note body, restoring all affected properties together with Properties, editor, and disk agreement; repeat undo/redo after waiting at least three seconds for delayed persistence, and verify visible Properties changes after the first shortcut before any second history shortcut is sent. Another drag immediately after undo must not report out-of-sync state, and deliberate focus on another input, pane, or window before reconciliation finishes must not be reclaimed. Wait at least three seconds after writeback before verifying disk YAML and SHA-256 so host-delayed persistence is not mistaken for failure;
- the wiki-link contract fixture records `data-href`, `.internal-link` placement, `.multi-select-pill-content`, raw `textContent` code points, and drag eligibility for exact aliases, edge whitespace, and NFC/NFD targets and aliases before any alias normalization rule changes;
- pinned/hidden/bottom, name/recent/note count, menu reuse, all-hidden, hover-to-keyboard, arrows/Home/End/PageUp/PageDown/Enter/Escape, and focus departure. Recent acceptance separately uses mouse click, Enter, and typed successful commits to prove that strict MRU advances only after Metadata Cache confirmation; hover, navigation, cancellation, and failure do not record; unrecorded items use name order; and usage values equal the number of Markdown notes containing the property;
- recent history retains current-Vault/device order through reload and full restart while another Vault does not inherit it; clearing immediately restores name fallback and changes neither `data.json` nor notes. Immediate settings also cover the three-tab surface on the minimum and current supported hosts, light/dark themes, and narrow layout.

The Android emulator verifies:

- the native Edit, Remove from list, and Copy actions remain present alongside Reorder or Reorder or move;
- selecting the added action arms only that pill, the next same-pill touch drag can reorder or move it, and outside tap, Escape, timeout, backgrounding, or plugin disable cancels cleanly;
- a non-list target shows rejection feedback, releasing on it shows one Notice without writeback, and leaving it clears all feedback;
- the wiki-link contract fixture captures the same raw target, text, structure, and drag evidence as desktop before platform-specific normalization is inferred;
- touch suggestion selection and its post-commit recent update, recent-history clearing, roughly 394px settings layout, rotation, and active-tab reveal;
- background/foreground recovery, plugin disable/re-enable, and absence of crash or ANR.

## Verification boundary

- Automated gates cover pure rules, injectable failures, and release contracts.
- Every candidate-build acceptance record separates commit/version identity, SHA-256 values for the three deployed artifacts and install archive, automated-gate results, per-host/device acceptance evidence, and still-missing visual, input, or platform evidence. No layer is inferred from another.
- Desktop acceptance uses isolated Windows 11 Vaults with Obsidian 1.12.7 and the current supported 1.13.x release. Both hosts must prove immediate same- and cross-property one-step undo/redo without an intervening body click, another drag immediately after undo, no focus reclaim after deliberate user transfer, editor and visible-Properties agreement after one host turn, disk-YAML agreement after at least three seconds, scalar mismatch drag grip behavior, non-list rejection, `preserve`/`flow`/`block` output, and the wiki-link host contract, plus strict-MRU commit confirmation, restart persistence, per-Vault isolation, the timestamp-free 100-entry boundary, and clearing. Both hosts also cover the three top tabs, custom rule editors, conditional controls, language rerendering, persistence, and Retry.
- New CRLF fixtures must remain CRLF when merely opened. Both a Property Order editor transaction and an ordinary manual body edit may then serialize the note as LF under Obsidian 1.12.7; acceptance attributes that behavior to the host and verifies logical text plus one-step undo instead of adding a non-undoable second Vault write.
- Android acceptance uses an independent Android 15 / API 35 emulator Vault, verifies deployed production files by SHA-256, preserves Obsidian's Edit, Copy, and Remove from list actions beside Reorder or move, exercises same-property reorder and cross-property move on disk, verifies recent update and clearing after a touch property-name commit, and checks cancellation plus background/foreground recovery without plugin error, crash, or ANR.
- This desktop-plus-emulator matrix is the complete shared mobile release gate. Android physical devices and iOS are out of scope.
- Automated tests cover the 15-second drag timeout, recent-confirmation timeout, local-storage read/write failure, Escape, unsupported-menu fail open, and cleanup paths that routine host acceptance does not inject.
- Physical-device input stacks, haptics, pens, and vendor-specific behavior are not acceptance claims made by this project.
- Keyboard property-value reorder and screen-reader drag announcements remain explicit product non-goals.
- The language contract proves that Auto uses Obsidian's configured interface language through the public `getLanguage()` API. The minimum supported Obsidian version is 1.12.7, and `versions.json` remains the compatibility contract for published versions.
- CR-only byte preservation is automated; Obsidian 1.12.7 exposes no matching Properties UI, so a nonexistent host path is not required.

## CI and Release

CI and the release workflow both use Node.js 24.19.0 from `.node-version` and require npm 11.17.0 through `packageManager`. They verify the exact runtime before `npm ci`, then run `npm run check`. Its release-asset gate independently reproduces the bundle and requires production `main.js` to remain at or below 320,000 B; this is a project regression budget, not an Obsidian platform limit. CI uploads top-level `dist/main.js`, `dist/manifest.json`, and `dist/styles.css`. The release workflow accepts only an exact `x.y.z` version matching `manifest.json`, without a `v` prefix, reruns the complete gate, and publishes:

- `main.js`;
- `manifest.json`;
- `styles.css`;
- `property-order-<version>.zip`, containing only one `property-order/` directory with those files.

The install archive fixes entry order, timestamps, permissions, and irrelevant metadata so identical inputs produce identical bytes. Tests execute the same exactly locked release-core ZIP and candidate logic used by the repository. They cover required and optional styles, missing/extra/non-regular entries, tampered bytes, wrong checksums, path escapes, and a historical same-version tag. Ordinary `npm run check` uses non-tag-aware validation; only `npm run release:check` requires a clean commit and the absent-or-exact tag gate.

One constant repository-wide concurrency group serializes every version without cancelling a run in progress. The Release workflow responds only to explicit `workflow_dispatch`, with `mode` defaulting to `verify`; an ordinary tag push never publishes. At the exact version tag, the read-only job performs one independent install and one complete `release:check`, creates Candidate Bundle v3 containing loose assets, the versioned ZIP, `SHA256SUMS`, and `candidate-bundle.json`, source-verifies it, and pins the current-run artifact ID and server digest. The write-scoped job runs only for explicit `publish`, performs transport verification after download, and before its first mutation validates tag/commit/tree, the portable acceptance closure, independent authorization, and their SHA-256 bindings. Swaps, replays, private paths, field drift, and substituting another Bundle digest all fail closed.

After publication, GitHub is queried again for an immutable stable Release. Exact four-asset inventory, metadata digests, downloaded bytes, ZIP internal/external equivalence, remote tag, and per-asset provenance must all match. A same-tag no-op is accepted only on complete identity; every conflict requires a higher version. Tag rulesets and immutable Releases remain maintainer-recorded prerequisites outside the workflow, and automated gates do not change administrator settings.

The Actions artifact step output accepts only a raw 64-character lowercase hexadecimal SHA-256. The REST record may expose the same value raw or with the canonical `sha256:` prefix. Downloaded bytes are rehashed against the pinned output; a wrong prefix, length, or byte stream fails closed.

The workflow has no duplicate publication implementation. Bundle creation, ZIP parsing, source/transport verification, publication-boundary checks, and post-verification all invoke the same locked core. A separate workflow-contract test pins triggers, the exact nine inputs, permission separation, action commit pins, artifact ID/digest transport, and the publish-only write job so YAML cannot bypass the core boundary.
