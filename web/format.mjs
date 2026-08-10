const GENERAL_NAME_KINDS = new Set([
  'other_name',
  'email',
  'dns',
  'x400_address',
  'directory_name',
  'edi_party_name',
  'uri',
  'ip',
  'registered_id',
  'invalid',
]);

export function formatFingerprint(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value !== 'string' || !/^(?:[0-9a-fA-F]{2})+$/.test(value)) {
    return String(value);
  }
  return value.toUpperCase().match(/.{2}/g).join(':');
}

export function formatUtcDate(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value !== 'number' || !Number.isFinite(value)) return String(value);

  const date = new Date(value * 1_000);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

export function formatGeneralName(entry, t) {
  if (!entry || typeof entry !== 'object') return '-';

  const kind = typeof entry.kind === 'string' && entry.kind ? entry.kind : t('values.unknown');
  const label = GENERAL_NAME_KINDS.has(kind) ? t(`general_names.${kind}`) : kind;
  const value = entry.value === null || entry.value === undefined || entry.value === ''
    ? t('values.none')
    : String(entry.value);
  return `${label}${t('punctuation.label_separator')}${value}`;
}

export function formatAlgorithm(algorithm) {
  if (!algorithm || typeof algorithm !== 'object') return '-';

  const name = typeof algorithm.display_name === 'string' ? algorithm.display_name : '';
  const oid = typeof algorithm.oid === 'string' ? algorithm.oid : '';
  if (name && oid) return `${name} (${oid})`;
  return name || oid || '-';
}

export function formatJson(value) {
  try {
    return JSON.stringify(value, null, 2) ?? '-';
  } catch {
    return String(value ?? '-');
  }
}
