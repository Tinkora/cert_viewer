# ADR 0002: Inspection-Only Terminology And Evidence Gates

- Status: Accepted
- Date: 2026-08-10

## Context

X.509 field parsing is easy to mistake for a security decision. Dates, equal subject and issuer names, fingerprints, and adjacent certificates do not by themselves establish authenticity, authorization, or suitability for a service. Agent-related labels can likewise imply an integration that does not exist.

## Decision

All product surfaces describe Cert Viewer as inspection-only. The product reports parsed fields and observable date states. It does not perform signature, certification-path, revocation, CT, trust-store, or hostname verification, and it does not state that a PEM bundle forms a verified chain.

The public field `is_self_issued` records a direct structural comparison of the subject and issuer representations returned by x509-parser. Equivalent distinguished names with different encodings may compare unequal. UI and documentation must not turn the field into a signature or trust conclusion.

Agent capability uses four stable labels: `Human-usable`, `Machine-readable`, `Agent schema draft`, and `Not Agent-callable`. The JSON Schema is a data contract, not a transport. Any future MCP or other callable integration must pass an evidence gate before public claims are changed: an accepted problem statement, real user evidence, a reviewed protocol and security boundary, an implemented transport, tests, versioned documentation, and an explicit architecture decision.

## Consequences

- UI status language stays factual and scoped to observed fields and the browser clock.
- Documentation must state absent verification behavior near relevant output explanations.
- A multi-certificate input remains an ordered collection of independently inspected certificates.
- Schema publication may proceed without implying a callable agent tool.
- New trust or integration claims require implementation evidence and an explicit review; terminology alone cannot create a capability.
