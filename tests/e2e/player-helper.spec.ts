import { expect, test } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { launchDesktop, removeTestProfile, testProfile } from './profile';
async function current(page: Page) {
  const result = await page.evaluate(() => window.desktop.getCampaignLibrary());
  if (!result.ok || result.value.active?.schemaVersion !== 3)
    throw new Error('Expected operational campaign.');
  return result.value.active;
}
for (const packaged of [false, true])
  test(`${packaged ? 'packaged' : 'built'} helper guides safe choices and remembers its preference`, async () => {
    test.setTimeout(90000);
    const profile = testProfile();
    let app: ElectronApplication | null = null;
    const confirm = async (response: number) =>
      app!.evaluate(({ dialog }, value) => {
        dialog.showMessageBox = async () => ({
          response: value,
          checkboxChecked: false,
        });
        dialog.showMessageBoxSync = () => 1;
      }, response);
    try {
      app = await launchDesktop(profile, packaged);
      let page = await app.firstWindow();
      await page.context().setOffline(true);
      const helper = () =>
        page.getByRole('region', { name: 'Player helper', exact: true });
      await expect(
        page.getByRole('checkbox', { name: 'Helper mode', exact: true }),
      ).toBeChecked();
      await expect(helper()).toContainText('Start here: choose your campaign');
      await helper()
        .getByRole('button', {
          name: 'Show me: Choose a campaign',
          exact: true,
        })
        .click();
      await expect(
        page.getByRole('region', { name: 'Campaign library' }),
      ).toHaveClass(/helper-next/);
      await page
        .getByRole('button', {
          name: 'New simultaneous Fontenoy campaign',
          exact: true,
        })
        .click();
      await expect(helper()).toContainText('Choose French orders');
      const opening = await current(page);
      await helper()
        .getByRole('button', { name: 'Show me: Plan a move', exact: true })
        .click();
      await expect(page.locator('[data-helper="map"]')).toHaveClass(
        /helper-next/,
      );
      const counter = page.getByRole('button', {
        name: `Select ${opening.corps[0]!.name}`,
        exact: true,
      });
      await expect(counter).toBeFocused();
      expect(await current(page)).toEqual(opening);
      await helper().screenshot({
        path: `test-results/${packaged ? 'packaged' : 'built'}-player-helper.png`,
      });
      await counter.press('Enter');
      await expect(helper()).toContainText('Draw and save your route');
      await page
        .getByRole('button', { name: 'Cancel route', exact: true })
        .click();
      await expect(helper()).toContainText('Choose French orders');
      await helper()
        .getByRole('button', {
          name: 'Show me: Hold positions and lock orders',
          exact: true,
        })
        .click();
      const frenchLock = page.getByRole('button', {
        name: 'Lock French orders',
        exact: true,
      });
      await expect(frenchLock).toBeFocused();
      expect(await current(page)).toEqual(opening);
      await frenchLock.click();
      await expect(helper()).toContainText('French orders are locked');
      await helper()
        .getByRole('button', {
          name: 'Show me: Plan for the other side',
          exact: true,
        })
        .click();
      await expect(
        page.getByRole('combobox', { name: 'Planning side', exact: true }),
      ).toBeFocused();
      await page
        .getByRole('combobox', { name: 'Planning side', exact: true })
        .selectOption('allied');
      await expect(helper()).toContainText('Choose Allied orders');
      await page
        .getByRole('button', { name: 'Lock Allied orders', exact: true })
        .click();
      await expect(helper()).toContainText(
        'Both sides are ready: resolve movement',
      );
      const locked = await current(page);
      await helper()
        .getByRole('button', {
          name: 'Show me: Find Resolve movement',
          exact: true,
        })
        .click();
      await expect(
        page.getByRole('button', {
          name: 'Resolve simultaneous movement',
          exact: true,
        }),
      ).toBeFocused();
      expect(await current(page)).toEqual(locked);
      await confirm(0);
      await page
        .getByRole('button', {
          name: 'Resolve simultaneous movement',
          exact: true,
        })
        .click();
      expect(await current(page)).toEqual(locked);
      await confirm(1);
      await page
        .getByRole('button', {
          name: 'Resolve simultaneous movement',
          exact: true,
        })
        .click();
      await expect(helper()).toContainText('Ready to finish this shared phase');
      await page
        .getByRole('checkbox', { name: 'Helper mode', exact: true })
        .uncheck();
      await expect(helper()).not.toBeVisible();
      await expect(page.locator('.helper-next')).toHaveCount(0);
      const saved = await current(page);
      await app.close();
      app = await launchDesktop(profile, packaged);
      page = await app.firstWindow();
      await expect(
        page.getByRole('checkbox', { name: 'Helper mode', exact: true }),
      ).not.toBeChecked();
      await expect(helper()).not.toBeVisible();
      expect(await current(page)).toEqual(saved);
      await page
        .getByRole('checkbox', { name: 'Helper mode', exact: true })
        .check();
      await expect(helper()).toContainText('Ready to finish this shared phase');
      await page
        .getByRole('combobox', { name: 'Map view', exact: true })
        .selectOption('french');
      await expect(helper()).toContainText('Waiting for umpire review');
      await expect(
        helper().getByRole('button', {
          name: 'Show me: Find the view controls',
          exact: true,
        }),
      ).toBeVisible();
      expect(await current(page)).toEqual(saved);
    } finally {
      if (app && app.process().exitCode === null) {
        await confirm(1).catch(() => {});
        await app.close();
      }
      removeTestProfile(profile);
    }
  });
