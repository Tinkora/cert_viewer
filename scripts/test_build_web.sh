#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(cd -- "${script_dir}/.." && pwd -P)"
schema_dir="${repo_root}/docs/schema"
dist_schema_dir="${repo_root}/dist/schema"

expected=$'inspection-result-v1.example.json\ninspection-result-v1.schema.json'
actual="$(find "${dist_schema_dir}" -mindepth 1 -maxdepth 1 -type f -exec basename {} \; 2>/dev/null | sort || true)"
if [[ "${actual}" != "${expected}" ]]; then
  printf 'Built schema inventory is not exact.\n' >&2
  diff -u <(printf '%s\n' "${expected}") <(printf '%s\n' "${actual}") >&2 || true
  exit 1
fi

for name in inspection-result-v1.example.json inspection-result-v1.schema.json; do
  if ! cmp -s -- "${schema_dir}/${name}" "${dist_schema_dir}/${name}"; then
    printf 'Built schema artifact differs from its canonical source: %s\n' "${name}" >&2
    exit 1
  fi
done

printf 'Built schema artifacts match their canonical sources.\n'
