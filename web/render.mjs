import {
  formatAlgorithm,
  formatFingerprint,
  formatGeneralName,
  formatJson,
  formatUtcDate,
} from './format.mjs';

export function clearElement(element) {
  while (element.firstChild) element.removeChild(element.firstChild);
}

function appendHeading(document, parent, level, text) {
  const heading = document.createElement(`h${level}`);
  heading.textContent = text;
  parent.appendChild(heading);
  return heading;
}

function displayValue(value, t) {
  if (value === null || value === undefined || value === '') return t('values.none');
  if (typeof value === 'boolean') return t(value ? 'values.yes' : 'values.no');
  return String(value);
}

function translatedValue(t, prefix, value) {
  if (typeof value !== 'string' || !value) return t('values.unknown');
  const key = `${prefix}.${value}`;
  const translated = t(key);
  return translated === key ? value : translated;
}

function createFieldList(document) {
  const list = document.createElement('dl');
  list.className = 'field-list';
  return list;
}

function appendField(document, list, label, value, valueClass = '') {
  const group = document.createElement('div');
  group.className = 'field-row';

  const term = document.createElement('dt');
  term.className = 'field-label';
  term.textContent = label;

  const description = document.createElement('dd');
  description.className = valueClass ? `field-value ${valueClass}` : 'field-value';
  description.textContent = value;

  group.appendChild(term);
  group.appendChild(description);
  list.appendChild(group);
  return description;
}

function createFieldSection(document, article, heading) {
  const section = document.createElement('section');
  section.className = 'field-group';
  appendHeading(document, section, 4, heading);
  article.appendChild(section);
  return section;
}

function appendName(document, parent, name, kind, t) {
  const heading = document.createElement('h5');
  heading.textContent = t(`fields.${kind}`);
  parent.appendChild(heading);

  const list = createFieldList(document);
  for (const field of [
    'common_name',
    'organization',
    'organizational_unit',
    'country',
    'state',
    'locality',
  ]) {
    appendField(document, list, t(`fields.${field}`), displayValue(name?.[field], t), 'mono-value');
  }
  parent.appendChild(list);

  const details = document.createElement('details');
  details.className = 'field-disclosure';
  const summary = document.createElement('summary');
  summary.textContent = t(`disclosures.${kind}_entries`);
  details.appendChild(summary);

  const entries = Array.isArray(name?.entries) ? name.entries : [];
  if (entries.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = t('values.none');
    details.appendChild(empty);
  } else {
    for (const entry of entries) {
      const entryList = createFieldList(document);
      entryList.classList.add('name-entry');
      appendField(document, entryList, t('fields.oid'), displayValue(entry?.oid, t), 'mono-value');
      appendField(document, entryList, t('fields.value'), displayValue(entry?.value, t), 'mono-value');
      appendField(
        document,
        entryList,
        t('fields.value_format'),
        translatedValue(t, 'name_value_formats', entry?.value_format),
      );
      details.appendChild(entryList);
    }
  }
  parent.appendChild(details);
}

function appendValueList(document, parent, values, t, itemClass) {
  if (!Array.isArray(values) || values.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = t('values.none');
    parent.appendChild(empty);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'value-list';
  for (const value of values) {
    const item = document.createElement('li');
    item.className = itemClass;
    item.textContent = displayValue(value, t);
    list.appendChild(item);
  }
  parent.appendChild(list);
}

function appendFingerprint(document, parent, algorithm, value, t) {
  const row = document.createElement('div');
  row.className = 'fingerprint-row';

  const label = document.createElement('span');
  label.className = 'field-label';
  label.textContent = t(`fields.${algorithm}`);

  const fingerprint = document.createElement('code');
  fingerprint.className = 'field-value mono-value';
  fingerprint.textContent = formatFingerprint(value);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'copy-button';
  button.dataset.copyField = algorithm;
  button.textContent = t(`actions.copy_${algorithm}`);

  row.appendChild(label);
  row.appendChild(fingerprint);
  row.appendChild(button);
  parent.appendChild(row);
}

function appendExtensions(document, parent, extensions, t) {
  const details = document.createElement('details');
  details.className = 'field-disclosure';
  const summary = document.createElement('summary');
  summary.textContent = t('disclosures.extensions');
  details.appendChild(summary);

  if (!Array.isArray(extensions) || extensions.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = t('values.none');
    details.appendChild(empty);
  } else {
    for (const extension of extensions) {
      const list = createFieldList(document);
      list.classList.add('extension-item');
      appendField(document, list, t('fields.oid'), displayValue(extension?.oid, t), 'mono-value');
      appendField(document, list, t('fields.critical'), displayValue(extension?.critical, t));
      appendField(document, list, t('fields.decoded'), displayValue(extension?.decoded, t));
      details.appendChild(list);
    }
  }
  parent.appendChild(details);
}

function appendCertificate(document, container, certificate, position, t) {
  const article = document.createElement('article');
  article.className = 'certificate-card card';
  article.dataset.certificatePosition = String(position);
  appendHeading(document, article, 3, t('headings.certificate', { number: position + 1 }));

  const identity = createFieldSection(document, article, t('headings.identity'));
  const identityFields = createFieldList(document);
  appendField(document, identityFields, t('fields.input_index'), displayValue(certificate?.input_index, t));
  appendField(document, identityFields, t('fields.version'), displayValue(certificate?.version, t));
  appendField(document, identityFields, t('fields.serial_number'), displayValue(certificate?.serial_number, t), 'mono-value');
  appendField(document, identityFields, t('fields.is_self_issued'), displayValue(certificate?.is_self_issued, t));
  identity.appendChild(identityFields);
  appendName(document, identity, certificate?.subject, 'subject', t);
  appendName(document, identity, certificate?.issuer, 'issuer', t);

  const validity = createFieldSection(document, article, t('headings.validity'));
  const validityFields = createFieldList(document);
  appendField(
    document,
    validityFields,
    t('fields.not_before_unix'),
    formatUtcDate(certificate?.not_before_unix),
    'mono-value',
  );
  appendField(
    document,
    validityFields,
    t('fields.not_after_unix'),
    formatUtcDate(certificate?.not_after_unix),
    'mono-value',
  );
  appendField(
    document,
    validityFields,
    t('fields.date_status'),
    translatedValue(t, 'status', certificate?.date_status),
  );
  validity.appendChild(validityFields);

  const names = createFieldSection(document, article, t('headings.alternative_names'));
  appendValueList(
    document,
    names,
    Array.isArray(certificate?.subject_alt_names)
      ? certificate.subject_alt_names.map((entry) => formatGeneralName(entry, t))
      : [],
    t,
    'mono-value',
  );

  const usages = createFieldSection(document, article, t('headings.usages'));
  appendHeading(document, usages, 5, t('fields.key_usage'));
  appendValueList(document, usages, certificate?.key_usage, t, 'mono-value');
  appendHeading(document, usages, 5, t('fields.extended_key_usage'));
  appendValueList(document, usages, certificate?.extended_key_usage, t, 'mono-value');

  const constraints = createFieldSection(document, article, t('headings.constraints'));
  const constraintFields = createFieldList(document);
  const basicConstraints = certificate?.basic_constraints;
  appendField(
    document,
    constraintFields,
    t('fields.basic_constraints'),
    basicConstraints && typeof basicConstraints === 'object' ? t('values.present') : t('values.none'),
  );
  if (basicConstraints && typeof basicConstraints === 'object') {
    appendField(document, constraintFields, t('fields.is_ca'), displayValue(basicConstraints.is_ca, t));
    appendField(
      document,
      constraintFields,
      t('fields.path_length_constraint'),
      displayValue(basicConstraints.path_length_constraint, t),
    );
  }
  constraints.appendChild(constraintFields);
  appendExtensions(document, constraints, certificate?.extensions, t);

  const cryptography = createFieldSection(document, article, t('headings.cryptography'));
  const cryptographyFields = createFieldList(document);
  appendField(
    document,
    cryptographyFields,
    t('fields.public_key'),
    formatAlgorithm(certificate?.public_key?.algorithm),
    'mono-value',
  );
  const size = certificate?.public_key?.size_bits;
  appendField(
    document,
    cryptographyFields,
    t('fields.size_bits'),
    size === null || size === undefined ? t('values.unknown') : t('values.bits', { count: size }),
  );
  appendField(
    document,
    cryptographyFields,
    t('fields.signature_algorithm'),
    formatAlgorithm(certificate?.signature_algorithm),
    'mono-value',
  );
  cryptography.appendChild(cryptographyFields);

  const fingerprints = createFieldSection(document, article, t('headings.fingerprints'));
  appendFingerprint(document, fingerprints, 'sha256', certificate?.fingerprints?.sha256, t);
  appendFingerprint(document, fingerprints, 'sha1', certificate?.fingerprints?.sha1, t);
  const legacyNote = document.createElement('p');
  legacyNote.className = 'field-note';
  legacyNote.textContent = t('notes.sha1_legacy');
  fingerprints.appendChild(legacyNote);

  container.appendChild(article);
}

function appendJsonDisclosure(document, container, result, t) {
  const details = document.createElement('details');
  details.className = 'json-disclosure';
  const summary = document.createElement('summary');
  summary.textContent = t('disclosures.json');

  const copyButton = document.createElement('button');
  copyButton.type = 'button';
  copyButton.className = 'copy-button';
  copyButton.dataset.copyField = 'json';
  copyButton.textContent = t('actions.copy_json');

  const output = document.createElement('pre');
  output.className = 'json-output mono-value';
  output.tabIndex = 0;
  output.textContent = formatJson(result);

  details.appendChild(summary);
  details.appendChild(copyButton);
  details.appendChild(output);
  container.appendChild(details);
}

export function renderEmpty(container, t) {
  clearElement(container);
  const message = container.ownerDocument.createElement('p');
  message.className = 'empty-state';
  message.textContent = t('states.empty');
  container.appendChild(message);
}

export function renderError(container, error, t) {
  clearElement(container);
  const document = container.ownerDocument;
  const panel = document.createElement('section');
  panel.className = 'error-panel';
  panel.setAttribute('role', 'alert');
  appendHeading(document, panel, 2, t('errors.title'));

  const fields = createFieldList(document);
  const code = typeof error?.code === 'string' && error.code ? error.code : 'unknown';
  const errorKey = `errors.codes.${code}`;
  const translatedError = t(errorKey);
  const description = translatedError === errorKey ? t('errors.unknown') : translatedError;
  appendField(document, fields, t('errors.code'), `${description} (${code})`, 'mono-value');
  if (error?.certificate_index !== null && error?.certificate_index !== undefined) {
    appendField(
      document,
      fields,
      t('errors.certificate_index'),
      String(error.certificate_index),
    );
  }
  if (typeof error?.message === 'string' && error.message) {
    appendField(document, fields, t('errors.detail'), error.message, 'mono-value');
  }
  panel.appendChild(fields);
  container.appendChild(panel);
}

export function renderInspection(container, result, t) {
  clearElement(container);
  const document = container.ownerDocument;
  const certificates = Array.isArray(result?.certificates) ? result.certificates : [];
  if (certificates.length === 0) {
    renderEmpty(container, t);
    return;
  }

  appendHeading(document, container, 2, t('headings.results'));
  const success = document.createElement('p');
  success.className = 'success-state';
  success.textContent = t('states.success', { count: certificates.length });
  container.appendChild(success);

  const resultFields = createFieldList(document);
  resultFields.classList.add('result-metadata');
  appendField(document, resultFields, t('fields.schema_version'), displayValue(result?.schema_version, t));
  appendField(
    document,
    resultFields,
    t('fields.input_format'),
    translatedValue(t, 'input_formats', result?.input_format),
  );
  container.appendChild(resultFields);

  certificates.forEach((certificate, position) => {
    appendCertificate(document, container, certificate, position, t);
  });
  appendJsonDisclosure(document, container, result, t);
}
