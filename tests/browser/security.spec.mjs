import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const hostileFixturePath = fileURLToPath(new URL('../fixtures/html-like-dn.pem', import.meta.url));
const expectedOrigin = 'http://127.0.0.1:4173';
const allowedRequestPaths = new Set([
  '/',
  '/app.mjs',
  '/favicon.svg',
  '/format.mjs',
  '/i18n.mjs',
  '/icons/braces.svg',
  '/icons/circle-check.svg',
  '/icons/copy.svg',
  '/icons/file-up.svg',
  '/icons/languages.svg',
  '/icons/scan-search.svg',
  '/icons/trash-2.svg',
  '/pkg/cert_viewer_web.js',
  '/pkg/cert_viewer_web_bg.wasm',
  '/render.mjs',
  '/sample.mjs',
  '/styles.css',
]);
const allowedRootQueries = new Set(['', '?lang=zh-CN']);

function inspectRequest(request) {
  const url = new URL(request.url());
  const hasPostData = request.postData() !== null;
  const violations = [];
  if (url.origin !== expectedOrigin) violations.push('unexpected origin');
  if (request.method() !== 'GET') violations.push('unexpected method');
  if (hasPostData) violations.push('request body');
  if (!allowedRequestPaths.has(url.pathname)) violations.push('unexpected pathname');
  if (url.pathname === '/') {
    if (!allowedRootQueries.has(url.search)) violations.push('unexpected root query');
  } else if (url.search) {
    violations.push('unexpected static query');
  }
  return {
    origin: url.origin,
    method: request.method(),
    pathname: url.pathname,
    search: url.search,
    hasPostData,
    violations,
  };
}

function observePage(page) {
  const consoleErrors = [];
  const requests = [];
  const unexpectedRequests = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('request', (request) => {
    const inspectedRequest = inspectRequest(request);
    requests.push(inspectedRequest);
    if (inspectedRequest.violations.length > 0) unexpectedRequests.push(inspectedRequest);
  });
  return { consoleErrors, requests, unexpectedRequests };
}

test('normal inspection has a clean console and obeys the local request contract', async ({ page }) => {
  const observations = observePage(page);
  await page.goto('/');
  await page.getByTestId('load-sample').click();
  await page.getByTestId('inspect').click();

  await expect(page.getByTestId('result')).toContainText('rsa.fixture.tinkora.test');
  expect(observations.requests.length).toBeGreaterThan(0);
  expect(observations.consoleErrors).toEqual([]);
  expect(observations.unexpectedRequests).toEqual([]);
});

test('the request guard rejects same-origin POST requests with bodies', async ({ page }) => {
  const observations = observePage(page);
  await page.route('**/unexpected', (route) => route.abort('blockedbyclient'));
  await page.goto('/');

  await page.evaluate(() => fetch('/unexpected', {
    method: 'POST',
    body: 'probe=blocked',
  }).catch(() => undefined));

  expect(observations.unexpectedRequests).toEqual([{
    origin: expectedOrigin,
    method: 'POST',
    pathname: '/unexpected',
    search: '',
    hasPostData: true,
    violations: ['unexpected method', 'request body', 'unexpected pathname'],
  }]);
});

test('hostile-looking distinguished names remain literal text without active content', async ({ page }) => {
  const observations = observePage(page);
  const hostilePem = await readFile(hostileFixturePath, 'utf8');
  await page.goto('/');
  await page.getByTestId('certificate-input').fill(hostilePem);
  await page.getByTestId('inspect').click();

  const result = page.getByTestId('result');
  await expect(result.getByText('<img src=x onerror=alert(1)>.fixture.test', { exact: true }).first()).toBeVisible();
  expect(await result.locator('script, img:not(.icon), [onerror], [onload], [onclick]').count()).toBe(0);
  expect(observations.consoleErrors).toEqual([]);
  expect(observations.unexpectedRequests).toEqual([]);
});

test('the static CSP meta policy constrains executable and navigation capabilities', async ({ page }) => {
  const observations = observePage(page);
  await page.goto('/');

  const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(policy).toContain("default-src 'self'");
  expect(policy).toContain("object-src 'none'");
  expect(policy).toContain("base-uri 'none'");
  expect(policy).toContain("form-action 'none'");
  expect(observations.consoleErrors).toEqual([]);
  expect(observations.unexpectedRequests).toEqual([]);
});

test('inspection, copy, language, and clear workflows leave browser storage empty', async ({ page, context }) => {
  const observations = observePage(page);
  await page.goto('/');
  await page.getByTestId('load-sample').click();
  await page.getByTestId('inspect').click();
  const copyButton = page.getByRole('button', { name: 'Copy SHA-256 fingerprint' });
  await copyButton.click();
  await expect(copyButton).toHaveAttribute('data-copy-state', 'copied');
  await page.getByRole('button', { name: 'Simplified Chinese' }).click();
  await page.getByTestId('clear').click();

  const browserState = await page.evaluate(async () => ({
    localStorageKeys: Object.keys(localStorage),
    sessionStorageKeys: Object.keys(sessionStorage),
    serviceWorkers: (await navigator.serviceWorker.getRegistrations()).length,
    caches: await caches.keys(),
  }));
  expect(browserState).toEqual({
    localStorageKeys: [],
    sessionStorageKeys: [],
    serviceWorkers: 0,
    caches: [],
  });
  expect(await context.cookies()).toEqual([]);
  expect(observations.consoleErrors).toEqual([]);
  expect(observations.unexpectedRequests).toEqual([]);
});
