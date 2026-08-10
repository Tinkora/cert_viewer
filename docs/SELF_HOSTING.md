# Self-Hosting Tinkora Cert Viewer

Tinkora Cert Viewer is a static browser application. The host serves HTML, CSS, JavaScript, SVG, and WebAssembly files; it never needs to receive certificate contents.

## Reproducible Toolchain

Use the pinned Rust 1.95.0 toolchain from `rust-toolchain.toml`, wasm-pack 0.15.0, and Node.js 24. Install dependencies without running package lifecycle scripts:

```bash
npm ci --ignore-scripts
wasm-pack --version
rustc --version
npm run build:web
```

The build creates `dist/`. Publish only that directory and preserve `.nojekyll` when the hosting platform honors it. Do not add certificate upload handlers, analytics, remote fonts, or runtime CDNs.

## Local Verification

Serve the generated directory through HTTP rather than opening `index.html` from the filesystem:

```bash
python3 -m http.server 8080 --directory dist
```

Open `http://localhost:8080`, load the public sample, inspect it, change languages, and check the browser console and network panel. Certificate inspection should not initiate requests after the application files have loaded.

## Static Host Requirements

- Serve `index.html` as `text/html`, `.mjs` and `.js` as JavaScript, `.css` as `text/css`, `.svg` as `image/svg+xml`, and `.wasm` as `application/wasm`.
- Keep files on the same origin unless you have reviewed and tested CORS and the Content Security Policy.
- Support HTTPS in production so clipboard functionality can use a secure context.
- Preserve the relative `icons/` and `pkg/` paths generated under `dist/`.
- Do not rewrite WebAssembly or JavaScript requests to `index.html`.

## Content Security Policy

The application ships a local meta policy with `default-src 'self'`, local scripts and styles, `connect-src 'self'`, and no objects, base navigation, or form submission. WebAssembly compilation requires `'wasm-unsafe-eval'` in `script-src` on supporting browsers. If the host sets an HTTP CSP header, keep it at least as restrictive and test that it does not conflict with the meta policy.

Any change that permits remote scripts, remote connections, inline content, or certificate uploads changes the privacy and security boundary and requires a separate review.

## Cache Invalidation

Deploy each release from an immutable artifact. Because generated filenames are stable in 0.1.x, either invalidate cached `index.html`, JavaScript, and WebAssembly together or publish them under a versioned path. Do not let `index.html` reference JavaScript or WebAssembly from a different release. A short cache lifetime for `index.html` and an atomic directory switch reduce mixed-version failures.

## Rollback

Retain the previous immutable release directory and its recorded checksums. To roll back, atomically point the site to that complete directory, purge or invalidate affected caches, and verify the application version, WebAssembly loading, sample inspection, CSP, and network behavior. Do not rebuild an old tag during an incident when the previously verified artifact is available.

If a release has been publicly tagged, do not move or replace that tag. Publish a corrected superseding release after the rollback.
