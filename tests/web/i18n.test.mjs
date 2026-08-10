import assert from 'node:assert/strict';
import test from 'node:test';

import { createTranslator, messages, normalizeLanguage } from '../../web/i18n.mjs';

function flatKeys(value, prefix = '') {
  return Object.entries(value)
    .flatMap(([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return child && typeof child === 'object'
        ? flatKeys(child, path)
        : [path];
    })
    .sort();
}

function assertDeeplyFrozen(value) {
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object') assertDeeplyFrozen(child);
  }
}

test('English and Simplified Chinese expose identical keys', () => {
  assert.deepEqual(flatKeys(messages.en), flatKeys(messages.zhCN));
});

test('translations cover every visible workbench and result concept', () => {
  const requiredKeys = [
    'app.title',
    'headings.input', 'headings.results', 'headings.certificate',
    'headings.identity', 'headings.validity', 'headings.alternative_names',
    'headings.usages', 'headings.constraints', 'headings.cryptography',
    'headings.fingerprints',
    'actions.inspect', 'actions.clear', 'actions.choose_file',
    'actions.load_sample', 'actions.copy_sha256', 'actions.copy_sha1',
    'actions.copy_json',
    'inputs.certificate.label', 'inputs.certificate.placeholder',
    'inputs.certificate.hint',
    'file.none', 'file.selected', 'file.reading',
    'states.empty', 'states.loading', 'states.success',
    'errors.title', 'errors.code', 'errors.certificate_index', 'errors.detail',
    'errors.unknown',
    'errors.codes.invalid_input_type', 'errors.codes.invalid_current_time',
    'errors.codes.input_empty', 'errors.codes.input_too_large',
    'errors.codes.invalid_pem_utf8', 'errors.codes.invalid_pem',
    'errors.codes.non_certificate_pem_block',
    'errors.codes.too_many_certificates', 'errors.codes.invalid_der',
    'errors.codes.trailing_der_data',
    'errors.codes.unsupported_certificate_version',
    'fields.schema_version', 'fields.input_format', 'fields.input_index',
    'fields.version', 'fields.serial_number', 'fields.subject', 'fields.issuer',
    'fields.common_name', 'fields.organization', 'fields.organizational_unit',
    'fields.country', 'fields.state', 'fields.locality', 'fields.entries',
    'fields.oid', 'fields.value', 'fields.value_format',
    'fields.not_before_unix', 'fields.not_after_unix', 'fields.date_status',
    'fields.subject_alt_names', 'fields.key_usage',
    'fields.extended_key_usage', 'fields.basic_constraints', 'fields.is_ca',
    'fields.path_length_constraint', 'fields.extensions', 'fields.critical',
    'fields.decoded', 'fields.public_key', 'fields.algorithm',
    'fields.size_bits', 'fields.signature_algorithm', 'fields.fingerprints',
    'fields.sha256', 'fields.sha1', 'fields.is_self_issued',
    'disclosures.subject_entries', 'disclosures.issuer_entries',
    'disclosures.extensions', 'disclosures.json',
    'copy.copy', 'copy.copied', 'copy.failed',
    'notes.sha1_legacy', 'notes.local_processing',
    'capabilities.human_usable', 'capabilities.machine_readable',
    'capabilities.agent_schema_draft', 'capabilities.not_agent_callable',
    'input_support.pem', 'input_support.der', 'input_support.bundles',
    'input_support.local_only',
    'language.control_label', 'language.english',
    'language.simplified_chinese',
    'status.not_yet_valid', 'status.within_stated_dates', 'status.expired',
    'general_names.other_name', 'general_names.email', 'general_names.dns',
    'general_names.x400_address', 'general_names.directory_name',
    'general_names.edi_party_name', 'general_names.uri', 'general_names.ip',
    'general_names.registered_id', 'general_names.invalid',
    'input_formats.pem_bundle', 'input_formats.der',
    'name_value_formats.text', 'name_value_formats.hex',
    'values.yes', 'values.no', 'values.none', 'values.unknown', 'values.bits',
  ];

  const keys = new Set(flatKeys(messages.en));
  for (const key of requiredKeys) assert.equal(keys.has(key), true, key);
});

test('capability and language labels match the approved product semantics', () => {
  assert.deepEqual(messages.en.capabilities, {
    human_usable: 'Human-usable',
    machine_readable: 'Machine-readable',
    agent_schema_draft: 'Agent schema draft',
    not_agent_callable: 'Not Agent-callable',
  });
  assert.deepEqual(messages.zhCN.capabilities, {
    human_usable: '人类可用',
    machine_readable: '机器可读',
    agent_schema_draft: 'Agent Schema 草案',
    not_agent_callable: '不可由 Agent 调用',
  });
  assert.deepEqual(messages.en.language, {
    control_label: 'Language',
    english: 'English',
    simplified_chinese: 'Simplified Chinese',
  });
  assert.deepEqual(messages.zhCN.language, {
    control_label: '语言',
    english: 'English',
    simplified_chinese: '简体中文',
  });
});

test('date status labels do not collapse inspection into validity', () => {
  assert.equal(messages.en.status.within_stated_dates, 'Within stated dates');
  assert.equal(messages.zhCN.status.within_stated_dates, '在证书声明日期范围内');
  assert.equal(messages.en.fields.is_self_issued, 'Subject matches issuer');
  assert.equal('valid' in messages.en.status, false);
  assert.equal('self_signed' in messages.en.fields, false);
});

test('language selection is exact and defaults to English', () => {
  assert.equal(normalizeLanguage('en'), 'en');
  assert.equal(normalizeLanguage('zh-CN'), 'zh-CN');
  assert.equal(normalizeLanguage('zh-cn'), 'en');
  assert.equal(normalizeLanguage('en-US'), 'en');
  assert.equal(normalizeLanguage(undefined), 'en');
});

test('translator resolves dotted keys, interpolates named values, and falls back safely', () => {
  const en = createTranslator('en');
  const zhCN = createTranslator('zh-CN');

  assert.equal(en('file.selected', { name: 'leaf.pem' }), 'Selected: leaf.pem');
  assert.equal(zhCN('file.selected', { name: 'leaf.pem' }), '已选择：leaf.pem');
  assert.equal(createTranslator('fr')('actions.inspect'), 'Inspect');
  assert.equal(en('missing.translation.key'), 'missing.translation.key');
});

test('message dictionaries are deeply immutable', () => {
  assertDeeplyFrozen(messages);
  assert.throws(() => {
    messages.en.actions.inspect = 'Changed';
  }, TypeError);
});
