import { expect, test } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import path from 'node:path';
import { SqliteCampaignRepository } from '../../src/main/persistence/repository';
import type { FontenoyCampaign } from '../../src/domain/campaign';
import {
  launchDesktop,
  navigateTo,
  removeTestProfile,
  testProfile,
  showHelperChoice,
  openPlayerHelper,
} from './profile';
async function current(page: Page) {
  const result = await page.evaluate(() => window.desktop.getCampaignLibrary());
  if (!result.ok || result.value.active?.schemaVersion !== 3)
    throw new Error('Expected operational campaign.');
  return result.value.active;
}
for (const packaged of [false, true])
  test(`${packaged ? 'packaged' : 'built'} manual officers, guarded drafts and private portable history`, async () => {
    test.setTimeout(120000);
    const profile = testProfile(),
      destination = testProfile();
    const repo = new SqliteCampaignRepository(
      path.join(profile, 'campaigns.sqlite'),
    );
    const audit = { actor: 'Umpire', reason: 'Commander acceptance.' };
    const source = repo.create({ title: 'Officer setup', ...audit })
      .active as FontenoyCampaign;
    repo.clone({
      id: source.id,
      expectedRevision: 1,
      profile: 'simultaneous_fontenoy',
      title: 'Officer acceptance',
      ...audit,
    });
    repo.close();
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
      const panel = () => page.locator('[data-helper="officers"]');
      await showHelperChoice(page, 'Show me: Review commanders and Notables');
      await expect(panel()).toHaveAttribute('open');
      await expect(panel().locator(':scope > summary')).toBeFocused();
      await expect(
        page.getByRole('button', {
          name: 'Enable commander management',
          exact: true,
        }),
      ).toBeVisible();
      await confirm(0);
      await page
        .getByRole('button', {
          name: 'Enable commander management',
          exact: true,
        })
        .click();
      expect((await current(page)).fontenoy!.officers).toBeUndefined();
      await confirm(1);
      await page
        .getByRole('button', {
          name: 'Enable commander management',
          exact: true,
        })
        .click();
      await expect(
        page.getByRole('button', {
          name: 'Record officer arrival',
          exact: true,
        }),
      ).toBeVisible();
      const opening = await current(page);
      await page
        .getByRole('button', { name: 'Record officer arrival', exact: true })
        .click();
      await page
        .getByLabel('Officer name', { exact: true })
        .fill('Test Notable');
      await page
        .getByLabel('Private Notable reference', { exact: true })
        .fill('Private player card reference');
      await page
        .getByLabel('Decision explanation', { exact: true })
        .fill('Arrival manually agreed by both players.');
      await navigateTo(page, 'Settings');
      await showHelperChoice(page, 'Show me: Return to your edit');
      await expect(
        page.getByLabel('Private Notable reference', { exact: true }),
      ).toHaveValue('Private player card reference');
      await confirm(0);
      await page
        .getByRole('button', { name: 'Confirm officer change', exact: true })
        .click();
      expect((await current(page)).fontenoy!.officers!.records).toHaveLength(0);
      await expect(
        page.getByLabel('Decision explanation', { exact: true }),
      ).toHaveValue('Arrival manually agreed by both players.');
      await confirm(1);
      await page
        .getByRole('button', { name: 'Confirm officer change', exact: true })
        .click();
      await expect(
        page.getByRole('form', { name: 'Officer change' }),
      ).not.toBeVisible();
      const row = () =>
        panel()
          .locator('.officer-roster > details')
          .filter({ hasText: 'Test Notable' });
      await row().locator('summary').click();
      await row()
        .getByRole('button', { name: 'Assign Test Notable', exact: true })
        .click();
      await page
        .getByRole('combobox', { name: 'Assigned formation', exact: true })
        .selectOption(opening.corps[0]!.id);
      await page
        .getByLabel('Decision explanation', { exact: true })
        .fill('Attachment agreed before orders.');
      await page
        .getByRole('button', { name: 'Confirm officer change', exact: true })
        .click();
      await expect(
        page.getByRole('form', { name: 'Officer change' }),
      ).not.toBeVisible();
      await row()
        .getByRole('button', {
          name: 'Record status for Test Notable',
          exact: true,
        })
        .click();
      await page
        .getByRole('combobox', { name: 'Resolved officer status', exact: true })
        .selectOption('retired');
      await page
        .getByLabel('Decision explanation', { exact: true })
        .fill('Retirement resolved manually.');
      await page
        .getByRole('button', { name: 'Confirm officer change', exact: true })
        .click();
      await expect(row().locator('summary')).toContainText('retired');
      for (const side of ['french', 'allied']) {
        await page
          .getByRole('combobox', { name: 'Planning side', exact: true })
          .selectOption(side);
        await page
          .getByRole('button', {
            name: `Lock ${side === 'french' ? 'French' : 'Allied'} orders`,
            exact: true,
          })
          .click();
      }
      await page
        .getByRole('button', {
          name: 'Resolve simultaneous movement',
          exact: true,
        })
        .click();
      await openPlayerHelper(page);
      await expect(
        page.getByRole('button', {
          name: 'Show me: Review commander outcomes',
          exact: true,
        }),
      ).toBeVisible();
      const saved = await current(page),
        id = saved.fontenoy!.commanders.find(
          (u) => u.displayName === 'Test Notable',
        )!.id;
      expect(
        saved.fontenoy!.formations.some((f) => f.commanderIds.includes(id)),
      ).toBe(false);
      expect(saved.fontenoy!.officers!.records).toHaveLength(3);
      expect(saved.hqs).toEqual(opening.hqs);
      expect(saved.fontenoy!.units).toEqual(opening.fontenoy!.units);
      await panel().screenshot({
        path: `test-results/${packaged ? 'packaged' : 'built'}-commander-management.png`,
      });
      await page
        .getByRole('combobox', { name: 'Map view', exact: true })
        .selectOption('allied');
      await expect(panel()).not.toContainText('Test Notable');
      await expect(panel()).not.toContainText('Private player card reference');
      await expect(panel().getByRole('button')).toHaveCount(0);
      await app.close();
      app = await launchDesktop(profile, packaged);
      page = await app.firstWindow();
      expect((await current(page)).fontenoy).toEqual(saved.fontenoy);
      const file = path.join(profile, 'officers.json');
      await app.evaluate(({ dialog }, filePath) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath });
      }, file);
      await navigateTo(page, 'Dashboard');
      await page
        .getByRole('button', { name: 'Export saved JSON', exact: true })
        .click();
      await expect(
        page.getByText('Saved campaign and journal exported.'),
      ).toBeVisible();
      await app.close();
      app = await launchDesktop(destination, packaged);
      page = await app.firstWindow();
      await app.evaluate(({ dialog }, filePath) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [filePath],
        });
      }, file);
      await page
        .getByRole('button', { name: 'Import JSON', exact: true })
        .click();
      await expect(
        page.getByRole('region', { name: 'Open campaign', exact: true }),
      ).toContainText('Officer acceptance');
      expect((await current(page)).fontenoy).toEqual(saved.fontenoy);
      await app.close();
      app = await launchDesktop(destination, packaged);
      page = await app.firstWindow();
      expect((await current(page)).fontenoy).toEqual(saved.fontenoy);
    } finally {
      if (app && app.process().exitCode === null) {
        await confirm(1).catch(() => {});
        await app.close();
      }
      removeTestProfile(profile);
      removeTestProfile(destination);
    }
  });
