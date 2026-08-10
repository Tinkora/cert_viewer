# ADR 0001: Browser-First, Local-Only Inspection

- Status: Accepted
- Date: 2026-08-10

## Context

Certificate inspection often involves names, internal hostnames, email addresses, and organization metadata. A hosted parsing API would receive that input and create server retention, access-control, abuse, availability, and disclosure obligations. Users also need an interface that works without installing a native application.

## Decision

Cert Viewer is a static, browser-first application. Rust inspection logic is compiled to WebAssembly, and browser code reads local files, invokes the WebAssembly boundary, and renders results as text. There is no application backend and no certificate upload path. The core crate remains platform-independent so inspection behavior can be tested natively.

The deployed host serves only reviewed static assets. Browser tests enforce an allowlist for application asset requests and verify that an inspection does not send certificate contents over the network.

## Consequences

- Certificate contents remain in browser memory under the user's device and browser controls.
- Static hosting is inexpensive and can be self-hosted, mirrored, cached, or rolled back as one artifact set.
- Input size and certificate count are bounded to protect the browser UI.
- Browser compatibility, WebAssembly delivery, CSP, and secure-context clipboard behavior become explicit operational concerns.
- Features that require server persistence, remote enrichment, or upload are outside the accepted boundary and require a new decision record.

Local-only describes application processing, not the initial download of HTML, JavaScript, WebAssembly, styles, or icons from the selected host.
