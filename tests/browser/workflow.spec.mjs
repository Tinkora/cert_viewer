import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function fixturePath(name) {
  return fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
}

function fixtureText(name) {
  return readFileSync(fixturePath(name), 'utf8');
}

function fixtureChecksum(name) {
  return fixtureText(name).trim().split(/\s+/u)[0];
}

const rsaFixturePath = fixturePath('rsa-leaf.pem');
const rsaDerFixturePath = fixturePath('rsa-leaf.der');
const rsaPem = fixtureText('rsa-leaf.pem');
const ecPem = fixtureText('ec-ca.pem');
const bundlePem = fixtureText('bundle.pem');
const rsaSha256 = fixtureChecksum('rsa-leaf.der.sha256');
const ecSha256 = fixtureChecksum('ec-ca.der.sha256');
const malformedPem = `-----BEGIN CERTIFICATE-----
not-base64
-----END CERTIFICATE-----`;

async function inspectText(page, text) {
  await page.getByTestId('certificate-input').fill(text);
  await page.getByTestId('inspect').click();
}

async function inspectionJson(page, language = 'en') {
  const disclosureName = language === 'zh-CN' ? '完整 JSON' : 'Complete JSON';
  await page.getByText(disclosureName, { exact: true }).click();
  const output = page.getByTestId('json-output');
  await expect(output).toBeVisible();
  return JSON.parse(await output.textContent());
}

async function expectInspectionEvidence(page, expectedCertificates) {
  const result = await inspectionJson(page);
  expect(result.schema_version).toBe(1);
  expect(result.certificates).toHaveLength(expectedCertificates.length);
  expect(result.certificates.map((certificate) => ({
    inputIndex: certificate.input_index,
    commonName: certificate.subject.common_name,
    sha256: certificate.fingerprints.sha256,
  }))).toEqual(expectedCertificates);
}

test('loads and inspects the bundled certificate sample @wasm-smoke', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'Tinkora Cert Viewer' })).toBeVisible();

  await page.getByRole('button', { name: 'Load sample' }).click();
  await page.getByRole('button', { name: 'Inspect' }).click();

  await expect(page.getByText('rsa.fixture.tinkora.test', { exact: true }).first()).toBeVisible();
  await expectInspectionEvidence(page, [{
    inputIndex: 0,
    commonName: 'rsa.fixture.tinkora.test',
    sha256: rsaSha256,
  }]);
});

test('pasted PEM and multi-certificate bundles preserve fixture evidence and input order', async ({ page }) => {
  await page.goto('/');

  await inspectText(page, rsaPem);
  await expectInspectionEvidence(page, [{
    inputIndex: 0,
    commonName: 'rsa.fixture.tinkora.test',
    sha256: rsaSha256,
  }]);

  await inspectText(page, bundlePem);
  await expectInspectionEvidence(page, [
    { inputIndex: 0, commonName: 'rsa.fixture.tinkora.test', sha256: rsaSha256 },
    { inputIndex: 1, commonName: 'ec-ca.fixture.tinkora.test', sha256: ecSha256 },
  ]);
});

test('selected RSA DER and dropped EC PEM files produce the committed fixture results', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('file-input').setInputFiles(rsaDerFixturePath);
  await expect(page.locator('#file-status')).toHaveText('Selected: rsa-leaf.der');
  await page.getByTestId('inspect').click();
  await expectInspectionEvidence(page, [{
    inputIndex: 0,
    commonName: 'rsa.fixture.tinkora.test',
    sha256: rsaSha256,
  }]);

  const dataTransfer = await page.evaluateHandle(({ contents }) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([contents], 'ec-dropped.pem', { type: 'application/x-pem-file' }));
    return transfer;
  }, { contents: ecPem });
  await page.getByTestId('drop-zone').dispatchEvent('drop', { dataTransfer });
  await dataTransfer.dispose();
  await expect(page.locator('#file-status')).toHaveText('Selected: ec-dropped.pem');
  await page.getByTestId('inspect').click();
  await expectInspectionEvidence(page, [{
    inputIndex: 0,
    commonName: 'ec-ca.fixture.tinkora.test',
    sha256: ecSha256,
  }]);
});

test('language query selection survives reload and unknown values fall back to English', async ({ page }) => {
  await page.goto('/?lang=zh-CN');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.getByRole('heading', { name: 'Tinkora 证书查看器' })).toBeVisible();
  await expect(page).toHaveURL(/\?lang=zh-CN$/u);

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.getByRole('button', { name: '简体中文' })).toHaveAttribute('aria-pressed', 'true');

  await page.goto('/?lang=unknown');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'Tinkora Cert Viewer' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
});

test('explicit copy actions place the raw SHA-256 fingerprint and pretty JSON on the clipboard', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('load-sample').click();
  await page.getByTestId('inspect').click();

  await page.getByRole('button', { name: 'Copy SHA-256 fingerprint' }).click();
  await expect(page.getByRole('button', { name: /SHA-256.*Copied/u })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(rsaSha256);

  await page.getByText('Complete JSON', { exact: true }).click();
  const expectedJson = await page.getByTestId('json-output').textContent();
  await page.getByTestId('copy-json').click();
  await expect(page.getByTestId('copy-json')).toHaveAttribute('data-copy-state', 'copied');
  const copiedJson = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiedJson).toBe(expectedJson);
  expect(copiedJson).toContain('\n  "schema_version": 1');
  expect(JSON.parse(copiedJson).certificates[0].fingerprints.sha256).toBe(rsaSha256);
});

test('malformed, trailing, over-count, and oversized inputs expose stable structured errors', async ({ page }) => {
  await page.goto('/');

  await inspectText(page, malformedPem);
  await expect(page.getByRole('alert')).toContainText('invalid_pem');

  await page.getByTestId('file-input').setInputFiles({
    name: 'trailing.der',
    mimeType: 'application/pkix-cert',
    buffer: Buffer.concat([readFileSync(rsaDerFixturePath), Buffer.from([0])]),
  });
  await page.getByTestId('inspect').click();
  await expect(page.getByRole('alert')).toContainText('trailing_der_data');

  await inspectText(page, rsaPem.repeat(33));
  await expect(page.getByRole('alert')).toContainText('too_many_certificates');

  await inspectText(page, 'x'.repeat(1_048_577));
  await expect(page.getByRole('alert')).toContainText('input_too_large');
});

test('Clear removes textarea, file, errors, results, certificate text, and copied feedback', async ({ page }) => {
  await page.goto('/');
  await inspectText(page, malformedPem);
  await expect(page.getByRole('alert')).toContainText('invalid_pem');
  await page.getByTestId('clear').click();
  await expect(page.getByRole('alert')).toHaveCount(0);

  await page.getByTestId('file-input').setInputFiles(rsaDerFixturePath);
  await page.getByTestId('inspect').click();
  await page.getByRole('button', { name: 'Copy SHA-256 fingerprint' }).click();
  await expect(page.locator('[data-copy-state="copied"]')).toHaveCount(1);
  await page.getByTestId('clear').click();

  await expect(page.getByTestId('certificate-input')).toHaveValue('');
  expect(await page.getByTestId('file-input').evaluate((input) => input.files.length)).toBe(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('[data-copy-state]')).toHaveCount(0);
  await expect(page.getByTestId('json-output')).toHaveCount(0);
  await expect(page.getByTestId('result')).toHaveText('No certificate has been inspected yet.');
  await expect(page.locator('body')).not.toContainText('rsa.fixture.tinkora.test');
  await expect(page.getByRole('status')).toHaveText('No certificate has been inspected yet.');
});

test('stale file reads cannot override Clear or a newer sample @workflow-regression', async ({ page }) => {
  await page.addInitScript(() => {
    const readFile = File.prototype.arrayBuffer;
    const pendingReads = [];

    File.prototype.arrayBuffer = function delayedArrayBuffer() {
      const file = this;
      return new Promise((resolve, reject) => {
        pendingReads.push(async () => {
          try {
            resolve(await readFile.call(file));
          } catch (error) {
            reject(error);
          }
        });
      });
    };
    window.releaseNextFileRead = () => pendingReads.shift()?.();
  });
  await page.goto('/');

  const fileInput = page.locator('#file-input');
  const certificateInput = page.locator('#certificate-input');
  const inspect = page.getByRole('button', { name: 'Inspect' });

  await page.getByRole('button', { name: 'Load sample' }).click();
  await expect(inspect).toBeEnabled();
  await fileInput.setInputFiles(rsaFixturePath);
  await expect(page.locator('#file-status')).toContainText('Reading: rsa-leaf.pem');
  await expect(certificateInput).toHaveValue('');
  await expect(inspect).toBeDisabled();
  await page.getByRole('button', { name: 'Clear' }).click();
  await page.evaluate(() => window.releaseNextFileRead());
  await expect(page.locator('#file-status')).toHaveText('No file selected');
  await expect(certificateInput).toHaveValue('');
  await expect(inspect).toBeDisabled();
  await expect(page.locator('#results')).toContainText('No certificate has been inspected yet.');

  await fileInput.setInputFiles(rsaFixturePath);
  await expect(page.locator('#file-status')).toContainText('Reading: rsa-leaf.pem');
  await page.getByRole('button', { name: 'Load sample' }).click();
  await page.evaluate(() => window.releaseNextFileRead());
  await expect(page.locator('#file-status')).toHaveText('No file selected');
  await expect(certificateInput).toHaveValue(/^-----BEGIN CERTIFICATE-----/);
  await expect(inspect).toBeEnabled();
});

test('language changes preserve selected files and structured errors @workflow-regression', async ({ page }) => {
  await page.goto('/');

  await page.locator('#file-input').setInputFiles(rsaFixturePath);
  await expect(page.locator('#file-status')).toHaveText('Selected: rsa-leaf.pem');
  await page.getByRole('button', { name: 'Simplified Chinese' }).click();
  await expect(page.locator('#file-status')).toHaveText('已选择：rsa-leaf.pem');
  await expect(page.getByRole('button', { name: '检查' })).toBeEnabled();

  await page.getByRole('button', { name: '清除' }).click();
  await page.getByRole('button', { name: 'English' }).click();
  await page.locator('#certificate-input').fill(malformedPem);
  await page.getByRole('button', { name: 'Inspect' }).click();
  await expect(page.locator('.error-panel')).toContainText('invalid_pem');

  await page.getByRole('button', { name: 'Simplified Chinese' }).click();
  await expect(page.locator('.error-panel')).toContainText('invalid_pem');
  await expect(page.locator('.error-panel')).toContainText('无法检查证书数据');
});

test('WASM module load failures remain visible and localized @workflow-regression', async ({ page }) => {
  await page.route('**/pkg/cert_viewer_web.js', (route) => route.abort('failed'));
  await page.goto('/');

  await expect(page.locator('.error-panel')).toContainText('wasm_initialization_failed');
  await expect(page.getByRole('button', { name: 'Inspect' })).toBeDisabled();

  await page.locator('#certificate-input').fill(malformedPem);
  await expect(page.locator('.error-panel')).toContainText('wasm_initialization_failed');
  await expect(page.getByRole('button', { name: 'Inspect' })).toBeDisabled();

  await page.getByRole('button', { name: 'Simplified Chinese' }).click();
  await expect(page.locator('.error-panel')).toContainText('wasm_initialization_failed');
  await expect(page.locator('.error-panel')).toContainText('无法检查证书数据');
});

test('the hidden file input exposes its keyboard focus on the visible label @workflow-regression', async ({ page }) => {
  await page.goto('/');

  await page.locator('#file-input').focus();
  const focusStyle = await page.locator('label[for="file-input"]').evaluate((label) => {
    const style = getComputedStyle(label);
    return {
      width: style.outlineWidth,
      style: style.outlineStyle,
      color: style.outlineColor,
    };
  });

  expect(focusStyle).toEqual({ width: '3px', style: 'solid', color: 'rgb(37, 99, 235)' });
});

test('file drags outside the drop zone cannot navigate the page @workflow-regression', async ({ page }) => {
  await page.goto('/');

  const prevention = await page.evaluate(() => {
    const dispatch = (type, types) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'dataTransfer', {
        value: { types, files: [] },
      });
      document.body.dispatchEvent(event);
      return event.defaultPrevented;
    };

    return {
      fileDragover: dispatch('dragover', ['Files']),
      fileDrop: dispatch('drop', ['Files']),
      textDragover: dispatch('dragover', ['text/plain']),
      textDrop: dispatch('drop', ['text/plain']),
    };
  });

  expect(prevention).toEqual({
    fileDragover: true,
    fileDrop: true,
    textDragover: false,
    textDrop: false,
  });
});

test('copy feedback retains the fingerprint and JSON targets @workflow-regression', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await page.getByRole('button', { name: 'Load sample' }).click();
  await page.getByRole('button', { name: 'Inspect' }).click();

  await page.getByRole('button', { name: 'Copy SHA-256 fingerprint' }).click();
  await expect(page.getByRole('button', { name: /SHA-256.*Copied/ })).toBeVisible();

  await page.getByText('Complete JSON', { exact: true }).click();
  await page.getByRole('button', { name: 'Copy complete JSON' }).click();
  await expect(page.getByRole('button', { name: /JSON.*Copied/ })).toBeVisible();

  await page.evaluate(() => {
    navigator.clipboard.writeText = () => Promise.reject(new DOMException('denied'));
  });
  await page.getByRole('button', { name: 'Copy SHA-1 fingerprint' }).click();
  await expect(page.getByRole('button', { name: /SHA-1.*Copy failed/ })).toBeVisible();

  await page.getByRole('button', { name: 'Simplified Chinese' }).click();
  await page.evaluate(() => {
    navigator.clipboard.writeText = () => Promise.resolve();
  });
  await page.getByRole('button', { name: '复制 SHA-1 指纹' }).click();
  await expect(page.getByRole('button', { name: /复制 SHA-1 指纹.*已复制/ })).toBeVisible();
});

test('certificate input exposes its localized hint as a description @workflow-regression', async ({ page }) => {
  await page.goto('/');

  const input = page.getByRole('textbox', { name: 'Certificate data' });
  await expect(input).toHaveAttribute('aria-describedby', 'input-hint');
  await expect(input).toHaveAccessibleDescription('Paste PEM or choose a local .pem, .crt, .cer, or .der file.');
});

test('inspection submissions stay serialized while rendering is pending @interaction-regression', async ({ page }) => {
  await page.addInitScript(() => {
    const callbacks = [];
    window.requestAnimationFrame = (callback) => {
      callbacks.push(callback);
      return callbacks.length;
    };
    window.pendingAnimationFrameCount = () => callbacks.length;
    window.releaseNextAnimationFrame = () => {
      callbacks.shift()?.(performance.now());
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Load sample' }).click();

  const inspect = page.getByRole('button', { name: 'Inspect' });
  await inspect.click();
  const initialQueueLength = await page.evaluate(() => window.pendingAnimationFrameCount());
  const disabledWhileLoading = await inspect.isDisabled();
  const queueLengthAfterRepeat = await page.evaluate(() => {
    document.querySelector('#inspect').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return window.pendingAnimationFrameCount();
  });

  expect({ disabledWhileLoading, initialQueueLength, queueLengthAfterRepeat }).toEqual({
    disabledWhileLoading: true,
    initialQueueLength: 1,
    queueLengthAfterRepeat: 1,
  });

  await page.evaluate(() => window.releaseNextAnimationFrame());
  await expect(page.getByText('rsa.fixture.tinkora.test', { exact: true }).first()).toBeVisible();
  await expect(inspect).toBeEnabled();
  expect(await page.evaluate(() => window.pendingAnimationFrameCount())).toBe(0);
});

test('a dropped file clears stale picker state before the picker is reused @interaction-regression', async ({ page }) => {
  await page.goto('/');

  const fileInput = page.locator('#file-input');
  const fileStatus = page.locator('#file-status');
  await fileInput.setInputFiles(rsaFixturePath);
  await expect(fileStatus).toHaveText('Selected: rsa-leaf.pem');

  await page.locator('#drop-zone').evaluate((dropZone) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['dropped input'], 'dropped-b.pem', {
      type: 'application/x-pem-file',
    }));
    dropZone.dispatchEvent(new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer: transfer,
    }));
  });

  await expect(fileStatus).toHaveText('Selected: dropped-b.pem');
  await expect(page.getByRole('button', { name: 'Inspect' })).toBeEnabled();
  expect(await fileInput.evaluate((input) => input.files.length)).toBe(0);

  await fileInput.setInputFiles(rsaFixturePath);
  await expect(fileStatus).toHaveText('Selected: rsa-leaf.pem');
});

async function expectResponsiveLayout(page) {
  const audit = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const outsideViewport = Array.from(document.querySelectorAll(
      '.mono-value, button, label.button, summary, .app-footer',
    )).filter(visible).filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left < -1 || rect.right > viewportWidth + 1;
    }).map((element) => element.textContent.trim().slice(0, 80));
    const controls = Array.from(document.querySelectorAll('button, label.button, summary')).filter(visible);
    const overlaps = [];
    for (let leftIndex = 0; leftIndex < controls.length; leftIndex += 1) {
      const left = controls[leftIndex].getBoundingClientRect();
      for (let rightIndex = leftIndex + 1; rightIndex < controls.length; rightIndex += 1) {
        const right = controls[rightIndex].getBoundingClientRect();
        const overlapWidth = Math.min(left.right, right.right) - Math.max(left.left, right.left);
        const overlapHeight = Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top);
        if (overlapWidth > 1 && overlapHeight > 1) {
          overlaps.push([
            controls[leftIndex].textContent.trim(),
            controls[rightIndex].textContent.trim(),
          ]);
        }
      }
    }
    const result = document.querySelector('[data-testid="result"]')?.getBoundingClientRect();
    const footer = document.querySelector('.app-footer')?.getBoundingClientRect();
    return {
      bodyTextLength: document.body.innerText.trim().length,
      documentOverflow: document.documentElement.scrollWidth - viewportWidth,
      bodyOverflow: document.body.scrollWidth - document.body.clientWidth,
      outsideViewport,
      overlaps,
      resultFooterOverlap: result && footer ? result.bottom - footer.top : 0,
    };
  });

  expect(audit.bodyTextLength).toBeGreaterThan(80);
  expect(audit.documentOverflow).toBeLessThanOrEqual(0);
  expect(audit.bodyOverflow).toBeLessThanOrEqual(0);
  expect(audit.outsideViewport).toEqual([]);
  expect(audit.overlaps).toEqual([]);
  expect(audit.resultFooterOverlap).toBeLessThanOrEqual(0);
}

test('empty, error, and populated states remain readable at every configured viewport', async ({ page }, testInfo) => {
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.goto('/');

  await expect(page.getByTestId('result')).toContainText('No certificate has been inspected yet.');
  await expectResponsiveLayout(page);

  await inspectText(page, malformedPem);
  await expect(page.getByRole('alert')).toContainText('invalid_pem');
  await expectResponsiveLayout(page);

  await inspectText(page, bundlePem);
  const result = page.getByTestId('result');
  await expect(result).toContainText('Inspection complete: 2 certificate(s).');
  expect((await result.boundingBox()).height).toBeGreaterThan(80);
  const disclosures = page.locator('details > summary');
  for (let index = 0; index < await disclosures.count(); index += 1) {
    await disclosures.nth(index).click();
  }
  await expectResponsiveLayout(page);
  await page.screenshot({ path: testInfo.outputPath('review-en.png'), fullPage: true });

  await page.getByRole('button', { name: 'Simplified Chinese' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(result).toContainText('检查完成：共 2 张证书。');
  await expectResponsiveLayout(page);
  await page.screenshot({ path: testInfo.outputPath('review-zh-CN.png'), fullPage: true });
  expect(consoleErrors).toEqual([]);
});
