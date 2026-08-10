# Inspection Result Schema

Cert Viewer publishes a versioned JSON Schema for successful certificate
inspection results. English is the default language for this contract and its
documentation.

## Files

- [`inspection-result-v1.schema.json`](inspection-result-v1.schema.json) is the
  Draft 2020-12 schema.
- [`inspection-result-v1.example.json`](inspection-result-v1.example.json) is a
  deterministic example generated from the committed RSA fixture.

The canonical schema identifier is
`https://tinkora.github.io/cert_viewer/schema/inspection-result-v1.schema.json`.

## Capabilities

- `Human-usable`: people can inspect the documented JSON and use it in local
  certificate workflows.
- `Machine-readable`: JSON Schema validators can validate complete successful
  inspection results.
- `Agent schema draft`: the contract can inform future agent integrations while
  its agent-facing semantics remain a draft.
- `Not Agent-callable`: this release does not expose an agent tool, endpoint, or
  invocation protocol.

This schema is a data contract. It does not define a transport, remote API, or
MCP implementation. Certificate contents remain local to the browser product
boundary.

## Version Compatibility

Every result includes a required `schema_version`. Consumers of this schema
must require the value `1` and reject unsupported versions. Adding, removing,
renaming, or changing the meaning of a field requires a new schema version and
a separately published schema. Editorial clarifications that do not change the
accepted JSON shape may update this documentation without changing the version.

The contract is strict: every modeled property is required, nullable Rust
`Option` fields are present with either their value or `null`, and unknown
properties are rejected.

## Error Rule

The schema describes successful inspection only. If any certificate or the
input bundle cannot be inspected, a producer must return its defined error and
must not return a partial `InspectionResult`, a successfully parsed prefix, or
placeholder certificate data.
