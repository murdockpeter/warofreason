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
  openDeskDrawer,
  closeDeskDrawer,
} from './profile';

async function snapshot(page: Page) {
  const data = await page.evaluate(() => window.desktop.getCampaignLibrary());
  if (!data.ok || data.value.active?.schemaVersion !== 3)
    throw new Error('Expected simultaneous campaign.');
  return { ...data.value, active: data.value.active };
}
for (const packaged of [false, true])
  test(`${packaged ? 'packaged' : 'built'} simultaneous Maurice result, conscript recovery and portable restart`, async () => {
    test.setTimeout(120000);
    const profile = testProfile(),
      destination = testProfile();
    const audit = {
      actor: 'Unit tester',
      reason: 'Reviewed simultaneous aftermath.',
    };
    const repo = new SqliteCampaignRepository(
      path.join(profile, 'campaigns.sqlite'),
    );
    const source = repo.create({ title: 'Recovery setup', ...audit })
      .active as FontenoyCampaign;
    source.columns[0]!.squareId = source.squares.find(
      (s) => s.column === 5 && s.row === 4,
    )!.id;
    source.columns[2]!.squareId = source.squares.find(
      (s) => s.column === 7 && s.row === 4,
    )!.id;
    repo.saveSetup({
      id: source.id,
      expectedRevision: 1,
      settings: source.settings,
      columns: source.columns,
      commanders: source.commanders,
      ...audit,
    });
    repo.clone({
      id: source.id,
      expectedRevision: 2,
      profile: 'simultaneous_fontenoy',
      title: 'Maurice recovery acceptance',
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
      await openDeskDrawer(page, 'Campaign tools');
      await page
        .getByText('Maurice unit recovery · not enabled', { exact: true })
        .click();
      await page
        .getByRole('button', {
          name: 'Review and enable unit recovery',
          exact: true,
        })
        .click();
      await expect(
        page.getByLabel('Calendar hours per recovery turn', { exact: true }),
      ).toHaveValue('48');
      await page
        .getByLabel('Calendar hours per recovery turn', { exact: true })
        .fill('1');
      await confirm(0);
      await page
        .getByRole('button', {
          name: 'Confirm unit recovery policy',
          exact: true,
        })
        .click();
      expect((await snapshot(page)).active.fontenoy!.aftermath).toBeUndefined();
      await expect(
        page.getByLabel('Calendar hours per recovery turn', { exact: true }),
      ).toHaveValue('1');
      await confirm(1);
      await page
        .getByRole('button', {
          name: 'Confirm unit recovery policy',
          exact: true,
        })
        .click();
      await expect(
        page.getByRole('form', { name: 'Maurice recovery policy' }),
      ).not.toBeVisible();
      await closeDeskDrawer(page, 'Campaign tools');
      const c = (await snapshot(page)).active;
      const unitName = c.fontenoy!.units[0]!.displayName;
      for (const [side, index] of [
        ['french', 0],
        ['allied', 2],
      ] as const) {
        await page
          .getByRole('combobox', { name: 'Planning side', exact: true })
          .selectOption(side);
        await page
          .getByRole('button', {
            name: `Select ${c.corps[index]!.name}`,
            exact: true,
          })
          .click();
        await page
          .getByRole('button', { name: 'Hex 6,4', exact: true })
          .click();
        await page
          .getByRole('button', { name: 'Save movement segment', exact: true })
          .click();
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
      await openDeskDrawer(page, 'Turn desk');
      await page
        .getByRole('button', { name: 'Declare tactical battle', exact: true })
        .click();
      const battle = () =>
        page.getByRole('article', { name: 'Battle at 6,4', exact: true });
      await battle()
        .getByRole('button', { name: 'Enter manual result', exact: true })
        .click();
      await page
        .getByLabel('Outcome', { exact: true })
        .fill('French marginal victory');
      await page
        .getByLabel('Battle duration in minutes', { exact: true })
        .fill('60');
      await page
        .getByRole('button', {
          name: 'Mark participating units survived',
          exact: true,
        })
        .click();
      await page
        .getByLabel(`Outcome for ${unitName}`, { exact: true })
        .selectOption('broken');
      await page
        .getByLabel(`Disruption for ${unitName}`, { exact: true })
        .selectOption('true');
      await page
        .getByLabel('french final Army Morale (optional)', { exact: true })
        .fill('7');
      await expect(
        page.getByRole('region', { name: 'Maurice campaign effects preview' }),
      ).toContainText('conscript / recovering');
      await confirm(0);
      await page
        .getByRole('button', {
          name: 'Review and confirm manual result',
          exact: true,
        })
        .click();
      await expect(
        page.getByLabel(`Outcome for ${unitName}`, { exact: true }),
      ).toHaveValue('broken');
      expect((await snapshot(page)).active.fontenoy!.units[0]!.quality).toBe(
        'elite',
      );
      await confirm(1);
      await page
        .getByRole('button', {
          name: 'Review and confirm manual result',
          exact: true,
        })
        .click();
      await expect(
        page.getByRole('form', { name: 'Manual tactical result', exact: true }),
      ).not.toBeVisible();
      await battle()
        .getByRole('button', { name: 'Approve campaign effects', exact: true })
        .click();
      expect(
        (await snapshot(page)).active.fontenoy!.units[0]!.currentStatus,
      ).toBe('ready');
      await page
        .getByRole('button', {
          name: 'Resolve simultaneous movement',
          exact: true,
        })
        .click();
      const applied = await snapshot(page);
      expect(applied.active.fontenoy!.units[0]).toMatchObject({
        quality: 'conscript',
        initialQuality: 'elite',
        currentStatus: 'recovering',
      });
      expect(applied.active.fontenoy!.aftermath!.recoveries).toHaveLength(1);
      await openDeskDrawer(page, 'Turn desk');
      await page
        .getByRole('region', { name: 'Maurice unit after-action record' })
        .screenshot({
          path: `test-results/${packaged ? 'packaged' : 'built'}-simultaneous-aftermath.png`,
        });
      await app.close();
      app = await launchDesktop(profile, packaged);
      page = await app.firstWindow();
      expect((await snapshot(page)).active.fontenoy).toEqual(
        applied.active.fontenoy,
      );
      await confirm(0);
      await page
        .getByRole('button', { name: 'Finish shared phase', exact: true })
        .click();
      expect(
        (await snapshot(page)).active.fontenoy!.units[0]!.currentStatus,
      ).toBe('recovering');
      await confirm(1);
      await page
        .getByRole('button', { name: 'Finish shared phase', exact: true })
        .click();
      const recovered = await snapshot(page);
      expect(recovered.active.fontenoy!.units[0]).toMatchObject({
        quality: 'conscript',
        currentStatus: 'ready',
      });
      expect(
        recovered.active.fontenoy!.aftermath!.recoveries[0]!.recoveredAt,
      ).toBeGreaterThanOrEqual(
        recovered.active.fontenoy!.aftermath!.recoveries[0]!.dueAt,
      );
      const file = path.join(profile, 'recovery.json');
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
      ).toContainText('Maurice recovery acceptance');
      expect((await snapshot(page)).active.fontenoy).toEqual(
        recovered.active.fontenoy,
      );
      await app.close();
      app = await launchDesktop(destination, packaged);
      page = await app.firstWindow();
      expect((await snapshot(page)).active.fontenoy).toEqual(
        recovered.active.fontenoy,
      );
    } finally {
      if (app && app.process().exitCode === null) {
        await confirm(1).catch(() => {});
        await app.close();
      }
      removeTestProfile(profile);
      removeTestProfile(destination);
    }
  });
