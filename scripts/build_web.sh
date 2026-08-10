#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
DIST_DIR="$REPO_ROOT/dist"
WEB_DIR="$REPO_ROOT/web"
SCHEMA_DIR="$REPO_ROOT/docs/schema"
PKG_DIR="$REPO_ROOT/crates/cert_viewer_web/pkg"
ICON_DIR="$REPO_ROOT/node_modules/lucide-static/icons"

if [[ -z "$REPO_ROOT" || "$REPO_ROOT" == "/" || "$DIST_DIR" != "$REPO_ROOT/dist" ]]; then
  echo "Refusing to resolve an unsafe distribution path." >&2
  exit 1
fi

for source_dir in "$WEB_DIR" "$SCHEMA_DIR" "$ICON_DIR"; do
  if [[ -L "$source_dir" || ! -d "$source_dir" ]]; then
    echo "Refusing unsafe source directory: $source_dir" >&2
    exit 1
  fi
done
if [[ -L "$PKG_DIR" ]]; then
  echo "Refusing symlinked WASM package directory: $PKG_DIR" >&2
  exit 1
fi
if [[ -L "$DIST_DIR" ]]; then
  echo "Refusing symlinked distribution target: $DIST_DIR" >&2
  exit 1
fi

copy_reviewed_file() {
  local source="$1"
  local destination="$2"

  if [[ -L "$source" || ! -f "$source" ]]; then
    echo "Refusing non-regular source file: $source" >&2
    exit 1
  fi
  case "$destination" in
    *.html|*.css|*.mjs|*.svg|*.js|*.json|*.wasm) ;;
    *)
      echo "Refusing unexpected output suffix: $destination" >&2
      exit 1
      ;;
  esac
  cp -- "$source" "$destination"
}

cd -- "$REPO_ROOT"
wasm-pack build crates/cert_viewer_web --target web --release --locked

if [[ -L "$PKG_DIR" || ! -d "$PKG_DIR" ]]; then
  echo "Missing or unsafe WASM package directory: $PKG_DIR" >&2
  exit 1
fi

for source in \
  "$WEB_DIR/index.html" \
  "$WEB_DIR/styles.css" \
  "$WEB_DIR/app.mjs" \
  "$WEB_DIR/sample.mjs" \
  "$WEB_DIR/favicon.svg" \
  "$WEB_DIR/format.mjs" \
  "$WEB_DIR/i18n.mjs" \
  "$WEB_DIR/render.mjs" \
  "$SCHEMA_DIR/inspection-result-v1.example.json" \
  "$SCHEMA_DIR/inspection-result-v1.schema.json" \
  "$PKG_DIR/cert_viewer_web.js" \
  "$PKG_DIR/cert_viewer_web_bg.wasm"
do
  if [[ -L "$source" || ! -f "$source" ]]; then
    echo "Missing or unsafe required source: $source" >&2
    exit 1
  fi
done

if [[ ! -f "$WEB_DIR/index.html" ]]; then
  echo "Missing web/index.html." >&2
  exit 1
fi

while IFS= read -r generated; do
  if [[ -L "$generated" || ! -f "$generated" ]]; then
    echo "Refusing unsafe WASM package entry: $generated" >&2
    exit 1
  fi
  case "$(basename -- "$generated")" in
    .gitignore|package.json|cert_viewer_web.js|cert_viewer_web.d.ts|cert_viewer_web_bg.wasm|cert_viewer_web_bg.wasm.d.ts) ;;
    *)
      echo "Refusing unexpected WASM package output: $generated" >&2
      exit 1
      ;;
  esac
done < <(find "$PKG_DIR" -mindepth 1 -maxdepth 1 -print)

if [[ -e "$DIST_DIR" ]]; then
  if [[ ! -d "$DIST_DIR" ]]; then
    echo "Refusing unsafe distribution target: $DIST_DIR" >&2
    exit 1
  fi
  unexpected_dist_entry="$(find "$DIST_DIR" -mindepth 1 \( -type l -o \( ! -type f ! -type d \) \) -print -quit)"
  if [[ -n "$unexpected_dist_entry" ]]; then
    echo "Refusing unsafe distribution entry: $unexpected_dist_entry" >&2
    exit 1
  fi
  rm -rf -- "$DIST_DIR"
fi

mkdir -p -- "$DIST_DIR/icons" "$DIST_DIR/pkg" "$DIST_DIR/schema"

for name in index.html styles.css app.mjs sample.mjs favicon.svg format.mjs i18n.mjs render.mjs; do
  copy_reviewed_file "$WEB_DIR/$name" "$DIST_DIR/$name"
done

for name in scan-search file-up trash-2 copy braces languages circle-check; do
  copy_reviewed_file "$ICON_DIR/$name.svg" "$DIST_DIR/icons/$name.svg"
done

for name in inspection-result-v1.example.json inspection-result-v1.schema.json; do
  copy_reviewed_file "$SCHEMA_DIR/$name" "$DIST_DIR/schema/$name"
done

copy_reviewed_file "$PKG_DIR/cert_viewer_web.js" "$DIST_DIR/pkg/cert_viewer_web.js"
copy_reviewed_file "$PKG_DIR/cert_viewer_web_bg.wasm" "$DIST_DIR/pkg/cert_viewer_web_bg.wasm"
: > "$DIST_DIR/.nojekyll"

bash "$SCRIPT_DIR/test_build_web.sh"
