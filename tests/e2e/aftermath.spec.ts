import { expect, test } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import path from 'node:path';
import {
  navigateTo,
  launchDesktop,
  testProfile,
  removeTestProfile,
} from './profile';
import { SqliteCampaignRepository } from '../../src/main/persistence/repository';
import type { FontenoyCampaign } from '../../src/domain/campaign';
import { completedResult, declarationFor } from '../fixtures/tabletop';

async function snapshot(page: Page) {
  const result = await page.evaluate(() => window.desktop.getCampaignLibrary());
  if (!result.ok || result.value.active?.schemaVersion !== 2)
    throw new Error('Expected Fontenoy.');
  return { ...result.value, active: result.value.active };
}
for (const packaged of [false, true]) {
  test(`${packaged ? 'packaged' : 'built'} campaign aftermath, recovery, commanders and final-turn siege victory`, async () => {
    test.setTimeout(120000);
    const profile = testProfile();
    const destination = testProfile();
    const audit = {
      actor: 'Campaign tester',
      reason: 'Milestone F acceptance.',
    };
    const repo = new SqliteCampaignRepository(
      path.join(profile, 'campaigns.sqlite'),
    );
    const c = repo.create({ title: 'Aftermath acceptance', ...audit })
      .active as FontenoyCampaign;
    c.columns[3]!.squareId = c.squares.find(
      (s) => s.row === 2 && s.column === 4,
    )!.id;
    c.settings.schedule.turnCount = 2;
    c.settings.reviewedHouseRules = true;
    c.settings.reviewedSchematicMap = true;
    repo.saveSetup({
      id: c.id,
      expectedRevision: 1,
      settings: c.settings,
      columns: c.columns,
      commanders: c.commanders,
      ...audit,
    });
    repo.start({ id: c.id, expectedRevision: 2, ...audit });
    const ref = () => ({
      id: c.id,
      expectedRevision: repo.library().active!.revision,
      ...audit,
    });
    repo.operate({ ...ref(), command: { kind: 'enable' } });
    repo.operate({
      ...ref(),
      command: {
        kind: 'issue',
        orders: [
          {
            columnId: c.columns[0]!.id,
            path: [c.columns[0]!.squareId!, c.columns[3]!.squareId!],
          },
        ],
      },
    });
    repo.operate({ ...ref(), command: { kind: 'resolve' } });
    repo.tabletop({
      ...ref(),
      command: {
        kind: 'declare-battle',
        declaration: declarationFor(repo.library().active as FontenoyCampaign),
      },
    });
    const battle = (repo.library().active as FontenoyCampaign).tabletop!
      .battles[0]!;
    repo.tabletop({
      ...ref(),
      command: { kind: 'start-battle', battleId: battle.id },
    });
    const result = completedResult(battle);
    result.commanders[0]!.status = 'lost';
    result.armyMorale.french = 7;
    repo.tabletop({
      ...ref(),
      command: { kind: 'record-result', battleId: battle.id, result },
    });
    repo.close();
    let app: ElectronApplication | null = null;
    try {
      app = await launchDesktop(profile, packaged);
      let page = await app.firstWindow();
      await navigateTo(page, 'Siege & Victory');
      await page
        .getByRole('button', { name: 'Enable post-battle and siege rules' })
        .click();
      await page
        .getByRole('button', { name: 'Review campaign house rules' })
        .click();
      await page
        .getByRole('spinbutton', { name: 'Siege success threshold' })
        .fill('2');
      await page
        .getByRole('button', { name: 'Save campaign changes', exact: true })
        .click();
      await page
        .getByRole('button', {
          name: `Review aftermath: ${battle.declaration.title}`,
        })
        .click();
      await page
        .getByRole('spinbutton', { name: 'french Epic Points (optional)' })
        .fill('3');
      await page
        .getByRole('spinbutton', { name: 'french exhaustion added' })
        .fill('1');
      await page
        .getByRole('textbox', { name: 'After-action notes' })
        .fill('Both players approved these campaign changes.');
      await expect(
        page.getByRole('list', { name: 'Battle changes preview' }),
      ).toContainText('conscript');
      const beforeCancel = await snapshot(page);
      await app.evaluate(({ dialog }) => {
        dialog.showMessageBox = async () => ({
          response: 0,
          checkboxChecked: false,
        });
      });
      await page
        .getByRole('button', { name: 'Review and apply battle changes' })
        .click();
      await expect(
        page.getByText('No changes committed. Your draft is still available.'),
      ).toBeVisible();
      expect(await snapshot(page)).toEqual(beforeCancel);
      await navigateTo(page, 'Campaign Map');
      await expect(
        page.getByRole('region', { name: 'Campaign status' }),
      ).toContainText('Uncommitted tabletop draft');
      await navigateTo(page, 'Siege & Victory');
      await expect(
        page.getByRole('spinbutton', { name: 'french Epic Points (optional)' }),
      ).toHaveValue('3');
      await app.evaluate(({ dialog }) => {
        dialog.showMessageBox = async () => ({
          response: 1,
          checkboxChecked: false,
        });
      });
      await page
        .getByRole('button', { name: 'Review and apply battle changes' })
        .click();
      await expect(
        page.getByRole('region', { name: 'Post-battle reviews' }),
      ).toContainText('campaign changes applied');
      const applied = await snapshot(page);
      expect(applied.active.units[0]!.quality).toBe('conscript');
      expect(applied.active.units[0]!.currentStatus).toBe('recovering');
      expect(applied.active.aftermath!.exhaustion.french).toBe(1);
      expect(
        applied.active.aftermath!.reviews[0]!.input.epicPoints.french,
      ).toBe(3);
      expect(applied.active.commanders[0]!.campaignStatus).toBe('lost');
      expect(
        applied.active.columns.flatMap((column) => column.commanderIds),
      ).not.toContain(c.commanders[0]!.id);
      await page
        .getByRole('button', { name: 'Record arriving commander' })
        .click();
      await page
        .getByRole('textbox', { name: 'Commander name', exact: true })
        .fill('Player Notable');
      await page
        .getByRole('textbox', {
          name: 'Private Notable/card reference (optional)',
        })
        .fill('My private card title.');
      await page
        .getByRole('textbox', { name: 'Reason for campaign change' })
        .fill('Players verified arrival.');
      await page
        .getByRole('button', { name: 'Save campaign changes', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Manage attachment: Player Notable' })
        .click();
      await page
        .getByRole('combobox', { name: 'Attach to column' })
        .selectOption(c.columns[0]!.id);
      await page
        .getByRole('textbox', { name: 'Reason for campaign change' })
        .fill('Attached to the French column by agreement.');
      await page
        .getByRole('button', { name: 'Save campaign changes', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Record investment, supply and relief' })
        .click();
      await page
        .getByRole('checkbox', { name: 'Investment active', exact: true })
        .check();
      await page
        .getByRole('checkbox', { name: 'Supply route verified by umpire' })
        .check();
      await page
        .getByRole('textbox', { name: 'Reason for campaign change' })
        .fill('Investment and operational supply verified by both players.');
      await page
        .getByRole('button', { name: 'Save campaign changes', exact: true })
        .click();
      expect((await snapshot(page)).active.settings.siege.progress).toBe(0);
      await app.close();
      app = await launchDesktop(profile, packaged);
      page = await app.firstWindow();
      expect((await snapshot(page)).active.aftermath!.reviews).toHaveLength(1);
      const pass = async () => {
        await navigateTo(page, 'Turn Orders');
        await page
          .getByRole('button', { name: 'Issue orders', exact: true })
          .click();
        await app!.evaluate(({ dialog }) => {
          dialog.showMessageBox = async () => ({
            response: 1,
            checkboxChecked: false,
          });
        });
        await page
          .getByRole('button', { name: 'Resolve orders', exact: true })
          .click();
      };
      await pass();
      await navigateTo(page, 'Siege & Victory');
      await expect(
        page.getByRole('button', { name: 'Finalize turn 1', exact: true }),
      ).toBeEnabled();
      const beforeFinalize = await snapshot(page);
      await app.evaluate(({ dialog }) => {
        dialog.showMessageBox = async () => ({
          response: 0,
          checkboxChecked: false,
        });
      });
      await page
        .getByRole('button', { name: 'Finalize turn 1', exact: true })
        .click();
      expect(await snapshot(page)).toEqual(beforeFinalize);
      await app.evaluate(({ dialog }) => {
        dialog.showMessageBox = async () => ({
          response: 1,
          checkboxChecked: false,
        });
      });
      await page
        .getByRole('button', { name: 'Finalize turn 1', exact: true })
        .click();
      await expect(
        page.getByRole('region', { name: 'Campaign aftermath and siege' }),
      ).toContainText('Siege: 1 / 2');
      const recovered = await snapshot(page);
      expect(recovered.active.units[0]!.currentStatus).toBe('ready');
      expect(recovered.active.units[0]!.quality).toBe('conscript');
      expect(recovered.active.aftermath!.victory).toBeNull();
      await pass();
      await pass();
      await navigateTo(page, 'Siege & Victory');
      await page
        .getByRole('button', { name: 'Finalize turn 2', exact: true })
        .click();
      await expect(
        page.getByRole('heading', {
          name: 'Campaign outcome: french',
          exact: true,
        }),
      ).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `test-results/${packaged ? 'packaged' : 'built'}-campaign-outcome.png`,
      });
      const finished = await snapshot(page);
      expect(finished.active.settings.siege.progress).toBe(2);
      expect(finished.active.aftermath!.boundaries).toHaveLength(2);
      const backup = path.join(profile, 'campaign.json');
      await app.evaluate(({ dialog }, filename) => {
        dialog.showSaveDialog = async () => ({
          canceled: false,
          filePath: filename,
        });
      }, backup);
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
      await app.evaluate(({ dialog }, filename) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [filename],
        });
      }, backup);
      await page
        .getByRole('button', { name: 'Import JSON', exact: true })
        .click();
      await expect(
        page.getByRole('region', { name: 'Open campaign', exact: true }),
      ).toContainText('Aftermath acceptance');
      expect((await snapshot(page)).active.aftermath).toEqual(
        finished.active.aftermath,
      );
      await app.close();
      app = await launchDesktop(destination, packaged);
      page = await app.firstWindow();
      expect((await snapshot(page)).active.aftermath).toEqual(
        finished.active.aftermath,
      );
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
      removeTestProfile(destination);
    }
  });
}
