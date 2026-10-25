import { expect, test } from '@playwright/test';
import type { ElectronApplication } from '@playwright/test';
import {
  launchDesktop,
  navigateTo,
  removeTestProfile,
  testProfile,
} from './profile';
for (const packaged of [false, true])
  test(`${packaged ? 'packaged' : 'built'} Maurice Fontenoy simultaneous creation and saved-setup copy`, async () => {
    test.setTimeout(120000);
    const profile = testProfile();
    let app: ElectronApplication | null = null;
    try {
      app = await launchDesktop(profile, packaged);
      await app.evaluate(({ dialog }) => {
        dialog.showMessageBox = async () => ({
          response: 1,
          checkboxChecked: false,
        });
        dialog.showMessageBoxSync = () => 1;
      });
      let page = await app.firstWindow();
      page.setDefaultTimeout(15000);
      await page
        .getByRole('button', {
          name: 'New simultaneous Fontenoy campaign',
          exact: true,
        })
        .click();
      await expect(
        page.getByRole('button', {
          name: 'Open simultaneous map',
          exact: true,
        }),
      ).toBeVisible();
      await page
        .getByRole('button', { name: 'Open simultaneous map', exact: true })
        .click();
      const snapshot = async () => {
        const result = await page.evaluate(() =>
          window.desktop.getCampaignLibrary(),
        );
        if (!result.ok || result.value.active?.schemaVersion !== 3)
          throw new Error('Expected Fontenoy operations');
        return { ...result.value, active: result.value.active };
      };
      await expect(
        page.getByRole('region', {
          name: 'Maurice Fontenoy campaign',
          exact: true,
        }),
      ).toContainText('French 20 / Allied 18');
      await expect(
        page.getByRole('region', {
          name: 'Maurice Fontenoy campaign',
          exact: true,
        }),
      ).toContainText('Tournai');
      await expect(
        page.locator('svg[aria-label="Fontenoy operational map"]'),
      ).toBeVisible();
      const backdrop = page.locator('.fontenoy-map-art image');
      await expect(backdrop).toHaveCount(1);
      const backdropUrl = await backdrop.getAttribute('href');
      expect(
        await page.evaluate(
          (url) =>
            new Promise<boolean>((resolve) => {
              const art = new Image();
              art.onload = () => resolve(art.naturalWidth > 0);
              art.onerror = () => resolve(false);
              art.src = url!;
            }),
          backdropUrl,
        ),
      ).toBe(true);
      await page.getByLabel('Show period backdrop', { exact: true }).uncheck();
      await expect(backdrop).toHaveCount(0);
      await page.getByLabel('Show period backdrop', { exact: true }).check();
      await expect(backdrop).toHaveCount(1);
      let c = (await snapshot()).active;
      expect(c.moduleId).toBe('fontenoy-operational');
      expect(c.date).toBe('1745-05-01');
      expect(c.fontenoy!.units).toHaveLength(38);
      expect(c.hqs.map((h) => h.name)).not.toContain('Napoleon');
      expect(c.corps.map((f) => f.army)).not.toContain('prussian');
      await page
        .getByRole('button', { name: 'Enable preparation rules', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Lock French withdrawals', exact: true })
        .click();
      await page
        .getByRole('combobox', { name: 'Planning side', exact: true })
        .selectOption('allied');
      await page
        .getByRole('button', { name: 'Lock Allied withdrawals', exact: true })
        .click();
      await page
        .getByRole('button', {
          name: 'Confirm simultaneous withdrawals',
          exact: true,
        })
        .click();
      await page
        .getByRole('combobox', { name: 'Planning side', exact: true })
        .selectOption('french');
      await page
        .getByRole('button', { name: 'Select French Column A', exact: true })
        .click();
      await expect(
        page.getByRole('combobox', { name: 'Travel mode', exact: true }),
      ).toHaveValue('mixed');
      await page.getByRole('button', { name: 'Hex 4,2', exact: true }).click();
      await page
        .getByRole('button', { name: 'Hex 4,3 Fontenoy', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Save movement segment', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Lock French orders', exact: true })
        .click();
      await page
        .getByRole('combobox', { name: 'Planning side', exact: true })
        .selectOption('allied');
      await page
        .getByRole('button', { name: 'Lock Allied orders', exact: true })
        .click();
      await page
        .getByRole('button', {
          name: 'Resolve simultaneous movement',
          exact: true,
        })
        .click();
      await expect(
        page.getByRole('button', { name: 'Finish shared phase', exact: true }),
      ).toBeEnabled();
      c = (await snapshot()).active;
      expect(c.corps[0]!.hexId).toBe('4,3');
      expect(c.fontenoy!.units).toHaveLength(38);
      await page
        .getByRole('region', { name: 'Hex campaign map', exact: true })
        .screenshot({
          path: `test-results/${packaged ? 'packaged' : 'built'}-fontenoy-simultaneous-map.png`,
        });
      await app.close();
      app = await launchDesktop(profile, packaged);
      await app.evaluate(({ dialog }) => {
        dialog.showMessageBox = async () => ({
          response: 1,
          checkboxChecked: false,
        });
        dialog.showMessageBoxSync = () => 1;
      });
      page = await app.firstWindow();
      page.setDefaultTimeout(15000);
      expect((await snapshot()).active.corps[0]!.hexId).toBe('4,3');
      // Create a normal Maurice setup through the retained API, then use the
      // visible copy action; both the original and new histories must survive.
      const source = await page.evaluate(() =>
        window.desktop.createCampaign({
          title: 'Saved Maurice Fontenoy',
          actor: 'Acceptance player',
          reason: 'Saved Fontenoy setup copy fixture.',
        }),
      );
      if (!source.ok || !source.value.active)
        throw new Error('Setup creation failed');
      const sourceId = source.value.active.id;
      await page.reload();
      await navigateTo(page, 'Dashboard');
      await page
        .getByRole('button', {
          name: 'Create simultaneous Fontenoy copy',
          exact: true,
        })
        .click();
      await expect(
        page.getByRole('button', {
          name: 'Open simultaneous map',
          exact: true,
        }),
      ).toBeVisible();
      const copied = await snapshot();
      expect(copied.active.moduleId).toBe('fontenoy-operational');
      expect(copied.events[0]!.sourceCampaignId).toBe(sourceId);
      expect(copied.active.fontenoy!.units).toHaveLength(38);
      expect(copied.campaigns.some((s) => s.id === sourceId)).toBe(true);
    } finally {
      await app?.close();
      removeTestProfile(profile);
    }
  });
