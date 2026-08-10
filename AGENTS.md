# Repository Guide for AI Agents

## Product Boundary

- Cert Viewer is a browser-first, local-only X.509 certificate inspector.
- Certificate contents must remain in the browser and must never be sent to a
  server.

## Core Boundary

- `crates/cert_viewer_core` owns platform-independent certificate parsing,
  certificate data models, fingerprints, and stable domain errors.
- The core crate must remain usable as ordinary Rust and must not depend on
  `wasm-bindgen`, `js-sys`, or `serde-wasm-bindgen`.
- Core runtime dependencies are limited to `hex`, `pem`, `serde`, `sha1`,
  `sha2`, `thiserror`, and `x509-parser`.

## WASM and Web Boundary

- `crates/cert_viewer_web` owns only the thin WASM/JavaScript bridge:
  `#[wasm_bindgen]` exports, WASM input validation when needed, calls into
  `cert_viewer_core`, and JSON-compatible serialization to `JsValue`.
- The WASM bridge must not own DOM access, `FileReader`, clipboard, storage, or
  page interaction.
- The web crate may depend on `cert_viewer_core`, `js-sys`,
  `serde-wasm-bindgen`, and `wasm-bindgen` at runtime.
- The root `web/` directory owns HTML, CSS, JavaScript, DOM rendering, file
  reading, clipboard access, other browser APIs, and user interaction.
- Do not duplicate certificate parsing logic in JavaScript or add browser
  concerns to the core crate.

## Test Boundary

- Core behavior tests belong to `cert_viewer_core` and must run on the native
  Rust target. `serde_json` is available only as a core dev-dependency.
- WASM bridge tests belong to `cert_viewer_web` and use `wasm-bindgen-test` only
  as a dev-dependency.
- Keep fixtures and assertions at the narrowest owning crate; test public
  outcomes rather than third-party implementation details.

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
