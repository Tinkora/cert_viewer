# Cert Viewer Public Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build, verify, and publish Tinkora Cert Viewer `v0.1.0` as a
browser-local X.509 inspection tool with an English-first bilingual interface,
a versioned JSON result, and no claim of certificate validation or agent
callability.

**Architecture:** A platform-independent Rust core strictly classifies and
inspects DER or PEM bundle bytes using `x509-parser 0.18.1`. A thin
`wasm-bindgen` crate serializes the core result, while dependency-light HTML,
CSS, and JavaScript modules own localization, safe DOM rendering, and browser
interaction. GitHub Actions build the same static `dist/` tree used by
Playwright, Pages, checksummed release assets, and provenance attestations.

**Tech Stack:** Rust 1.95.0, Cargo workspace, `x509-parser 0.18.1`,
`wasm-bindgen`, `serde-wasm-bindgen`, `wasm-pack 0.15.0`, HTML/CSS/ES modules,
Node.js 24, Playwright 1.62.1, `@axe-core/playwright 4.12.1`, Ajv 8.20.0,
LinkeDOM 0.18.13, GitHub Actions, GitHub Pages, CodeQL, Dependabot, cargo-deny,
and cargo-audit.

---

## Execution Constraints

- Work on local `main`; do not push until Task 13 explicitly authorizes it.
- Read `AGENTS.md` before each delegated task. Repository rules require English
  Conventional Commits and English code comments.
- Preserve unrelated working-tree content. This plan explicitly owns the old
  Cert Viewer prototype files named in the file map below.
- Use `apply_patch` for manual text edits. Generated lockfiles, OpenSSL
  fixtures, WASM packages, screenshots, and formatted output may be produced by
  their dedicated tools.
- Before every GitHub operation, run `gh auth status -h github.com` and confirm
  the active account is `tinkeragora`. Never print or persist `gh auth token`.
- Do not add a CLI, MCP transport, API server, PWA, trust check, chain
  validation, hostname check, signature verification, or revocation lookup.
- Do not call a certificate or bundle valid, trusted, safe, usable, verified,
  or self-signed. Use `within_stated_dates` and `is_self_issued` exactly.
- Invoke `ui-ux-pro-max` and complete its required searches immediately before
  each of Tasks 8, 9, and 10 edits any user-facing frontend.
- Keep all browser runtime assets local. No external font, CDN, analytics,
  telemetry, cookie, or certificate storage is allowed.
- Make a local milestone commit only after the task-specific checks pass. The
  final publication baseline is rewritten to one clean English commit after all
  behavior is verified.

## Final File Map

```text
.
├── .github/
│   ├── CODEOWNERS
│   ├── ISSUE_TEMPLATE/{bug.yml,config.yml,feature.yml,question.yml}
│   ├── PULL_REQUEST_TEMPLATE.md
│   ├── dependabot.yml
│   └── workflows/{docs-quality,pages,quality,release,supply-chain,test}.yml
├── assets/
│   └── social-preview.png
├── crates/
│   ├── cert_viewer_core/
│   │   ├── Cargo.toml
│   │   ├── src/{error,input,inspect,lib,model,oid}.rs
│   │   └── tests/{date_status,input_contract,inspection_fields,schema_contract}.rs
│   └── cert_viewer_web/
│       ├── Cargo.toml
│       ├── src/lib.rs
│       └── tests/wasm_boundary.rs
├── docs/
│   ├── decisions/
│   │   ├── 0001-browser-first-local-only.md
│   │   └── 0002-inspection-only-terminology.md
│   ├── schema/
│   │   ├── README.md
│   │   ├── inspection-result-v1.example.json
│   │   └── inspection-result-v1.schema.json
│   ├── superpowers/{plans,specs}/
│   ├── RELEASING.md
│   └── SELF_HOSTING.md
├── scripts/
│   ├── build_web.sh
│   ├── check_docs.rb
│   ├── test_validate_release.sh
│   ├── validate_schema.mjs
│   └── validate_release.sh
├── tests/
│   ├── browser/{accessibility,security,workflow}.spec.mjs
│   ├── fixtures/
│   │   ├── README.md
│   │   ├── bundle.pem
│   │   ├── ec-ca.{der,pem,der.sha1,der.sha256,openssl.txt}
│   │   ├── generate.sh
│   │   ├── html-like-dn.pem
│   │   ├── rsa-leaf.{der,pem,der.sha1,der.sha256,openssl.txt}
│   │   ├── self-issued-not-self-signed.pem
│   │   ├── unsupported-version.der
│   │   └── unknown-oids.pem
│   └── web/{format,i18n,render}.test.mjs
├── web/
│   ├── app.mjs
│   ├── favicon.svg
│   ├── format.mjs
│   ├── i18n.mjs
│   ├── index.html
│   ├── render.mjs
│   ├── sample.mjs
│   └── styles.css
├── .gitignore
├── .markdownlint-cli2.jsonc
├── AGENTS.md
├── CHANGELOG.md
├── CITATION.cff
├── CODE_OF_CONDUCT.md
├── CODE_OF_CONDUCT.zh-CN.md
├── CONTRIBUTING.md
├── CONTRIBUTING.zh-CN.md
├── Cargo.lock
├── Cargo.toml
├── LICENSE
├── README.md
├── README.zh-CN.md
├── SECURITY.md
├── SECURITY.zh-CN.md
├── SUPPORT.md
├── SUPPORT.zh-CN.md
├── THIRD_PARTY_NOTICES.md
├── deny.toml
├── package-lock.json
├── package.json
├── playwright.config.mjs
└── rust-toolchain.toml
```

Delete these obsolete prototype paths rather than carrying their claims into
the public baseline:

```text
crates/cert_viewer_core/src/parse.rs
crates/cert_viewer_core/src/wasm.rs
crates/cert_viewer_web/static/index.html
docs/product_spec.zh-CN.md
index.html
skills/cert_viewer.md
skills/mcp-tools.json
```

## Task 1: Rebuild Workspace Metadata and Boundaries

**Files:**

- Modify: `Cargo.toml`
- Modify: `crates/cert_viewer_core/Cargo.toml`
- Modify: `crates/cert_viewer_web/Cargo.toml`
- Modify: `.gitignore`
- Modify: `AGENTS.md`
- Create: `rust-toolchain.toml`
- Delete: `crates/cert_viewer_core/src/wasm.rs`

- [ ] **Step 1: Replace the workspace manifest with the approved dependency boundary**

Use this dependency ownership; do not enable `x509-parser` verification
features:

```toml
[workspace]
members = ["crates/cert_viewer_core", "crates/cert_viewer_web"]
resolver = "3"

[workspace.package]
version = "0.1.0"
edition = "2024"
license = "MIT"
repository = "https://github.com/Tinkora/cert_viewer"
rust-version = "1.95"

[workspace.dependencies]
hex = "0.4.3"
js-sys = "0.3.81"
pem = "3.0.6"
serde = { version = "1.0.219", features = ["derive"] }
serde_json = "1.0.143"
serde-wasm-bindgen = "0.6.5"
sha1 = "0.10.6"
sha2 = "0.10.9"
thiserror = "2.0.16"
wasm-bindgen = "0.2.104"
wasm-bindgen-test = "0.3.54"
x509-parser = "0.18.1"

[profile.release]
lto = "thin"
strip = true
```

Core runtime dependencies are `hex`, `pem`, `serde`, `sha1`, `sha2`,
`thiserror`, and `x509-parser`; `serde_json` is a dev-dependency. The web crate
uses `cert_viewer_core`, `js-sys`, `serde-wasm-bindgen`, and `wasm-bindgen`, with
`wasm-bindgen-test` as a dev-dependency and `crate-type = ["cdylib", "rlib"]`.

- [ ] **Step 2: Pin the supported Rust toolchain**

Create `rust-toolchain.toml`:

```toml
[toolchain]
channel = "1.95.0"
components = ["clippy", "rustfmt"]
profile = "minimal"
targets = ["wasm32-unknown-unknown"]
```

- [ ] **Step 3: Rebuild ignore rules and agent guidance**

Use repository-root ignore entries:

```gitignore
/dist/
/node_modules/
/output/
/playwright-report/
/target/
/test-results/
/crates/*/pkg/
.DS_Store
```

Rewrite `AGENTS.md` to describe only the approved core, WASM, web, and test
boundaries. It must retain these repository overrides verbatim:

```markdown
## Commit Language

- Write commit subjects and bodies in English and follow Conventional Commits.
- This repository-level rule overrides any global preference for another
  commit-message language.

## Code Comments

- Write all new or modified code comments in English.

## Frontend Design Requirement

- Before creating, modifying, reviewing, or debugging any HTML page or
  user-facing frontend, invoke the `ui-ux-pro-max` skill.
- Run the skill's required `--design-system` search before editing, followed by
  relevant stack and UX searches.
- If `ui-ux-pro-max` is unavailable, stop frontend work and report the missing
  prerequisite.
- Verify the rendered result in a real browser at 375, 768, 1024, and 1440
  pixel widths, including console, keyboard, accessibility, and overflow checks.
```

- [ ] **Step 4: Remove the duplicate core WASM bridge and regenerate the lockfile**

Run:

```bash
cargo generate-lockfile
cargo metadata --locked --no-deps --format-version 1 >/dev/null
```

Expected: both commands exit 0; `Cargo.lock` resolves `x509-parser 0.18.1`; the
core manifest contains no `wasm-bindgen`, `js-sys`, or `serde-wasm-bindgen`.

- [ ] **Step 5: Verify and commit the workspace milestone**

Run:

```bash
cargo fmt --all -- --check
git diff --check
git status --short
```

Expected: formatting and diff checks pass. Stage only the files listed in this
task, including `Cargo.lock`, then commit:

```bash
git commit -m "build: define the Cert Viewer workspace"
git show -s --format=%B HEAD
```

Expected commit message: `build: define the Cert Viewer workspace`.

## Task 2: Add Independently Inspectable Certificate Fixtures

**Files:**

- Create: `tests/fixtures/generate.sh`
- Create: `tests/fixtures/README.md`
- Create: `tests/fixtures/rsa-leaf.pem`
- Create: `tests/fixtures/rsa-leaf.der`
- Create: `tests/fixtures/rsa-leaf.der.sha256`
- Create: `tests/fixtures/rsa-leaf.der.sha1`
- Create: `tests/fixtures/rsa-leaf.openssl.txt`
- Create: `tests/fixtures/ec-ca.pem`
- Create: `tests/fixtures/ec-ca.der`
- Create: `tests/fixtures/ec-ca.der.sha256`
- Create: `tests/fixtures/ec-ca.der.sha1`
- Create: `tests/fixtures/ec-ca.openssl.txt`
- Create: `tests/fixtures/self-issued-not-self-signed.pem`
- Create: `tests/fixtures/unsupported-version.der`
- Create: `tests/fixtures/unknown-oids.pem`
- Create: `tests/fixtures/html-like-dn.pem`
- Create: `tests/fixtures/bundle.pem`

- [ ] **Step 1: Write the OpenSSL fixture generator**

The script must use `mktemp -d`, remove private keys on exit, set fixed serial
numbers and subjects, and write only public certificates and expected output to
`tests/fixtures/`. Its certificate profiles are exact:

```text
rsa-leaf:
  serial=0x1001
  subject=C=US,O=Tinkora Test,CN=rsa.fixture.tinkora.test
  basicConstraints=critical,CA:FALSE
  keyUsage=critical,digitalSignature,keyEncipherment
  extendedKeyUsage=serverAuth,clientAuth
  subjectAltName=DNS:rsa.fixture.tinkora.test,
    DNS:alt.fixture.tinkora.test,IP:192.0.2.10,
    email:fixture@tinkora.test,URI:https://fixture.tinkora.test/cert

ec-ca:
  serial=0x2001
  subject=C=US,O=Tinkora Test,CN=ec-ca.fixture.tinkora.test
  key=P-256
  basicConstraints=critical,CA:TRUE,pathlen:1
  keyUsage=critical,keyCertSign,cRLSign

self-issued-not-self-signed:
  serial=0x3001
  subject=issuer=C=US,O=Tinkora Test,CN=self-issued.fixture.tinkora.test
  public key belongs to a leaf; signature is made by a different fixture key

unknown-oids:
  serial=0x4001
  subject includes 1.2.3.4.5=retained-name
  extendedKeyUsage includes 1.2.3.4.6
  extension includes 1.2.3.4.7=ASN1:UTF8String:retained-extension

html-like-dn:
  serial=0x5001
  common name=<img src=x onerror=alert(1)>.fixture.test

unsupported-version:
  copy rsa-leaf.der and replace its unique a0 03 02 01 02 version sequence
  with a0 03 02 01 03, producing encoded X.509 version 4 for rejection tests
```

Derive `unsupported-version.der` with Ruby byte operations, require exactly one
match for `"\xA0\x03\x02\x01\x02".b`, change only its final byte to `0x03`,
and abort if the source layout differs. This deliberately invalidates the
signature, but the product never verifies signatures and must reject the
unsupported version before presenting any result.

For every `.der`, run both independent checksum commands:

```bash
openssl dgst -sha256 -r tests/fixtures/rsa-leaf.der \
  > tests/fixtures/rsa-leaf.der.sha256
openssl dgst -sha1 -r tests/fixtures/rsa-leaf.der \
  > tests/fixtures/rsa-leaf.der.sha1
```

Repeat for `ec-ca.der`. Capture independent metadata with:

```bash
openssl x509 -in tests/fixtures/rsa-leaf.pem -noout \
  -serial -subject -issuer -dates -ext subjectAltName \
  -ext keyUsage -ext extendedKeyUsage -ext basicConstraints \
  > tests/fixtures/rsa-leaf.openssl.txt
```

- [ ] **Step 2: Generate and independently verify the fixtures**

Run:

```bash
bash tests/fixtures/generate.sh
openssl x509 -in tests/fixtures/rsa-leaf.pem -noout -text >/dev/null
openssl x509 -in tests/fixtures/ec-ca.pem -noout -text >/dev/null
openssl x509 -inform DER -in tests/fixtures/unsupported-version.der \
  -noout -text | grep -F 'Version: 4 (0x3)'
openssl x509 -in tests/fixtures/self-issued-not-self-signed.pem \
  -noout -subject -issuer
if openssl verify -check_ss_sig \
  -CAfile tests/fixtures/self-issued-not-self-signed.pem \
  tests/fixtures/self-issued-not-self-signed.pem; then
  echo "self-issued fixture unexpectedly verifies with its own public key" >&2
  exit 1
fi
openssl dgst -sha256 -r tests/fixtures/rsa-leaf.der
openssl dgst -sha1 -r tests/fixtures/rsa-leaf.der
```

Expected: inspection and checksum commands exit 0; the guarded OpenSSL verify
command fails as required. The self-issued fixture prints identical subject and
issuer names while failing a signature check with its own public key. Checksum
output matches the committed `.sha256` and `.sha1` files.

- [ ] **Step 3: Document fixture provenance without committing private keys**

`tests/fixtures/README.md` must list OpenSSL `3.6.3`, every generation and
inspection command, the intentionally non-production names, and this warning:

```text
These certificates contain no production identity or secret. Private fixture
keys are generated in a temporary directory and are never committed.
```

Run:

```bash
find tests/fixtures -type f \( -iname '*key*' -o -iname '*.csr' \)
```

Expected: no output.

- [ ] **Step 4: Commit the fixture milestone**

Run `git diff --check`, stage only `tests/fixtures/`, and commit:

```bash
git commit -m "test: add OpenSSL certificate fixtures"
git show -s --format=%B HEAD
```

## Task 3: Define the Stable Result, Date, and Error Contracts

**Files:**

- Create: `crates/cert_viewer_core/src/model.rs`
- Replace: `crates/cert_viewer_core/src/error.rs`
- Replace: `crates/cert_viewer_core/src/lib.rs`
- Create: `crates/cert_viewer_core/tests/date_status.rs`

- [ ] **Step 1: Write failing date-boundary and error-serialization tests**

Create tests equivalent to:

```rust
use cert_viewer_core::{DateStatus, InspectionError, InspectionErrorCode};

#[test]
fn date_status_uses_inclusive_certificate_bounds() {
    assert_eq!(DateStatus::for_time(99, 100, 200), DateStatus::NotYetValid);
    assert_eq!(DateStatus::for_time(100, 100, 200), DateStatus::WithinStatedDates);
    assert_eq!(DateStatus::for_time(200, 100, 200), DateStatus::WithinStatedDates);
    assert_eq!(DateStatus::for_time(201, 100, 200), DateStatus::Expired);
}

#[test]
fn error_serialization_keeps_machine_fields() {
    let error = InspectionError::at_certificate(
        InspectionErrorCode::InvalidDer,
        "Certificate DER could not be decoded.",
        2,
    );
    let value = serde_json::to_value(error).expect("error serializes");
    assert_eq!(value["code"], "invalid_der");
    assert_eq!(value["certificate_index"], 2);
    assert_eq!(value["message"], "Certificate DER could not be decoded.");
}
```

Run:

```bash
cargo test -p cert_viewer_core --test date_status --locked
```

Expected: FAIL because the new public types do not exist.

- [ ] **Step 2: Implement the model types with exact serialized names**

Define these public types in `model.rs`; all enums use
`#[serde(rename_all = "snake_case")]`:

```rust
pub const SCHEMA_VERSION: u32 = 1;
pub const MAX_INPUT_BYTES: usize = 1_048_576;
pub const MAX_CERTIFICATES: usize = 32;

pub enum InputFormat { PemBundle, Der }
pub enum DateStatus { NotYetValid, WithinStatedDates, Expired }

pub struct InspectionResult {
    pub schema_version: u32,
    pub input_format: InputFormat,
    pub certificates: Vec<CertificateInspection>,
}

pub struct CertificateInspection {
    pub input_index: usize,
    pub version: u32,
    pub serial_number: String,
    pub subject: DistinguishedName,
    pub issuer: DistinguishedName,
    pub not_before_unix: i64,
    pub not_after_unix: i64,
    pub date_status: DateStatus,
    pub subject_alt_names: Vec<GeneralNameEntry>,
    pub key_usage: Vec<String>,
    pub extended_key_usage: Vec<String>,
    pub basic_constraints: Option<BasicConstraintsInfo>,
    pub extensions: Vec<ExtensionSummary>,
    pub public_key: PublicKeyInfo,
    pub signature_algorithm: AlgorithmInfo,
    pub fingerprints: Fingerprints,
    pub is_self_issued: bool,
}

pub struct DistinguishedName {
    pub common_name: Option<String>,
    pub organization: Option<String>,
    pub organizational_unit: Option<String>,
    pub country: Option<String>,
    pub state: Option<String>,
    pub locality: Option<String>,
    pub entries: Vec<NameEntry>,
}

pub struct NameEntry { pub oid: String, pub value: String, pub value_format: NameValueFormat }
pub enum NameValueFormat { Text, Hex }
pub struct GeneralNameEntry { pub kind: String, pub value: String }
pub struct BasicConstraintsInfo { pub is_ca: bool, pub path_length_constraint: Option<u32> }
pub struct ExtensionSummary { pub oid: String, pub critical: bool, pub decoded: bool }
pub struct AlgorithmInfo { pub oid: String, pub display_name: Option<String> }
pub struct PublicKeyInfo { pub algorithm: AlgorithmInfo, pub size_bits: Option<u32> }
pub struct Fingerprints { pub sha256: String, pub sha1: String }
```

Derive `Clone`, `Debug`, `Eq`, `PartialEq`, `Serialize`, and `Deserialize` where
the contained data permits it. `DateStatus::for_time` implements the exact
inclusive comparison from the approved specification.

- [ ] **Step 3: Implement one structured error type**

Use:

```rust
#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InspectionErrorCode {
    InvalidInputType,
    InvalidCurrentTime,
    InputEmpty,
    InputTooLarge,
    InvalidPemUtf8,
    InvalidPem,
    NonCertificatePemBlock,
    TooManyCertificates,
    InvalidDer,
    TrailingDerData,
    UnsupportedCertificateVersion,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize, thiserror::Error)]
#[error("{message}")]
pub struct InspectionError {
    pub code: InspectionErrorCode,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub certificate_index: Option<usize>,
}
```

Provide `new` and `at_certificate` constructors. Do not expose parser debug
strings as stable codes.

- [ ] **Step 4: Re-export only the approved public surface and make tests pass**

`lib.rs` declares private `input`, `inspect`, and `oid` modules, public `error`
and `model` modules, re-exports the model/error types, and reserves this exact
entry point for Task 5:

```rust
pub fn inspect_bundle(
    input: &[u8],
    now_unix_seconds: i64,
) -> Result<InspectionResult, InspectionError>;
```

Temporarily return `InspectionErrorCode::InvalidDer` from the entry point so the
crate compiles while behavior remains test-driven in later tasks.

Run:

```bash
cargo test -p cert_viewer_core --test date_status --locked
cargo fmt --all -- --check
cargo clippy -p cert_viewer_core --all-targets --locked -- -D warnings
```

Expected: all pass.

- [ ] **Step 5: Commit the contract milestone**

Stage only the files in this task and commit:

```bash
git commit -m "feat: define certificate inspection contracts"
git show -s --format=%B HEAD
```

## Task 4: Enforce Strict Input Classification and Limits

**Files:**

- Create: `crates/cert_viewer_core/src/input.rs`
- Create: `crates/cert_viewer_core/tests/input_contract.rs`

- [ ] **Step 1: Write failing outcome-focused input tests**

The test file must call `inspect_bundle` and assert every stable input-envelope
code. Task 5 covers the unsupported-version field error, and Task 6 covers the
two JavaScript boundary type errors:

```rust
#[test]
fn rejects_empty_and_oversized_input() {
    assert_code(b" \r\n\t", InspectionErrorCode::InputEmpty);
    assert_code(&vec![b'x'; MAX_INPUT_BYTES + 1], InspectionErrorCode::InputTooLarge);
}

#[test]
fn rejects_trailing_der_and_mixed_pem_without_partial_success() {
    let mut der = fixture("rsa-leaf.der");
    der.push(0);
    assert_code(&der, InspectionErrorCode::TrailingDerData);

    let mixed = [
        fixture_text("rsa-leaf.pem"),
        "-----BEGIN PRIVATE KEY-----\nAA==\n-----END PRIVATE KEY-----\n".into(),
    ].concat();
    assert_code(mixed.as_bytes(), InspectionErrorCode::NonCertificatePemBlock);
}

#[test]
fn rejects_invalid_utf8_pem_and_thirty_three_certificates() {
    let mut invalid_utf8 = b"-----BEGIN CERTIFICATE-----\n".to_vec();
    invalid_utf8.push(0xff);
    assert_code(&invalid_utf8, InspectionErrorCode::InvalidPemUtf8);

    let pem = fixture_text("rsa-leaf.pem");
    assert_code(pem.repeat(33).as_bytes(), InspectionErrorCode::TooManyCertificates);
}
```

Also test malformed base64, surrounding non-whitespace text, mismatched end
labels, an empty PEM body, and a malformed second certificate returning
`certificate_index: 1`.

Run:

```bash
cargo test -p cert_viewer_core --test input_contract --locked
```

Expected: FAIL because the entry point still returns its temporary error.

- [ ] **Step 2: Implement strict PEM envelope validation**

`input.rs` owns:

```rust
pub(crate) struct ParsedInput {
    pub format: InputFormat,
    pub certificates: Vec<Vec<u8>>,
}

pub(crate) fn parse_input(input: &[u8]) -> Result<ParsedInput, InspectionError>;
```

Implementation order is fixed:

1. Reject more than `MAX_INPUT_BYTES` before any scan, decoding, or parsing.
2. Reject zero or ASCII-whitespace-only bytes.
3. Remove only leading/trailing ASCII whitespace for classification.
4. If the remaining bytes start with `-----BEGIN` followed by one ASCII space,
   decode as UTF-8 or return `invalid_pem_utf8`.
5. Run a line-state envelope checker that permits only exact
   `BEGIN CERTIFICATE`, base64 body, matching `END CERTIFICATE`, and ASCII
   whitespace between blocks. Return `non_certificate_pem_block` for any other
   PEM label and `invalid_pem` for other text or malformed framing.
6. Stop and return `too_many_certificates` when block 33 begins.
7. Make the envelope checker return the exact byte range for every complete
   block. Decode each range separately with `pem::parse`, re-check its tag and
   legacy-header absence, and attach the loop index to any decode failure.
   Never use one `pem::parse_many` call because it cannot identify a malformed
   second block and it scans past unframed text.
8. Otherwise return one owned DER item without parsing it yet.

Do not use `x509_parser::pem::Pem::iter_from_buffer`; its documented behavior
silently ignores text before, between, and after blocks.

- [ ] **Step 3: Connect input parsing to the public entry point**

Call `parse_input`, then pass each owned DER item and its index to the Task 5
inspection helper. Until Task 5 exists, use a private stub that returns
`invalid_der` at the correct index. This makes limit, label, and envelope tests
pass while DER success tests remain red.

Run:

```bash
cargo test -p cert_viewer_core --test input_contract --locked
cargo clippy -p cert_viewer_core --all-targets --locked -- -D warnings
```

Expected: strict input rejection tests pass; success-path tests intentionally
remain in Task 5 rather than being weakened.

- [ ] **Step 4: Commit the strict-input milestone**

Stage only `input.rs`, `input_contract.rs`, and the directly affected `lib.rs`,
then commit:

```bash
git commit -m "feat: enforce strict certificate input limits"
git show -s --format=%B HEAD
```

## Task 5: Parse and Inspect Certificate Fields

**Files:**

- Create: `crates/cert_viewer_core/src/inspect.rs`
- Create: `crates/cert_viewer_core/src/oid.rs`
- Replace: `crates/cert_viewer_core/src/lib.rs`
- Delete: `crates/cert_viewer_core/src/parse.rs`
- Create: `crates/cert_viewer_core/tests/inspection_fields.rs`
- Create: `crates/cert_viewer_core/tests/schema_contract.rs`

- [ ] **Step 1: Write failing fixture and bundle inspection tests**

Use committed fixtures and checksum files rather than values produced by the
Rust implementation:

```rust
#[test]
fn inspects_rsa_fixture_against_openssl_evidence() {
    let der = fixture("rsa-leaf.der");
    let result = inspect_bundle(&der, 0).expect("fixture inspects");
    let cert = &result.certificates[0];

    assert_eq!(result.schema_version, 1);
    assert_eq!(result.input_format, InputFormat::Der);
    assert_eq!(cert.input_index, 0);
    assert_eq!(cert.serial_number, "1001");
    assert_eq!(cert.subject.common_name.as_deref(), Some("rsa.fixture.tinkora.test"));
    assert_eq!(cert.public_key.algorithm.oid, "1.2.840.113549.1.1.1");
    assert_eq!(cert.public_key.size_bits, Some(2048));
    assert_eq!(cert.fingerprints.sha256, checksum("rsa-leaf.der.sha256"));
    assert_eq!(cert.fingerprints.sha1, checksum("rsa-leaf.der.sha1"));
}

#[test]
fn preserves_bundle_order_without_inferring_a_chain() {
    let result = inspect_bundle(&fixture("bundle.pem"), i64::MAX)
        .expect("bundle inspects");
    assert_eq!(result.input_format, InputFormat::PemBundle);
    assert_eq!(result.certificates.len(), 2);
    assert_eq!(result.certificates[0].input_index, 0);
    assert_eq!(result.certificates[1].input_index, 1);
}
```

Add tests for P-256 key size, CA/path length, typed SANs, ordered key usages,
unknown name/EKU/extension OIDs, `is_self_issued`, extension criticality, exact
date bounds, lowercase unseparated fingerprints, deterministic JSON field
names, and `unsupported-version.der` returning exactly
`unsupported_certificate_version`. Assert that serialized JSON has no
`is_self_signed`, `is_expired`, `days_until_expiry`, `raw_pem`, `trust`, or
`chain` field.

Run:

```bash
cargo test -p cert_viewer_core --test inspection_fields --locked
cargo test -p cert_viewer_core --test schema_contract --locked
```

Expected: FAIL because the DER inspection helper is still a stub.

- [ ] **Step 2: Implement all-consuming DER parsing**

`inspect.rs` owns this exact boundary:

```rust
pub(crate) fn inspect_der(
    der: &[u8],
    input_index: usize,
    now_unix_seconds: i64,
) -> Result<CertificateInspection, InspectionError> {
    let (remainder, certificate) = X509Certificate::from_der(der)
        .map_err(|_| invalid_der(input_index))?;
    if !remainder.is_empty() {
        return Err(InspectionError::at_certificate(
            InspectionErrorCode::TrailingDerData,
            "Certificate DER contains trailing data.",
            input_index,
        ));
    }
    inspect_x509(&certificate, input_index, now_unix_seconds)
}
```

Hash `certificate.as_raw()`, never the caller's unconsumed input. Check
`certificate.version().0` is exactly `0`, `1`, or `2` before adding one; this
avoids overflow on a malicious encoded version. Return
`unsupported_certificate_version` for any other value. Serialize the serial as
`format!("{:x}", certificate.tbs_certificate.serial)` so an ASN.1 sign-padding
byte from `raw_serial()` does not become part of the machine value.

- [ ] **Step 3: Implement loss-aware names and general names**

For every DN attribute, retain its dotted OID. Use `attribute.as_str()` when
supported and otherwise preserve `hex::encode(attribute.as_slice())` with
`value_format: hex`. Populate convenience fields from the first matching OID
without deleting duplicate raw entries.

Map `GeneralName` variants to stable kinds:

```text
other_name, email, dns, x400_address, directory_name, edi_party_name,
uri, ip, registered_id, invalid
```

Use `Ipv4Addr` for four-byte IP values and `Ipv6Addr` for sixteen-byte values;
other lengths remain lowercase hex with kind `invalid`. For binary or
unsupported variants, retain OID/tag plus lowercase hex rather than Rust debug
text.

- [ ] **Step 4: Implement usages, constraints, extensions, and algorithms**

Map key usage methods to this fixed order:

```rust
[
    (usage.digital_signature(), "digital_signature"),
    (usage.non_repudiation(), "content_commitment"),
    (usage.key_encipherment(), "key_encipherment"),
    (usage.data_encipherment(), "data_encipherment"),
    (usage.key_agreement(), "key_agreement"),
    (usage.key_cert_sign(), "key_cert_sign"),
    (usage.crl_sign(), "crl_sign"),
    (usage.encipher_only(), "encipher_only"),
    (usage.decipher_only(), "decipher_only"),
]
```

Map known EKUs to `any`, `server_auth`, `client_auth`, `code_signing`,
`email_protection`, `time_stamping`, and `ocsp_signing`; append unknown dotted
OIDs in input order. Read `BasicConstraints` directly. For each extension,
`decoded` is false only for `UnsupportedExtension`, `ParseError`, or `Unparsed`.

Read key metadata with:

```rust
let spki = certificate.public_key();
let parsed_key = spki.parsed().ok();
let size_bits = parsed_key
    .as_ref()
    .map(PublicKey::key_size)
    .filter(|size| *size > 0)
    .and_then(|size| u32::try_from(size).ok());
```

Do not infer EC or DSA size from raw SPKI length. Resolve reviewed names with
`x509_parser::objects::oid2sn(oid, oid_registry()).ok()`; unknown algorithms
return `display_name: None` while retaining the dotted OID.

- [ ] **Step 5: Implement status, self-issued semantics, and public entry point**

Use `certificate.subject() == certificate.issuer()` for the parser's
structural name equality hint. Document that differently encoded but equivalent
DNs can produce a conservative false negative. Do not call `verify_signature`
and do not enable the `ring`, `aws-lc-rs`, `verify`, or `verify-aws` features.

`inspect_bundle` calls `parse_input`, inspects every item in order, returns no
partial result after an error, and constructs:

```rust
InspectionResult {
    schema_version: SCHEMA_VERSION,
    input_format: parsed.format,
    certificates,
}
```

- [ ] **Step 6: Run all core verification and commit**

Run:

```bash
cargo test -p cert_viewer_core --locked
cargo fmt --all -- --check
cargo clippy -p cert_viewer_core --all-targets --locked -- -D warnings
cargo check -p cert_viewer_core --target wasm32-unknown-unknown --locked
```

Expected: all core tests pass, including the OpenSSL comparisons and negative
inputs. Stage only Task 5 files and commit:

```bash
git commit -m "feat: inspect X.509 certificate bundles"
git show -s --format=%B HEAD
```

## Task 6: Build the JSON-compatible WASM Boundary

**Files:**

- Replace: `crates/cert_viewer_web/src/lib.rs`
- Create: `crates/cert_viewer_web/tests/wasm_boundary.rs`

- [ ] **Step 1: Write failing real-WASM boundary tests**

Use `wasm_bindgen_test` to test the exported Rust function on Node's WASM
runtime:

```rust
#[wasm_bindgen_test]
fn serializes_a_json_compatible_result() {
    let input = js_sys::Uint8Array::from(RSA_DER);
    let value = inspect_bundle_js(input.into(), JsValue::from_f64(1_800_000_000.0))
        .expect("WASM inspection succeeds");
    assert!(js_sys::JSON::stringify(&value).is_ok());
    assert_eq!(
        js_sys::Reflect::get(&value, &"schema_version".into()).unwrap(),
        JsValue::from_f64(1.0),
    );
}
```

Add failures for a non-`Uint8Array` input, `NaN`, a fractional timestamp, and a
timestamp outside JavaScript's safe integer range. Assert codes
`invalid_input_type` and `invalid_current_time`. Add a malformed certificate
test proving the core `invalid_der` code and `certificate_index` survive the
boundary.

Run:

```bash
wasm-pack test --node crates/cert_viewer_web --locked
```

Expected: FAIL because the single approved export does not exist.

- [ ] **Step 2: Replace all legacy exports with one inspected bundle export**

Expose only:

```rust
#[wasm_bindgen(js_name = inspectBundle)]
pub fn inspect_bundle_js(
    input: JsValue,
    now_unix_seconds: JsValue,
) -> Result<JsValue, JsValue>;

#[wasm_bindgen(js_name = getVersion)]
pub fn get_version() -> String;
```

Require `input.dyn_into::<js_sys::Uint8Array>()` to succeed. Check its length
against 1 MiB before calling `to_vec()`; the core repeats the same limit after
copying. Require `js_sys::Number::is_safe_integer(&now)` and `now.as_f64()`
before conversion to `i64`. Convert both boundary failures to the same
structured error shape as core failures.

Serialize success and error values with:

```rust
let serializer = serde_wasm_bindgen::Serializer::json_compatible();
value.serialize(&serializer)
```

This is required because default Rust `i64` serialization may create
JavaScript `BigInt`, which `JSON.stringify` rejects.

- [ ] **Step 3: Verify native, WASM, and generated API names**

Run:

```bash
wasm-pack test --node crates/cert_viewer_web --locked
wasm-pack build crates/cert_viewer_web --target web --release --locked
rg -n "inspectBundle|getVersion" crates/cert_viewer_web/pkg/cert_viewer_web.js
rg -n "parsePem|parseDer|parseAuto|parseChain" \
  crates/cert_viewer_web/pkg/cert_viewer_web.js
```

Expected: tests/build pass; the first search finds both exports; the legacy
search has no output.

- [ ] **Step 4: Commit the WASM milestone**

Do not stage generated `pkg/`. Commit only the bridge, tests, manifest/lockfile
changes:

```bash
git commit -m "feat: expose JSON-compatible WASM inspection"
git show -s --format=%B HEAD
```

## Task 7: Publish and Test the Versioned JSON Schema

**Files:**

- Create: `docs/schema/inspection-result-v1.schema.json`
- Create: `docs/schema/inspection-result-v1.example.json`
- Create: `docs/schema/README.md`
- Create: `scripts/validate_schema.mjs`
- Modify: `crates/cert_viewer_core/tests/schema_contract.rs`
- Create: `package.json`
- Create: `package-lock.json`

- [ ] **Step 1: Add the Node test toolchain with exact versions**

Create `package.json`:

```json
{
  "name": "tinkora-cert-viewer",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build:web": "bash scripts/build_web.sh",
    "test:browser": "playwright test",
    "test:schema": "node scripts/validate_schema.mjs",
    "test:web": "node --test tests/web/*.test.mjs"
  },
  "devDependencies": {
    "@axe-core/playwright": "4.12.1",
    "@playwright/test": "1.62.1",
    "ajv": "8.20.0",
    "linkedom": "0.18.13",
    "lucide-static": "1.31.0",
    "markdownlint-cli2": "0.20.0"
  },
  "engines": {
    "node": ">=24 <25"
  }
}
```

Run `npm install --ignore-scripts` once to generate `package-lock.json`, then
use only `npm ci --ignore-scripts` in verification and CI.

- [ ] **Step 2: Write a failing schema/example validator**

`scripts/validate_schema.mjs` must use `Ajv2020`, load both committed JSON
files, compile the schema, reject unknown top-level and certificate properties,
and exit nonzero with formatted Ajv errors when the example does not validate.
It must also assert:

```js
assert.equal(example.schema_version, 1);
assert.ok(!JSON.stringify(example).includes('is_self_signed'));
assert.ok(!JSON.stringify(example).includes('chain'));
```

Run `npm run test:schema`.

Expected: FAIL because schema and example do not exist.

- [ ] **Step 3: Write the complete Draft 2020-12 schema**

The schema ID is:

```text
https://tinkora.github.io/cert_viewer/schema/inspection-result-v1.schema.json
```

It requires every `InspectionResult` and `CertificateInspection` field from
Task 3; uses exact enums for `input_format`, `date_status`, and
`name_value_format`; constrains fingerprints to lowercase hex lengths 64 and
40; constrains `schema_version` to `const: 1`; constrains `certificates` to
`minItems: 1, maxItems: 32`; and sets `additionalProperties: false` on every
object. Integers use JavaScript-safe bounds where applicable.

Add an ignored `print_schema_example` test in `schema_contract.rs`. It inspects
the committed RSA DER once to obtain `not_before_unix`, inspects it again with
that exact value as `now_unix_seconds`, and prints pretty JSON between literal
`SCHEMA_EXAMPLE_BEGIN` and `SCHEMA_EXAMPLE_END` marker lines. Generate the
example with:

```bash
mkdir -p output docs/schema
cargo test -p cert_viewer_core --test schema_contract \
  print_schema_example --locked -- --ignored --nocapture \
  > output/schema-example.log
sed -n '/^SCHEMA_EXAMPLE_BEGIN$/,/^SCHEMA_EXAMPLE_END$/p' \
  output/schema-example.log | sed '1d;$d' \
  > docs/schema/inspection-result-v1.example.json
```

Review the generated values against the committed OpenSSL evidence. Do not
hand-author fields that the implementation did not produce. The normal
`schema_contract` tests load this committed example and compare it with a fresh
serialization so drift fails CI.

- [ ] **Step 4: Document draft-agent semantics and validate**

`docs/schema/README.md` must state all four capability labels and say that the
schema is a data contract, not a transport or an MCP implementation. Document
`schema_version` compatibility and the no-partial-result error rule.

Run:

```bash
npm ci --ignore-scripts
npm run test:schema
npx --no-install markdownlint-cli2 docs/schema README.md
```

Expected: all pass.

- [ ] **Step 5: Commit the schema milestone**

Stage only Task 7 files and commit:

```bash
git commit -m "docs: publish the inspection result schema"
git show -s --format=%B HEAD
```

## Task 8: Implement Localization, Formatting, and Safe Rendering Modules

**Files:**

- Create: `web/i18n.mjs`
- Create: `web/format.mjs`
- Create: `web/render.mjs`
- Create: `tests/web/i18n.test.mjs`
- Create: `tests/web/format.test.mjs`
- Create: `tests/web/render.test.mjs`

- [ ] **Step 1: Invoke `ui-ux-pro-max` before frontend module work**

Run these searches before creating or editing a user-facing frontend module:

```bash
python3 /Users/zfj/.codex/skills/ui-ux-pro-max/scripts/search.py \
  "developer X.509 certificate inspector local privacy workbench" \
  --design-system -p "Tinkora Cert Viewer"
python3 /Users/zfj/.codex/skills/ui-ux-pro-max/scripts/search.py \
  "keyboard focus disclosure error file upload dense technical data" \
  --domain ux -n 10
python3 /Users/zfj/.codex/skills/ui-ux-pro-max/scripts/search.py \
  "responsive form disclosure table safe DOM accessibility" \
  --stack html-tailwind
```

Record accepted accessibility, focus, language, density, and responsive
recommendations under ignored `output/ui-ux-task8.md`. Stop this task if the
skill is unavailable.

- [ ] **Step 2: Write failing translation parity tests**

The test recursively compares `en` and `zhCN` key sets and asserts representative
non-trust terminology:

```js
test('English and Simplified Chinese expose identical keys', () => {
  assert.deepEqual(flatKeys(messages.en), flatKeys(messages.zhCN));
});

test('date status labels do not collapse inspection into validity', () => {
  assert.equal(messages.en.status.within_stated_dates, 'Within stated dates');
  assert.equal(messages.zhCN.status.within_stated_dates, '在证书声明日期范围内');
  assert.equal(messages.en.fields.is_self_issued, 'Subject matches issuer');
});
```

Require keys for every visible heading, action, input label, file state, error
code, empty/loading/success state, field label, disclosure name, copy state,
legacy SHA-1 explanation, local-processing note, and capability label.

- [ ] **Step 3: Write failing pure-format tests**

Test exact fingerprint formatting, ISO UTC timestamps, typed SAN labels,
algorithm fallbacks, OID retention, and date status labels. Use fixed locales
and timestamps so tests do not depend on the machine time zone.

- [ ] **Step 4: Write a failing safe-renderer injection test**

Use LinkeDOM and a synthetic certificate whose CN is
`<img src=x onerror=alert(1)>`:

```js
const { document } = parseHTML('<main id="results"></main>');
renderInspection(document.querySelector('#results'), maliciousResult, t);
assert.equal(document.querySelectorAll('img').length, 0);
assert.match(document.querySelector('#results').textContent, /<img src=x/);
assert.equal(document.querySelectorAll('[onclick]').length, 0);
```

Run `npm run test:web`.

Expected: FAIL because the modules do not exist.

- [ ] **Step 5: Implement translation and formatting modules**

`i18n.mjs` exports immutable `messages`, `normalizeLanguage(value)`, and
`createTranslator(language)`. Only `en` and `zh-CN` are accepted; missing or
unknown values resolve to English.

`format.mjs` exports `formatFingerprint`, `formatUtcDate`, `formatGeneralName`,
`formatAlgorithm`, and `formatJson`. It never maps
`within_stated_dates` to `valid` or translates stable JSON values.

- [ ] **Step 6: Implement renderer functions using DOM APIs only**

`render.mjs` exports:

```js
export function renderEmpty(container, t) {}
export function renderError(container, error, t) {}
export function renderInspection(container, result, t) {}
export function clearElement(element) {
  while (element.firstChild) element.removeChild(element.firstChild);
}
```

Create elements with `document.createElement`, assign certificate data only via
`textContent`, and attach handlers with `addEventListener`. Use native
`<details><summary>` for field disclosure. Repeated certificates may be cards;
field groups inside them are unframed sections, not nested cards.

- [ ] **Step 7: Make unit tests pass and commit**

Run:

```bash
npm run test:web
npm run test:schema
git diff --check
```

Expected: all pass. Commit:

```bash
git commit -m "feat: add bilingual safe certificate rendering"
git show -s --format=%B HEAD
```

## Task 9: Build the Actual Browser Tool

**Files:**

- Create: `web/index.html`
- Create: `web/styles.css`
- Create: `web/app.mjs`
- Create: `web/sample.mjs`
- Create: `web/favicon.svg`
- Create: `scripts/build_web.sh`
- Create: `playwright.config.mjs`
- Create: `tests/browser/workflow.spec.mjs`
- Create: `THIRD_PARTY_NOTICES.md`
- Delete: `crates/cert_viewer_web/static/index.html`
- Delete: `index.html`

- [ ] **Step 1: Invoke `ui-ux-pro-max` before editing frontend files**

Run these exact searches:

```bash
python3 /Users/zfj/.codex/skills/ui-ux-pro-max/scripts/search.py \
  "developer X.509 certificate inspector local privacy workbench" \
  --design-system -p "Tinkora Cert Viewer"
python3 /Users/zfj/.codex/skills/ui-ux-pro-max/scripts/search.py \
  "keyboard focus disclosure error file upload dense technical data" \
  --domain ux -n 10
python3 /Users/zfj/.codex/skills/ui-ux-pro-max/scripts/search.py \
  "responsive form disclosure table safe DOM accessibility" \
  --stack html-tailwind
```

Record the synthesis in the task notes: retain visible focus, live error
feedback, keyboard order, reduced motion, and consistent Lucide icons. Reject
the generated marketing Hero, vibrant block layout, dark-blue one-note palette,
large display type, and Google Fonts because they conflict with the approved
workbench and local-only runtime.

- [ ] **Step 2: Write a failing real-WASM browser workflow test**

Configure one initial Chromium project at 1440 by 900 and a local web server
that runs `npm run build:web` before serving `dist/` on port 4173. The test must
load the page, assert English is the default, choose **Load sample**, inspect it,
and expect a visible certificate result containing
`rsa.fixture.tinkora.test`. Mark the test `@wasm-smoke` for CI selection.

Run:

```bash
npx --no-install playwright install chromium
npm run test:browser -- --grep @wasm-smoke
```

Expected: FAIL because the application source and build script do not exist.

- [ ] **Step 3: Build an English-first semantic application shell**

`web/index.html` contains only static semantic markup and local asset links:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'self'; script-src 'self' 'wasm-unsafe-eval';
                 style-src 'self'; img-src 'self'; connect-src 'self';
                 object-src 'none'; base-uri 'none'; form-action 'none'">
  <title>Tinkora Cert Viewer</title>
  <link rel="icon" href="./favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="./styles.css">
  <script type="module" src="./app.mjs"></script>
</head>
<body>
  <a class="skip-link" href="#workspace">Skip to certificate workspace</a>
  <header class="app-header"></header>
  <main id="workspace" tabindex="-1"></main>
  <footer class="app-footer"></footer>
</body>
</html>
```

The generated app header identifies **Tinkora Cert Viewer** prominently, exposes
an English/Simplified Chinese segmented language control, and shows the four
capability labels without a marketing hero.

- [ ] **Step 4: Implement the complete local workflow controller**

`app.mjs` imports local WASM, translations, renderers, and sample data. It owns
only UI state:

```js
const state = {
  inputBytes: null,
  result: null,
  language: normalizeLanguage(new URL(location.href).searchParams.get('lang')),
};
```

The controller must:

1. Initialize WASM before enabling **Inspect**.
2. Read paste text with `TextEncoder` or a selected/dropped file with
   `Uint8Array(await file.arrayBuffer())`.
3. Pass `Math.trunc(Date.now() / 1000)` explicitly to `inspectBundle`.
4. Render loading, success, and localized structured errors through a live
   region.
5. Copy fingerprints or pretty JSON only on explicit button activation.
6. Clear textarea, file input, byte state, result state, copied state, and
   rendered result.
7. Change language by updating `document.documentElement.lang` and
   `?lang=zh-CN` through `history.replaceState`, with no storage.
8. Accept only `.pem`, `.crt`, `.cer`, and `.der` in the file picker while
   treating file content, not extension, as authoritative.

No `innerHTML`, inline event handler, `eval`, storage API, fetch to a remote
origin, or service worker is allowed.

- [ ] **Step 5: Implement restrained responsive styling**

Use system UI and monospace stacks. Keep the page background neutral, the
primary action green, warnings amber, errors red, and technical selections
blue; do not make one hue dominate. Cards use at most `8px` radius. The input
workspace is an unframed full-width band; only repeated certificate results are
cards. Set explicit button/icon dimensions, wrap or locally scroll long fields,
and add:

```css
:focus-visible { outline: 3px solid #2563eb; outline-offset: 2px; }
.mono-value { overflow-wrap: anywhere; word-break: break-word; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto; transition: none !important; }
}
```

Use Lucide icons copied from the lockfile-pinned `lucide-static` package for
inspect, upload, clear, copy, JSON, language, and success controls. All icon
images are decorative with empty `alt`; buttons retain localized accessible
names. Document Lucide's ISC license in `THIRD_PARTY_NOTICES.md`.

- [ ] **Step 6: Build a clean static distribution**

`scripts/build_web.sh` must:

1. resolve the repository root from `BASH_SOURCE`;
2. run `wasm-pack build crates/cert_viewer_web --target web --release --locked`;
3. replace only the resolved repository `dist/` directory;
4. copy `web/index.html`, CSS, modules, favicon, selected Lucide SVG files, and
   generated WASM package into `dist/`;
5. create `dist/.nojekyll`;
6. reject symlinks, special files, missing `index.html`, and any unexpected
   output suffix.

Run:

```bash
npm run build:web
find dist -type f | sort
rg -n "https?://|innerHTML|onclick|localStorage|sessionStorage" web dist \
  -g '*.html' -g '*.css' -g '*.mjs' -g '*.js'
```

Expected: build succeeds; the file list contains only reviewed local assets;
the scan has no runtime external URL, unsafe HTML sink, inline handler, or
storage use. License URLs in `THIRD_PARTY_NOTICES.md` are outside this scan.

- [ ] **Step 7: Run browser, module, and WASM checks and commit**

Run:

```bash
npm run test:web
npm run test:browser -- --grep @wasm-smoke
wasm-pack test --node crates/cert_viewer_web --locked
cargo fmt --all -- --check
git diff --check
```

Expected: all pass. Stage source and notices, never `dist/` or generated
crate `pkg/`, then commit:

```bash
git commit -m "feat: build the local certificate inspection UI"
git show -s --format=%B HEAD
```

## Task 10: Complete Browser, Accessibility, and Visual Acceptance

**Files:**

- Modify: `playwright.config.mjs`
- Modify: `tests/browser/workflow.spec.mjs`
- Modify: `web/app.mjs`
- Modify: `web/styles.css`
- Create: `tests/browser/accessibility.spec.mjs`
- Create: `tests/browser/security.spec.mjs`
- Create: `assets/social-preview.png`

- [ ] **Step 1: Invoke `ui-ux-pro-max` before changing the rendered UI**

Run these searches because this task modifies user-facing behavior and styling:

```bash
python3 /Users/zfj/.codex/skills/ui-ux-pro-max/scripts/search.py \
  "developer X.509 certificate inspector local privacy workbench" \
  --design-system -p "Tinkora Cert Viewer"
python3 /Users/zfj/.codex/skills/ui-ux-pro-max/scripts/search.py \
  "keyboard focus disclosure error file upload dense technical data" \
  --domain ux -n 10
python3 /Users/zfj/.codex/skills/ui-ux-pro-max/scripts/search.py \
  "responsive form disclosure table safe DOM accessibility" \
  --stack html-tailwind
```

Record accepted and rejected recommendations under ignored
`output/ui-ux-task10.md`. Stop if the skill is unavailable.

- [ ] **Step 2: Lock stable browser-test hooks and viewport projects**

Add `data-testid` attributes only where accessible role/name selectors are not
stable enough: `certificate-input`, `file-input`, `drop-zone`, `inspect`,
`clear`, `load-sample`, `result`, `json-output`, and `copy-json`. They are test
hooks, never the only accessible name.

Define these Chromium projects in `playwright.config.mjs`:

```js
import { defineConfig } from '@playwright/test';

const widths = [375, 768, 1024, 1440];

export default defineConfig({
  testDir: './tests/browser',
  outputDir: 'output/playwright',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    permissions: ['clipboard-read', 'clipboard-write'],
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: widths.map((width) => ({
    name: `chromium-${width}`,
    use: { viewport: { width, height: width === 375 ? 812 : 900 } },
  })),
  webServer: {
    command: 'npm run build:web && python3 -m http.server 4173 --bind 127.0.0.1 --directory dist',
    port: 4173,
    reuseExistingServer: false,
  },
});
```

- [ ] **Step 3: Cover every primary workflow with the real WASM build**

Extend `workflow.spec.mjs` with outcome-focused tests for:

1. pasted PEM and pasted multi-certificate PEM bundle in input order;
2. selected RSA DER file and dropped EC PEM file;
3. language switch to `?lang=zh-CN`, reload persistence through the URL only,
   and fallback from `?lang=unknown` to English;
4. copy one fingerprint and copy pretty JSON after explicit clicks;
5. malformed PEM, trailing DER bytes, over-count bundle, and oversized input;
6. Clear removing textarea content, file state, errors, results, and copied
   status without retaining certificate text in the DOM.

For every case, compare stable values against the committed fixture evidence,
including certificate count, CN, SHA-256, and `schema_version`. Do not assert
chain, trust, hostname, signature verification, or a generic valid state.

- [ ] **Step 4: Add explicit accessibility and keyboard tests**

`accessibility.spec.mjs` must use `@axe-core/playwright` after the empty,
error, and populated states and require zero violations. Add explicit checks
that supplement Axe:

```js
await page.keyboard.press('Tab');
await expect(page.locator('.skip-link')).toBeFocused();
await page.keyboard.press('Enter');
await expect(page.locator('#workspace')).toBeFocused();
await expect(page.locator(':focus-visible')).toBeVisible();
await expect(page.locator('[role="status"]')).toHaveAttribute('aria-live', 'polite');
```

Tab through the language control, paste input, file control, sample, Inspect,
Clear, every disclosure, and copy action. In Chinese mode assert
`document.documentElement.lang === 'zh-CN'` and translated accessible names.

- [ ] **Step 5: Add browser security and privacy assertions**

`security.spec.mjs` registers listeners before navigation:

```js
const consoleErrors = [];
const unexpectedRequests = [];
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('request', (request) => {
  if (new URL(request.url()).origin !== 'http://127.0.0.1:4173') {
    unexpectedRequests.push(request.url());
  }
});
```

Load `html-like-dn.pem`, inspect it, and assert the literal hostile-looking DN
is visible text while `script`, injected `img`, inline event attributes, and
unexpected requests are absent. Assert that the response CSP contains
`default-src 'self'`, `object-src 'none'`, `base-uri 'none'`, and
`form-action 'none'`. Verify `localStorage`, `sessionStorage`, cookies, service
workers, and Cache Storage remain empty after inspect, copy, language, and
clear workflows.

- [ ] **Step 6: Assert responsive layout and capture review evidence**

At each configured width, test the empty, error, and populated states:

```js
const metrics = await page.evaluate(() => ({
  viewport: document.documentElement.clientWidth,
  document: document.documentElement.scrollWidth,
  text: document.body.innerText.trim(),
  resultHeight: document.querySelector('[data-testid="result"]')?.getBoundingClientRect().height ?? 0,
}));
expect(metrics.document).toBeLessThanOrEqual(metrics.viewport);
expect(metrics.text.length).toBeGreaterThan(80);
expect(metrics.resultHeight).toBeGreaterThan(80);
```

Capture full-page English and Chinese screenshots under `output/playwright/`
for visual inspection. Check that controls, long DNs, fingerprints, and footer
content do not overlap or clip. These review images are evidence, not tracked
release files.

- [ ] **Step 7: Produce and inspect the repository social preview**

Use Playwright at exactly 1280 by 640, load the sample certificate, open the
primary details, and capture the actual application to
`assets/social-preview.png`. The image must show the product name, input action,
and a real certificate result; it must not be a marketing graphic or expose a
private certificate. Inspect it with the local image viewer and verify the PNG
is exactly 1280 by 640, nonblank, sharp, and free of clipped or overlapping
text.

- [ ] **Step 8: Run the complete browser milestone and commit**

Run:

```bash
npm ci --ignore-scripts
npx --no-install playwright install chromium
npm run test:web
npm run test:schema
npm run test:browser
git diff --check
```

Expected: unit, schema, and all 12 viewport/state browser project combinations
pass with no console, network, accessibility, overflow, or injection failure.
Commit only the files in this task:

```bash
git commit -m "test: cover browser accessibility and privacy workflows"
git show -s --format=%B HEAD
```

## Task 11: Write the Public Documentation and Community Surface

**Files:**

- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `CODE_OF_CONDUCT.md`
- Modify: `CONTRIBUTING.md`
- Modify: `SECURITY.md`
- Modify: `SUPPORT.md`
- Create: `README.zh-CN.md`
- Create: `CODE_OF_CONDUCT.zh-CN.md`
- Create: `CONTRIBUTING.zh-CN.md`
- Create: `SECURITY.zh-CN.md`
- Create: `SUPPORT.zh-CN.md`
- Create: `CITATION.cff`
- Create: `docs/RELEASING.md`
- Create: `docs/SELF_HOSTING.md`
- Create: `docs/decisions/0001-browser-first-local-only.md`
- Create: `docs/decisions/0002-inspection-only-terminology.md`
- Create: `scripts/check_docs.rb`
- Create: `.markdownlint-cli2.jsonc`
- Create: `.github/CODEOWNERS`
- Create: `.github/ISSUE_TEMPLATE/bug.yml`
- Create: `.github/ISSUE_TEMPLATE/feature.yml`
- Create: `.github/ISSUE_TEMPLATE/question.yml`
- Create: `.github/ISSUE_TEMPLATE/config.yml`
- Modify: `.github/PULL_REQUEST_TEMPLATE.md`
- Delete: `.github/ISSUE_TEMPLATE/bug_report.md`
- Delete: `.github/ISSUE_TEMPLATE/feature_request.md`
- Delete: `docs/product_spec.zh-CN.md`
- Delete: `skills/cert_viewer.md`
- Delete: `skills/mcp-tools.json`

- [ ] **Step 1: Write a failing public-document contract checker**

`scripts/check_docs.rb` must read UTF-8 explicitly, reject BOMs, validate local
Markdown links without leaving the repository, and require these English/
Chinese pairs:

```ruby
BILINGUAL_PAIRS = %w[
  README CODE_OF_CONDUCT CONTRIBUTING SECURITY SUPPORT
].map { |stem| ["#{stem}.md", "#{stem}.zh-CN.md"] }.freeze

CAPABILITY_MARKERS = [
  "Human-usable", "Machine-readable", "Agent schema draft", "Not Agent-callable"
].freeze
```

It must also require `LICENSE`, `CHANGELOG.md`, `CITATION.cff`,
`THIRD_PARTY_NOTICES.md`, both ADRs, `docs/RELEASING.md`,
`docs/SELF_HOSTING.md`, all Schema documents, Issue Forms, the PR template, and
CODEOWNERS. In the product surface, reject obsolete files, non-current
organization URLs, unsupported MCP/chain/trust/hostname claims,
`is_self_signed`, and public Markdown without the four capability markers where
a capability table is required. Treat `docs/superpowers/` as current planning
evidence: still validate its UTF-8 and local links, but exclude quoted deletion
targets and negative examples from product-claim scans.

Run `ruby scripts/check_docs.rb`.

Expected: FAIL and list every missing bilingual or governance document.

- [ ] **Step 2: Replace README with an English-first product manual**

The first screen of `README.md` contains the product name, one-sentence
inspection-only description, live Pages link, and `[简体中文](README.zh-CN.md)`.
Use this exact capability table in both languages; stable labels remain English
inside the Chinese document:

| Label | v0.1.0 evidence |
| --- | --- |
| Human-usable | Browser UI |
| Machine-readable | Versioned JSON result |
| Agent schema draft | Published JSON Schema |
| Not Agent-callable | No transport or integration |

Document supported input, 1 MiB and 32-certificate limits, date-state
semantics, `is_self_issued`, local privacy, Quick Start, build/test commands,
Schema compatibility, browser support, limitations, security reporting,
contributing, self-hosting, citation, license, and release verification. Never
use a generic valid/trusted badge or present a PEM bundle as a verified chain.

- [ ] **Step 3: Write the complete Simplified Chinese README**

`README.zh-CN.md` mirrors every user-facing section, command, limit, link, and
capability state in `README.md`, begins with `[English](README.md)`, and keeps
JSON property names and stable error values untranslated. It must not contain
features absent from the English document.

- [ ] **Step 4: Add bilingual contributor, conduct, security, and support documents**

Use the Tinkora organization documents as the policy source, specialized for
this repository:

- contribution guides define issue-first scope, fork/branch/PR flow, English
  Conventional Commits, English code comments, TDD, exact local checks, review,
  squash merge, changelog rules, and the required `ui-ux-pro-max` frontend gate;
- security guides direct vulnerabilities to GitHub Private Vulnerability
  Reporting, define supported version `0.1.x`, response expectations, input
  sensitivity, and exclusions for trust/chain/hostname claims;
- support guides separate usage questions, reproducible bugs, feature evidence,
  security reports, and conduct reports;
- conduct documents use the Contributor Covenant text and the same enforceable
  contact-discovery path at `https://github.com/tinkeragora`; the account must
  still expose a maintainer-controlled email before public interaction opens,
  and the repository must not copy that address into source or invent another.

Every English file links to its Chinese counterpart in the first 12 lines and
vice versa.

- [ ] **Step 5: Add maintainership and contribution forms**

Set `.github/CODEOWNERS` to:

```text
* @tinkeragora
/.github/ @tinkeragora
/crates/ @tinkeragora
/docs/schema/ @tinkeragora
/web/ @tinkeragora
```

Create YAML Issue Forms for reproducible bugs, evidence-backed features, and
usage questions. Each form presents English first and includes concise Chinese
help text. Security selectors must direct reporters away from public Issues.
`config.yml` sets `blank_issues_enabled: false` and links private vulnerability
reports plus Discussions. The PR template requires scope, linked issue,
behavior evidence, tests, documentation, security/privacy impact,
accessibility evidence for frontend changes, and a changelog decision.

- [ ] **Step 6: Record product decisions, self-hosting, and release policy**

ADR 0001 records the browser-first, local-only architecture and its tradeoffs.
ADR 0002 records inspection-only terminology, the absence of trust/chain/
hostname verification, and the MCP evidence gate. These are current decisions,
not migration history.

`docs/SELF_HOSTING.md` documents `npm ci --ignore-scripts`, Rust 1.95.0,
wasm-pack 0.15.0, `npm run build:web`, a static server, required WASM MIME type,
the local CSP, cache invalidation, and rollback to a prior immutable release.
`docs/RELEASING.md` documents preflight, dry-run workflow, exact-SHA approval,
immutable tag, asset/checksum/SBOM/attestation verification, failure recovery,
and superseding releases.

- [ ] **Step 7: Add version and citation records**

`CHANGELOG.md` follows Keep a Changelog and contains exactly one dated release
section, `## [0.1.0] - 2026-08-10`, describing inspection, bilingual UI, Schema,
privacy constraints, and known limitations. `CITATION.cff` uses CFF 1.2.0,
title `Tinkora Cert Viewer`, version `0.1.0`, release date `2026-08-10`, MIT,
repository URL, and the `tinkeragora` GitHub identity without inventing a legal
name or email.

- [ ] **Step 8: Make documentation checks pass and commit**

Run:

```bash
ruby scripts/check_docs.rb
npx --no-install markdownlint-cli2 '**/*.md'
npm run test:schema
git diff --check
```

Expected: all required files, bilingual entry points, local links, capability
labels, UTF-8 checks, Markdown rules, and Schema links pass. Commit:

```bash
git commit -m "docs: publish bilingual project and contribution guides"
git show -s --format=%B HEAD
```

## Task 12: Add CI, Pages, Dependency, and Release Automation

**Files:**

- Modify: `.github/dependabot.yml`
- Delete: `.github/workflows/test.yml`
- Create: `.github/workflows/test.yml`
- Create: `.github/workflows/quality.yml`
- Create: `.github/workflows/docs-quality.yml`
- Create: `.github/workflows/supply-chain.yml`
- Create: `.github/workflows/pages.yml`
- Create: `.github/workflows/release.yml`
- Create: `deny.toml`
- Create: `scripts/validate_release.sh`
- Create: `scripts/test_validate_release.sh`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Write failing workflow and release-contract tests**

Add a Ruby block to `scripts/test_validate_release.sh` that safely loads every
workflow with aliases disabled and asserts:

1. top-level permissions are exactly `contents: read`;
2. every external `uses:` value is a 40-character commit SHA;
3. only Pages deploy receives `pages: write` and `id-token: write`;
4. only attestation jobs receive `attestations: write` and `id-token: write`;
5. only the final tag publication job receives `contents: write`;
6. no workflow uses `pull_request_target`, `secrets: inherit`, mutable tags,
   write-all, or interpolated shell commands from untrusted event fields;
7. manual release runs never execute the publication job;
8. release publication depends on metadata, quality, build, checksum, SBOM,
   and attestation verification jobs.

Run `bash scripts/test_validate_release.sh`.

Expected: FAIL because the six approved workflows do not yet exist.

- [ ] **Step 2: Pin dependency policy and scheduled updates**

Create `deny.toml` that denies unknown registries and Git sources, multiple
versions at warning level, unmaintained/yanked/vulnerable crates, and all
licenses except the reviewed SPDX set used by the lockfile. Explicitly allow
the Unicode data licenses required by the ASN.1/X.509 dependency tree only
after `cargo deny list` confirms the package and license expression.

Configure Dependabot weekly for Cargo, npm, and GitHub Actions, each with a
dependency-specific `chore(deps)` Conventional Commit prefix, five-open-PR
limit, and UTC schedule. Dependabot must target `main` and never group major
updates with patch updates.

- [ ] **Step 3: Add the reusable quality entry point**

Use the reviewed organization workflow bundle only at this immutable commit:

```yaml
jobs:
  rust-quality:
    uses: Tinkora/.github/.github/workflows/reusable-rust-quality.yml@af8ae92c2083c55283187be0d6a1ffba7740df86
    with:
      toolchain: 1.95.0
      msrv: 1.95.0
      locked: true
      coverage: true
    permissions:
      contents: read

  wasm-quality:
    uses: Tinkora/.github/.github/workflows/reusable-wasm-quality.yml@af8ae92c2083c55283187be0d6a1ffba7740df86
    with:
      working-directory: crates/cert_viewer_web
      toolchain: 1.95.0
      locked: true
      playwright-smoke: false
    permissions:
      contents: read
```

`quality.yml` is callable through `workflow_call`. Add a direct `browser`
job on `ubuntu-24.04` that pins checkout and setup-node, installs Rust 1.95.0,
the WASM target, wasm-pack 0.15.0, npm dependencies with scripts disabled, and
Chromium, then runs `npm run test:web`, `npm run test:schema`, and the complete
Playwright suite. Add `test:wasm-smoke` to `package.json` as
`playwright test --grep @wasm-smoke --project chromium-1440` for use by future
reusable-workflow canaries.

- [ ] **Step 4: Add push and pull-request CI**

`test.yml` triggers on pushes and pull requests to `main` plus manual dispatch,
uses cancellation per workflow/ref, grants only `contents: read`, and calls the
local `quality.yml`. Its required checks are the Rust, MSRV, coverage, WASM,
and browser jobs exposed by that called workflow.

- [ ] **Step 5: Add documentation and workflow checks**

`docs-quality.yml` runs on relevant pull requests and `main` pushes, weekly,
and manually. Pin:

```yaml
- uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
  with:
    persist-credentials: false
- uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
  with:
    node-version: '24'
- uses: DavidAnson/markdownlint-cli2-action@21c1be1b93ad9ed58fa840aacc3f279cde2a72ff # v24.2.0
```

Run `ruby scripts/check_docs.rb`, Schema validation, Markdown lint, release
contract tests, and
`go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.7`. Do not add another
third-party Action because the organization allowlist intentionally permits
only reviewed external actions.

- [ ] **Step 6: Add dependency review and supply-chain gates**

`supply-chain.yml` triggers on pull requests, `main`, weekly, and manually. It
calls:

```yaml
jobs:
  audit:
    uses: Tinkora/.github/.github/workflows/reusable-supply-chain.yml@af8ae92c2083c55283187be0d6a1ffba7740df86
    with:
      working-directory: .
      toolchain: 1.95.0
    permissions:
      contents: read

  dependency-review:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-24.04
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: actions/dependency-review-action@a1d282b36b6f3519aa1f3fc636f609c47dddb294 # v4.8.3
```

The audit workflow runs fixed cargo-deny, cargo-audit, and zizmor versions from
the reviewed organization workflow.

- [ ] **Step 7: Deploy the tested static artifact to Pages**

`pages.yml` triggers on `main` and manual dispatch, calls `quality.yml`, then a
least-privilege build job creates `dist/` and uploads it as
`cert-viewer-pages-${{ github.run_id }}` with pinned `upload-artifact`. A final
job calls:

```yaml
uses: Tinkora/.github/.github/workflows/reusable-pages.yml@af8ae92c2083c55283187be0d6a1ffba7740df86
with:
  source-artifact-name: cert-viewer-pages-${{ github.run_id }}
  source-subdirectory: .
permissions:
  contents: read
  pages: write
  id-token: write
```

The build job and Playwright must use the same `scripts/build_web.sh`; Pages may
not rebuild a different tree.

- [ ] **Step 8: Validate version metadata before any release build**

`scripts/validate_release.sh TAG [ROOT] MODE` accepts only stable `vX.Y.Z` and
exact modes `canary` or `tag`. Both modes require every Cargo package,
`package.json`, `CHANGELOG.md`, `CITATION.cff`, and Schema example to report the
same version plus one ISO-dated changelog heading. `canary` requires the local
release tag to be absent. `tag` requires the tag to resolve to HEAD and the
workflow ref to be that tag. Fixture tests cover invalid SemVer/mode,
mismatched Cargo/npm/CFF/Schema versions, duplicate changelog sections, missing
release date, an existing canary tag, and a release tag pointing elsewhere.

- [ ] **Step 9: Build a dry-run-capable immutable release workflow**

`release.yml` triggers on `v*` tag pushes and manual dispatch with required
`release_tag`. It serializes by repository/tag and never cancels. Manual runs
call the validator in `canary` mode; tag pushes call it in `tag` mode. A
read-only preflight queries the GitHub API and rejects an existing Release in
both modes. Both paths run metadata validation and `quality.yml`. The build job
produces exactly:

```text
cert_viewer-web-v0.1.0.tar.gz
cert_viewer-source-v0.1.0.tar.gz
SHA256SUMS
SBOM.spdx.json
```

The web archive contains the reviewed `dist/` tree under one top-level
directory. The source archive comes from `git archive` of the exact commit and
excludes generated packages and local output. Build timestamps use the commit
timestamp; file order and owners are normalized. Generate SPDX 2.3 file
records and verify every SHA-1/SHA-256 against the two archives.

Upload the candidate with pinned `actions/upload-artifact`. Use these exact
attestation actions and permissions only after checksums and SBOM pass:

```yaml
- uses: actions/attest-build-provenance@977bb373ede98d70efdf65b84cb5f73e068dcc2a # v4.1.0
  with:
    subject-path: release-assets/*.tar.gz
- uses: actions/attest-sbom@4651f806c01d8637787e274ac3bdf724ef169f34 # v4.0.0
  with:
    subject-path: release-assets/*.tar.gz
    sbom-path: release-assets/SBOM.spdx.json
```

Download the candidate with pinned `actions/download-artifact`, run strict
checksum and SPDX validation, and verify the asset inventory. Only a tag push
may enter environment `release`, receive `contents: write`, create a draft
release using the matching `CHANGELOG.md` section as its body, upload without
clobbering, and publish after all four assets exist. Generated release notes are
disabled. Manual dispatch is a complete canary but never creates a tag or
Release.

- [ ] **Step 10: Validate automation locally and commit**

Run:

```bash
bash scripts/test_validate_release.sh
./scripts/validate_release.sh v0.1.0 . canary
cargo deny check advisories bans licenses sources
cargo audit
go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.7
npx --no-install markdownlint-cli2 '**/*.md'
ruby scripts/check_docs.rb
git diff --check
```

Expected: all workflow contracts, release fixtures, dependency policy, advisory
checks, workflow syntax, docs, and diffs pass. Commit:

```bash
git commit -m "ci: add quality deployment and release pipelines"
git show -s --format=%B HEAD
```

## Task 13: Verify the Release Candidate and Create a Clean Public Root

**Files:**

- Modify only files required to resolve findings from this task
- Do not add generated `dist/`, `pkg/`, browser reports, coverage, or review
  evidence to Git

- [ ] **Step 1: Run the complete deterministic local matrix**

Run from a clean dependency install:

```bash
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --workspace --all-targets --locked
cargo check -p cert_viewer_web --target wasm32-unknown-unknown --locked
wasm-pack test --node crates/cert_viewer_web --locked
npm ci --ignore-scripts
npm run test:web
npm run test:schema
npm run build:web
npx --no-install playwright install chromium
npm run test:browser
bash scripts/test_validate_release.sh
./scripts/validate_release.sh v0.1.0 . canary
ruby scripts/check_docs.rb
npx --no-install markdownlint-cli2 '**/*.md'
go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.7
cargo deny check advisories bans licenses sources
cargo audit
git diff --check
```

Expected: every command exits 0. Save only concise command/result evidence
under ignored `output/`; do not weaken a check to make the matrix green.

- [ ] **Step 2: Measure core coverage and inspect missing critical branches**

Run:

```bash
cargo llvm-cov clean --workspace
cargo llvm-cov -p cert_viewer_core --all-targets --locked \
  --fail-under-lines 90 --lcov --output-path output/core.lcov
```

Expected: at least 90% line coverage in the parsing core. Inspect uncovered
lines in strict PEM ranges, DER remainder rejection, limit ordering, version
conversion, field extraction, and date boundaries. Add outcome-focused tests
for any uncovered security or correctness branch; do not add tests for trivial
getters merely to raise the number.

- [ ] **Step 3: Perform fresh-context quality and security reviews**

Invoke `code-review-and-quality` for the complete candidate and
`codex-security:security-scan` for the repository. Review public API stability,
panic/overflow paths, resource limits, WASM type boundaries, DOM injection,
CSP, supply-chain permissions, archive construction, documentation claims, and
test gaps. Resolve every validated high/medium finding and rerun the narrowest
failing check plus the complete matrix. Record false positives with evidence
in ignored `output/review-notes.md`, never in public source as defensive
narrative.

- [ ] **Step 4: Inspect all tracked files and reachable history**

Run:

```bash
git status --short --untracked-files=all
git ls-files -z | xargs -0 file
git grep -nIE 'is_self_signed|parse_certificate_chain|mcp[_ -]?tools' -- . ':!docs/superpowers/**'
git log --all --format='%H%x09%s'
git fsck --no-reflogs --unreachable
```

Expected: tracked text is UTF-8 without BOM; no obsolete prototype, unsupported
claim, credential, private path, or generated artifact is staged. Review every
untracked file before the history rewrite and preserve only files owned by this
approved plan.

- [ ] **Step 5: Rewrite local publication history to one English root commit**

This is the explicitly approved cleanup boundary. Confirm there is still no
remote, then create an orphan publication branch from the verified working
tree:

```bash
test -z "$(git remote)"
git switch --orphan public-main
git add --all
git status --short
git commit -m "feat: publish Tinkora Cert Viewer v0.1.0"
git branch -M main
git show -s --format=%B HEAD
test "$(git rev-list --count main)" -eq 1
test "$(git rev-list --max-parents=0 --count main)" -eq 1
```

Before committing, confirm `git status --short` contains only the final file map
and no ignored/generated/private file. Expected message is exactly
`feat: publish Tinkora Cert Viewer v0.1.0`.

- [ ] **Step 6: Verify the exact clean root tree again**

Run the complete Step 1 matrix after the orphan commit, then:

```bash
git status --short
git log --oneline --decorate --all
git ls-tree -r --name-only HEAD
git grep -nIE 'is_self_signed|parse_certificate_chain|mcp[_ -]?tools' HEAD -- . ':!docs/superpowers/**'
```

Expected: clean worktree, one reachable `main` commit, only the approved final
tree, and no retired identity, migration narrative, unsupported MCP claim, or
obsolete certificate terminology.

## Task 14: Publish and Govern `Tinkora/cert_viewer`

**Files:**

- No source changes unless a remote check exposes a validated defect
- Remote repository settings, Actions, Pages, release, and attestations change
  in this task

- [ ] **Step 1: Verify GitHub identity and repository absence**

Run:

```bash
gh auth status -h github.com
test "$(gh api user --jq .login)" = "tinkeragora"
gh api repos/Tinkora/cert_viewer
```

Expected: the authenticated login is `tinkeragora`; the final command returns
404. If the repository exists, stop and audit it instead of overwriting or
force-pushing it.

- [ ] **Step 2: Create the public repository and push the clean root**

Run:

```bash
gh repo create Tinkora/cert_viewer \
  --public \
  --description "Inspect X.509 PEM and DER certificates locally in your browser" \
  --homepage "https://tinkora.github.io/cert_viewer/" \
  --source . \
  --remote origin \
  --push
```

Expected: `origin` is `https://github.com/Tinkora/cert_viewer.git`, remote
`main` has exactly the clean root commit, and no other branch or tag exists.

- [ ] **Step 3: Apply repository metadata and interaction settings**

Configure the exact topics:

```text
certificate, cryptography, developer-tools, privacy, rust, tinkora,
webassembly, x509
```

Enable Issues and Discussions for this project, disable Wiki and repository
Projects until each has an owned workflow, allow squash merge only, and delete
merged branches automatically. Enable Private Vulnerability Reporting,
vulnerability alerts, automated security fixes, secret scanning, and push
protection wherever GitHub Free exposes the control. Read each setting back
through `gh api`; unsupported plan controls must be recorded as unsupported,
never reported as configured.

Before opening Issues or Discussions, verify without printing the address:

```bash
test "$(gh api user --jq 'if .email == null then "missing" else "present" end')" = "present"
```

If this fails, pause the interaction settings and ask the owner to publish and
verify a controlled contact method; Private Vulnerability Reporting is not a
conduct-reporting substitute.

Run the supported CLI settings in one explicit call:

```bash
gh repo edit Tinkora/cert_viewer \
  --enable-issues=true \
  --enable-discussions=true \
  --enable-wiki=false \
  --enable-projects=false \
  --enable-squash-merge=true \
  --enable-merge-commit=false \
  --enable-rebase-merge=false \
  --delete-branch-on-merge=true \
  --enable-secret-scanning=true \
  --enable-secret-scanning-push-protection=true \
  --add-topic certificate \
  --add-topic cryptography \
  --add-topic developer-tools \
  --add-topic privacy \
  --add-topic rust \
  --add-topic tinkora \
  --add-topic webassembly \
  --add-topic x509
gh api -X PUT repos/Tinkora/cert_viewer/private-vulnerability-reporting
gh api -X PUT repos/Tinkora/cert_viewer/vulnerability-alerts
gh api -X PUT repos/Tinkora/cert_viewer/automated-security-fixes
```

Use the authenticated GitHub settings page to enable **Immutable releases**
before any tag exists; the REST repository object does not currently expose a
writable field for this setting. If GitHub Free does not expose the control,
stop release publication and report the missing prerequisite rather than
silently publishing mutable assets. Task 14 Step 12 verifies the published
Release through its API `immutable` field.

- [ ] **Step 4: Configure Pages, CodeQL, and environments**

Set Pages build type to GitHub Actions and create environments `github-pages`
and `release`. Restrict `release` deployment branches to protected tags matching
`v*`; do not add a fake independent reviewer during the solo-maintainer stage.
Enable CodeQL Default Setup for the languages GitHub detects. Record that
CodeQL covers JavaScript/TypeScript and Actions, while Rust remains covered by
Clippy, cargo-deny, cargo-audit, fixtures, WASM, and browser tests.

Use these API calls, choosing POST for absent Pages and PUT for existing Pages:

```bash
if gh api repos/Tinkora/cert_viewer/pages >/dev/null 2>&1; then
  gh api -X PUT repos/Tinkora/cert_viewer/pages -f build_type=workflow
else
  gh api -X POST repos/Tinkora/cert_viewer/pages -f build_type=workflow
fi
gh api -X PUT repos/Tinkora/cert_viewer/environments/release --input - <<'JSON'
{
  "wait_timer": 0,
  "prevent_self_review": false,
  "deployment_branch_policy": {
    "protected_branches": false,
    "custom_branch_policies": true
  }
}
JSON
gh api -X POST \
  repos/Tinkora/cert_viewer/environments/release/deployment-branch-policies \
  -f name='v*' -f type=tag
gh api -X PATCH repos/Tinkora/cert_viewer/code-scanning/default-setup \
  -f state=configured -f query_suite=default
```

- [ ] **Step 5: Run initial workflows before enforcing required checks**

Wait for `test.yml`, `docs-quality.yml`, `supply-chain.yml`, and `pages.yml` on
the pushed root:

```bash
gh run list --repo Tinkora/cert_viewer --limit 20
run_id="$(gh run list --repo Tinkora/cert_viewer --limit 1 --json databaseId --jq '.[0].databaseId')"
test -n "${run_id}"
gh run watch --repo Tinkora/cert_viewer --exit-status "${run_id}"
```

Expected: every workflow succeeds and Pages serves the exact tested commit.
Fetch check runs for `HEAD` and verify the required context names before using
them in a ruleset; never guess a status-check string.

- [ ] **Step 6: Create main and release-tag rulesets**

Create an active `main` ruleset that targets `refs/heads/main`, blocks deletion
and non-fast-forward updates, requires a pull request with zero approvals during
the documented solo stage, requires all successful test/docs/supply-chain check
contexts discovered in Step 5, requires conversation resolution, and grants no
GitHub App bypass. Create an active tag ruleset for `refs/tags/v*` that blocks
tag update and deletion. Use a repository-admin bypass only for the minimum
operation needed to recover from a rules configuration mistake, and verify
behavior with a disposable branch before release.

- [ ] **Step 7: Install the organization label taxonomy**

Create or update the exact labels and colors from
`Tinkora/.github/docs/LABELS.md`: four `type:*`, four `status:*`, four
`priority:*`, four `area:*`, `good first issue`, and `help wanted`. Remove
GitHub default labels only when their meaning is fully replaced. Read the label
list back and compare names, colors, and descriptions with the source taxonomy.

- [ ] **Step 8: Upload and verify the social preview**

Use the authenticated GitHub web UI through the browser-control skill because
GitHub exposes no supported repository social-preview REST endpoint. First
confirm **Immutable releases** is enabled under repository settings. Then upload
`assets/social-preview.png` under **Settings > General > Social preview** and
reload the public repository page to verify the actual 1280 by 640 image. Do
not change unrelated account or organization settings in the browser.

- [ ] **Step 9: Run the release canary against the exact root commit**

Run:

```bash
gh workflow run release.yml \
  --repo Tinkora/cert_viewer \
  --ref main \
  -f release_tag=v0.1.0
gh run list \
  --repo Tinkora/cert_viewer \
  --workflow release.yml \
  --event workflow_dispatch \
  --limit 1
```

Watch the run to completion. Expected: all quality, archive, checksum, SBOM,
and attestation verification jobs succeed; the publication job is skipped; no
tag or Release exists.

- [ ] **Step 10: Obtain exact release authorization**

Present the user with the immutable candidate commit SHA, successful required
checks, Pages URL, complete four-file release inventory, and canary run URL.
Pause until the user explicitly authorizes creating `v0.1.0` for that SHA. Any
source, dependency, workflow, version, or documentation change invalidates the
authorization and requires a new canary.

- [ ] **Step 11: Create the immutable tag and publish `v0.1.0`**

After authorization, create an annotated tag on the exact reviewed commit and
push only that tag:

```bash
authorized_sha="$(git rev-parse HEAD)"
test "${authorized_sha}" = "$(git rev-parse origin/main)"
git tag -a v0.1.0 -m "Tinkora Cert Viewer v0.1.0" "${authorized_sha}"
git push origin refs/tags/v0.1.0
```

Watch the tag-triggered release workflow. Expected: it publishes one immutable
GitHub Release only after all prerequisite jobs pass.

- [ ] **Step 12: Verify the public release independently**

Download into a new temporary directory, run strict SHA-256 verification,
validate `SBOM.spdx.json`, list both archives, and verify build provenance plus
SBOM attestations for each archive with signer workflow
`Tinkora/cert_viewer/.github/workflows/release.yml`. Verify the Release points
to the authorized tag and commit, immutable releases are enabled, Pages serves
the same version, CodeQL completed without error, and all branch/tag rules are
active.

## Task 15: Update Organization Governance and the Tool Portfolio

**Files in the independent `Tinkora/.github` repository:**

- Modify: `profile/README.md`
- Modify: `profile/README.zh-CN.md`
- Modify: `config/github-settings-policy.json`

**Workspace record outside a Git repository:**

- Modify: `../TOOL_MATRIX.md`

- [ ] **Step 1: Add the verified repository to the settings policy**

Only after Task 14 succeeds, add `cert_viewer` under
`repositoryScope.repositories` with the observed topics, Issues, Discussions,
Projects, CodeQL, ruleset count, and release count. Keep unsupported GitHub Free
features and unresolved manual attestations in their real state; do not mark
the independent-owner, private conduct-reporting, funding-recipient, or domain
control gates satisfied without external evidence.

- [ ] **Step 2: Add Cert Viewer to the bilingual organization profile**

Add one project entry to each profile with the repository and Pages links. The
English description must say it locally inspects X.509 PEM/DER and exposes a
versioned JSON result; the Chinese description must match. Both profiles show
the same four capability states and explicitly say the first release is not
Agent-callable.

- [ ] **Step 3: Update the portfolio evidence record**

In `../TOOL_MATRIX.md`, set the verified portfolio to eight public repositories
with six public tools, move `cert_viewer` from candidate/paused status to an
Alpha `v0.1.0` Wave 2 row, and record only evidence verified in Task 14:
fixture-backed field and fingerprint inspection, strict limits/errors,
bilingual Pages workflow, versioned Schema, green CI/CodeQL, and immutable
release assets. Replace the prior chain/hostname wording with the accurate
inspection-only boundary. Its next gate is three non-maintainers completing a
real certificate-inspection workflow and saying they would use it again.

- [ ] **Step 4: Validate and publish the governance update**

From the independent `.github` repository run:

```bash
bash scripts/check_all.sh
ruby scripts/github_settings_audit.rb \
  --policy config/github-settings-policy.json \
  --output ../output/tinkora-settings-audit.json
git diff --check
git status --short
```

Expected: local governance checks pass; the live audit identifies no
unexplained Cert Viewer drift and preserves honest warnings for unmet manual or
future gates. Stage only the three `.github` files, commit in English, verify
the body, and push `main`:

```bash
git commit -m "docs: add Cert Viewer to the Tinkora catalog"
git show -s --format=%B HEAD
git push origin main
```

`../TOOL_MATRIX.md` is intentionally not committed because the workspace root
is not a Git repository; verify its diff manually and keep it as the local
portfolio decision record.

- [ ] **Step 5: Perform the final cross-repository audit**

Verify the public organization profile, Cert Viewer repository, Pages site,
README language links, Discussions, labels, CodeQL, required checks, rulesets,
environments, release assets, checksums, SBOM, attestations, and immutable tag.
Run the `.github` live settings audit once more after its policy commit. The
project is complete only when the repository, organization catalog, governance
policy, and local tool matrix report the same version, URL, maturity, and four
capability states.
