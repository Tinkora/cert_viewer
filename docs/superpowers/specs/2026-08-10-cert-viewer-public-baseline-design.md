# Cert Viewer Public Baseline Design

| Field | Value |
| --- | --- |
| Status | Approved for implementation |
| Date | 2026-08-10 |
| Repository | `Tinkora/cert_viewer` |
| First public release | `v0.1.0` |

## 1. Purpose

Tinkora Cert Viewer is a browser-first X.509 certificate inspection tool for
developers, operators, and security practitioners who need a fast way to read
certificate metadata without installing a desktop application or sending the
certificate to a service.

The first release has four explicit capability labels:

- **Human-usable:** the complete workflow is available through the web UI.
- **Machine-readable:** a parsed bundle can be copied as versioned JSON.
- **Agent schema draft:** the JSON contract is documented for future tools.
- **Not Agent-callable:** there is no MCP server, command transport, hosted API,
  or other agent-callable runtime in this release.

These labels prevent a schema draft from being mistaken for a working agent
integration. The README, web UI, repository topics, release notes, and
organization catalog must use the same language.

## 2. Evidence and Product Boundary

Mature tools such as XCA, KeyStore Explorer, Certigo, and CyberChef demonstrate
recurring demand for certificate inspection. No comparable demand signal was
found for a dedicated X.509 MCP server. The first release therefore solves the
proven browser inspection problem and defers MCP until real users request an
agent transport.

The product is an **inspector**, not a validator. It may describe fields that
exist in a certificate, but it must not claim that a certificate, identity,
issuer, signature, or bundle is trusted or valid.

## 3. Release Scope

### 3.1 Included

- Accept a single DER certificate or a PEM bundle containing one to 32
  `CERTIFICATE` blocks.
- Accept pasted PEM text and local `.pem`, `.crt`, `.cer`, and `.der` files.
- Parse entirely in the browser through Rust compiled to WebAssembly.
- Show each certificate independently in input order.
- Expose subject and issuer names, serial number, version, validity dates,
  subject alternative names, key usages, extended key usages, basic
  constraints, public-key metadata, signature algorithm, and SHA-256/SHA-1
  fingerprints.
- Report the certificate's date state as `not_yet_valid`,
  `within_stated_dates`, or `expired` relative to an explicit current time.
- Report `is_self_issued` when subject and issuer names are equal. Present it as
  a structural hint, never as proof of a self-signed certificate.
- Copy SHA-256 fingerprints and legacy SHA-1 fingerprints for comparison with
  existing tooling.
- Copy the entire versioned inspection result as JSON.
- Provide complete English and Simplified Chinese UI text, with English as the
  default.
- Work without fonts, analytics, telemetry, cookies, certificate persistence,
  or runtime network requests.
- Publish a static GitHub Pages application and a workflow-built, checksummed
  GitHub Release.

### 3.2 Explicit Non-goals

The first release does not perform or advertise:

- certification-path building or chain validation;
- trust-store lookup or trust decisions;
- hostname or service-identity matching;
- signature verification, including self-signature verification;
- revocation checks through CRL or OCSP;
- Certificate Transparency checks;
- policy, name-constraint, usage, or compliance validation;
- private-key parsing, matching, generation, or storage;
- certificate generation, conversion, repair, or modification;
- remote URL, TLS endpoint, or server scanning;
- MCP, an HTTP API, a CLI, a browser extension, or an installable PWA.

The UI uses **bundle**, **certificate**, and **inspection**. It does not call
input certificates a verified chain and does not use an unqualified **valid**
status.

## 4. Architecture

The repository remains a small Rust workspace with a static web application:

```text
cert_viewer/
├── crates/
│   ├── cert_viewer_core/       # Platform-independent parsing and data model
│   └── cert_viewer_web/        # Thin wasm-bindgen serialization boundary
├── web/                        # HTML, CSS, JS modules, and translations
├── tests/
│   ├── fixtures/               # Fixed certificates and expected metadata
│   └── browser/                # Playwright tests using the real WASM build
├── docs/
│   ├── schema/                 # Versioned JSON contract
│   └── superpowers/            # Design and implementation records
└── .github/                    # CI, Pages, release, and community workflows
```

### 4.1 Core crate

`cert_viewer_core` owns input classification, limits, X.509 parsing, normalized
output, date-state calculation, and stable error codes. It accepts the current
Unix timestamp as an argument instead of reading a platform clock, which keeps
the crate deterministic and usable on native and WASM targets.

The core depends on `x509-parser 0.18.1`. It contains no browser APIs and no
serialization assumptions beyond `serde`-compatible public result types.

### 4.2 WASM boundary

`cert_viewer_web` exports one primary operation:

```text
inspectBundle(inputBytes, nowUnixSeconds) -> JSON-compatible result or error
```

The boundary validates JavaScript argument types, calls the core, and serializes
the result. It does not duplicate parsing, date logic, or product policy.

### 4.3 Web application

The static application owns file reading, paste input, localization, safe DOM
rendering, disclosure controls, clipboard actions, and accessible status
announcements. It imports only the locally built WASM package and local JS
modules. The repository-root page redirects to or contains the actual tool; it
is not a marketing landing page.

## 5. Input Contract

### 5.1 Limits

- Maximum total input: **1,048,576 bytes** before decoding or parsing.
- Maximum PEM certificates: **32**.
- Empty or ASCII-whitespace-only input is rejected.
- Limits are enforced in the Rust core so every future consumer receives the
  same behavior.

The limits are large enough for ordinary certificate bundles while bounding
CPU, memory, output size, and accidental file uploads.

### 5.2 Classification and strictness

After leading ASCII whitespace, input beginning with a PEM boundary is parsed
as UTF-8 PEM. Otherwise it is parsed as binary DER.

PEM input must contain only `CERTIFICATE` blocks plus ASCII whitespace. A
private key, certificate request, arbitrary PEM label, malformed block, or
non-whitespace text is rejected. No block is silently skipped.

DER input must encode exactly one certificate. Any unconsumed trailing byte is
reported as `trailing_der_data`.

Certificates in a PEM bundle are parsed independently and retained in input
order. No relationship between adjacent certificates is inferred.

## 6. Machine-readable Result

The JSON result starts with `schema_version: 1`, `input_format`, and a
`certificates` array. Stable machine values use `snake_case`; translated display
labels exist only in the web application.

Each certificate contains:

- its zero-based `input_index`;
- X.509 `version` and hexadecimal `serial_number`;
- structured `subject` and `issuer` distinguished names, including ordered raw
  OID/value entries;
- `not_before_unix`, `not_after_unix`, and `date_status`;
- typed subject alternative names with `kind` and `value`;
- stable key-usage and extended-key-usage identifiers;
- basic constraints, including `is_ca` and optional path-length constraint;
- an ordered extension summary containing OID, criticality, and whether the
  extension received structured decoding;
- public-key algorithm OID, display name, and optional key size in bits;
- signature algorithm OID and display name;
- lowercase, unseparated SHA-256 and SHA-1 fingerprints;
- `is_self_issued`.

The result does not include the original input bytes, raw extension payloads,
or a synthetic trust, chain, hostname, revocation, usage, or
signature-verification result. Unknown name, algorithm, extended-key-usage, and
extension OIDs encountered in the selected fields are retained as OIDs rather
than dropped or assigned a guessed name.

`date_status` is calculated with inclusive bounds:

```text
now < not_before                 => not_yet_valid
not_before <= now <= not_after  => within_stated_dates
now > not_after                  => expired
```

`within_stated_dates` only describes the encoded time interval.

## 7. Error Contract

Errors cross the WASM boundary as a structured object with `code`, `message`,
and optional `certificate_index`. Messages are concise English diagnostics;
the UI maps codes to localized user guidance and may retain the diagnostic as
details.

The stable first-release codes are:

| Code | Meaning |
| --- | --- |
| `invalid_input_type` | The WASM input is not a `Uint8Array`. |
| `invalid_current_time` | The current time is not a safe integer. |
| `input_empty` | No certificate data was supplied. |
| `input_too_large` | Input exceeds 1 MiB. |
| `invalid_pem_utf8` | PEM-classified input is not valid UTF-8. |
| `invalid_pem` | PEM structure or surrounding content is malformed. |
| `non_certificate_pem_block` | A PEM block has an unexpected label. |
| `too_many_certificates` | The bundle contains more than 32 certificates. |
| `invalid_der` | A certificate cannot be parsed as DER X.509. |
| `trailing_der_data` | DER input contains bytes after the certificate. |
| `unsupported_certificate_version` | The X.509 version is unsupported. |

For a PEM bundle failure, `certificate_index` identifies the zero-based block
when parsing reached a particular certificate. A failed bundle produces no
partial success result.

## 8. User Experience

The first viewport is the working tool. The visual language is quiet,
work-focused, and suitable for repeated technical inspection, with no oversized
hero, decorative illustration, gradient background, nested cards, or
marketing-style feature section.

### 8.1 Primary workflow

1. Paste PEM or choose/drop a local certificate file.
2. Select **Inspect** or submit the form from the input control.
3. See a bundle summary and one independently labeled result per certificate.
4. Expand field groups, copy a fingerprint, or copy the complete JSON result.
5. Clear the session to remove all input and rendered data from memory and the
   DOM.

The UI clearly states that processing is local. It does not state that a
certificate is safe, trusted, usable, or valid.

### 8.2 Language behavior

- English is the initial language when no `lang` query is present.
- `?lang=zh-CN` opens the complete Simplified Chinese interface.
- The language control updates the document language and URL with
  `history.replaceState`; it does not use storage.
- Every visible label, help message, error, empty state, status announcement,
  accessible name, and copied-state message exists in both languages.
- README is English-first and links prominently to `README.zh-CN.md`; the
  Chinese README links back to English.

### 8.3 Accessibility and responsive behavior

- All operations are real buttons, labels, inputs, or native disclosure
  controls and work with a keyboard.
- Focus order follows the visual workflow, and focus indicators remain visible.
- Parse, error, copy, and clear outcomes are announced through an appropriate
  live region.
- Color never carries date state or errors alone.
- Long DNs, SANs, serial numbers, OIDs, and fingerprints wrap or scroll within
  their own region without widening the viewport.
- Fixed controls retain stable dimensions at 375, 768, 1024, and 1440 pixel
  viewport widths.
- Reduced-motion preferences disable nonessential transitions.

User-controlled certificate fields are inserted only with safe DOM/text APIs.
No inline event handlers or dynamic user-data HTML strings are permitted.

## 9. Privacy and Security

- The deployed application has no backend and makes no runtime network request
  after its static files load.
- There are no external fonts, scripts, styles, images, analytics, telemetry,
  advertising pixels, cookies, or storage of certificate data.
- A strict Content Security Policy permits only the static application and the
  WebAssembly execution mechanism required by supported browsers.
- Input files are read only after explicit local selection or drop and are
  never uploaded.
- Clear removes the selected file value, pasted text, parsed result, and copied
  status from the document state.
- Dependency updates, GitHub Actions, release artifacts, and Pages deployment
  follow Tinkora's pinned-action and least-privilege supply-chain policy.

Certificate data is often public, but the application treats all input as
untrusted and potentially sensitive.

## 10. Verification Strategy

### 10.1 Core tests

Commit fixed OpenSSL-generated certificate fixtures and their independently
captured expected metadata. Native tests compare subject, issuer, serial,
validity, SANs, usages, constraints, key metadata, algorithm OIDs, and both
fingerprints against those expectations.

Outcome-focused tests cover:

- one PEM certificate, one DER certificate, and a multi-certificate PEM bundle;
- all three date states, including exact `not_before` and `not_after` bounds;
- RSA and EC key metadata;
- unknown OIDs retained in machine-readable output;
- empty, oversized, malformed, mixed-label, and over-count input;
- invalid UTF-8 PEM, DER trailing bytes, and failure at a known bundle index;
- deterministic JSON field names and `schema_version`.

The fixture generation command and OpenSSL inspection commands are documented,
but tests use committed fixtures and do not depend on OpenSSL at runtime.

### 10.2 WASM and JavaScript tests

- Run `wasm-pack test --node` for the real serialization boundary.
- Unit-test localization completeness, formatting, and safe renderer helpers.
- Reject a schema or core error that loses its stable code at the WASM boundary.

### 10.3 Browser tests

Playwright builds and loads the real release WASM package, then covers the
complete paste, file, bundle, language, copy, error, and clear workflows.
Chromium runs at 375, 768, 1024, and 1440 pixel widths. Tests also assert:

- no console errors;
- no unexpected network requests;
- no horizontal page overflow;
- keyboard operability and visible focus;
- correct document language and translated accessible names;
- safe rendering of certificate fields containing HTML-like text;
- a nonblank, correctly framed application at every target width.

Automated accessibility checks supplement, but do not replace, explicit
keyboard and semantic assertions.

### 10.4 Repository gates

CI must pass formatting, workspace tests, strict Clippy, native and WASM builds,
JavaScript tests, Playwright tests, Markdown checks, actionlint, and zizmor.
CodeQL, Dependabot, dependency review, secret scanning where available on the
GitHub Free plan, and a read-only repository-settings audit complete the public
baseline.

## 11. Documentation and Release

The public repository includes:

- English `README.md` and Simplified Chinese `README.zh-CN.md`;
- contribution, conduct, security, support, release, and self-hosting guidance;
- issue forms, a pull-request template, CODEOWNERS, and agent instructions;
- an English changelog following Keep a Changelog;
- the versioned JSON schema and an example result;
- an explicit capability matrix showing **Not Agent-callable**;
- architecture decisions for browser-first/local-only processing and strict
  inspection-only terminology.

Before publication, all obsolete organization URLs and badges, obsolete MCP
claims, unsupported feature claims, Chinese-only public documents, and
non-English commit messages are removed from the public baseline. Public Git
history starts from a clean, English Conventional Commit baseline under
Tinkora.

The `v0.1.0` release publishes checksummed static assets and source artifacts.
GitHub Pages serves the same tested build. Repository description, topics,
homepage, social preview, Discussions, labels, rulesets, environments, and
branch protections are configured consistently with Tinkora governance and the
GitHub Free plan.

## 12. Acceptance Criteria

The release is complete when all of the following are true:

1. A user can inspect supported PEM and DER input locally in a real browser and
   obtain correct fields and fingerprints verified against OpenSSL fixtures.
2. A PEM bundle is displayed as independent certificates in input order without
   any chain or trust claim.
3. Every malformed, oversized, mixed, trailing-data, and over-count case fails
   with the documented structured error and no partial result.
4. Date state uses the three exact non-trust labels and handles both inclusive
   boundaries correctly.
5. `is_self_issued` replaces every `is_self_signed` field and claim.
6. English and Simplified Chinese workflows are complete and equivalent, with
   English as the default.
7. User-controlled content cannot create markup or event handlers, and browser
   checks find no console error, unexpected request, horizontal overflow, or
   keyboard blocker at the four required widths.
8. README, schema, release notes, Pages UI, repository metadata, and Tinkora's
   organization catalog agree on the four capability labels.
9. Reachable commits, branches, tags, releases, Pages assets, and repository
   metadata use only the current Tinkora identity and public product decisions.
10. All local and GitHub quality, security, release, and governance checks pass.

## 13. Deferred Decision Gate

MCP work may begin only after an issue records a concrete user workflow that a
browser and copied JSON cannot satisfy. That future proposal must separately
define transport, authentication, input privacy, lifecycle, error semantics,
and conformance tests. A JSON schema alone is never evidence that the current
release is Agent-callable.
