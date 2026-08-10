import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatAlgorithm,
  formatFingerprint,
  formatGeneralName,
  formatJson,
  formatUtcDate,
} from '../../web/format.mjs';
import { createTranslator } from '../../web/i18n.mjs';

test('fingerprints are uppercase colon-separated for display without changing JSON', () => {
  const result = { fingerprints: { sha256: 'aabb00ff' } };

  assert.equal(formatFingerprint(result.fingerprints.sha256), 'AA:BB:00:FF');
  assert.equal(result.fingerprints.sha256, 'aabb00ff');
  assert.equal(formatFingerprint('not-hex'), 'not-hex');
  assert.equal(formatFingerprint(null), '-');
});

test('Unix timestamps render as exact ISO UTC values independent of local timezone', () => {
  assert.equal(formatUtcDate(0), '1970-01-01T00:00:00.000Z');
  assert.equal(formatUtcDate(1_786_339_310), '2026-08-10T05:21:50.000Z');
  assert.equal(formatUtcDate('unknown'), 'unknown');
  assert.equal(formatUtcDate(null), '-');
});

test('general names use localized type labels and preserve unknown kinds and values', () => {
  const en = createTranslator('en');
  const zhCN = createTranslator('zh-CN');

  assert.equal(
    formatGeneralName({ kind: 'dns', value: 'example.test' }, en),
    'DNS name: example.test',
  );
  assert.equal(
    formatGeneralName({ kind: 'ip', value: '192.0.2.1' }, zhCN),
    'IP 地址：192.0.2.1',
  );
  assert.equal(
    formatGeneralName({ kind: 'registered_id', value: '1.2.3.999' }, en),
    'Registered ID: 1.2.3.999',
  );
  assert.equal(
    formatGeneralName({ kind: 'future_name', value: '1.2.3.999' }, en),
    'future_name: 1.2.3.999',
  );
});

test('algorithms include display names and always retain their OIDs', () => {
  assert.equal(
    formatAlgorithm({ display_name: 'rsaEncryption', oid: '1.2.840.113549.1.1.1' }),
    'rsaEncryption (1.2.840.113549.1.1.1)',
  );
  assert.equal(
    formatAlgorithm({ display_name: null, oid: '1.2.3.999' }),
    '1.2.3.999',
  );
  assert.equal(formatAlgorithm({ display_name: 'Future Algorithm' }), 'Future Algorithm');
  assert.equal(formatAlgorithm(null), '-');
});

test('all date states have precise labels instead of trust claims', () => {
  const en = createTranslator('en');
  const zhCN = createTranslator('zh-CN');

  assert.deepEqual(
    ['not_yet_valid', 'within_stated_dates', 'expired'].map((value) => en(`status.${value}`)),
    ['Before stated dates', 'Within stated dates', 'After stated dates'],
  );
  assert.deepEqual(
    ['not_yet_valid', 'within_stated_dates', 'expired'].map((value) => zhCN(`status.${value}`)),
    ['早于证书声明日期', '在证书声明日期范围内', '晚于证书声明日期'],
  );
});

test('pretty JSON preserves stable property names and snake_case values', () => {
  const result = {
    input_format: 'pem_bundle',
    certificates: [{ date_status: 'within_stated_dates', is_self_issued: true }],
  };
  const formatted = formatJson(result);

  assert.equal(formatted, JSON.stringify(result, null, 2));
  assert.match(formatted, /"input_format": "pem_bundle"/);
  assert.match(formatted, /"date_status": "within_stated_dates"/);
  assert.doesNotMatch(formatted, /Within stated dates/);
});
