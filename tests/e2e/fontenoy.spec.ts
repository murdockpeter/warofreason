import { expect, test } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import path from 'node:path';
import { launchDesktop, removeTestProfile, testProfile } from './profile';
import { SqliteCampaignRepository } from '../../src/main/persistence/repository';
import { campaignFixture, exportFixture } from '../fixtures/campaign';

async function snapshot(page: Page) {
  const result = await page.evaluate(() => window.desktop.getCampaignLibrary());
  if (!result.ok) throw new Error(result.error.message);
  if (result.value.active?.schemaVersion !== 2)
    throw new Error('Expected configured Fontenoy campaign');
  return result.value.active;
}
for (const packaged of [false, true]) {
  test(`${packaged ? 'packaged' : 'built'} Fontenoy review, edited setup, start and transfer round trip`, async () => {
    test.setTimeout(90000);
    const profile = testProfile();
    const destination = testProfile();
    let app: ElectronApplication | null = null;
    try {
      app = await launchDesktop(profile, packaged);
      let page = await app.firstWindow();
      await page
        .getByRole('button', { name: 'New campaign', exact: true })
        .click();
      await page
        .getByRole('textbox', { name: 'Campaign title' })
        .fill('Fontenoy setup smoke');
      await page.getByRole('button', { name: 'Create and save' }).click();
      await expect(
        page.getByRole('region', { name: 'Open campaign', exact: true }),
      ).toContainText('French: 20');
      const seeded = await snapshot(page);
      await page.getByRole('button', { name: 'Review Fontenoy setup' }).click();
      await expect(page.getByText('French: 20', { exact: true })).toBeVisible();
      await expect(page.getByText('Allied: 18', { exact: true })).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Start Campaign', exact: true }),
      ).toBeDisabled();
      await expect(
        page.getByRole('img', {
          name: 'Schematic 12-column by 8-row map with eight named locations',
        }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Edit setup' }).click();
      const unit = seeded.units[0]!;
      await page
        .getByRole('combobox', {
          name: `Assign ${unit.displayName}`,
          exact: true,
        })
        .selectOption(seeded.columns[1]!.id);
      await page
        .getByRole('checkbox', {
          name: `Hidden ${seeded.columns[1]!.displayName}`,
        })
        .check();
      await page
        .getByRole('combobox', {
          name: `Opening square for ${seeded.columns[1]!.displayName}`,
        })
        .selectOption(
          seeded.squares.find((s) => s.locationName === 'Fontenoy')!.id,
        );
      await page.getByLabel('Opening date', { exact: true }).fill('1745-05-03');
      await page.getByLabel('Days per turn', { exact: true }).fill('1');
      await page.getByLabel('Number of turns', { exact: true }).fill('15');
      await page
        .getByLabel('First faction', { exact: true })
        .selectOption('allied');
      await page
        .getByLabel('Initial siege status', { exact: true })
        .selectOption('invested');
      await page
        .getByLabel('Initial siege progress', { exact: true })
        .fill('2');
      await page
        .getByLabel('Approximate kilometres per square (optional)', {
          exact: true,
        })
        .fill('3');
      await page
        .getByLabel('Proposed road from', { exact: true })
        .selectOption(seeded.squares[0]!.id);
      await page
        .getByLabel('Proposed road to', { exact: true })
        .selectOption(seeded.squares[1]!.id);
      await page.getByRole('button', { name: 'Add proposed road' }).click();
      await page
        .getByRole('checkbox', {
          name: 'I reviewed the provisional operational setup and schedule.',
        })
        .check();
      await page
        .getByRole('checkbox', {
          name: 'I understand the map is schematic and routes are unverified.',
        })
        .check();
      await expect(
        page.getByRole('button', { name: 'Start Campaign', exact: true }),
      ).toBeDisabled();
      await app.evaluate(({ app, dialog, BrowserWindow }) => {
        Reflect.set(app, 'setupClosePrompts', 0);
        dialog.showMessageBoxSync = () => {
          Reflect.set(
            app,
            'setupClosePrompts',
            Number(Reflect.get(app, 'setupClosePrompts')) + 1,
          );
          return 0;
        };
        BrowserWindow.getAllWindows()[0]!.close();
      });
      await expect
        .poll(() =>
          app!.evaluate(({ app }) => Reflect.get(app, 'setupClosePrompts')),
        )
        .toBe(1);
      await expect(
        page.getByLabel('Opening date', { exact: true }),
      ).toHaveValue('1745-05-03');
      await page.getByRole('button', { name: 'Save setup' }).click();
      await expect(
        page.getByRole('button', { name: 'Start Campaign', exact: true }),
      ).toBeEnabled();
      const reviewed = await snapshot(page);
      expect(reviewed.columns[0]!.unitIds).toHaveLength(9);
      expect(reviewed.columns[1]!.unitIds).toHaveLength(11);
      expect(reviewed.squares).toEqual(seeded.squares);
      expect(reviewed.units).toEqual(seeded.units);
      expect(reviewed.settings.map.roadEdges).toHaveLength(1);
      await app.evaluate(({ dialog }) => {
        dialog.showMessageBox = async () => ({
          response: 0,
          checkboxChecked: false,
        });
      });
      await page
        .getByRole('button', { name: 'Start Campaign', exact: true })
        .click();
      await expect(
        page.getByRole('button', { name: 'Start Campaign', exact: true }),
      ).toBeEnabled();
      expect((await snapshot(page)).status).toBe('draft');
      await app.evaluate(({ dialog }) => {
        dialog.showMessageBox = async () => ({
          response: 1,
          checkboxChecked: false,
        });
      });
      await page
        .getByRole('button', { name: 'Start Campaign', exact: true })
        .click();
      await expect(
        page.getByRole('region', { name: 'Campaign status' }),
      ).toContainText('1745-05-03');
      await expect(
        page.getByRole('region', { name: 'Campaign status' }),
      ).toContainText('allied');
      const started = await snapshot(page);
      expect(started.status).toBe('active');
      expect(started.turn).toBe(1);
      expect(started.columns[1]!.concealment).toBe('hidden');
      await page
        .getByRole('region', { name: 'Fontenoy setup review' })
        .screenshot({
          path: `test-results/${packaged ? 'packaged' : 'built'}-setup-review.png`,
        });
      await page
        .getByRole('region', { name: 'Schematic campaign map' })
        .screenshot({
          path: `test-results/${packaged ? 'packaged' : 'built'}-fontenoy-map.png`,
        });
      await app.close();
      app = null;
      app = await launchDesktop(profile, packaged);
      page = await app.firstWindow();
      await expect(
        page.getByRole('region', { name: 'Open campaign', exact: true }),
      ).toContainText('Campaign started');
      expect(await snapshot(page)).toEqual(started);
      const filename = path.join(profile, 'fontenoy.json');
      await app.evaluate(({ dialog }, filename) => {
        dialog.showSaveDialog = async () => ({
          canceled: false,
          filePath: filename,
        });
      }, filename);
      await page.getByRole('button', { name: 'Export saved JSON' }).click();
      await expect(page.getByRole('status')).toContainText('exported');
      await app.close();
      app = null;
      app = await launchDesktop(destination, packaged);
      page = await app.firstWindow();
      await app.evaluate(({ dialog }, filename) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [filename],
        });
      }, filename);
      await page.getByRole('button', { name: 'Import JSON' }).click();
      await expect(
        page.getByRole('region', { name: 'Open campaign', exact: true }),
      ).toContainText('Campaign started');
      const imported = await snapshot(page);
      expect(imported.units).toEqual(started.units);
      expect(imported.columns).toEqual(started.columns);
      expect(imported.settings).toEqual(started.settings);
      await page
        .getByRole('button', { name: 'Campaign Map', exact: true })
        .click();
      await expect(
        page.getByRole('img', {
          name: 'Schematic 12-column by 8-row map with eight named locations',
        }),
      ).toBeVisible();
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
test('existing Milestone B profile loads unchanged, then explicitly loads the module without losing history', async () => {
  const profile = testProfile();
  let app: ElectronApplication | null = null;
  try {
    const legacy = campaignFixture();
    legacy.factions = [];
    legacy.units = [];
    legacy.commanders = [];
    legacy.columns = [];
    legacy.squares = [];
    const repository = new SqliteCampaignRepository(
      path.join(profile, 'campaigns.sqlite'),
    );
    repository.importCampaign(exportFixture(legacy));
    const old = repository.library();
    repository.close();
    app = await launchDesktop(profile);
    const page = await app.firstWindow();
    await expect(
      page.getByRole('region', { name: 'Open campaign', exact: true }),
    ).toContainText('Saved legacy draft');
    const before = await page.evaluate(() =>
      window.desktop.getCampaignLibrary(),
    );
    expect(before.ok && before.value.active?.schemaVersion).toBe(1);
    await page.getByRole('button', { name: 'Load Fontenoy setup' }).click();
    await page.getByRole('button', { name: 'Load Fontenoy setup' }).click();
    await expect(page.getByText('French: 20', { exact: true })).toBeVisible();
    const result = await page.evaluate(() =>
      window.desktop.getCampaignLibrary(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.active?.id).toBe(legacy.id);
    expect(result.value.active?.title).toBe(legacy.title);
    expect(result.value.events.slice(0, -1)).toEqual(old.events);
    expect(result.value.events.at(-1)?.category).toBe('scenario_loaded');
  } finally {
    if (app) await app.close();
    removeTestProfile(profile);
  }
});
