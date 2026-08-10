import assert from 'node:assert/strict';
import test from 'node:test';

import { parseHTML } from 'linkedom';

import { createTranslator } from '../../web/i18n.mjs';
import {
  clearElement,
  renderEmpty,
  renderError,
  renderInspection,
} from '../../web/render.mjs';

const maliciousResult = {
  schema_version: 1,
  input_format: 'pem_bundle',
  certificates: [
    {
      input_index: 0,
      version: 3,
      serial_number: '00ff',
      subject: {
        common_name: '<img src=x onerror=alert(1)>',
        organization: 'Example Org',
        organizational_unit: null,
        country: 'CN',
        state: 'Shanghai',
        locality: 'Shanghai',
        entries: [
          { oid: '2.5.4.3', value: '<img src=x onerror=alert(1)>', value_format: 'text' },
        ],
      },
      issuer: {
        common_name: 'Example Issuer',
        organization: 'Example Org',
        organizational_unit: 'Certificate Services',
        country: 'CN',
        state: null,
        locality: null,
        entries: [
          { oid: '2.5.4.3', value: 'Example Issuer', value_format: 'text' },
        ],
      },
      not_before_unix: 0,
      not_after_unix: 1_786_339_310,
      date_status: 'within_stated_dates',
      subject_alt_names: [
        { kind: 'dns', value: 'example.test' },
        { kind: 'registered_id', value: '1.2.3.999' },
      ],
      key_usage: ['digital_signature', 'key_encipherment'],
      extended_key_usage: ['server_auth', '1.2.3.4.6'],
      basic_constraints: { is_ca: false, path_length_constraint: null },
      extensions: [
        { oid: '2.5.29.19', critical: true, decoded: true },
        { oid: '1.2.3.999', critical: false, decoded: false },
      ],
      public_key: {
        algorithm: { oid: '1.2.840.113549.1.1.1', display_name: 'rsaEncryption' },
        size_bits: 2048,
      },
      signature_algorithm: {
        oid: '1.2.840.113549.1.1.11',
        display_name: 'sha256WithRSAEncryption',
      },
      fingerprints: {
        sha256: 'aabb00ff',
        sha1: '11223344',
      },
      is_self_issued: false,
    },
  ],
};

test('renderEmpty clears prior output and shows the localized empty state', () => {
  const { document } = parseHTML('<main id="results"><p>old</p></main>');
  const container = document.querySelector('#results');

  renderEmpty(container, createTranslator('zh-CN'));

  assert.doesNotMatch(container.textContent, /old/);
  assert.match(container.textContent, /尚未检查证书/);
});

test('renderError announces a localized structured error and keeps stable details', () => {
  const { document } = parseHTML('<main id="results"></main>');
  const container = document.querySelector('#results');

  renderError(container, {
    code: 'invalid_der',
    message: '<broken DER>',
    certificate_index: 2,
  }, createTranslator('zh-CN'));

  const alert = container.querySelector('[role="alert"]');
  assert.ok(alert);
  assert.match(alert.textContent, /DER 数据无效/);
  assert.match(alert.textContent, /invalid_der/);
  assert.match(alert.textContent, /<broken DER>/);
  assert.equal(container.querySelectorAll('broken').length, 0);
  const indexRow = [...alert.querySelectorAll('.field-row')]
    .find((row) => row.querySelector('dt')?.textContent === '证书索引');
  assert.equal(indexRow?.querySelector('dd')?.textContent, '2');
});

test('renderError falls back for unknown error codes without losing the code', () => {
  const { document } = parseHTML('<main id="results"></main>');
  const container = document.querySelector('#results');

  renderError(container, { code: 'future_error', message: '' }, createTranslator('en'));

  assert.match(container.textContent, /Unknown inspection error/);
  assert.match(container.textContent, /future_error/);
});

test('renderInspection treats certificate values as text and never injects DOM', () => {
  const { document } = parseHTML('<main id="results"></main>');
  const t = createTranslator('en');

  renderInspection(document.querySelector('#results'), maliciousResult, t);

  assert.equal(document.querySelectorAll('img').length, 0);
  assert.match(document.querySelector('#results').textContent, /<img src=x/);
  assert.equal(document.querySelectorAll('[onclick]').length, 0);
});

test('inspection output is scan-friendly, complete, and uses native disclosures', () => {
  const { document } = parseHTML('<main id="results"></main>');
  const container = document.querySelector('#results');

  renderInspection(container, maliciousResult, createTranslator('en'));

  const articles = container.querySelectorAll('article.certificate-card.card');
  assert.equal(articles.length, 1);
  assert.ok(container.querySelectorAll('details > summary').length >= 4);
  assert.equal(articles[0].querySelectorAll('section.card').length, 0);
  assert.ok(articles[0].querySelectorAll('section.field-group').length >= 6);
  assert.equal(container.querySelectorAll('button[onclick]').length, 0);

  const text = container.textContent;
  for (const expected of [
    'Schema version', 'PEM bundle', 'Input index', 'Serial number',
    'Subject matches issuer', 'Common name', 'Organization',
    'Organizational unit', 'Country', 'State', 'Locality', '2.5.4.3', 'text',
    '1970-01-01T00:00:00.000Z', 'Within stated dates',
    'DNS name: example.test', 'Registered ID: 1.2.3.999',
    'digital_signature', 'server_auth', '1.2.3.4.6',
    'Certificate authority', 'Path length constraint',
    '2.5.29.19', 'Critical', 'Decoded', '1.2.3.999',
    'rsaEncryption (1.2.840.113549.1.1.1)', '2048 bits',
    'sha256WithRSAEncryption (1.2.840.113549.1.1.11)',
    'AA:BB:00:FF', '11:22:33:44', 'SHA-1 is a legacy algorithm',
    'Complete JSON', '"date_status": "within_stated_dates"',
  ]) assert.match(text, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('the scrollable JSON output is keyboard focusable', () => {
  const { document } = parseHTML('<main id="results"></main>');

  renderInspection(document.querySelector('#results'), maliciousResult, createTranslator('en'));

  const output = document.querySelector('pre.json-output');
  assert.ok(output);
  assert.equal(output.getAttribute('tabindex'), '0');
});

test('repeated rendering removes nodes from the previous result', () => {
  const { document } = parseHTML('<main id="results"></main>');
  const container = document.querySelector('#results');
  const t = createTranslator('en');

  renderInspection(container, maliciousResult, t);
  const marker = document.createElement('span');
  marker.id = 'stale-marker';
  container.appendChild(marker);

  renderInspection(container, {
    ...maliciousResult,
    certificates: [{
      ...maliciousResult.certificates[0],
      serial_number: 'new-serial',
    }],
  }, t);

  assert.equal(container.querySelector('#stale-marker'), null);
  assert.equal(container.querySelectorAll('article.certificate-card').length, 1);
  assert.match(container.textContent, /new-serial/);
});

test('clearElement removes every child node', () => {
  const { document } = parseHTML('<div id="target">text<span>child</span></div>');
  const target = document.querySelector('#target');

  clearElement(target);

  assert.equal(target.childNodes.length, 0);
});
