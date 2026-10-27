import { expect, test } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import path from 'node:path';
import { SqliteCampaignRepository } from '../../src/main/persistence/repository';
import type {
  WaterlooCampaign,
  WaterlooCommand,
} from '../../src/domain/waterloo-schema';
import {
  launchDesktop,
  navigateTo,
  removeTestProfile,
  testProfile,
  showHelperChoice,
  openDeskDrawer,
} from './profile';
async function current(page: Page) {
  const result = await page.evaluate(() => window.desktop.getCampaignLibrary());
  if (!result.ok || result.value.active?.schemaVersion !== 3)
    throw new Error('Expected operational campaign.');
  return result.value.active;
}
async function act(page: Page, command: WaterlooCommand) {
  const c = await current(page);
  const result = await page.evaluate(
    async ({ c, command }) =>
      window.desktop.commitWaterlooAction({
        id: c.id,
        expectedRevision: c.revision,
        command,
        actor: 'Umpire',
        reason: 'Scouting movement acceptance.',
      }),
    { c, command },
  );
  if (!result.ok) throw new Error(JSON.stringify(result));
}
for (const packaged of [false, true])
  test(`${packaged ? 'packaged' : 'built'} scouting requests, dated map reports, corrections, expiry and portable history`, async () => {
    test.setTimeout(120000);
    const profile = testProfile(),
      destination = testProfile();
    const repo = new SqliteCampaignRepository(
      path.join(profile, 'campaigns.sqlite'),
    );
    const initial = repo.create({
      title: 'Scouting acceptance',
      profile: 'simultaneous_fontenoy',
      actor: 'Umpire',
      reason: 'Test setup',
    }).active as WaterlooCampaign;
    repo.close();
    let app: ElectronApplication | null = null;
    const confirm = (response: number) =>
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
      await navigateTo(page, 'Campaign Map');
      await page
        .getByRole('combobox', { name: 'Map view', exact: true })
        .selectOption('french');
      await expect(
        page.getByRole('button', {
          name: 'Select opposing corps',
          exact: true,
        }),
      ).toHaveCount(0);
      await page
        .getByRole('button', {
          name: `Select ${initial.corps[0]!.name}`,
          exact: true,
        })
        .click({ button: 'right' });
      await page
        .getByRole('menuitem', { name: 'Scout an area…', exact: true })
        .click();
      await page.getByRole('button', { name: 'Hex 6,4', exact: true }).click();
      await page
        .getByRole('textbox', { name: 'Scouting question', exact: true })
        .fill('Observe this road for enemy troops.');
      await navigateTo(page, 'Settings');
      await navigateTo(page, 'Campaign Map');
      await expect(
        page.getByRole('combobox', { name: 'Area to scout', exact: true }),
      ).toHaveValue('6,4');
      await confirm(0);
      await page
        .getByRole('button', { name: 'Confirm scouting request', exact: true })
        .click();
      expect((await current(page)).fontenoy!.intelligence).toBeUndefined();
      await expect(
        page.getByRole('textbox', { name: 'Scouting question', exact: true }),
      ).toHaveValue('Observe this road for enemy troops.');
      await confirm(1);
      await page
        .getByRole('button', { name: 'Confirm scouting request', exact: true })
        .click();
      await expect
        .poll(
          async () =>
            (await current(page)).fontenoy!.intelligence?.requests.length,
        )
        .toBe(1);
      await page
        .getByRole('combobox', { name: 'Map view', exact: true })
        .selectOption('umpire');
      const panel = () => page.locator('[data-helper="intelligence"]');
      await showHelperChoice(page, 'Show me: Review scouting requests');
      await expect(panel()).toHaveAttribute('open');
      await page
        .getByRole('button', { name: 'Review scouting request', exact: true })
        .click();
      await page
        .getByRole('combobox', { name: 'Released intelligence', exact: true })
        .selectOption('estimated');
      await page
        .getByRole('textbox', { name: 'Released label', exact: true })
        .fill('Distant infantry');
      await page
        .getByRole('textbox', { name: 'Released details', exact: true })
        .fill('Two units estimated near the road.');
      await page
        .getByRole('textbox', { name: 'Message to player', exact: true })
        .fill('Approved observation only.');
      await page
        .getByRole('textbox', { name: 'Private umpire rationale', exact: true })
        .fill('PRIVATE TEST RATIONALE');
      await confirm(0);
      await page
        .getByRole('button', {
          name: 'Confirm intelligence report',
          exact: true,
        })
        .click();
      expect(
        (await current(page)).fontenoy!.intelligence!.reports,
      ).toHaveLength(0);
      await expect(
        page.getByRole('textbox', { name: 'Released label', exact: true }),
      ).toHaveValue('Distant infantry');
      await confirm(1);
      await page
        .getByRole('button', {
          name: 'Confirm intelligence report',
          exact: true,
        })
        .click();
      await expect
        .poll(
          async () =>
            (await current(page)).fontenoy!.intelligence!.reports.length,
        )
        .toBe(1);
      await page
        .getByRole('combobox', { name: 'Map view', exact: true })
        .selectOption('french');
      await page
        .getByRole('button', {
          name: 'Intelligence report at 6,4 · observed phase 1',
          exact: true,
        })
        .click();
      const dossier = page.getByRole('dialog', {
        name: 'Dated intelligence',
        exact: true,
      });
      await expect(dossier).toContainText('Two units estimated near the road.');
      await expect(page.locator('body')).not.toContainText(
        'PRIVATE TEST RATIONALE',
      );
      await page
        .getByRole('button', { name: 'Close Dated intelligence', exact: true })
        .click();
      await page.screenshot({
        path: `test-results/intelligence-${packaged ? 'packaged' : 'built'}.png`,
        fullPage: true,
      });
      // Move the enemy through actual journalled orders; the report must stay at its released hex.
      const before = await current(page),
        enemy = before.corps[2]!;
      await act(page, {
        kind: 'orders',
        side: 'french',
        orders: [],
        lock: true,
      });
      await act(page, {
        kind: 'orders',
        side: 'allied',
        orders: [
          {
            corpsId: enemy.id,
            priority: 0,
            segments: [
              {
                path: [enemy.hexId!, '7,1'],
                hqId: before.hqs.find((h) => h.army === enemy.army)!.id,
                roadOnly: false,
                startAt: 390,
              },
            ],
          },
        ],
        lock: true,
      });
      await act(page, { kind: 'resolve' });
      const moved = await current(page);
      expect(moved.corps[2]!.hexId).toBe('7,1');
      expect(moved.fontenoy!.intelligence!.reports[0]!.input).toEqual(
        before.fontenoy!.intelligence!.reports[0]!.input,
      );
      await page.reload();
      await navigateTo(page, 'Campaign Map');
      await page
        .getByRole('combobox', { name: 'Map view', exact: true })
        .selectOption('french');
      await expect(
        page.getByRole('button', {
          name: 'Intelligence report at 6,4 · observed phase 1',
          exact: true,
        }),
      ).toBeVisible();
      await page
        .getByRole('combobox', { name: 'Map view', exact: true })
        .selectOption('umpire');
      await openDeskDrawer(page, 'Intelligence');
      await panel().locator('summary').first().click();
      await page
        .getByRole('button', { name: 'Correct / withdraw report', exact: true })
        .click();
      await page
        .getByRole('textbox', { name: 'Released details', exact: true })
        .fill('Corrected estimate: one unit.');
      await page
        .getByRole('textbox', { name: 'Private umpire rationale', exact: true })
        .fill('Corrected transcription.');
      await page
        .getByRole('button', {
          name: 'Confirm intelligence report',
          exact: true,
        })
        .click();
      await expect
        .poll(
          async () =>
            (await current(page)).fontenoy!.intelligence!.reports.length,
        )
        .toBe(2);
      await page
        .getByRole('combobox', { name: 'Map view', exact: true })
        .selectOption('allied');
      await expect(
        page.getByRole('button', { name: /^Intelligence report at/ }),
      ).toHaveCount(0);
      await expect(page.locator('body')).not.toContainText(
        'Corrected estimate: one unit.',
      );
      await act(page, { kind: 'finalize' });
      await page.reload();
      await navigateTo(page, 'Campaign Map');
      await page
        .getByRole('combobox', { name: 'Map view', exact: true })
        .selectOption('french');
      await expect(
        page.getByRole('button', { name: /^Intelligence report at/ }),
      ).toHaveCount(0);
      await expect(page.locator('body')).not.toContainText(
        'Corrected estimate: one unit.',
      );
      const saved = await current(page);
      await app.close();
      app = await launchDesktop(profile, packaged);
      page = await app.firstWindow();
      expect((await current(page)).fontenoy!.intelligence).toEqual(
        saved.fontenoy!.intelligence,
      );
      const file = path.join(profile, 'intelligence.json');
      await app.evaluate(({ dialog }, filePath) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath });
      }, file);
      await navigateTo(page, 'Dashboard');
      await page
        .getByRole('button', { name: 'Export saved JSON', exact: true })
        .click();
      await expect(
        page.getByText('Saved campaign and journal exported.', { exact: true }),
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
      ).toContainText('Scouting acceptance');
      expect((await current(page)).fontenoy!.intelligence).toEqual(
        saved.fontenoy!.intelligence,
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
