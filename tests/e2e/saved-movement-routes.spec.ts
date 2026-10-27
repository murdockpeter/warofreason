import { expect, test } from '@playwright/test';
import type { ElectronApplication } from '@playwright/test';
import path from 'node:path';
import { SqliteCampaignRepository } from '../../src/main/persistence/repository';
import type { WaterlooCampaign } from '../../src/domain/waterloo-schema';
import {
  launchDesktop,
  openDeskDrawer,
  closeDeskDrawer,
  testProfile,
  removeTestProfile,
} from './profile';

for (const packaged of [false, true])
  test(`${packaged ? 'packaged' : 'built'} saved planning routes persist, remain private and clear on resolution`, async () => {
    const profile = testProfile(),
      repo = new SqliteCampaignRepository(
        path.join(profile, 'campaigns.sqlite'),
      );
    const c = repo.create({
      title: 'Saved route acceptance',
      profile: 'simultaneous_fontenoy',
      actor: 'Test player',
      reason: 'Isolated route overlay acceptance.',
    }).active as WaterlooCampaign;
    repo.close();
    let app: ElectronApplication | null = null;
    try {
      app = await launchDesktop(profile, packaged);
      let page = await app.firstWindow();
      await page.context().setOffline(true);
      const view = () =>
        page.getByRole('combobox', { name: 'Map view', exact: true });
      const route = (index: number) =>
        page.getByRole('img', {
          name: new RegExp(`^Saved movement order for ${c.corps[index]!.name}`),
        });
      const move = async (index: number, hex: string) => {
        await page
          .getByRole('button', {
            name: `Select ${c.corps[index]!.name}`,
            exact: true,
          })
          .click();
        await page
          .getByRole('button', { name: `Hex ${hex}`, exact: true })
          .click();
        await page
          .getByRole('button', { name: 'Save movement segment', exact: true })
          .click();
      };
      await view().selectOption('french');
      await move(0, '4,2');
      await expect(route(0)).toBeVisible();
      await expect(page.locator('[data-drawer="Orders"]')).not.toHaveAttribute(
        'open',
      );
      await move(0, '5,2');
      await expect(route(0).locator('.saved-order-segment')).toHaveCount(2);
      await page
        .getByRole('button', {
          name: `Select ${c.corps[1]!.name}`,
          exact: true,
        })
        .click();
      await expect(route(0)).toBeVisible();
      await page
        .getByRole('button', { name: 'Cancel route', exact: true })
        .click();
      await app.close();
      app = await launchDesktop(profile, packaged);
      page = await app.firstWindow();
      await page.context().setOffline(true);
      await view().selectOption('french');
      await expect(route(0).locator('.saved-order-segment')).toHaveCount(2);
      await page
        .getByRole('button', { name: 'Lock French orders', exact: true })
        .click();
      await expect(route(0)).toHaveAttribute('aria-label', /locked$/);
      await view().selectOption('allied');
      await expect(route(0)).toHaveCount(0);
      await move(2, '9,1');
      await expect(route(2)).toBeVisible();
      await openDeskDrawer(page, 'Orders');
      await page
        .getByRole('button', { name: 'Remove order', exact: true })
        .click();
      await expect(route(2)).toHaveCount(0);
      await closeDeskDrawer(page, 'Orders');
      await move(2, '9,1');
      await page
        .getByRole('button', { name: 'Lock Allied orders', exact: true })
        .click();
      await expect(route(2)).toBeVisible();
      await view().selectOption('umpire');
      await expect(
        page.getByRole('img', { name: /^Saved movement order/ }),
      ).toHaveCount(2);
      await page.screenshot({
        path: `test-results/${packaged ? 'packaged' : 'built'}-saved-routes.png`,
      });
      const before = await page.evaluate(() =>
        window.desktop.getCampaignLibrary(),
      );
      expect(
        before.ok && (before.value.active as WaterlooCampaign).corps[0]!.hexId,
      ).toBe(c.corps[0]!.hexId);
      await app.evaluate(({ dialog }) => {
        dialog.showMessageBox = async () => ({
          response: 1,
          checkboxChecked: false,
        });
      });
      await page
        .getByRole('button', {
          name: 'Resolve simultaneous movement',
          exact: true,
        })
        .click();
      await expect(
        page.getByRole('button', { name: 'Finish shared phase', exact: true }),
      ).toBeVisible();
      await expect(page.locator('.saved-movement-order')).toHaveCount(0);
    } finally {
      if (app && app.process().exitCode === null) {
        await app
          .evaluate(({ dialog }) => {
            dialog.showMessageBoxSync = () => 1;
          })
          .catch(() => {});
        await app.close();
      }
      removeTestProfile(profile);
    }
  });
