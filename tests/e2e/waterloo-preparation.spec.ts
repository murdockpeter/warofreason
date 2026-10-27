import { expect, test } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import path from 'node:path';
import { SqliteCampaignRepository } from '../../src/main/persistence/repository';
import {
  launchDesktop,
  navigateTo,
  removeTestProfile,
  testProfile,
  openDeskDrawer,
} from './profile';

async function automateDialogs(app: ElectronApplication, response = 1) {
  await app.evaluate(({ dialog }, choice) => {
    dialog.showMessageBox = async () => ({
      response: choice,
      checkboxChecked: false,
    });
    dialog.showMessageBoxSync = () => 1;
  }, response);
}
async function withdrawal(page: Page, name: string, hexes: string[]) {
  await page
    .getByRole('button', { name: `Plan withdrawal for ${name}`, exact: true })
    .click();
  for (const [i, hex] of hexes.entries())
    await page
      .getByRole('combobox', { name: `Retreat step ${i + 1}`, exact: true })
      .selectOption(hex);
}
for (const packaged of [false, true])
  test(`${packaged ? 'packaged' : 'built'} detachments and simultaneous withdrawal locks survive restart`, async () => {
    test.setTimeout(120000);
    const profile = testProfile();
    let app: ElectronApplication | null = null;
    const source = new SqliteCampaignRepository(':memory:');
    const destination = new SqliteCampaignRepository(
      path.join(profile, 'campaigns.sqlite'),
    );
    try {
      const created = source.createWaterloo({
        title: 'Preparation acceptance',
        actor: 'Test umpire',
        reason: 'Original adjacent-force fixture.',
      }).active!;
      const backup = source.exportCampaign({
        id: created.id,
        expectedRevision: created.revision,
      });
      if (backup.campaign.schemaVersion !== 3)
        throw new Error('Expected hex fixture');
      backup.campaign.corps[0]!.hexId = '5,4';
      backup.campaign.corps[2]!.hexId = '6,4';
      backup.events[0]!.after = structuredClone(backup.campaign);
      destination.importCampaign(backup);
    } finally {
      source.close();
      destination.close();
    }
    try {
      app = await launchDesktop(profile, packaged);
      await automateDialogs(app);
      let page = await app.firstWindow();
      page.setDefaultTimeout(15000);
      const snapshot = async () => {
        const response = await page.evaluate(() =>
          window.desktop.getCampaignLibrary(),
        );
        if (!response.ok || response.value.active?.schemaVersion !== 3)
          throw new Error('Expected hex campaign');
        return response.value.active;
      };
      await openDeskDrawer(page, 'Turn desk');
      await page
        .getByRole('button', { name: 'Enable preparation rules', exact: true })
        .click();
      await expect(
        page.getByRole('button', { name: 'Lock French orders', exact: true }),
      ).not.toBeVisible();
      await page.getByText('Screening detachments', { exact: true }).click();
      const deploy = () =>
        page.getByRole('group', {
          name: 'Deploy French I Corps screen',
          exact: true,
        });
      await deploy()
        .getByRole('combobox', { name: 'Placement hex', exact: true })
        .selectOption('0,0');
      await deploy()
        .getByRole('button', {
          name: 'Deploy French I Corps screen',
          exact: true,
        })
        .click();
      await expect(
        page.getByRole('button', {
          name: 'Select French I Corps screen',
          exact: true,
        }),
      ).toBeVisible();
      await openDeskDrawer(page, 'Map options');
      await page
        .getByRole('combobox', { name: 'Map overlay', exact: true })
        .selectOption('control');
      await expect(page.locator('.hex-overlay-control').first()).toBeVisible();
      await page
        .getByRole('region', { name: 'Hex campaign map', exact: true })
        .screenshot({
          path: `test-results/${packaged ? 'packaged' : 'built'}-preparation-map.png`,
        });
      await openDeskDrawer(page, 'Turn desk');
      await page
        .getByRole('button', {
          name: 'Recall French I Corps screen',
          exact: true,
        })
        .click();
      await expect(
        page.getByRole('button', {
          name: 'Select French I Corps screen',
          exact: true,
        }),
      ).not.toBeVisible();
      expect(
        (await snapshot()).corps.find(
          (f) => f.name === 'French I Corps screen',
        )!.detachment!.availableFromTurn,
      ).toBe(2);
      await withdrawal(page, 'French I Corps', ['4,4', '3,4', '2,4']);
      await navigateTo(page, 'Settings');
      await navigateTo(page, 'Campaign Map');
      await expect(
        page.getByRole('combobox', { name: 'Retreat step 3', exact: true }),
      ).toHaveValue('2,4');
      await page
        .getByRole('button', { name: 'Save withdrawal', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Lock French withdrawals', exact: true })
        .click();
      await page
        .getByRole('combobox', { name: 'Planning side', exact: true })
        .selectOption('allied');
      await withdrawal(page, 'Anglo-Allied I Corps', ['7,4', '8,4', '9,4']);
      await page
        .getByRole('button', { name: 'Save withdrawal', exact: true })
        .click();
      await page
        .getByRole('button', {
          name: 'Lock Coalition withdrawals',
          exact: true,
        })
        .click();
      await openDeskDrawer(page, 'Turn desk');
      await expect(page.getByLabel('Withdrawal readiness')).toHaveText(
        'French: locked · Coalition: locked',
      );
      await app.close();
      app = await launchDesktop(profile, packaged);
      await automateDialogs(app, 0);
      page = await app.firstWindow();
      page.setDefaultTimeout(15000);
      await openDeskDrawer(page, 'Turn desk');
      await expect(page.getByLabel('Withdrawal readiness')).toHaveText(
        'French: locked · Coalition: locked',
      );
      await expect(
        page.getByLabel('Withdrawal resolution preview'),
      ).toContainText('retreats to 2,4');
      await page
        .getByRole('button', {
          name: 'Confirm simultaneous withdrawals',
          exact: true,
        })
        .click();
      await expect(
        page.getByRole('button', {
          name: 'Confirm simultaneous withdrawals',
          exact: true,
        }),
      ).toBeEnabled();
      expect((await snapshot()).cursor).toBe(360);
      expect((await snapshot()).corps[0]!.hexId).toBe('5,4');
      await automateDialogs(app);
      await page
        .getByRole('button', {
          name: 'Confirm simultaneous withdrawals',
          exact: true,
        })
        .click();
      await expect(
        page.getByRole('button', { name: 'Lock French orders', exact: true }),
      ).toBeEnabled();
      let c = await snapshot();
      expect(c.cursor).toBe(420);
      expect(c.corps[0]!.hexId).toBe('2,4');
      expect(c.corps[2]!.hexId).toBe('9,4');
      await page
        .getByRole('button', { name: 'Select French I Corps', exact: true })
        .click();
      await expect(
        page.getByRole('region', { name: 'Hex route draft' }),
      ).not.toBeVisible();
      await page
        .getByRole('button', {
          name: 'Select French Reserve Cavalry',
          exact: true,
        })
        .click();
      await page.getByRole('button', { name: 'Hex 2,6', exact: true }).click();
      await page.locator('.route-options > summary').click();
      await page
        .getByRole('combobox', { name: 'Travel mode', exact: true })
        .selectOption('mixed');
      await expect(
        page.getByRole('spinbutton', {
          name: 'Departure (minutes after phase opening)',
          exact: true,
        }),
      ).toHaveValue('60');
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
        .getByRole('button', { name: 'Lock Coalition orders', exact: true })
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
      await page
        .getByRole('button', { name: 'Finish shared phase', exact: true })
        .click();
      await expect(
        page.getByRole('button', {
          name: 'Lock Coalition withdrawals',
          exact: true,
        }),
      ).toBeEnabled();
      c = await snapshot();
      expect(c.preparation!.deploymentHqIds).toEqual([]);
      expect(c.preparation!.withdrawnCorpsIds).toEqual([]);
      await page
        .getByRole('combobox', { name: 'Planning side', exact: true })
        .selectOption('french');
      await page.getByText('Screening detachments', { exact: true }).click();
      await deploy()
        .getByRole('combobox', { name: 'Placement hex', exact: true })
        .selectOption('0,0');
      await deploy()
        .getByRole('button', {
          name: 'Deploy French I Corps screen',
          exact: true,
        })
        .click();
      await expect(
        page.getByRole('button', {
          name: 'Select French I Corps screen',
          exact: true,
        }),
      ).toBeVisible();
      await page
        .getByRole('combobox', { name: 'Map view', exact: true })
        .selectOption('french');
      await openDeskDrawer(page, 'Map options');
      await page
        .getByRole('combobox', { name: 'Map overlay', exact: true })
        .selectOption('command');
      await expect(
        page.getByRole('combobox', { name: 'Overlay HQ', exact: true }),
      ).toContainText('Napoleon');
      await expect(
        page.getByRole('combobox', { name: 'Overlay HQ', exact: true }),
      ).not.toContainText('Wellington');
      await expect(
        page.getByRole('button', {
          name: 'Confirm simultaneous withdrawals',
          exact: true,
        }),
      ).not.toBeVisible();
    } finally {
      await app?.close();
      removeTestProfile(profile);
    }
  });
