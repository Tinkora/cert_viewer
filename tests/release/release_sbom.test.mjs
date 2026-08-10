import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  buildSpdxDocument,
  inventoryFromMetadata,
  validateSpdxDocument,
} from '../../scripts/release_sbom.mjs';

const inventory = {
  cargo: [
    {
      identity: 'cargo:fixture-core:0.1.0',
      name: 'fixture_core',
      version: '0.1.0',
      purl: 'pkg:cargo/fixture_core@0.1.0',
      license: 'MIT/Apache-2.0',
    },
  ],
  npm: [
    {
      identity: 'npm:node_modules/fixture-dependency:1.2.3',
      name: 'fixture-dependency',
      version: '1.2.3',
      purl: 'pkg:npm/fixture-dependency@1.2.3',
      license: 'Unknown-License',
    },
  ],
};

const archives = [
  {
    fileName: './cert_viewer-web-v0.1.0.tar.gz',
    bytes: Buffer.from('web archive'),
  },
  {
    fileName: './cert_viewer-source-v0.1.0.tar.gz',
    bytes: Buffer.from('source archive'),
  },
];

const context = {
  version: '0.1.0',
  repository: 'Tinkora/cert_viewer',
  commit: '0123456789abcdef0123456789abcdef01234567',
  created: '2026-08-11T00:00:00Z',
  inventory,
  archives,
};

test('builds and validates a deterministic SPDX inventory', () => {
  const first = buildSpdxDocument(context);
  const second = buildSpdxDocument(context);

  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.doesNotThrow(() => validateSpdxDocument(first, context));
  assert.equal(first.spdxVersion, 'SPDX-2.3');
  assert.equal(first.packages.length, 3);
  assert.equal(first.files.length, 2);
  assert.equal(first.relationships.length, 2);
  assert.equal(
    first.packages.find((pkg) => pkg.name === 'fixture_core').licenseDeclared,
    'MIT OR Apache-2.0',
  );
  assert.equal(
    first.packages.find((pkg) => pkg.name === 'fixture-dependency').licenseDeclared,
    'NOASSERTION',
  );
});

test('rejects an SPDX document missing a locked package', () => {
  const document = buildSpdxDocument(context);
  document.packages = document.packages.filter((pkg) => pkg.name !== 'fixture_core');

  assert.throws(
    () => validateSpdxDocument(document, context),
    /missing package/i,
  );
});

test('rejects an SPDX document missing a package relationship', () => {
  const document = buildSpdxDocument(context);
  document.relationships.pop();

  assert.throws(
    () => validateSpdxDocument(document, context),
    /missing dependency relationship/i,
  );
});

test('rejects an SPDX document with an archive checksum mismatch', () => {
  const document = buildSpdxDocument(context);
  document.files[0].checksums[0].checksumValue = '0'.repeat(40);

  assert.throws(
    () => validateSpdxDocument(document, context),
    /checksum mismatch/i,
  );
});

test('normalizes every real Cargo and npm license into an SPDX expression', () => {
  const cargoMetadata = JSON.parse(execFileSync(
    'cargo',
    ['metadata', '--locked', '--format-version', '1'],
    { encoding: 'utf8' },
  ));
  const packageLock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  const realContext = {
    ...context,
    inventory: inventoryFromMetadata(cargoMetadata, packageLock),
  };
  const document = buildSpdxDocument(realContext);
  assert.doesNotThrow(() => validateSpdxDocument(document, realContext));

  const id = '[A-Za-z0-9][A-Za-z0-9.-]*';
  const atom = `(?:${id}(?:\\s+WITH\\s+${id})?)`;
  const group = `(?:${atom}|\\(${atom}(?:\\s+(?:AND|OR)\\s+${atom})+\\))`;
  const expression = new RegExp(`^${group}(?:\\s+(?:AND|OR)\\s+${group})*$`);
  for (const pkg of document.packages) {
    for (const field of ['licenseDeclared', 'licenseConcluded']) {
      const value = pkg[field];
      assert.ok(
        value === 'NOASSERTION' || expression.test(value),
        `${pkg.name} has an invalid SPDX expression: ${value}`,
      );
      assert.equal(value.includes('/'), false, `${pkg.name} retains a slash license joiner`);
    }
  }
  assert.ok(document.packages.some((pkg) => pkg.licenseDeclared === 'Apache-2.0 OR MIT'));
  assert.ok(document.packages.some((pkg) => pkg.licenseDeclared === 'MIT OR Apache-2.0'));
  assert.ok(document.packages.some((pkg) => pkg.licenseDeclared === 'Unlicense OR MIT'));
});
