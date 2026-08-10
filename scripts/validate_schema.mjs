import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import Ajv2020 from 'ajv/dist/2020.js';

const schemaUrl = new URL(
  '../docs/schema/inspection-result-v1.schema.json',
  import.meta.url,
);
const exampleUrl = new URL(
  '../docs/schema/inspection-result-v1.example.json',
  import.meta.url,
);

async function readJson(url) {
  return JSON.parse(await readFile(url, 'utf8'));
}

const [schema, example] = await Promise.all([
  readJson(schemaUrl),
  readJson(exampleUrl),
]);
const ajv = new Ajv2020({ allErrors: true });
const validate = ajv.compile(schema);

if (!validate(example)) {
  console.error('The committed inspection result example is invalid:');
  console.error(JSON.stringify(validate.errors, null, 2));
  process.exit(1);
}

assert.equal(example.schema_version, 1);
assert.ok(!JSON.stringify(example).includes('is_self_signed'));
assert.ok(!JSON.stringify(example).includes('chain'));

const unknownTopLevel = structuredClone(example);
unknownTopLevel.unknown_property = true;
assert.equal(
  validate(unknownTopLevel),
  false,
  'the schema must reject unknown top-level properties',
);

const unknownCertificate = structuredClone(example);
unknownCertificate.certificates[0].unknown_property = true;
assert.equal(
  validate(unknownCertificate),
  false,
  'the schema must reject unknown certificate properties',
);

for (const invalidOid of ['3.1', '1.40', '1.02.3']) {
  const invalidOidExample = structuredClone(example);
  invalidOidExample.certificates[0].signature_algorithm.oid = invalidOid;
  assert.equal(
    validate(invalidOidExample),
    false,
    `the schema must reject invalid OID ${invalidOid}`,
  );
}

console.log('Inspection result schema and example are valid.');
