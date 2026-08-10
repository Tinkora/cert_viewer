import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const malformedPem = `-----BEGIN CERTIFICATE-----
not-base64
-----END CERTIFICATE-----`;

async function expectNoAxeViolations(page, state) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations, `${state}: ${JSON.stringify(violations, null, 2)}`).toEqual([]);
}

test('empty state has no detectable accessibility violations', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByTestId('result')).toContainText('No certificate has been inspected yet.');
  await expectNoAxeViolations(page, 'empty state');
});

test('error state has no detectable accessibility violations and is announced', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('certificate-input').fill(malformedPem);
  await page.getByTestId('inspect').click();

  await expect(page.getByRole('alert')).toContainText('invalid_pem');
  await expect(page.getByRole('status')).toHaveText('Unable to inspect certificate data');
  await expectNoAxeViolations(page, 'error state');
});

test('populated state has no detectable accessibility violations', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('load-sample').click();
  await page.getByTestId('inspect').click();

  await expect(page.getByTestId('result')).toContainText('rsa.fixture.tinkora.test');
  await expectNoAxeViolations(page, 'populated state with collapsed details');

  const disclosures = [
    { name: 'Subject entries', content: '.name-entry' },
    { name: 'Issuer entries', content: '.name-entry' },
    { name: 'Extension details', content: '.extension-item' },
    { name: 'Complete JSON', content: '[data-testid="json-output"]' },
  ];
  await expect(page.locator('details')).toHaveCount(disclosures.length);
  for (const { name, content } of disclosures) {
    const summary = page.getByText(name, { exact: true });
    const details = page.locator('details').filter({ has: summary });
    await expect(details).toHaveCount(1);
    await summary.click();
    await expect(details).toHaveAttribute('open', '');
    await expect(details.locator(content).first()).toBeVisible();
  }

  await expect(page.locator('details[open]')).toHaveCount(disclosures.length);
  await expectNoAxeViolations(page, 'populated state with expanded details');
});

test('skip link is first in the tab order and moves focus to the workspace', async ({ page }) => {
  await page.goto('/');

  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Certificate input' });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();
  expect(await skipLink.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('solid');

  await page.keyboard.press('Enter');
  await expect(page.locator('#workspace')).toBeFocused();
});

test('focus-visible styling is visible and the native file focus is projected to its label', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('certificate-input').focus();
  const inputFocus = await page.getByTestId('certificate-input').evaluate((element) => {
    const style = getComputedStyle(element);
    return { width: style.outlineWidth, style: style.outlineStyle, color: style.outlineColor };
  });
  expect(inputFocus).toEqual({ width: '3px', style: 'solid', color: 'rgb(37, 99, 235)' });

  await page.getByTestId('file-input').focus();
  const labelFocus = await page.locator('label[for="file-input"]').evaluate((element) => {
    const style = getComputedStyle(element);
    return { width: style.outlineWidth, style: style.outlineStyle, color: style.outlineColor };
  });
  expect(labelFocus).toEqual({ width: '3px', style: 'solid', color: 'rgb(37, 99, 235)' });
});

test('interactive controls follow the native DOM tab order without positive tabindex values', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('load-sample').click();
  await page.getByTestId('inspect').click();
  await expect(page.getByRole('heading', { name: 'Inspection results' })).toBeVisible();

  const disclosures = page.locator('details > summary');
  for (let index = 0; index < await disclosures.count(); index += 1) {
    await disclosures.nth(index).click();
  }

  const order = [
    page.getByRole('link', { name: 'Certificate input' }),
    page.getByRole('button', { name: 'English' }),
    page.getByRole('button', { name: 'Simplified Chinese' }),
    page.getByRole('textbox', { name: 'Certificate data' }),
    page.getByTestId('file-input'),
    page.getByRole('button', { name: 'Load sample' }),
    page.getByRole('button', { name: 'Inspect' }),
    page.getByRole('button', { name: 'Clear' }),
    page.getByText('Subject entries', { exact: true }),
    page.getByText('Issuer entries', { exact: true }),
    page.getByText('Extension details', { exact: true }),
    page.getByRole('button', { name: 'Copy SHA-256 fingerprint' }),
    page.getByRole('button', { name: 'Copy SHA-1 fingerprint' }),
    page.getByText('Complete JSON', { exact: true }),
    page.getByRole('button', { name: 'Copy complete JSON' }),
    page.getByTestId('json-output'),
  ];

  expect(await page.locator('[tabindex]:not([tabindex="-1"]):not([tabindex="0"])').count()).toBe(0);
  expect(await page.getByTestId('json-output').evaluate((element) => element.tabIndex)).toBe(0);
  await order[0].focus();
  await expect(order[0]).toBeFocused();
  for (const control of order.slice(1)) {
    await page.keyboard.press('Tab');
    await expect(control).toBeFocused();
  }

  const jsonFocus = await page.getByTestId('json-output').evaluate((element) => {
    const style = getComputedStyle(element);
    return { width: style.outlineWidth, style: style.outlineStyle, color: style.outlineColor };
  });
  expect(jsonFocus).toEqual({ width: '3px', style: 'solid', color: 'rgb(37, 99, 235)' });
});

test('Chinese mode exposes translated accessible names and language metadata', async ({ page }) => {
  await page.goto('/?lang=zh-CN');

  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.getByRole('group', { name: '语言' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '证书数据' })).toBeVisible();
  await expect(page.getByTestId('file-input')).toHaveAccessibleName('选择文件');
  await expect(page.getByRole('button', { name: '加载示例' })).toBeVisible();
  await expect(page.getByRole('button', { name: '检查' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '清除' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveAttribute('aria-live', 'polite');
});

test('reduced-motion preference disables smooth scrolling and transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  const styles = await page.getByTestId('inspect').evaluate((button) => ({
    scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
    transitionDuration: getComputedStyle(button).transitionDuration,
  }));
  expect(styles).toEqual({ scrollBehavior: 'auto', transitionDuration: '0s' });
});
