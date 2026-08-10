# Release Procedure

This procedure publishes immutable, auditable Cert Viewer releases. A release tag identifies one exact reviewed commit and is never moved or reused.

## 1. Preflight

1. Confirm the release version and date in `package.json`, `CITATION.cff`, and `CHANGELOG.md`.
2. Confirm the changelog describes user-visible behavior, security boundaries, compatibility, and known limitations.
3. Start from a clean `main` and record the exact candidate SHA with `git rev-parse HEAD`.
4. Run the full local checks documented in `CONTRIBUTING.md` using the pinned toolchain.
5. Confirm required branch checks, dependency review, CodeQL, browser tests, schema tests, documentation checks, and build jobs pass for that exact SHA.
6. Review the generated site locally and confirm certificate inspection produces no unexpected network requests.

## 2. Dry Run

Run the release workflow in dry-run mode against the candidate SHA. The dry run must build the same asset set as a release, generate checksums and an SBOM, and exercise provenance generation without creating a tag or public release.

Download the dry-run artifacts and verify that:

- the archive contains only the intended static site files;
- the WebAssembly MIME and local static-server behavior work;
- checksums match locally calculated values;
- the SBOM identifies the expected Rust and npm dependencies;
- provenance names the expected repository, workflow, commit, and build inputs.

## 3. Exact-SHA Approval

Present the candidate SHA, completed checks, dry-run artifact identifiers, changelog entry, and proposed tag to the approving maintainer. Obtain explicit approval for that exact SHA immediately before creating the tag. Approval of a branch name, earlier commit, or mutable workflow run is not sufficient.

If the commit changes after approval, discard the approval, rerun affected checks and the dry run, and request approval for the new SHA.

## 4. Immutable Tag And Release

Create the annotated `vMAJOR.MINOR.PATCH` tag only after exact-SHA approval and push it once. The release workflow must verify that the tag resolves to the approved commit before publishing.

Publish a GitHub Release containing the static site archive, source archive references, checksum manifest, SBOM, provenance or attestation, and concise release notes linked to the changelog. Do not replace artifacts after publication, move the tag, or reuse the version.

## 5. Post-Release Verification

1. Verify the public tag resolves to the approved SHA.
2. Download every asset from GitHub Releases and compare it with the published checksum manifest.
3. Inspect the SBOM and verify the attestation against `tinkora/cert_viewer`, the expected release workflow, the exact SHA, and the immutable tag.
4. Open the deployed Pages site, inspect the public sample in both languages, and verify console, keyboard, accessibility, CSP, and network privacy behavior.
5. Confirm the release appears correctly in GitHub's citation and package or artifact interfaces.

Record links to the workflow run, release, verification evidence, and any follow-up issue in the release tracking issue.

## Failure Recovery

Before a tag is pushed, fix the cause, create a new candidate commit if needed, and repeat checks, dry run, and exact-SHA approval.

After a tag or release is public, never rewrite it. Mark a broken release clearly, stop deployment or roll Pages back to the prior immutable release, and prepare a new patch version. Publish the correction as a superseding release with its own checksums, SBOM, attestation, changelog entry, exact-SHA approval, and immutable tag. Security-sensitive failures should also use GitHub Security Advisories for coordinated disclosure.
