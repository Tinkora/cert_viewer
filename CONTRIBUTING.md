# Contributing to Tinkora Cert Viewer

[简体中文](CONTRIBUTING.zh-CN.md)

Thank you for helping improve this inspection-only, local-only certificate viewer. Contributions must preserve the product and privacy boundaries in [`AGENTS.md`](AGENTS.md).

This guide applies [Tinkora's organization-wide community policies](https://github.com/Tinkora/.github) to the Cert Viewer development and review workflow.

## Start With An Issue

Open the appropriate Issue Form before substantial work. Reproducible bugs need steps and environment details. Feature requests need evidence of a real user workflow, alternatives, and a clear fit with inspection-only behavior. Use [GitHub Discussions](https://github.com/tinkora/cert_viewer/discussions) for usage questions that are not yet actionable.

Never post sensitive certificates, private keys, account data, or vulnerability details in a public issue. Use [Private Vulnerability Reporting](https://github.com/tinkora/cert_viewer/security/advisories/new) for security reports.

## Development Workflow

1. Fork the repository and clone your fork.
2. Create a focused branch from the latest `main`, such as `feat/clear-subject-copy` or `fix/der-file-detection`.
3. Add an outcome-focused failing test before changing behavior, confirm the expected failure, implement the smallest complete change, and make the test pass.
4. Keep each commit to one coherent milestone and write English [Conventional Commit](https://www.conventionalcommits.org/en/v1.0.0/) messages such as `fix: preserve certificate order`.
5. Write all new or modified code comments in English. Explain only non-obvious constraints or decisions.
6. Push the branch to your fork and open a pull request linked to the issue.

Maintainers use squash merge so that each merged pull request becomes one reviewable Conventional Commit on `main`.

## Local Setup

Install Rust 1.95.0 with the `wasm32-unknown-unknown` target, wasm-pack 0.15.0, Node.js 24, and Ruby. Install JavaScript dependencies without lifecycle scripts:

```bash
npm ci --ignore-scripts
```

## Required Checks

Run the checks affected by your change and report the exact commands and results in the pull request. Before requesting final review, the complete local baseline is:

```bash
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
git diff --check
```

Do not weaken assertions, skip tests, or suppress warnings to obtain a green check. Explain platform limitations when a relevant command cannot run locally.

## Frontend Changes

Before creating, modifying, reviewing, or debugging any HTML page or user-facing frontend, use the `ui-ux-pro-max` skill. Run its required `--design-system` search before editing, followed by relevant stack and UX searches. Verify the rendered result in a real browser at 375, 768, 1024, and 1440 pixel widths, including console, keyboard, accessibility, network privacy, and overflow checks. Attach useful screenshots or accessibility evidence to the pull request.

## Review Expectations

Keep pull requests focused and reviewable. Describe the behavior and privacy impact, show test evidence, and update both English and Simplified Chinese documentation when user-facing behavior changes. Respond to review findings with code or explicit technical reasoning; resolve conversations only after the concern is addressed.

Changes to public JSON fields require schema tests, compatible documentation, and a versioning decision. Do not describe an agent transport, trust decision, verified chain, or hostname verification unless independently approved evidence and implementation exist.

## Changelog And Releases

Add a changelog entry when a change affects users, security posture, compatibility, installation, or published artifacts. Typographical fixes and internal refactors normally do not need one; record that decision in the pull request. Maintainers own version selection, release commits, immutable tags, and GitHub Releases.

## Community

Participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md). Support routing is documented in [SUPPORT.md](SUPPORT.md), and vulnerability handling is documented in [SECURITY.md](SECURITY.md).
