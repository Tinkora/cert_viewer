import { formatJson } from './format.mjs';
import { createTranslator, normalizeLanguage } from './i18n.mjs';
import {
  clearElement,
  renderEmpty,
  renderError,
  renderInspection,
} from './render.mjs';
import { sampleCertificatePem } from './sample.mjs';

const state = {
  inputBytes: null,
  result: null,
  language: normalizeLanguage(new URL(location.href).searchParams.get('lang')),
  input: {
    source: 'none',
    fileName: null,
    reading: false,
  },
  view: {
    kind: 'empty',
    error: null,
  },
  status: {
    key: 'states.empty',
    replacements: {},
    kind: '',
  },
  revision: 0,
};

const elements = {
  input: document.querySelector('#certificate-input'),
  fileInput: document.querySelector('#file-input'),
  fileStatus: document.querySelector('#file-status'),
  dropZone: document.querySelector('#drop-zone'),
  inspect: document.querySelector('#inspect'),
  clear: document.querySelector('#clear'),
  loadSample: document.querySelector('#load-sample'),
  status: document.querySelector('#status'),
  results: document.querySelector('#results'),
};

for (const [element, testId] of [
  [elements.input, 'certificate-input'],
  [elements.fileInput, 'file-input'],
  [elements.dropZone, 'drop-zone'],
  [elements.inspect, 'inspect'],
  [elements.clear, 'clear'],
  [elements.loadSample, 'load-sample'],
  [elements.results, 'result'],
]) {
  element.dataset.testid = testId;
}

const encoder = new TextEncoder();
let t = createTranslator(state.language);
let wasmReady = false;
let inspectBundleWasm = null;

function iconFor(name) {
  const icon = document.createElement('img');
  icon.className = 'icon';
  icon.src = `./icons/${name}.svg`;
  icon.alt = '';
  return icon;
}

function applyTranslations() {
  t = createTranslator(state.language);
  document.documentElement.lang = state.language;
  document.title = t('app.title');

  for (const element of document.querySelectorAll('[data-i18n]')) {
    element.textContent = t(element.dataset.i18n);
  }
  for (const element of document.querySelectorAll('[data-i18n-placeholder]')) {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  }
  for (const element of document.querySelectorAll('[data-i18n-aria-label]')) {
    element.setAttribute('aria-label', t(element.dataset.i18nAriaLabel));
  }
  for (const button of document.querySelectorAll('[data-language]')) {
    button.setAttribute('aria-pressed', String(button.dataset.language === state.language));
  }
}

function setStatusState(key, replacements = {}, kind = '') {
  state.status = { key, replacements, kind };
}

function renderFileStatus() {
  if (state.input.reading && state.input.fileName) {
    elements.fileStatus.textContent = t('file.reading', { name: state.input.fileName });
  } else if (state.input.source === 'file' && state.input.fileName) {
    elements.fileStatus.textContent = t('file.selected', { name: state.input.fileName });
  } else {
    elements.fileStatus.textContent = t('file.none');
  }
}

function renderStatus() {
  elements.status.textContent = t(state.status.key, state.status.replacements);
  elements.status.classList.toggle('is-error', state.status.kind === 'error');
  elements.status.classList.toggle('is-success', state.status.kind === 'success');
}

function updateInspectButton() {
  elements.inspect.disabled = !wasmReady
    || state.view.kind === 'fatal'
    || state.view.kind === 'loading'
    || state.input.reading
    || !state.inputBytes?.length;
}

function decorateResultControls() {
  const success = elements.results.querySelector('.success-state');
  if (success) success.prepend(iconFor('circle-check'));

  for (const button of elements.results.querySelectorAll('button[data-copy-field]')) {
    const iconName = button.dataset.copyField === 'json' ? 'braces' : 'copy';
    if (button.dataset.copyField === 'json') button.dataset.testid = 'copy-json';
    button.prepend(iconFor(iconName));
  }

  const jsonOutput = elements.results.querySelector('.json-output');
  if (jsonOutput) jsonOutput.dataset.testid = 'json-output';
}

function renderCurrentView() {
  switch (state.view.kind) {
    case 'result':
      renderInspection(elements.results, state.result, t);
      decorateResultControls();
      break;
    case 'error':
    case 'fatal':
      renderError(elements.results, state.view.error, t);
      break;
    case 'loading':
      clearElement(elements.results);
      break;
    default:
      renderEmpty(elements.results, t);
  }
}

function renderDynamicState() {
  renderFileStatus();
  renderCurrentView();
  renderStatus();
  updateInspectButton();
}

function resetNonFatalView(statusKey = 'states.empty', replacements = {}) {
  state.result = null;
  if (state.view.kind === 'fatal') return;
  state.view = { kind: 'empty', error: null };
  setStatusState(statusKey, replacements);
}

function updateLanguage(language) {
  state.language = normalizeLanguage(language);
  const url = new URL(location.href);
  if (state.language === 'zh-CN') {
    url.searchParams.set('lang', 'zh-CN');
  } else {
    url.searchParams.delete('lang');
  }
  history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  applyTranslations();
  renderDynamicState();
}

function setTextInput(value, source) {
  state.revision += 1;
  elements.input.value = value;
  elements.fileInput.value = '';
  state.inputBytes = encoder.encode(value);
  state.input = { source, fileName: null, reading: false };
  resetNonFatalView();
  renderDynamicState();
}

async function selectFile(file) {
  if (!file) return;

  const revision = ++state.revision;
  elements.input.value = '';
  state.inputBytes = null;
  state.result = null;
  state.input = { source: 'file', fileName: file.name, reading: true };
  resetNonFatalView('file.reading', { name: file.name });
  renderDynamicState();

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (revision !== state.revision) return;

    state.inputBytes = bytes;
    state.input = { source: 'file', fileName: file.name, reading: false };
    resetNonFatalView('file.selected', { name: file.name });
  } catch (error) {
    if (revision !== state.revision) return;

    const structuredError = normalizeError(error, 'file_read_failed');
    state.inputBytes = null;
    state.result = null;
    state.input = { source: 'file', fileName: file.name, reading: false };
    if (state.view.kind !== 'fatal') {
      state.view = { kind: 'error', error: structuredError };
      setStatusState('errors.title', {}, 'error');
    }
  }
  renderDynamicState();
}

function clearWorkspace() {
  state.revision += 1;
  elements.input.value = '';
  elements.fileInput.value = '';
  elements.dropZone.classList.remove('is-dragging');
  state.inputBytes = null;
  state.result = null;
  state.input = { source: 'none', fileName: null, reading: false };
  resetNonFatalView();
  renderDynamicState();
}

function normalizeError(error, fallbackCode = 'unknown') {
  const code = typeof error?.code === 'string' && error.code ? error.code : fallbackCode;
  const message = typeof error?.message === 'string' ? error.message : String(error ?? '');
  const structuredError = { code, message };
  if (error?.certificate_index !== null && error?.certificate_index !== undefined) {
    structuredError.certificate_index = error.certificate_index;
  }
  return structuredError;
}

async function inspectInput() {
  if (
    !wasmReady
    || typeof inspectBundleWasm !== 'function'
    || state.view.kind === 'loading'
    || !state.inputBytes?.length
  ) return;

  const revision = state.revision;
  const inputBytes = state.inputBytes;
  state.result = null;
  state.view = { kind: 'loading', error: null };
  setStatusState('states.loading');
  renderDynamicState();
  await new Promise((resolve) => requestAnimationFrame(resolve));
  if (revision !== state.revision || state.view.kind === 'fatal') return;

  try {
    state.result = inspectBundleWasm(inputBytes, Math.trunc(Date.now() / 1000));
    state.view = { kind: 'result', error: null };
    setStatusState('states.success', { count: state.result.certificates.length }, 'success');
  } catch (error) {
    const structuredError = normalizeError(error);
    state.result = null;
    state.view = { kind: 'error', error: structuredError };
    setStatusState('errors.title', {}, 'error');
  }
  renderDynamicState();
}

function copyValue(button) {
  const field = button.dataset.copyField;
  if (!state.result || !field) return null;
  if (field === 'json') return formatJson(state.result);

  const article = button.closest('[data-certificate-position]');
  const position = Number(article?.dataset.certificatePosition);
  if (!Number.isInteger(position)) return null;
  return state.result.certificates?.[position]?.fingerprints?.[field] ?? null;
}

function copyActionKey(field) {
  return field === 'json' ? 'actions.copy_json' : `actions.copy_${field}`;
}

function showCopyFeedback(button, statusKey, iconName) {
  const label = `${t(copyActionKey(button.dataset.copyField))} · ${t(statusKey)}`;
  button.replaceChildren(iconFor(iconName), document.createTextNode(label));
}

async function handleCopy(button) {
  const value = copyValue(button);
  if (typeof value !== 'string') return;

  try {
    await navigator.clipboard.writeText(value);
    button.classList.add('is-copied');
    button.dataset.copyState = 'copied';
    showCopyFeedback(button, 'copy.copied', 'circle-check');
  } catch {
    button.classList.remove('is-copied');
    button.dataset.copyState = 'failed';
    showCopyFeedback(button, 'copy.failed', 'copy');
  }
}

function containsFiles(event) {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

elements.input.addEventListener('input', () => {
  state.revision += 1;
  state.inputBytes = encoder.encode(elements.input.value);
  state.input = {
    source: elements.input.value ? 'text' : 'none',
    fileName: null,
    reading: false,
  };
  elements.fileInput.value = '';
  resetNonFatalView();
  renderDynamicState();
});

elements.fileInput.addEventListener('change', () => {
  void selectFile(elements.fileInput.files?.[0]);
});
elements.loadSample.addEventListener('click', () => setTextInput(sampleCertificatePem, 'sample'));
elements.inspect.addEventListener('click', () => void inspectInput());
elements.clear.addEventListener('click', clearWorkspace);

for (const button of document.querySelectorAll('[data-language]')) {
  button.addEventListener('click', () => updateLanguage(button.dataset.language));
}

elements.dropZone.addEventListener('dragover', (event) => {
  if (!containsFiles(event)) return;
  event.preventDefault();
  elements.dropZone.classList.add('is-dragging');
});
elements.dropZone.addEventListener('dragleave', () => {
  elements.dropZone.classList.remove('is-dragging');
});
elements.dropZone.addEventListener('drop', (event) => {
  if (!containsFiles(event)) return;
  event.preventDefault();
  elements.dropZone.classList.remove('is-dragging');
  elements.fileInput.value = '';
  void selectFile(event.dataTransfer?.files?.[0]);
});

for (const eventName of ['dragover', 'drop']) {
  document.addEventListener(eventName, (event) => {
    if (containsFiles(event)) event.preventDefault();
  });
}

elements.results.addEventListener('click', (event) => {
  const button = event.target instanceof Element
    ? event.target.closest('button[data-copy-field]')
    : null;
  if (button) void handleCopy(button);
});

async function bootWasm() {
  try {
    const wasm = await import('./pkg/cert_viewer_web.js');
    await wasm.default();
    if (typeof wasm.inspectBundle !== 'function') {
      throw new TypeError('WASM module does not export inspectBundle.');
    }
    inspectBundleWasm = wasm.inspectBundle;
    wasmReady = true;
  } catch (error) {
    const structuredError = normalizeError(error, 'wasm_initialization_failed');
    inspectBundleWasm = null;
    wasmReady = false;
    state.result = null;
    state.view = { kind: 'fatal', error: structuredError };
    setStatusState('errors.codes.wasm_initialization_failed', {}, 'error');
  }
  renderDynamicState();
}

applyTranslations();
renderDynamicState();
await bootWasm();
