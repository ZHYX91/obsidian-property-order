---
source_language: zh-CN
translation_of: release.zh-CN.md
translation_status: synced
---

# Property Order — Release procedure

This document defines the repeatable process for a public Property Order GitHub Release. Source
gates, the fixed candidate, real Obsidian acceptance, GitHub publication, and production-Vault
deployment are separate evidence. No step implicitly authorizes another; tags, Releases, and a
production Vault may change only after separate approval for the exact target.

## Version decision

- Use a strictly advancing `x.y.z` without a `v` prefix or leading zeroes, and synchronize
  `manifest.json`, `package.json`, `package-lock.json`, and `versions.json`.
- Release tooling is pinned in `scripts/vendor/obsidian-release-core.mjs`. Its adjacent lock records
  the exact release-core `1.0.0` version and SHA-256; `scripts/release.mjs` declares only plugin
  identity, asset policy, and the public repository.
- Upgrade the core by regenerating both runtime and lock from the canonical release-core, then
  commit adapter tests and the complete gate together. Never edit only a version, hash, or one copy.

## Candidate construction

- At the exact clean committed candidate, use the pinned Node.js 24.19.0 and npm 11.17.0 to run
  `npm ci` and `npm run release:check`. Ordinary `npm run check` proves task quality; the tag-aware
  release gate reports an existing published-version collision separately.
- `node scripts/release.mjs candidate --output-dir <empty-directory>` creates a deterministic
  handoff: three loose assets, `property-order-x.y.z.zip`, `SHA256SUMS`, and `candidate.json`.
  `candidate.json` binds commit, tree, target tag name/commit, core version/hash, and every asset
  hash without a timestamp or machine path. The tag appearing at that same commit does not change
  candidate bytes; the tag-aware gate separately verifies the live absent-or-exact state.
- This plugin declares `styles.css` required, so its public Release has exactly four assets. The
  core also supports a future plugin that explicitly makes styles optional. The ZIP always has one
  plugin-ID top directory and byte-identical loose assets.

## Read-only preflight

- The workspace builds `plan.json` from the live active inventory and rebuilds the candidate in an
  isolated clone through repository-owned commands. The public repository does not depend on that
  private workspace: an independent clone can still install, test, build, and verify its handoff.
- The candidate enters a one-use isolated Vault. Desktop and the Android surfaces required by the
  current manifest must produce product evidence bound to the same commit, tree, and asset hashes.
  Automation, emulator, physical-device, and screenshot evidence remain distinct.
- `acceptance-closure.json` says only that the gate passed and fixes
  `authorizesPublication: false`; it cannot create a tag, dispatch a workflow, or publish a Release.

## Publication authorization and trigger

- After closure, create a separate `authorization.json` bound to the exact repository, version,
  commit, tree, candidate digest, and closure digest. Recording authorization performs no remote
  action.
- Tag creation and push are separate actions. Publication requires the exact `x.y.z` tag to point
  at the candidate commit. Never move, delete, or recreate an existing tag to clear a conflict.
- Only a second explicit publish confirmation lets the workspace orchestrator dispatch
  `workflow_dispatch` at that version tag, carrying the portable closure, candidate digest, and
  authorization binding. The workflow defaults to read-only `verify`; only explicit `publish` can
  enter the downstream write-scoped job. An ordinary tag push never publishes.

## Hash and hosted-byte verification

- The read-only job reruns `release:check` at the exact commit, builds the deterministic handoff,
  and uploads it by current-run artifact ID and digest. The write job reverifies the handoff,
  closure, authorization, tag, commit, and tree, then runs a read-only GitHub preflight. An existing
  Release is a zero-write no-op only when immutable state, exact bytes, and provenance already
  match; every conflict fails before the first attestation. Only an explicit missing result permits
  attestation and creation, and creation repeats the complete boundary to protect against races.
- Public assets are exactly `main.js`, `manifest.json`, `styles.css`, and the versioned ZIP.
  `SHA256SUMS` and `candidate.json` remain private handoff files. Every published asset requires
  provenance bound to the exact workflow, ref, and commit.
- Post-publication verification reads GitHub again and requires a stable, non-draft,
  non-prerelease, immutable Release with the exact inventory, metadata digests, downloaded bytes,
  and remote tag target. A same-tag Release is a safe no-op only when every check matches.

## Rollback and failure handling

- Before dispatch, fix source or evidence and restart plan, candidate, and acceptance from the new
  commit. Never replay the old authorization.
- When dispatch status is uncertain, recover by stable release run ID instead of triggering again
  blindly. If post-verification fails, retain evidence, do not move the tag or replace the immutable
  Release, and recover with a higher patch version.
- User rollback installs only production assets from a previously verified Release and preserves
  `data.json`. Production-Vault deployment still needs separate exact-Vault authorization, backup,
  and installed-hash verification.

## Evidence record and boundary

- Retain the plan, candidate, closure, authorization, trigger, and post-verify digests, plus CI,
  desktop/Android acceptance, external tag-ruleset/immutable-Release settings, and four hosted asset
  hashes.
- To add a plugin, first give its independent repository a pinned toolchain, thin adapter, core lock,
  production-asset policy, and complete gate. Then register its expected remote and acceptance
  adapter in the workspace inventory; never create a runtime dependency on the private workspace.
- This task does not change a version, create or move a tag, create a GitHub Release, publish a
  plugin, or deploy a production Vault.
