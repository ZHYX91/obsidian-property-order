import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const workflow = readFileSync(
  path.join(projectRoot, ".github", "workflows", "release.yml"),
  "utf8",
);
const ciWorkflow = readFileSync(
  path.join(projectRoot, ".github", "workflows", "ci.yml"),
  "utf8",
);
const verifyJob = getJobSource("verify", "publish");
const publishJob = getJobSource("publish");

describe("release workflow contract", () => {
  it("uploads the three standard build files from the top level of dist", () => {
    expect(ciWorkflow).toContain("dist/main.js");
    expect(ciWorkflow).toContain("dist/manifest.json");
    expect(ciWorkflow).toContain("dist/styles.css");
    expect(ciWorkflow).not.toContain("dist/property-order/");
  });

  it("keeps the loose Obsidian assets and adds one install-ready archive", () => {
    expect(workflow).toContain("dist/main.js");
    expect(workflow).toContain("dist/manifest.json");
    expect(workflow).toContain("dist/styles.css");
    expect(workflow).toContain("property-order-${RELEASE_VERSION}.zip");
    expect(workflow).toContain("node scripts/release-assets.mjs archive");
  });

  it("isolates read-only verification from tag-only publication credentials", () => {
    expect(verifyJob).toContain("attestations: read");
    expect(verifyJob).toContain("contents: read");
    expect(verifyJob).not.toContain("attestations: write");
    expect(verifyJob).not.toContain("contents: write");
    expect(verifyJob).not.toContain("id-token: write");

    expect(publishJob).toContain(
      "if: github.event_name == 'push' && needs.verify.outputs.release_exists != 'true'",
    );
    expect(publishJob).toContain("needs: verify");
    expect(publishJob).toContain("attestations: write");
    expect(publishJob).toContain("contents: write");
    expect(publishJob).toContain("id-token: write");
    expect(publishJob).not.toContain("workflow_dispatch");
  });

  it("verifies source identity before either job executes repository code", () => {
    expect(verifyJob.indexOf("Verify read-only release source identity")).toBeGreaterThan(-1);
    expect(verifyJob.indexOf("Verify read-only release source identity")).toBeLessThan(
      verifyJob.indexOf("Set up Node.js"),
    );
    expect(verifyJob.indexOf("Verify read-only release source identity")).toBeLessThan(
      verifyJob.indexOf("node scripts/check-release-version.mjs"),
    );

    expect(publishJob.indexOf("Reverify trusted tag source before repository code"))
      .toBeGreaterThan(-1);
    expect(publishJob.indexOf("Reverify trusted tag source before repository code"))
      .toBeLessThan(publishJob.indexOf("Set up Node.js"));
    expect(publishJob.indexOf("Reverify trusted tag source before repository code"))
      .toBeLessThan(publishJob.indexOf("node scripts/check-release-version.mjs"));
  });

  it("runs all read-only publication-admissibility checks before tag creation", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(verifyJob).toContain("Release preflight must run from the repository default branch.");
    expect(verifyJob).toContain(
      "Release preflight must run at the current remote default-branch HEAD.",
    );
    expect(verifyJob).toContain(
      "Release preflight requires a version whose remote tag does not exist.",
    );
    expect(verifyJob).toContain(
      "Release preflight requires a version whose published Release does not exist.",
    );
    expect(verifyJob).toContain("Check tagged Release state and existing provenance");
    expect(verifyJob).toContain("Select previous published Release for generated notes");
    expect(verifyJob).toContain("scripts/release-notes-baseline.mjs");
    expect(verifyJob).toContain("The previous published Release is not an ancestor");
    expect(verifyJob).toContain("Report successful preflight");
  });

  it("serializes all release versions for the repository", () => {
    expect(workflow).toContain("group: release-${{ github.repository }}");
    expect(workflow).toContain("cancel-in-progress: false");
    expect(workflow).not.toContain("group: release-${{ github.ref }}");
  });

  it("pins one exact runtime contract in CI and both release jobs", () => {
    expect(ciWorkflow).toContain("node-version-file: .node-version");
    expect(verifyJob).toContain("node-version-file: .node-version");
    expect(publishJob).toContain("node-version-file: .node-version");
    expect(ciWorkflow).toMatch(/Verify runtime contract[\s\S]*npm ci/u);
    expect(verifyJob).toMatch(/Verify runtime contract[\s\S]*npm ci/u);
    expect(publishJob).toMatch(/Verify runtime contract[\s\S]*npm ci/u);
    expect(workflow.match(/fetch-depth: 0/gu)).toHaveLength(2);
  });

  it("requires the candidate commit to remain reachable from the remote default branch", () => {
    expect(workflow.match(
      /git merge-base --is-ancestor "\$expected_commit" "\$remote_default_commit"/gu,
    )).toHaveLength(2);
    expect(workflow.match(
      /The release commit is not reachable from the current remote default branch\./gu,
    )).toHaveLength(2);
  });

  it("does not require a repository administration credential", () => {
    expect(workflow).not.toContain("secrets.RELEASE_IMMUTABILITY_TOKEN");
    expect(workflow).not.toContain(
      "${GITHUB_API_URL}/repos/${GITHUB_REPOSITORY}/immutable-releases",
    );
    expect(workflow).not.toContain("--request PUT");
    expect(workflow).not.toContain("-X PUT");
    expect(workflow).not.toContain("gh api --method PUT");
  });

  it("fails closed when the pushed version tag no longer identifies the event commit", () => {
    expect(workflow).toContain('git rev-parse "${GITHUB_SHA}^{commit}"');
    expect(workflow).toContain('git rev-parse "HEAD^{commit}"');
    expect(workflow).toContain(
      'git ls-remote --exit-code origin "$tag_ref" "${tag_ref}^{}"',
    );
    expect(workflow).toContain('awk -v ref="${tag_ref}^{}"');
    expect(workflow).toContain(
      '"The remote release tag no longer points to the pushed event commit."',
    );
    expect(workflow.match(/^\s+verify_release_tag_identity$/gmu)?.length ?? 0)
      .toBeGreaterThanOrEqual(4);
  });

  it("treats only an explicit read-only REST 404 as a missing tagged Release", () => {
    expect(verifyJob).toContain('--write-out "%{http_code}"');
    expect(verifyJob).toContain('case "$release_status" in');
    expect(verifyJob).toContain('"404")');
    expect(verifyJob).toContain(
      '"Could not query the tagged Release (HTTP ${release_status})."',
    );
    expect(workflow).not.toContain('gh release view "$RELEASE_VERSION"');
  });

  it("accepts an existing tagged Release only with immutable matching attested assets", () => {
    expect(verifyJob).toContain(
      "'.immutable == true and .draft == false and .prerelease == false'",
    );
    expect(verifyJob).toContain('gh release download "$RELEASE_VERSION"');
    expect(verifyJob).toContain("node scripts/release-assets.mjs compare");
    expect(verifyJob).toContain('gh attestation verify "$existing_assets/$asset_name"');
    expect(verifyJob).toContain('--source-digest "$expected_commit"');
    expect(verifyJob).toContain('--source-ref "$GITHUB_REF"');
    expect(verifyJob).toMatch(
      /gh attestation verify[\s\S]*verify_release_tag_identity[\s\S]*echo "exists=true"/u,
    );
    expect(workflow).not.toContain("gh release upload");
    expect(workflow).not.toContain("--clobber");
  });

  it("requires every remote asset inventory to be exactly four unique files", () => {
    expect(workflow).toContain('archive_name="property-order-${RELEASE_VERSION}.zip"');
    expect(workflow).toContain('(.assets | type == "array")');
    expect(workflow).toContain(
      '([.assets[].name] | unique | length) == 4',
    );
    expect(verifyJob).toContain(
      '"The tagged Release asset inventory is not exactly the four expected files; publish a new version."',
    );
  });

  it("retries only transport failures, 404, 5xx, and incomplete successful state", () => {
    expect(publishJob).toContain('if ! release_status="$(');
    expect(publishJob).toContain(
      'if [[ "$release_status" == "404" || "$release_status" =~ ^5[0-9][0-9]$ ]]',
    );
    expect(publishJob).toContain(
      "tagged Release query returned non-retryable HTTP ${release_status}",
    );
    expect(publishJob).toContain("for attempt in {1..10}");
    expect(publishJob).toContain("sleep 3");
  });

  it("publishes directly and verifies exact immutable remote bytes", () => {
    expect(publishJob).toContain('gh release create "$RELEASE_VERSION" "${assets[@]}"');
    expect(publishJob).not.toContain("--draft");
    expect(publishJob).not.toContain("gh release edit");
    expect(publishJob).toContain("verify_release_assets() {");
    expect(publishJob).toContain(".prerelease == false and");
    expect(publishJob).toContain(".draft == $expected_draft");
    expect(publishJob).toContain(".immutable == $expected_immutable");
    expect(publishJob).toContain("Release supply-chain verification failed");
    expect(publishJob).toMatch(
      /gh release create[\s\S]*?verify_release_assets[\s\S]*?verify_release_tag_identity/u,
    );
  });

  it("generates notes from the highest older real stable Release", () => {
    expect(verifyJob).toContain("gh api --paginate --slurp");
    expect(verifyJob).toContain("scripts/release-notes-baseline.mjs");
    expect(verifyJob).toContain('--current-version "$RELEASE_VERSION"');
    expect(publishJob).toContain("${{ needs.verify.outputs.previous_tag }}");
    expect(publishJob).toContain(
      'notes_arguments+=(--notes-start-tag "$PREVIOUS_RELEASE_TAG")',
    );
  });

  it("attests every newly published release asset", () => {
    expect(publishJob).toContain("attestations: write");
    expect(publishJob).toContain("id-token: write");
    expect(publishJob).toContain(
      "uses: actions/attest@36051bcae73b7c2a8a6945a48cbf80953c6baa35 # v4",
    );
    expect(publishJob).toContain("dist/main.js");
    expect(publishJob).toContain("dist/manifest.json");
    expect(publishJob).toContain("dist/styles.css");
    expect(publishJob).toContain("dist/property-order-${{ env.RELEASE_VERSION }}.zip");
  });

  it("pins every third-party Action to a full commit SHA", () => {
    for (const source of [ciWorkflow, workflow]) {
      const actionUses = [...source.matchAll(/^\s*uses:\s*([^\s#]+)(?:\s+#.*)?$/gmu)].map(
        (match) => match[1],
      );
      expect(actionUses.length).toBeGreaterThan(0);
      expect(
        actionUses.every((value) => /@[a-f\d]{40}$/u.test(value ?? "")),
      ).toBe(true);
    }
  });
});

function getJobSource(jobName: string, nextJobName?: string): string {
  const startMarker = `\n  ${jobName}:\n`;
  const start = workflow.indexOf(startMarker);
  if (start === -1) {
    throw new Error(`Missing workflow job: ${jobName}`);
  }

  if (nextJobName == null) {
    return workflow.slice(start);
  }

  const end = workflow.indexOf(`\n  ${nextJobName}:\n`, start + startMarker.length);
  if (end === -1) {
    throw new Error(`Missing workflow job after ${jobName}: ${nextJobName}`);
  }
  return workflow.slice(start, end);
}
