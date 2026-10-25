import { expect, test } from '@playwright/test';
import packageMetadata from '../../package.json' with { type: 'json' };
import {
  navigateTo,
  launchDesktop,
  removeTestProfile,
  testProfile,
} from './profile';

for (const packaged of [false, true]) {
  test(`${packaged ? 'packaged Windows' : 'production build'} opens offline with isolated renderer`, async () => {
    const profile = testProfile();
    const app = await launchDesktop(profile, packaged);
    try {
      const page = await app.firstWindow();
      await app.evaluate(({ app, dialog }) => {
        Reflect.set(app, 'smokeLoadErrors', [] as string[]);
        dialog.showErrorBox = (title, message) => {
          (Reflect.get(app, 'smokeLoadErrors') as string[]).push(
            `${title}: ${message}`,
          );
        };
      });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.context().setOffline(true);
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
      for (const name of [
        'Campaign Map',
        'Armies/Columns',
        'Turn Orders',
        'Battle Log',
        'Siege & Victory',
        'Settings',
      ]) {
        await navigateTo(page, name);
        await expect(
          name === 'Campaign Map'
            ? page.getByRole('button', { name, exact: true })
            : page.getByRole('heading', { level: 1, name, exact: true }),
        ).toBeVisible();
        if (name === 'Campaign Map') {
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
          await page
            .getByRole('region', { name: 'Campaign map preview' })
            .screenshot({
              path: `test-results/${packaged ? 'packaged' : 'built'}-map-preview.png`,
            });
        }
      }
      await expect(
        page.getByText(packageMetadata.version, { exact: true }),
      ).toBeVisible();
      expect(
        await app.evaluate(({ app }) => Reflect.get(app, 'smokeLoadErrors')),
      ).toEqual([]);
      const failureDialogs = await app.evaluate(({ app, BrowserWindow }) => {
        const contents = BrowserWindow.getAllWindows()[0]!.webContents;
        contents.emit(
          'did-fail-load',
          {},
          -3,
          'ERR_ABORTED',
          contents.getURL(),
          true,
        );
        contents.emit(
          'did-fail-load',
          {},
          -6,
          'ERR_FILE_NOT_FOUND',
          contents.getURL(),
          false,
        );
        const afterIgnored = [
          ...(Reflect.get(app, 'smokeLoadErrors') as string[]),
        ];
        contents.emit(
          'did-fail-load',
          {},
          -6,
          'ERR_FILE_NOT_FOUND (smoke test)',
          contents.getURL(),
          true,
        );
        return {
          afterIgnored,
          afterRealFailure: Reflect.get(app, 'smokeLoadErrors') as string[],
        };
      });
      expect(failureDialogs.afterIgnored).toEqual([]);
      expect(failureDialogs.afterRealFailure).toHaveLength(1);
      const globals = await page.evaluate(() => ({
        require: typeof Reflect.get(window, 'require'),
        process: typeof Reflect.get(window, 'process'),
        api: Object.keys(window.desktop).sort(),
      }));
      expect(globals).toEqual({
        require: 'undefined',
        process: 'undefined',
        api: [
          'confirmResetSession',
          'getAppInfo',
          'logError',
          'getCampaignLibrary',
          'createCampaign',
          'createWaterlooCampaign',
          'commitWaterlooAction',
          'renameCampaign',
          'cloneCampaign',
          'archiveCampaign',
          'openCampaign',
          'importCampaign',
          'exportCampaign',
          'confirmDiscardDraft',
          'initializeScenario',
          'saveCampaignSetup',
          'startCampaign',
          'commitOperationalAction',
          'exportPlayerView',
          'commitTabletopAction',
          'commitAftermathAction',
          'rollScoutingDie',
          'exportBattleBrief',
        ].sort(),
      });
      const cdp = await page.context().newCDPSession(page);
      const contexts: { id: number; name: string }[] = [];
      cdp.on('Runtime.executionContextCreated', ({ context }) =>
        contexts.push(context),
      );
      await cdp.send('Runtime.enable');
      const preloadWorld = contexts.find(
        (context) => context.name === 'Electron Isolated Context',
      );
      expect(preloadWorld).toBeDefined();
      // Electron creates this separate execution context only with isolation enabled.
      // Sandboxing is checked independently through the main-process metrics below.
      await cdp.detach();
      expect(
        await app.evaluate(({ app }) =>
          app
            .getAppMetrics()
            .filter((metric) => metric.type === 'Tab')
            .map((metric) => metric.sandboxed),
        ),
      ).toEqual([true]);
      const invalidRejected = await app.evaluate(async ({ BrowserWindow }) => {
        try {
          await BrowserWindow.getAllWindows()[0]!.webContents.executeJavaScript(
            `window.desktop.logError({source:'renderer', message:'test', arbitraryPath:'C:/'})`,
          );
          return false;
        } catch {
          return true;
        }
      });
      expect(invalidRejected).toBe(true);
      // Exercise real native confirmation without leaving an interactive dialog open.
      await app.evaluate(({ dialog }) => {
        dialog.showMessageBox = async () => ({
          response: 0,
          checkboxChecked: false,
        });
      });
      expect(
        await page.evaluate(() => window.desktop.confirmResetSession()),
      ).toBe(false);
      await app.evaluate(({ dialog }) => {
        dialog.showMessageBox = async () => ({
          response: 1,
          checkboxChecked: false,
        });
      });
      expect(
        await page.evaluate(() => window.desktop.confirmResetSession()),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/${packaged ? 'packaged' : 'built'}-settings.png`,
      });
      expect(errors).toEqual([]);
    } finally {
      await app.close();
      removeTestProfile(profile);
    }
  });
}
