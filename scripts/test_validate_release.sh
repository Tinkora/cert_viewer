#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
validator="${script_dir}/validate_release.sh"
repo_root="${script_dir}/.."
release_workflow="${repo_root}/.github/workflows/release.yml"
fixture_root="$(mktemp -d)"
trap 'rm -rf "${fixture_root}"' EXIT

for workflow in test quality docs-quality supply-chain pages release; do
  if [[ ! -f "${repo_root}/.github/workflows/${workflow}.yml" ]]; then
    printf 'Required workflow implementation is missing: %s.yml\n' "${workflow}" >&2
    exit 1
  fi
done

write_workspace_package() {
  local package_dir="$1"
  local package_name="$2"

  mkdir -p "${package_dir}/src"
  cat > "${package_dir}/Cargo.toml" <<EOF
[package]
name = "${package_name}"
version.workspace = true
edition.workspace = true
EOF
  : > "${package_dir}/src/lib.rs"
}

reset_fixture() {
  find "${fixture_root}" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
  mkdir -p "${fixture_root}/crates" "${fixture_root}/docs/schema"

  cat > "${fixture_root}/Cargo.toml" <<'EOF'
[workspace]
members = ["crates/core", "crates/web"]
resolver = "2"

[workspace.package]
version = "0.1.0"
edition = "2021"
EOF
  write_workspace_package "${fixture_root}/crates/core" "fixture_core"
  write_workspace_package "${fixture_root}/crates/web" "fixture_web"

  cat > "${fixture_root}/package.json" <<'EOF'
{
  "name": "fixture",
  "version": "0.1.0"
}
EOF
  cat > "${fixture_root}/CHANGELOG.md" <<'EOF'
# Changelog

## [0.1.0] - 2026-08-10
EOF
  cat > "${fixture_root}/CITATION.cff" <<'EOF'
cff-version: 1.2.0
title: fixture
version: 0.1.0
date-released: 2026-08-10
EOF
  cat > "${fixture_root}/docs/schema/inspection-result-v1.example.json" <<'EOF'
{
  "schema_version": 1
}
EOF
  cargo generate-lockfile --quiet --manifest-path "${fixture_root}/Cargo.toml"
  git -C "${fixture_root}" init --quiet
  git -C "${fixture_root}" config user.name "Release Test"
  git -C "${fixture_root}" config user.email "release-test@example.invalid"
  git -C "${fixture_root}" add .
  git -C "${fixture_root}" commit --quiet -m fixture
}

expect_failure() {
  local expected_message="$1"
  shift
  local output

  if output="$("$@" 2>&1)"; then
    printf 'Expected command to fail: %s\n' "$*" >&2
    exit 1
  fi
  if [[ "${output}" != *"${expected_message}"* ]]; then
    printf 'Expected failure containing %q, got:\n%s\n' \
      "${expected_message}" "${output}" >&2
    exit 1
  fi
}

reset_fixture
"${validator}" v0.1.0 "${fixture_root}" canary

expect_failure "stable SemVer" \
  "${validator}" v01.1.0 "${fixture_root}" canary
expect_failure "mode must be canary or tag" \
  "${validator}" v0.1.0 "${fixture_root}" preview

reset_fixture
sed -i.bak 's/version = "0.1.0"/version = "0.2.0"/' "${fixture_root}/Cargo.toml"
rm "${fixture_root}/Cargo.toml.bak"
cargo generate-lockfile --quiet --manifest-path "${fixture_root}/Cargo.toml"
expect_failure "Cargo package versions" \
  "${validator}" v0.1.0 "${fixture_root}" canary

reset_fixture
sed -i.bak 's/"version": "0.1.0"/"version": "0.2.0"/' "${fixture_root}/package.json"
rm "${fixture_root}/package.json.bak"
expect_failure "package.json version" \
  "${validator}" v0.1.0 "${fixture_root}" canary

reset_fixture
sed -i.bak 's/version: 0.1.0/version: 0.2.0/' "${fixture_root}/CITATION.cff"
rm "${fixture_root}/CITATION.cff.bak"
expect_failure "CITATION.cff version" \
  "${validator}" v0.1.0 "${fixture_root}" canary

reset_fixture
sed -i.bak 's/"schema_version": 1/"schema_version": 2/' \
  "${fixture_root}/docs/schema/inspection-result-v1.example.json"
rm "${fixture_root}/docs/schema/inspection-result-v1.example.json.bak"
expect_failure "Schema example version" \
  "${validator}" v0.1.0 "${fixture_root}" canary

reset_fixture
printf '\n## [0.1.0] - 2026-08-10\n' >> "${fixture_root}/CHANGELOG.md"
expect_failure "exactly one dated section" \
  "${validator}" v0.1.0 "${fixture_root}" canary

reset_fixture
sed -i.bak 's/ - 2026-08-10//' "${fixture_root}/CHANGELOG.md"
rm "${fixture_root}/CHANGELOG.md.bak"
expect_failure "exactly one dated section" \
  "${validator}" v0.1.0 "${fixture_root}" canary

reset_fixture
git -C "${fixture_root}" tag v0.1.0
expect_failure "must not already exist" \
  "${validator}" v0.1.0 "${fixture_root}" canary

reset_fixture
git -C "${fixture_root}" tag v0.1.0
printf '\n' >> "${fixture_root}/package.json"
git -C "${fixture_root}" add package.json
git -C "${fixture_root}" commit --quiet -m second
GITHUB_REF=refs/tags/v0.1.0 expect_failure "must resolve to HEAD" \
  "${validator}" v0.1.0 "${fixture_root}" tag

reset_fixture
git -C "${fixture_root}" tag v0.1.0
GITHUB_REF=refs/tags/v0.2.0 expect_failure "GitHub workflow ref" \
  "${validator}" v0.1.0 "${fixture_root}" tag
GITHUB_REF=refs/tags/v0.1.0 \
  "${validator}" v0.1.0 "${fixture_root}" tag

WORKFLOW_ROOT="${repo_root}/.github/workflows" ruby -ryaml <<'RUBY'
workflow_root = ENV.fetch("WORKFLOW_ROOT")
expected_files = %w[
  test.yml
  quality.yml
  docs-quality.yml
  supply-chain.yml
  pages.yml
  release.yml
]

def assert_contract(condition, message)
  abort "Workflow contract failed: #{message}" unless condition
end

workflows = expected_files.to_h do |name|
  path = File.join(workflow_root, name)
  assert_contract(File.file?(path), "missing #{name}")
  [name, YAML.safe_load_file(path, aliases: false)]
end

workflows.each do |name, workflow|
  assert_contract(
    workflow.fetch("permissions") == { "contents" => "read" },
    "#{name} top-level permissions must be contents: read"
  )

  triggers = workflow.key?("on") ? workflow.fetch("on") : workflow.fetch(true)
  assert_contract(!triggers.key?("pull_request_target"), "#{name} uses pull_request_target")

  workflow.fetch("jobs").each do |job_name, job|
    permissions = job.fetch("permissions", { "contents" => "read" })
    allowed = if name == "pages.yml" && job_name == "deploy"
      { "contents" => "read", "pages" => "write", "id-token" => "write" }
    elsif name == "release.yml" && job_name == "attest"
      { "contents" => "read", "attestations" => "write", "id-token" => "write" }
    elsif name == "release.yml" && job_name == "publish"
      { "contents" => "write" }
    else
      { "contents" => "read" }
    end
    assert_contract(permissions == allowed, "#{name}/#{job_name} permissions are not least privilege")
  end

  text = File.read(File.join(workflow_root, name), encoding: "UTF-8")
  assert_contract(!text.match?(/\bwrite-all\b/), "#{name} uses write-all")
  assert_contract(!text.include?("secrets: inherit"), "#{name} inherits secrets")
  assert_contract(
    !text.match?(/run:\s*(?:\||>)?[\s\S]*?\$\{\{\s*(?:github\.event\.(?:pull_request|issue|comment|head_commit)|inputs\.)/),
    "#{name} interpolates untrusted event data directly into shell"
  )

  workflow.fetch("jobs").each_value do |job|
    uses = [job["uses"]] + job.fetch("steps", []).map { |step| step["uses"] }
    uses.compact.reject { |value| value.start_with?("./") }.each do |value|
      assert_contract(
        value.match?(%r{\A[^@\s]+@[0-9a-f]{40}\z}),
        "#{name} has an external use without a full SHA: #{value}"
      )
    end
  end
end

test = workflows.fetch("test.yml")
test_triggers = test.key?("on") ? test.fetch("on") : test.fetch(true)
assert_contract(test_triggers.dig("push", "branches") == ["main"], "test push must target main")
assert_contract(test_triggers.dig("pull_request", "branches") == ["main"], "test PR must target main")
assert_contract(test_triggers.key?("workflow_dispatch"), "test must support manual runs")
assert_contract(test.dig("concurrency", "cancel-in-progress") == true, "test must cancel superseded runs")
assert_contract(test.dig("jobs", "quality", "uses") == "./.github/workflows/quality.yml", "test must call quality")

quality = workflows.fetch("quality.yml")
quality_triggers = quality.key?("on") ? quality.fetch("on") : quality.fetch(true)
assert_contract(quality_triggers.key?("workflow_call"), "quality must be reusable")
expected_reusable = {
  "rust" => "Tinkora/.github/.github/workflows/reusable-rust-quality.yml@af8ae92c2083c55283187be0d6a1ffba7740df86",
  "wasm" => "Tinkora/.github/.github/workflows/reusable-wasm-quality.yml@af8ae92c2083c55283187be0d6a1ffba7740df86"
}
expected_reusable.each do |job_name, use|
  assert_contract(quality.dig("jobs", job_name, "uses") == use, "quality #{job_name} reusable workflow changed")
end
browser = quality.dig("jobs", "browser")
assert_contract(browser.fetch("runs-on") == "ubuntu-24.04", "browser runner changed")
browser_run = browser.fetch("steps").filter_map { |step| step["run"] }.join("\n")
%w[npm\ ci\ --ignore-scripts npm\ run\ test:web npm\ run\ test:schema npm\ run\ test:browser].each do |command|
  assert_contract(browser_run.include?(command.gsub("\\ ", " ")), "browser job misses #{command}")
end

docs = workflows.fetch("docs-quality.yml")
docs_run = docs.fetch("jobs").values.flat_map { |job| job.fetch("steps", []) }
  .filter_map { |step| step["run"] }.join("\n")
[
  "npm ci --ignore-scripts",
  "ruby scripts/check_docs.rb",
  "npm run test:schema",
  "bash scripts/test_validate_release.sh",
  "npm run test:sbom",
  "go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.7"
].each { |command| assert_contract(docs_run.include?(command), "docs quality misses #{command}") }

supply = workflows.fetch("supply-chain.yml")
dependency_review = supply.dig("jobs", "dependency-review")
assert_contract(
  dependency_review.fetch("if").include?("pull_request"),
  "dependency review must run only for pull requests"
)

pages = workflows.fetch("pages.yml")
assert_contract(pages.dig("jobs", "quality", "uses") == "./.github/workflows/quality.yml", "Pages must call quality")
assert_contract(pages.dig("jobs", "build", "needs") == "quality", "Pages build must follow quality")
assert_contract(
  pages.dig("jobs", "deploy", "uses") == "Tinkora/.github/.github/workflows/reusable-pages.yml@af8ae92c2083c55283187be0d6a1ffba7740df86",
  "Pages deploy reusable workflow changed"
)
pages_build = pages.dig("jobs", "build", "steps")
assert_contract(pages_build.any? { |step| step["run"] == "bash scripts/build_web.sh" }, "Pages must use build_web.sh")
pages_upload = pages_build.find { |step| step["uses"]&.start_with?("actions/upload-artifact@") }
assert_contract(
  pages_upload&.dig("with", "name") == "cert-viewer-pages-${{ github.run_id }}" &&
    pages_upload&.dig("with", "path") == "dist",
  "Pages artifact contract changed"
)

release = workflows.fetch("release.yml")
release_triggers = release.key?("on") ? release.fetch("on") : release.fetch(true)
dispatch_input = release_triggers.dig("workflow_dispatch", "inputs", "release_tag")
assert_contract(dispatch_input&.fetch("required") == true, "manual release must require release_tag")
assert_contract(release.dig("concurrency", "cancel-in-progress") == false, "release runs must never cancel")
jobs = release.fetch("jobs")
assert_contract(jobs.fetch("publish").fetch("if").include?("github.event_name == 'push'"), "manual release may publish")
assert_contract(jobs.fetch("publish").fetch("environment") == "release", "publication must use release environment")
assert_contract(
  jobs.fetch("publish").fetch("needs").sort == %w[attest build checksum metadata quality sbom verify].sort,
  "publication must depend on metadata, quality, build, checksum, SBOM, and attestation verification"
)
assert_contract(jobs.fetch("attest").fetch("needs").sort == %w[build checksum sbom], "attestation prerequisites changed")
assert_contract(jobs.fetch("verify").fetch("needs").sort == %w[attest build checksum sbom], "verification prerequisites changed")

release_text = File.read(File.join(workflow_root, "release.yml"), encoding: "UTF-8")
[
  "cert_viewer-web-v${VERSION}.tar.gz",
  "cert_viewer-source-v${VERSION}.tar.gz",
  "SHA256SUMS",
  "SBOM.spdx.json",
  "node scripts/release_sbom.mjs generate",
  "node scripts/release_sbom.mjs validate",
  "actions/attest-build-provenance@977bb373ede98d70efdf65b84cb5f73e068dcc2a",
  "actions/attest-sbom@4651f806c01d8637787e274ac3bdf724ef169f34"
].each { |value| assert_contract(release_text.include?(value), "release contract misses #{value}") }
assert_contract(!release_text.include?("jq -n"), "release SBOM must not be an inline file-only document")
assert_contract(
  release_text.scan("node scripts/release_sbom.mjs validate").length == 4,
  "release must validate SBOM generation, attestation, download, and publication inputs"
)
assert_contract(!release_text.include?("--generate-notes"), "generated release notes must stay disabled")
assert_contract(!release_text.include?("--clobber"), "release assets must never be overwritten")
assert_contract(release_text.include?("--draft"), "release must be assembled as a draft")
assert_contract(release_text.include?("--draft=false"), "release must publish only after asset upload")

publish_steps = jobs.fetch("publish").fetch("steps")
tag_verification_steps = publish_steps.each_index.select do |index|
  publish_steps[index]["name"]&.start_with?("Verify remote tag commit")
end
assert_contract(
  tag_verification_steps.length == 2,
  "publication must verify the remote tag before draft creation and again before publication"
)
tag_verification_steps.each do |index|
  run = publish_steps[index].fetch("run", "")
  assert_contract(
    run.scan('/git/ref/tags/${RELEASE_TAG}').length == 1 &&
      run.include?('/git/tags/${tag_sha}') &&
      run.include?('while [[ "${tag_type}" == "tag" ]]') &&
      run.include?('"${tag_type}" != "commit" || "${tag_sha}" != "${GITHUB_SHA}"'),
    "remote tag verification must recursively peel annotated tags and match GITHUB_SHA"
  )
end
create_draft_index = publish_steps.index do |step|
  step["name"] == "Create draft and upload four assets"
end
create_draft_step = publish_steps.fetch(create_draft_index)
create_draft_run = create_draft_step.fetch("run", "")
assert_contract(
  create_draft_run.include?('release_id="$(gh api') &&
    create_draft_run.include?('--method POST') &&
    create_draft_run.include?('repos/${GITHUB_REPOSITORY}/releases') &&
    create_draft_run.include?('repos/${GITHUB_REPOSITORY}/releases/${release_id}'),
  "draft publication must capture the create response ID and read back by release ID"
)
assert_contract(
  !create_draft_run.include?('releases/tags/${RELEASE_TAG}'),
  "draft publication must not use the published-release tag endpoint"
)
publish_draft_index = publish_steps.index do |step|
  step.fetch("run", "").include?("gh release edit") && step.fetch("run", "").include?("--draft=false")
end
assert_contract(
  tag_verification_steps.first < create_draft_index &&
    create_draft_index < tag_verification_steps.last &&
    tag_verification_steps.last < publish_draft_index,
  "remote tag verification must bracket draft creation and publication"
)

puts "Workflow release and supply-chain contract passed."
RUBY

tag_check_script="${fixture_root}/verify_remote_tag.sh"
WORKFLOW_PATH="${release_workflow}" OUTPUT_PATH="${tag_check_script}" ruby -ryaml <<'RUBY'
workflow = YAML.safe_load_file(ENV.fetch("WORKFLOW_PATH"), aliases: false)
scripts = workflow.dig("jobs", "publish", "steps").filter_map do |step|
  step.fetch("run", nil) if step["name"]&.start_with?("Verify remote tag commit")
end
abort "Expected exactly two remote tag verification scripts" unless scripts.length == 2
abort "Remote tag verification scripts must be identical" unless scripts.uniq.length == 1
File.write(ENV.fetch("OUTPUT_PATH"), scripts.fetch(0), encoding: "UTF-8")
RUBY

mock_bin="${fixture_root}/mock-bin"
mkdir -p "${mock_bin}"
cat > "${mock_bin}/gh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" != "api" ]]; then
  printf 'Unexpected gh command: %s\n' "$*" >&2
  exit 1
fi

case "${2:-}" in
  repos/example/cert_viewer/git/ref/tags/v0.1.0)
    printf '%s\n' '{"object":{"type":"tag","sha":"1111111111111111111111111111111111111111"}}'
    ;;
  repos/example/cert_viewer/git/tags/1111111111111111111111111111111111111111)
    printf '%s\n' '{"object":{"type":"tag","sha":"2222222222222222222222222222222222222222"}}'
    ;;
  repos/example/cert_viewer/git/tags/2222222222222222222222222222222222222222)
    printf '{"object":{"type":"commit","sha":"%s"}}\n' \
      "${MOCK_GH_COMMIT_SHA:?}"
    ;;
  *)
    printf 'Unexpected gh api endpoint: %s\n' "${2:-}" >&2
    exit 1
    ;;
esac
EOF
chmod +x "${mock_bin}/gh"

expected_commit="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
mismatched_commit="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
tag_check_env=(
  "PATH=${mock_bin}:${PATH}"
  "GH_TOKEN=test-token"
  "GITHUB_REPOSITORY=example/cert_viewer"
  "RELEASE_TAG=v0.1.0"
  "GITHUB_SHA=${expected_commit}"
)

env "${tag_check_env[@]}" "MOCK_GH_COMMIT_SHA=${expected_commit}" \
  bash --noprofile --norc -e -o pipefail "${tag_check_script}"
expect_failure "expected commit ${expected_commit}" \
  env "${tag_check_env[@]}" "MOCK_GH_COMMIT_SHA=${mismatched_commit}" \
    bash --noprofile --norc -e -o pipefail "${tag_check_script}"

printf 'Release validation tests passed.\n'
