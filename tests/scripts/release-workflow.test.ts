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
    expect(workflow).toContain("property-order-${GITHUB_REF_NAME}.zip");
    expect(workflow).toContain("node scripts/release-assets.mjs archive");
  });

  it("does not require a repository administration credential", () => {
    expect(workflow).not.toContain("secrets.RELEASE_IMMUTABILITY_TOKEN");
    expect(workflow).not.toContain(
      "${GITHUB_API_URL}/repos/${GITHUB_REPOSITORY}/immutable-releases",
    );
    expect(workflow).toContain(".immutable == $expected_immutable");
    expect(workflow).toContain('"published-post-publish"');
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
    expect(workflow.match(/^\s+verify_release_tag_identity$/gmu)).toHaveLength(4);
  });

  it("treats only an explicit REST 404 as a missing tagged Release", () => {
    expect(workflow.match(/releases\/tags\/\$\{GITHUB_REF_NAME\}/gu)).toHaveLength(2);
    expect(workflow).toContain('--write-out "%{http_code}"');
    expect(workflow).toContain('case "$release_status" in');
    expect(workflow).toContain('"404")');
    expect(workflow).toContain('"Could not query the tagged Release (HTTP ${release_status})."');
    expect(workflow).not.toContain('gh release view "$GITHUB_REF_NAME"');
  });

  it("accepts an existing tagged Release only when immutable assets match", () => {
    expect(workflow).toContain("'.immutable == true and .draft == false'");
    expect(workflow).toContain('gh release download "$GITHUB_REF_NAME"');
    expect(workflow).toContain("node scripts/release-assets.mjs compare");
    expect(workflow).toContain('echo "exists=true" >> "$GITHUB_OUTPUT"');
    expect(workflow).toContain("if: steps.release_state.outputs.exists != 'true'");
    expect(workflow).toContain('gh release create "$GITHUB_REF_NAME"');
    expect(workflow).not.toContain("gh release upload");
    expect(workflow).not.toContain("--clobber");
  });

  it("requires the existing Release asset inventory to be exactly four unique files", () => {
    expect(workflow).toContain('archive_name="property-order-${GITHUB_REF_NAME}.zip"');
    expect(workflow).toContain('(.assets | type == "array")');
    expect(workflow).toContain(
      '([.assets[].name] | sort) ==\n                  (["main.js", "manifest.json", "styles.css", $archive_name] | sort)',
    );
    expect(workflow).toContain('([.assets[].name] | unique | length) == 4');
    expect(workflow).toContain(
      '"The tagged Release asset inventory is not exactly the four expected files; publish a new version."',
    );
  });

  it("verifies the exact remote draft and immutable asset bytes around publication", () => {
    expect(workflow).toContain('gh release create "$GITHUB_REF_NAME" "${assets[@]}"');
    expect(workflow).toMatch(/gh release create[\s\S]*?--draft[\s\S]*?gh release edit/u);
    expect(workflow).toContain('--draft=false');
    expect(workflow).toContain("verify_release_assets() {");
    expect(workflow).toContain(".draft == $expected_draft");
    expect(workflow).toContain(".immutable == $expected_immutable");
    expect(workflow).toContain('"draft-pre-publish"');
    expect(workflow).toContain('"published-post-publish"');
    expect(workflow).toContain("Release supply-chain verification failed");
    expect(workflow.match(/node scripts\/release-assets\.mjs compare/gu)).toHaveLength(2);
    expect(workflow).toMatch(
      /gh release create[\s\S]*?verify_release_assets[\s\S]*?gh release edit/u,
    );
    expect(workflow).toMatch(
      /gh release edit[\s\S]*?--draft=false[\s\S]*?verify_release_assets/u,
    );
  });

  it("attests every published release asset", () => {
    expect(workflow).toContain("attestations: write");
    expect(workflow).toContain("id-token: write");
    expect(workflow).toContain(
      "uses: actions/attest@36051bcae73b7c2a8a6945a48cbf80953c6baa35 # v4",
    );
    expect(workflow).toContain("dist/main.js");
    expect(workflow).toContain("dist/manifest.json");
    expect(workflow).toContain("dist/styles.css");
    expect(workflow).toContain("dist/property-order-${{ github.ref_name }}.zip");
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
