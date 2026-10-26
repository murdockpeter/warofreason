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
} from './profile';

async function snapshot(page: Page) {
  const data = await page.evaluate(() => window.desktop.getCampaignLibrary());
  if (!data.ok || data.value.active?.schemaVersion !== 3)
    throw new Error('Expected simultaneous campaign.');
  return data.value.active;
}
for (const packaged of [false, true])
  test(`${packaged ? 'packaged' : 'built'} Tournai review, siege victory and portable restart`, async () => {
    test.setTimeout(120000);
    const profile = testProfile(),
      destination = testProfile();
    const repo = new SqliteCampaignRepository(
      path.join(profile, 'campaigns.sqlite'),
    );
    const audit = { actor: 'Umpire', reason: 'Reviewed siege acceptance.' };
    const source = repo.create({ title: 'Tournai setup', ...audit })
      .active as FontenoyCampaign;
    repo.clone({
      id: source.id,
      expectedRevision: source.revision,
      profile: 'simultaneous_fontenoy',
      title: 'Tournai acceptance',
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
      const panel = () =>
        page.getByRole('region', { name: 'Tournai siege and victory' });
      await panel()
        .getByText('Siege rules and checkpoint history', { exact: true })
        .click();
      await panel()
        .getByRole('button', {
          name: 'Review and enable siege rules',
          exact: true,
        })
        .click();
      await expect(
        page.getByLabel('Calendar hours per siege interval', { exact: true }),
      ).toHaveValue('48');
      await page
        .getByLabel('Calendar hours per siege interval', { exact: true })
        .fill('6');
      await page
        .getByLabel('Siege success threshold', { exact: true })
        .fill('1');
      await confirm(0);
      await page
        .getByRole('button', { name: 'Confirm siege policy', exact: true })
        .click();
      expect((await snapshot(page)).fontenoy!.siege.campaign).toBeUndefined();
      await expect(
        page.getByLabel('Calendar hours per siege interval', { exact: true }),
      ).toHaveValue('6');
      await confirm(1);
      await page
        .getByRole('button', { name: 'Confirm siege policy', exact: true })
        .click();
      await expect(
        page.getByRole('form', { name: 'Siege policy' }),
      ).not.toBeVisible();
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
      await expect(
        page.getByRole('button', { name: 'Finish shared phase', exact: true }),
      ).toBeDisabled();
      await panel()
        .getByRole('button', { name: 'Review siege checkpoint', exact: true })
        .click();
      await expect(
        page.getByLabel('French supply confirmed', { exact: true }),
      ).not.toBeChecked();
      const investment = page.getByLabel('Investment confirmed', {
        exact: true,
      });
      await investment.setChecked(true);
      await page.getByLabel('French supply confirmed', { exact: true }).check();
      await page
        .getByRole('textbox', { name: 'Checkpoint explanation', exact: true })
        .fill(
          'Both players confirm investment and supply for the completed interval.',
        );
      await expect(
        page.getByLabel('Siege checkpoint preview', { exact: true }),
      ).toContainText('Proposed campaign outcome: french');
      await confirm(0);
      await page
        .getByRole('button', { name: 'Confirm siege review', exact: true })
        .click();
      expect(
        (await snapshot(page)).fontenoy!.siege.campaign!.pendingReview,
      ).toBeNull();
      await expect(
        page.getByRole('textbox', {
          name: 'Checkpoint explanation',
          exact: true,
        }),
      ).toHaveValue(
        'Both players confirm investment and supply for the completed interval.',
      );
      await confirm(1);
      await page
        .getByRole('button', { name: 'Confirm siege review', exact: true })
        .click();
      const reviewed = await snapshot(page);
      expect(reviewed.fontenoy!.siege.progress).toBe(0);
      expect(reviewed.fontenoy!.siege.campaign!.victory).toBeNull();
      await app.close();
      app = await launchDesktop(profile, packaged);
      page = await app.firstWindow();
      expect((await snapshot(page)).fontenoy).toEqual(reviewed.fontenoy);
      await confirm(0);
      await page
        .getByRole('button', { name: 'Finish shared phase', exact: true })
        .click();
      expect((await snapshot(page)).fontenoy!.siege.progress).toBe(0);
      await confirm(1);
      await page
        .getByRole('button', { name: 'Finish shared phase', exact: true })
        .click();
      await expect(
        panel().getByRole('heading', {
          name: 'Campaign outcome: french',
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Finish shared phase', exact: true }),
      ).toBeDisabled();
      await expect(
        page.getByRole('button', {
          name: 'Resolve simultaneous movement',
          exact: true,
        }),
      ).toBeDisabled();
      const concluded = await snapshot(page);
      expect(concluded.fontenoy!.siege).toMatchObject({
        progress: 1,
        campaign: { victory: { winner: 'french', turn: 1 } },
      });
      await panel().screenshot({
        path: `test-results/${packaged ? 'packaged' : 'built'}-tournai-victory.png`,
      });
      const file = path.join(profile, 'tournai.json');
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
      ).toContainText('Tournai acceptance');
      expect((await snapshot(page)).fontenoy).toEqual(concluded.fontenoy);
      await app.close();
      app = await launchDesktop(destination, packaged);
      page = await app.firstWindow();
      expect((await snapshot(page)).fontenoy).toEqual(concluded.fontenoy);
      await expect(
        panel().getByRole('heading', {
          name: 'Campaign outcome: french',
          exact: true,
        }),
      ).toBeVisible();
    } finally {
      if (app && app.process().exitCode === null) {
        await confirm(1).catch(() => {});
        await app.close();
      }
      removeTestProfile(profile);
      removeTestProfile(destination);
    }
  });
