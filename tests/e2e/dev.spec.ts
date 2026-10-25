import { expect, test } from '@playwright/test';
import packageMetadata from '../../package.json' with { type: 'json' };
import {
  navigateTo,
  launchDesktop,
  removeTestProfile,
  testProfile,
} from './profile';
test('development renderer starts with external network blocked', async () => {
  const profile = testProfile();
  const app = await launchDesktop(profile, false, true);
  try {
    const page = await app.firstWindow();
    await app.evaluate(({ app, dialog }) => {
      Reflect.set(app, 'smokeLoadErrors', [] as string[]);
      dialog.showErrorBox = (title) => {
        (Reflect.get(app, 'smokeLoadErrors') as string[]).push(title);
      };
    });
    await page.route('**/*', (route) =>
      route.request().url().startsWith('http://127.0.0.1:5173/')
        ? route.continue()
        : route.abort(),
    );
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Dashboard', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.app-shell')).toHaveCSS('display', 'block');
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
    await expect(page.locator('.panel').first()).toHaveCSS(
      'background-color',
      'rgb(54, 57, 59)',
    );
    await expect(page.locator('.sidebar')).toHaveCSS(
      'background-color',
      'rgb(36, 39, 42)',
    );
    await expect(page.locator('.status-strip')).toHaveCSS('display', 'grid');
    await page.screenshot({ path: 'test-results/dev-dashboard.png' });
    await navigateTo(page, 'Campaign Map');
    const backdrop = page.getByRole('img', {
      name: /Age of Reason campaign backdrop/,
    });
    await expect(backdrop).toBeVisible();
    await expect
      .poll(() =>
        backdrop.evaluate(
          (element) =>
            element instanceof HTMLImageElement &&
            element.complete &&
            element.naturalWidth > 0,
        ),
      )
      .toBe(true);
    await navigateTo(page, 'Settings');
    await expect(
      page.getByText(packageMetadata.version, { exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => typeof window.desktop.getAppInfo)).toBe(
      'function',
    );
    expect(
      await app.evaluate(({ app }) => Reflect.get(app, 'smokeLoadErrors')),
    ).toEqual([]);
  } finally {
    await app.close();
    removeTestProfile(profile);
  }
});
