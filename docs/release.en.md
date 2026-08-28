---
source_language: zh-CN
translation_of: release.zh-CN.md
translation_status: synced
---

# Property Order — Release procedure

This is the canonical process for a public Property Order GitHub Release. It does not authorize
creating a tag, publishing a Release, deploying to a Vault, or resetting plugin data; every run
still requires explicit approval for the exact version. Automated gates, the candidate, hosted
assets, real Obsidian hosts, and an actual Vault deployment are separate evidence layers and cannot
substitute for one another. See the [testing strategy](testing-strategy.en.md) for the full
verification boundary and the [security policy](../SECURITY.md) for security incidents.

## Version decision

- Select a strictly advancing `x.y.z` version without a `v` prefix or leading zeroes, and confirm
  that neither the remote tag nor a same-version Release exists.
- Synchronize `manifest.json`, `package.json`, `package-lock.json`, and `versions.json`; change the
  minimum Obsidian version only when compatibility evidence supports it.
- Move user-facing changes from the Unreleased section of the [changelog](../CHANGELOG.md) into the
  new version, and confirm that release notes do not claim more than the available evidence.

## Candidate construction

- The candidate must come from a clean commit at the current remote default-branch HEAD. Uncommitted
  files, local patches, and other branches must not enter the release.
- Use the repository-pinned Node.js 24.19.0 and npm 11.17.0 to run `npm ci`, followed by
  `npm run release:check`. The release gate validates the manifest, package, lockfile root, and
  `versions.json`, defaulting to the manifest version. A missing local same-version tag is allowed;
  an existing tag must resolve exactly to `HEAD`, so a tag from another commit cannot be reused. Its
  `npm run check`, coverage, build, release contract, and deterministic benchmark must all pass.
- Build output comprises `main.js`, `manifest.json`, `styles.css`, and the deterministic
  `property-order-x.y.z.zip`. The installation ZIP may contain only the first three files, with
  bytes identical to the loose assets.

## Read-only preflight

- Confirm green CI for the candidate commit and complete the real-host checks required by the
  current product scope. Automated success cannot replace desktop, mobile, or popout evidence.
- Run the Release workflow through `workflow_dispatch` at the current remote default-branch HEAD,
  supplying the candidate version. This read-only preflight requires the candidate tag and
  same-version Release to be absent, every published stable version to be older, and the selected
  release-notes baseline to be reachable.
- Before creating the tag, manually verify and record that the numeric-version tag ruleset blocks
  updates and deletion with no release-identity bypass, and that repository-level immutable
  Releases are enabled. The workflow has no administration permission and cannot replace this
  external evidence.

## Publication authorization and trigger

- Request publication approval for the exact version only after checking the candidate commit,
  version, CI, real-host evidence, read-only preflight, and external settings.
- After approval, create the exact `x.y.z` tag at the verified commit and push it. The tag push is
  the only write trigger that creates a Release; manual preflight, pull requests, and local commands
  do not publish.
- The workflow's read-only job reruns the complete gate and creates the candidate. Its write-capable
  job does not check out source, install npm dependencies, or execute repository code; it consumes
  only the one-use handoff artifact from the current run.

## Hash and hosted-byte verification

- The one-use handoff must contain exactly the four release assets plus `SHA256SUMS`. The manifest
  uses ASCII, LF, fixed ordering, and one SHA-256 for each asset; the Actions artifact digest must
  also match the recomputed downloaded bytes.
- The Release asset inventory must be exactly `main.js`, `manifest.json`, `styles.css`, and
  `property-order-x.y.z.zip`, with no missing, duplicate, or extra file.
- After creation, download the GitHub hosted bytes again, compare them byte-for-byte and by SHA-256
  with the handed-off candidate, and verify that each provenance record is bound exactly to this
  repository, the Release workflow, tag ref, event commit, and a non-self-hosted runner.
- Publication succeeds only after a stable, non-draft, non-prerelease, immutable Release passes
  those checks and remote tag identity is verified again.
- A failed tag workflow is safely rerunnable. An existing same-tag Release is accepted as a
  successful no-op only when its exact four public assets match the current candidate byte for
  byte and every provenance record binds the same tag and commit. Otherwise the run fails and a
  higher version is required. The checksum manifest always stays inside the handoff and is never
  uploaded to the public Release.

## Rollback and failure handling

- If a problem appears before tag creation, stop publication, fix it in a new commit, and rerun all
  gates and preflight checks.
- After tag creation, do not move, delete, or recreate the tag, and do not overwrite an immutable
  Release. Preserve the failed run, responses, and hashes; if public assets already exist, assess
  the impact under the security policy and fix it with a strictly newer patch version.
- When a user must restore an older version, install only the three plugin files from a previously
  verified Release and preserve the existing `data.json`. That is a separate deployment operation;
  source or publication results cannot prove its success.

## Evidence record and boundary

- Record the version, commit, tag object, CI and preflight runs, approval, external rule settings,
  four asset SHA-256 values, hosted-byte comparison, and provenance results.
- Label source checks, candidate construction, GitHub hosting state, real-host acceptance, and Vault
  deployment separately; mark any layer not obtained as unverified.
- Release notes may state only changes and compatibility actually verified. Do not infer real-device,
  performance, accessibility, or production-Vault results from automated gates.
