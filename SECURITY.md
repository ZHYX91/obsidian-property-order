# Security Policy

## Supported versions

Security fixes target the latest stable 0.5.x code line, which requires Obsidian 1.12.7 or later.
`manifest.json` and Git tags identify versioned source; they do not prove GitHub Release publication
or hosted-asset state, which must be verified separately. Older code lines do not receive separate
security updates; users should move to the latest verified stable release.

## Reporting a vulnerability

Do not include exploit details, private note content, credentials, or a sensitive proof of concept
in a public issue.

Use GitHub's private **Report a vulnerability** action in this repository's Security tab when it is
available. If that private channel is unavailable, open a minimal public issue asking the maintainer
for a private contact channel without describing the vulnerability itself.

Include, through the private channel:

- the affected Property Order and Obsidian versions and operating system;
- the security impact and required preconditions;
- minimal reproduction steps using non-sensitive fixture data;
- whether the issue affects source behavior, packaged assets, or the publication pipeline;
- any suggested mitigation, if known.

The maintainer will validate the report, determine affected versions, coordinate a fix and advisory
when appropriate, and credit reporters who request attribution. No fixed response or remediation
deadline is promised.

## Scope and evidence

Examples in scope include unintended note modification or disclosure, unsafe handling of untrusted
property content, cross-document or cross-window isolation failures, and compromise of published
release assets or provenance.

A local test pass, source review, packaged-candidate hash, hosted GitHub asset, and real-host result
are distinct evidence layers. Security reports and advisories must state which layer was actually
verified. Publication and rollback follow the canonical [release guide](docs/release.en.md).
