---
source_language: zh-CN
translation_of: release.zh-CN.md
translation_status: synced
---

# Property Order — Release procedure

This document defines the repeatable Property Order release process. Source checks, the Candidate
Bundle, real Obsidian acceptance, GitHub publication, and production-Vault deployment are separate
evidence and authorization boundaries.

## Boundaries

An authorized stable version tag push triggers publication. Manual dispatch on the same tag supports verify-only or publish mode through the same workflow. Host acceptance is optional; publishing does not deploy to a Vault.

## Version and source

`manifest.json`, `package.json`, `package-lock.json`, and `versions.json` bind one canonical version
and exact commit/tree. A clean worktree must pass `npm run release:check`, including the usage
benchmark and tag-identity gate.

## Candidate Bundle v3

The vendored release-core `3.0.1` and thin adapter create the sole Candidate Bundle v3 containing
`main.js`, `manifest.json`, `styles.css`, `property-order-x.y.z.zip`, `SHA256SUMS`, and
`candidate-bundle.json`. It binds the toolchain, core/config/workflow, product payload, scenario
contract, and fixture hashes; no second candidate object or transition stack exists.

## Optional product acceptance

Use the same Bundle for desktop and Android-emulator acceptance covering same-property reorder,
cross-property moves, persistence, one-step Undo/Redo, touch input, fail-closed conflicts, and
preservation of YAML comments, flow/block style, `[]`, newline semantics, and note body. Android
physical devices and iOS are out of scope.

## Standalone workflow

Tag push and manual dispatch use the same build, publish, and post-verification jobs. The read-only build job produces and verifies the Bundle. Publication downloads that fixed artifact without rebuilding and verifies the event, tag, commit, and Bundle digest before writing. Manual verify mode performs no publication.

## Publication and verification

Actions generates SLSA build provenance for the four public assets. The publisher verifies their source, tag and workflow, creates a draft, downloads and checks all draft assets, then publishes the immutable Release. A separate job checks the hosted release. Only the three loose files and versioned ZIP are public assets; Bundle metadata stays in the CI artifact. GitHub publication and Community Directory review are separate outcomes.

## Failure, rollback, and deployment

An existing same-tag Release is a zero-write no-op only when exact; any difference fails without
overwrite and fixes use a new version. Production-Vault deployment requires separate authorization
for the exact Vault and preserves `data.json`; candidate, host, publication, and deployment verdicts
are reported separately.
