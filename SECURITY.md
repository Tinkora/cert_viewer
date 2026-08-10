# Security Policy

[简体中文](SECURITY.zh-CN.md)

This repository applies [Tinkora's organization-wide community policies](https://github.com/Tinkora/.github) and defines the Cert Viewer-specific security boundary and response process below.

## Supported Versions

| Version | Security support |
| --- | --- |
| 0.1.x | Supported |
| Earlier or unreleased versions | Not supported |

Security fixes are released on the current `0.1.x` line. Superseded releases do not receive backports unless a release notice explicitly says otherwise.

## Report A Vulnerability

Use [GitHub Private Vulnerability Reporting](https://github.com/tinkora/cert_viewer/security/advisories/new). Do not open a public issue, Discussion, or pull request for a suspected vulnerability. Include affected versions, impact, reproduction details, and a minimal non-sensitive sample when possible. Never include private keys, production certificates, account data, or unrelated personal information.

You should receive an acknowledgement within 72 hours, an initial triage update within 7 days, and a remediation or coordination update at least every 14 days while the report remains active. These are response targets, not guarantees of a fix deadline.

The maintainer will validate the report, agree on disclosure timing when appropriate, prepare a fix and release, and credit the reporter if requested and permitted.

## Security Boundary

Cert Viewer inspects untrusted PEM and DER certificate data locally in the browser. Certificate text is rendered as text, input is limited to 1 MiB and 32 certificates, and browser privacy tests reject unexpected network requests during inspection.

Certificates can contain identifying names, internal hostnames, email addresses, and organizational metadata. Treat them as potentially sensitive even though public TLS certificates are often observable elsewhere. The application does not need private keys; never provide one.

## Claims The Product Does Not Make

Cert Viewer does not perform signature, certification-path, revocation, CT, trust-store, or hostname verification. It does not decide whether a certificate should be trusted, whether it is authorized for a service, or whether certificates in a PEM bundle form a verified chain. `is_self_issued` only compares subject and issuer names.

Reports about misleading inspection output, unsafe rendering, parser resource use, dependency compromise, unexpected network behavior, or published artifact integrity are in scope. General certificate-policy disagreements and capabilities already documented as absent are not vulnerabilities unless they expose a concrete security impact.

## Disclosure

Please allow time for coordinated remediation before public disclosure. Release notes will describe user impact and upgrade guidance without exposing sensitive reporter data. GitHub Security Advisories are the canonical coordination record.
