# Tinkora Cert Viewer

[简体中文](README.zh-CN.md)

[![Support Tinkora on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/tinkora)

Tinkora Cert Viewer is an inspection-only, browser-first X.509 certificate viewer that keeps certificate contents on your device.

[Open the live viewer](https://tinkora.github.io/cert_viewer/)

## Capabilities

| Capability | Current surface |
| --- | --- |
| Human-usable | Browser UI |
| Machine-readable | Versioned JSON result |
| Agent schema draft | Published JSON Schema |
| Not Agent-callable | No transport or integration |

The schema is available for local consumers and future integration research. Version 0.1.0 does not expose an agent tool, endpoint, MCP server, or invocation protocol.

## Supported Input

- Paste one PEM-encoded X.509 certificate or a PEM bundle.
- Select or drop a PEM or DER certificate file, including `.pem`, `.crt`, `.cer`, and `.der` files.
- Inspect at most 1 MiB of input and 32 certificates in one operation.
- Treat a multi-certificate PEM bundle as an ordered collection. Cert Viewer does not establish or verify a chain.

Private keys and PKCS#12 archives are intentionally unsupported. Do not paste private keys or other secrets.

## Inspection Semantics

The result reports certificate fields, fingerprints, extensions, and a date status computed from the browser clock. The three date states are `not_yet_valid`, `within_stated_dates`, and `expired`. They do not establish certificate trust or suitability for a hostname.

`is_self_issued` reports the result of directly comparing x509-parser's subject and issuer structures. Equivalent names with different encodings may compare unequal, and a true result does not prove that the certificate signature verifies with its own public key.

No generic valid, trusted, or verified badge is shown. Each inspected certificate remains independent, including certificates supplied together in a PEM bundle.

## Privacy

Parsing and rendering happen locally in the browser through WebAssembly. There is no application backend, analytics, telemetry, or upload endpoint, and certificate contents are not persisted by the application. Hosting a static build still requires the browser to fetch the application files from that host.

## Quick Start

Use the [live viewer](https://tinkora.github.io/cert_viewer/), paste or drop a certificate, and select **Inspect**. The bundled sample is public test data and is safe for learning the interface.

To run a production build locally:

```bash
npm ci --ignore-scripts
npm run build:web
python3 -m http.server 8080 --directory dist
```

Open `http://localhost:8080`. Building requires Rust 1.95.0, the `wasm32-unknown-unknown` target, and wasm-pack 0.15.0. See [Self-hosting](docs/SELF_HOSTING.md) for deployment, CSP, cache, and rollback guidance.

## Development And Tests

```bash
npm ci --ignore-scripts
cargo fmt --all -- --check
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo check -p cert_viewer_web --target wasm32-unknown-unknown
npm run test:web
npm run test:schema
npm run build:web
npm run test:browser
ruby scripts/check_docs.rb
npx --no-install markdownlint-cli2 '**/*.md'
```

Browser tests start a local static server and run the user workflow, accessibility, and network privacy checks.

## Schema Compatibility

Successful inspections can be represented by the [version 1 JSON Schema](docs/schema/README.md). Consumers must require `schema_version: 1`, reject unsupported versions, and reject unknown properties. A field removal, rename, type change, or semantic change requires a new schema version. The schema does not define error results, a remote API, or a callable agent integration.

## Browser Support

Automated release checks cover current Playwright Chromium. Current Chrome, Edge, Firefox, and Safari releases with WebAssembly and JavaScript module support are intended to work. Clipboard writes require a secure context or localhost and may be denied by browser permissions; inspection remains available when copying is unavailable.

## Known Limitations

- No signature, certification-path, revocation, CT, trust-store, or hostname verification.
- No inference that a PEM bundle is ordered correctly or forms a verified chain.
- No private-key, CSR, PKCS#7, or PKCS#12 parsing.
- Date status depends on the user's browser clock.
- The schema describes successful inspection results only.
- No agent-callable transport or integration is published in 0.1.0.

## Security, Support, And Contributions

Report vulnerabilities through [GitHub Private Vulnerability Reporting](https://github.com/tinkora/cert_viewer/security/advisories/new), never through a public issue. Read the [security policy](SECURITY.md), [support guide](SUPPORT.md), [contribution guide](CONTRIBUTING.md), and [Code of Conduct](CODE_OF_CONDUCT.md) before participating.

## Releases And Verification

Release assets, checksums, SBOMs, and attestations are published through GitHub Releases. Maintainers follow the [release procedure](docs/RELEASING.md); consumers should compare checksums and verify attestations against the expected repository and immutable tag.

## Citation

Use the metadata in [`CITATION.cff`](CITATION.cff) or GitHub's **Cite this repository** action. Cite a versioned release when reproducibility matters.

## License

Cert Viewer is available under the [MIT License](LICENSE). Bundled third-party material is documented in [Third-Party Notices](THIRD_PARTY_NOTICES.md).
