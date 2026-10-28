import { expect, test } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import path from 'node:path';
import { SqliteCampaignRepository } from '../../src/main/persistence/repository';
import type { FontenoyCampaign } from '../../src/domain/campaign';
import type {
  WaterlooCampaign,
  WaterlooCommand,
} from '../../src/domain/waterloo-schema';
import { unitBattleResult } from '../fixtures/simultaneous-aftermath';
import {
  launchDesktop,
  navigateTo,
  removeTestProfile,
  testProfile,
  showHelperChoice,
} from './profile';
async function current(page: Page) {
  const result = await page.evaluate(() => window.desktop.getCampaignLibrary());
  if (!result.ok || result.value.active?.schemaVersion !== 3)
    throw new Error('Expected operational campaign.');
  return result.value.active;
}
for (const packaged of [false, true])
  test(`${packaged ? 'packaged' : 'built'} manual Epic Points, correction totals and private portable history`, async () => {
    test.setTimeout(120000);
    const profile = testProfile(),
      destination = testProfile();
    const repo = new SqliteCampaignRepository(
      path.join(profile, 'campaigns.sqlite'),
    );
    const audit = { actor: 'Umpire', reason: 'Epic Points acceptance.' };
    const source = repo.create({ title: 'Points setup', ...audit })
      .active as FontenoyCampaign;
    for (const [index, column] of [
      [0, 5],
      [2, 7],
    ] as const)
      source.columns[index]!.squareId = source.squares.find(
        (s) => s.column === column && s.row === 4,
      )!.id;
    repo.saveSetup({
      id: source.id,
      expectedRevision: 1,
      columns: source.columns,
      commanders: source.commanders,
      settings: source.settings,
      ...audit,
    });
    repo.clone({
      id: source.id,
      expectedRevision: 2,
      profile: 'simultaneous_fontenoy',
      title: 'Epic acceptance',
      ...audit,
    });
    const active = () => repo.library().active as WaterlooCampaign;
    const act = (command: WaterlooCommand) =>
      repo.waterloo({
        id: active().id,
        expectedRevision: active().revision,
        command,
        ...audit,
      });
    for (const [side, index] of [
      ['french', 0],
      ['allied', 2],
    ] as const) {
      const c = active();
      act({
        kind: 'orders',
        side,
        lock: true,
        orders: [
          {
            corpsId: c.corps[index]!.id,
            priority: 0,
            segments: [
              {
                path: [c.corps[index]!.hexId!, '6,4'],
                startAt: 390,
                roadOnly: false,
                hqId: c.hqs.find((h) => h.army === c.corps[index]!.army)!.id,
              },
            ],
          },
        ],
      });
    }
    act({ kind: 'resolve' });
    act({
      kind: 'declare-battle',
      encounterId: active().encounters[0]!.id,
      title: 'Points battle',
    });
    act({
      kind: 'result',
      battleId: active().battles[0]!.id,
      result: unitBattleResult(active()),
      reason: 'Manual tabletop observations.',
    });
    act({ kind: 'approve-result', battleId: active().battles[0]!.id });
    act({ kind: 'resolve' });
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
      const panel = () => page.locator('[data-helper="epic"]');
      await showHelperChoice(page, 'Show me: Review optional Epic Points');
      await expect(panel()).toHaveAttribute('open');
      await confirm(0);
      await page
        .getByRole('button', { name: 'Enable manual Epic Points', exact: true })
        .click();
      expect((await current(page)).fontenoy!.epic).toBeUndefined();
      await confirm(1);
      await page
        .getByRole('button', { name: 'Enable manual Epic Points', exact: true })
        .click();
      await expect(
        panel().getByText('Recorded total:', { exact: false }).first(),
      ).toContainText('Not recorded');
      const opening = await current(page);
      await page
        .getByRole('button', { name: 'Record battle Epic Points', exact: true })
        .click();
      await page.getByLabel('French Epic Points', { exact: true }).fill('3');
      await page
        .getByLabel('Entry explanation', { exact: true })
        .fill('Reviewed from our own scoring materials.');
      await navigateTo(page, 'Settings');
      await showHelperChoice(page, 'Show me: Return to your edit');
      await expect(
        page.getByLabel('Allied Epic Points', { exact: true }),
      ).toHaveValue('');
      await confirm(0);
      await page
        .getByRole('button', { name: 'Confirm Epic Points entry', exact: true })
        .click();
      expect((await current(page)).fontenoy!.epic!.revisions).toHaveLength(0);
      await expect(
        page.getByLabel('French Epic Points', { exact: true }),
      ).toHaveValue('3');
      await confirm(1);
      await page
        .getByRole('button', { name: 'Confirm Epic Points entry', exact: true })
        .click();
      await expect(
        page.getByRole('form', { name: 'Epic Points entry', exact: true }),
      ).not.toBeVisible();
      await expect(
        panel().locator('[aria-label="French Epic Points summary"]'),
      ).toContainText('Recorded total: 3');
      await expect(
        panel().locator('[aria-label="Allied Epic Points summary"]'),
      ).toContainText('Not recorded');
      await page
        .getByRole('button', { name: 'Correct Points battle', exact: true })
        .click();
      await page.getByLabel('French Epic Points', { exact: true }).fill('0');
      await page.getByLabel('Allied Epic Points', { exact: true }).fill('0');
      await page
        .getByLabel('Correction reason', { exact: true })
        .fill('Corrected a transcription error after review.');
      await confirm(0);
      await page
        .getByRole('button', {
          name: 'Confirm Epic Points correction',
          exact: true,
        })
        .click();
      expect((await current(page)).fontenoy!.epic!.revisions).toHaveLength(1);
      await confirm(1);
      await page
        .getByRole('button', {
          name: 'Confirm Epic Points correction',
          exact: true,
        })
        .click();
      await expect(
        panel().locator('[aria-label="French Epic Points summary"]'),
      ).toContainText('Recorded total: 0');
      await expect(
        panel().locator('[aria-label="Allied Epic Points summary"]'),
      ).toContainText('Recorded total: 0');
      await page
        .getByRole('button', {
          name: 'Record campaign event points',
          exact: true,
        })
        .click();
      await page
        .getByLabel('Campaign event title', { exact: true })
        .fill('Private campaign event');
      await page.getByLabel('French Epic Points', { exact: true }).fill('2');
      await page
        .getByLabel('Entry explanation', { exact: true })
        .fill('Private umpire explanation.');
      await page
        .getByRole('button', { name: 'Confirm Epic Points entry', exact: true })
        .click();
      await expect(
        panel().locator('[aria-label="French Epic Points summary"]'),
      ).toContainText('Recorded total: 2');
      const saved = await current(page);
      expect(saved.fontenoy!.epic!.revisions).toHaveLength(3);
      expect(saved.battles).toEqual(opening.battles);
      expect(saved.fontenoy!.siege).toEqual(opening.fontenoy!.siege);
      expect(saved.fontenoy!.units).toEqual(opening.fontenoy!.units);
      // The ledger assertions above validate the data. Capture the viewport:
      // an oversized fixed drawer cannot always be scrolled into a stable box.
      await page.screenshot({
        path: `test-results/${packaged ? 'packaged' : 'built'}-epic-ledger.png`,
      });
      await page
        .getByRole('combobox', { name: 'Map view', exact: true })
        .selectOption('french');
      for (const secret of [
        'Private campaign event',
        'Private umpire explanation.',
        'Allied:',
        'Corrected a transcription',
      ])
        await expect(panel()).not.toContainText(secret);
      await expect(panel().getByRole('button')).toHaveCount(0);
      await app.close();
      app = await launchDesktop(profile, packaged);
      page = await app.firstWindow();
      expect((await current(page)).fontenoy).toEqual(saved.fontenoy);
      const file = path.join(profile, 'epic.json');
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
      ).toContainText('Epic acceptance');
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
