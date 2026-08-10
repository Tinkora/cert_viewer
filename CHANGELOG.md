# Changelog

All notable changes to this project are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-08-11

### Fixed

- Stabilized machine-readable `directory_name` values with dotted attribute OIDs, deterministic text escaping, and lowercase hexadecimal for non-text values.

## [0.1.0] - 2026-08-10

### Added

- Local-only PEM and DER certificate inspection in a bilingual browser interface.
- Structured inspection of certificate names, dates, extensions, public-key metadata, and SHA-1 and SHA-256 fingerprints.
- Versioned machine-readable inspection results with a published JSON Schema and deterministic example.
- Input limits of 1 MiB and 32 certificates, safe text rendering, accessibility checks, and network privacy tests.
- English and Simplified Chinese product, contribution, security, support, and conduct documentation.

### Known Limitations

- Inspection does not perform signature, certification-path, revocation, trust-store, or hostname verification.
- PEM bundles are inspected as ordered collections, not asserted to be verified chains.
- The published schema is a draft for future agent use and has no callable transport or integration.

[0.1.1]: https://github.com/tinkora/cert_viewer/releases/tag/v0.1.1
[0.1.0]: https://github.com/tinkora/cert_viewer/releases/tag/v0.1.0
