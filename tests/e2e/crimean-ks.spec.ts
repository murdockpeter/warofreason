import { almaRoster } from '../../src/domain/alma-roster';
import { expect, test } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { SqliteCampaignRepository } from '../../src/main/persistence/repository';
import { ksExportSchema } from '../../src/domain/crimean-ks';
import {
  launchDesktop,
  testProfile,
  removeTestProfile,
  openDeskDrawer,
  closeDeskDrawer,
} from './profile';
async function snapshot(page: Page) {
  const result = await page.evaluate(() => window.desktop.getKsLibrary());
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}
async function clickMap(page: Page, x: number, y: number) {
  const client = await page.locator('.ks-period-map').evaluate(
    (svg, p) => {
      const element = svg as SVGSVGElement,
        image = element.querySelector('image')!;
      const point = new DOMPoint(
        p.x * Number(image.getAttribute('width')),
        p.y * Number(image.getAttribute('height')),
      ).matrixTransform(element.getScreenCTM()!);
      return { x: point.x, y: point.y };
    },
    { x, y },
  );
  await page.mouse.click(client.x, client.y);
}
test('a newer Free KS database is preserved and does not block the existing Maurice module', async () => {
  const profile = testProfile(),
    repository = new SqliteCampaignRepository(
      path.join(profile, 'campaigns.sqlite'),
    );
  const old = repository.create({
    title: 'Maurice remains available',
    profile: 'simultaneous_fontenoy',
    actor: 'Test player',
    reason: 'Independent module recovery.',
  });
  repository.close();
  const database = new DatabaseSync(path.join(profile, 'free-ks.sqlite'));
  database.exec('PRAGMA user_version=99');
  database.close();
  let app: ElectronApplication | null = null;
  try {
    app = await launchDesktop(profile);
    const page = await app.firstWindow();
    await page
      .getByRole('combobox', { name: 'Campaign module', exact: true })
      .selectOption('crimean');
    await expect(page.getByRole('alert')).toContainText(
      'Unsupported Free KS storage version',
    );
    await page
      .getByRole('combobox', { name: 'Campaign module', exact: true })
      .selectOption('maurice');
    const result = await page.evaluate(() =>
      window.desktop.getCampaignLibrary(),
    );
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value).toEqual(old);
    await app.close();
    app = null;
    const check = new DatabaseSync(path.join(profile, 'free-ks.sqlite'));
    expect(check.prepare('PRAGMA user_version').get()?.user_version).toBe(99);
    check.close();
  } finally {
    if (app && app.process().exitCode === null) await app.close();
    removeTestProfile(profile);
  }
});
for (const packaged of [false, true])
  test(`${packaged ? 'packaged' : 'built'} independent offline Crimean Free KS: force, intent, ruling, sheet transfer, export and restart`, async () => {
    test.setTimeout(120000);
    const profile = testProfile(),
      repo = new SqliteCampaignRepository(
        path.join(profile, 'campaigns.sqlite'),
      );
    const original = repo.create({
      title: 'Preserved Maurice campaign',
      profile: 'simultaneous_fontenoy',
      actor: 'Test player',
      reason: 'Module isolation acceptance.',
    });
    repo.close();
    let app: ElectronApplication | null = null;
    try {
      app = await launchDesktop(profile, packaged);
      await app.evaluate(({ dialog }) => {
        dialog.showMessageBoxSync = () => 1;
      });
      let page = await app.firstWindow();
      await page.context().setOffline(true);
      await page
        .getByRole('combobox', { name: 'Campaign module', exact: true })
        .selectOption('crimean');
      await page
        .getByRole('button', { name: 'New Crimean KS', exact: true })
        .click();
      await page
        .getByRole('textbox', { name: 'Campaign title', exact: true })
        .fill('Crimean KS acceptance');
      await page
        .getByRole('button', { name: 'Create KS campaign', exact: true })
        .click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page
        .getByRole('button', { name: 'Add force', exact: true })
        .click();
      await clickMap(page, 0.45, 0.6);
      await page
        .getByRole('textbox', { name: 'Force name', exact: true })
        .fill('Test British brigade');
      await page
        .getByRole('combobox', { name: 'Allegiance', exact: true })
        .selectOption('britain');
      await page
        .getByRole('textbox', { name: 'Reported strength', exact: true })
        .fill('3 battalions — umpire scenario entry');
      await page
        .getByRole('button', { name: 'Record ruling', exact: true })
        .click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      const added = await snapshot(page),
        force = added.active!.forces[0]!;
      expect(force.position.x).toBeCloseTo(0.45);
      expect(force.position.y).toBeCloseTo(0.6);
      await page
        .getByRole('button', {
          name: 'Force Test British brigade',
          exact: true,
        })
        .click({ button: 'right' });
      await page
        .getByRole('menuitem', { name: 'Draw planned route', exact: true })
        .click();
      await clickMap(page, 0.52, 0.55);
      await clickMap(page, 0.6, 0.57);
      await page
        .getByRole('button', { name: 'Record intent', exact: true })
        .click();
      await page
        .getByRole('textbox', { name: 'Order / intent', exact: true })
        .fill('March towards the next village, subject to umpire decision.');
      await page
        .getByRole('button', { name: 'Record ruling', exact: true })
        .click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      const planned = await snapshot(page);
      expect(planned.active!.forces[0]!.position).toEqual(force.position);
      await expect(
        page.getByRole('img', {
          name: 'Planned intent for Test British brigade',
          exact: true,
        }),
      ).toBeVisible();
      await page
        .getByRole('button', {
          name: 'Force Test British brigade',
          exact: true,
        })
        .click({ button: 'right' });
      await page
        .getByRole('menuitem', { name: 'Move / transfer force', exact: true })
        .click();
      await page
        .getByRole('combobox', { name: 'Map sheet', exact: true })
        .selectOption('sevastopol_airey_1856');
      await clickMap(page, 0.42, 0.55);
      await expect(page.getByRole('dialog')).toContainText(
        'transfers the same force',
      );
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      expect(await snapshot(page)).toEqual(planned);
      await page
        .getByRole('combobox', { name: 'Map sheet', exact: true })
        .selectOption('crimea_wyld_1855');
      await page
        .getByRole('button', {
          name: 'Force Test British brigade',
          exact: true,
        })
        .click({ button: 'right' });
      await page
        .getByRole('menuitem', { name: 'Move / transfer force', exact: true })
        .click();
      await page
        .getByRole('combobox', { name: 'Map sheet', exact: true })
        .selectOption('sevastopol_airey_1856');
      await clickMap(page, 0.42, 0.55);
      await page
        .getByRole('textbox', { name: 'Ruling and rationale', exact: true })
        .fill(
          'Agreed destination on the detailed sheet; this is a manual placement, not automatic georeferencing.',
        );
      await page
        .getByRole('button', { name: 'Record ruling', exact: true })
        .click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      const moved = (await snapshot(page)).active!.forces[0]!;
      expect(moved.id).toBe(force.id);
      expect(moved.mapId).toBe('sevastopol_airey_1856');
      expect(moved.intent).toBeNull();
      expect(moved.strength).toBe(force.strength);
      await page
        .getByRole('button', { name: 'Set campaign time', exact: true })
        .click();
      await page
        .getByRole('textbox', { name: 'Campaign time', exact: true })
        .fill('20 September 1854, 09:00');
      await page
        .getByRole('textbox', { name: 'Ruling and rationale', exact: true })
        .fill('Agreed scenario time; no automatic travel duration.');
      await page
        .getByRole('button', { name: 'Record ruling', exact: true })
        .click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page
        .getByRole('button', { name: 'Record adjudication', exact: true })
        .click();
      await page
        .getByRole('textbox', {
          name: 'Umpire note / adjudication',
          exact: true,
        })
        .fill(
          'Umpire discussion: the road remains usable; no automatic combat result.',
        );
      await page
        .getByRole('button', { name: 'Record ruling', exact: true })
        .click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page
        .getByRole('button', { name: 'Find selected force', exact: true })
        .click();
      await page.screenshot({
        path: `release/ui-review/${packaged ? 'packaged' : 'built'}-crimean-ks-detail.png`,
      });
      await openDeskDrawer(page, 'Ruling journal');
      await expect(
        page.getByRole('region', {
          name: 'Ruling journal drawer',
          exact: true,
        }),
      ).toContainText('20 September 1854, 09:00');
      await closeDeskDrawer(page, 'Ruling journal');
      await openDeskDrawer(page, 'KS campaigns');
      const exportedFile = path.join(profile, 'crimean-roundtrip.json');
      await app.evaluate(({ dialog }, file) => {
        dialog.showSaveDialog = async () => ({
          canceled: false,
          filePath: file,
        });
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [file],
        });
      }, exportedFile);
      await page
        .getByRole('button', { name: 'Export KS JSON', exact: true })
        .click();
      await expect
        .poll(() => {
          try {
            return ksExportSchema.parse(
              JSON.parse(readFileSync(exportedFile, 'utf8')),
            ).campaign.title;
          } catch {
            return '';
          }
        })
        .toBe('Crimean KS acceptance');
      const saved = await snapshot(page);
      await page
        .getByRole('button', { name: 'Import KS JSON', exact: true })
        .click();
      await expect(page.getByRole('alert')).toContainText('already present');
      expect(await snapshot(page)).toEqual(saved);
      await closeDeskDrawer(page, 'KS campaigns');
      await page
        .getByRole('combobox', { name: 'Campaign module', exact: true })
        .selectOption('maurice');
      const preserved = await page.evaluate(() =>
        window.desktop.getCampaignLibrary(),
      );
      if (!preserved.ok) throw new Error(preserved.error.message);
      expect(preserved.value).toEqual(original);
      await page
        .getByRole('combobox', { name: 'Campaign module', exact: true })
        .selectOption('crimean');
      await app.close();
      app = await launchDesktop(profile, packaged);
      page = await app.firstWindow();
      await expect(
        page.getByRole('combobox', { name: 'Campaign module', exact: true }),
      ).toHaveValue('crimean');
      await expect
        .poll(async () => (await snapshot(page)).active?.id)
        .toBe(saved.active!.id);
      expect(await snapshot(page)).toEqual(saved);
      await page
        .getByRole('combobox', { name: 'Map sheet', exact: true })
        .selectOption('sevastopol_airey_1856');
      await expect(
        page.getByRole('button', {
          name: 'Force Test British brigade',
          exact: true,
        }),
      ).toBeVisible();
    } finally {
      if (app && app.process().exitCode === null) await app.close();
      removeTestProfile(profile);
    }
  });

for (const packaged of [false, true])
  test(`${packaged ? 'packaged' : 'built'} Alma deployment tray: load, select, preview, cancel, deploy and restart`, async () => {
    test.setTimeout(120000);
    const profile = testProfile();
    let app: ElectronApplication | null = null;
    try {
      app = await launchDesktop(profile, packaged);
      let page = await app.firstWindow();
      await page
        .getByRole('combobox', { name: 'Campaign module', exact: true })
        .selectOption('crimean');
      await page
        .getByRole('button', { name: 'New Crimean KS', exact: true })
        .click();
      await page
        .getByRole('textbox', { name: 'Campaign title', exact: true })
        .fill('Alma deployment acceptance');
      await page
        .getByRole('button', { name: 'Create KS campaign', exact: true })
        .click();
      await openDeskDrawer(page, 'Deployment Area');
      await page
        .getByRole('button', { name: 'Review Alma roster & sources' })
        .click();
      await expect(page.getByRole('dialog')).toContainText(
        'Ottoman contingent remains an aggregate',
      );
      await page
        .getByRole('button', { name: 'Load Alma roster into deployment area' })
        .click();
      await expect
        .poll(
          async () =>
            (await snapshot(page)).active?.deploymentArea?.forces.length,
        )
        .toBe(almaRoster.entries.length);
      expect((await snapshot(page)).active!.forces).toEqual([]);
      await page
        .getByRole('textbox', { name: 'Search deployment area' })
        .fill('Codrington');
      await page
        .getByRole('button', { name: 'Select visible (3)', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Place selected (3)', exact: true })
        .click();
      await clickMap(page, 0.5, 0.5);
      await expect(
        page.getByRole('img', { name: /Deployment preview/ }),
      ).toHaveCount(3);
      expect((await snapshot(page)).active!.forces).toEqual([]);
      await page.getByRole('button', { name: 'Cancel map action' }).click();
      await expect(
        page.getByRole('img', { name: /Deployment preview/ }),
      ).toHaveCount(0);
      await openDeskDrawer(page, 'Deployment Area');
      await page
        .getByRole('button', { name: 'Place selected (3)', exact: true })
        .click();
      await clickMap(page, 0.5, 0.5);
      await page
        .getByRole('combobox', { name: 'Map sheet', exact: true })
        .selectOption('sevastopol_airey_1856');
      await expect(
        page.getByRole('img', { name: /Deployment preview/ }),
      ).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: 'Confirm deployment (3)' }),
      ).toBeDisabled();
      await clickMap(page, 0.55, 0.5);
      await page.screenshot({
        path: `release/ui-review/alma-${packaged ? 'packaged' : 'built'}-preview.png`,
      });
      await page
        .getByRole('button', { name: 'Confirm deployment (3)' })
        .click();
      await expect
        .poll(async () => (await snapshot(page)).active!.forces.length)
        .toBe(3);
      const saved = await snapshot(page);
      expect(saved.active!.deploymentArea!.forces).toHaveLength(
        almaRoster.entries.length - 3,
      );
      expect(
        saved.active!.forces.every(
          (f) => f.mapId === 'sevastopol_airey_1856' && f.historical,
        ),
      ).toBe(true);
      await openDeskDrawer(page, 'Deployment Area');
      await page
        .getByRole('button', { name: 'Review Alma roster & sources' })
        .click();
      await expect(
        page.getByRole('button', { name: 'Alma roster already loaded' }),
      ).toBeDisabled();
      await page
        .getByRole('dialog')
        .getByRole('button', { name: /^Close / })
        .click();
      await closeDeskDrawer(page, 'Deployment Area');
      await page
        .getByRole('button', { name: 'Inspect selected', exact: true })
        .click();
      await expect(page.getByRole('dialog')).toContainText('source identity');
      await page.screenshot({
        path: `release/ui-review/alma-${packaged ? 'packaged' : 'built'}-source.png`,
      });
      await page
        .getByRole('dialog')
        .getByRole('button', { name: /^Close / })
        .click();
      await app.close();
      app = await launchDesktop(profile, packaged);
      page = await app.firstWindow();
      await expect
        .poll(async () => (await snapshot(page)).active?.id)
        .toBe(saved.active!.id);
      expect(await snapshot(page)).toEqual(saved);
    } finally {
      if (app && app.process().exitCode === null) await app.close();
      removeTestProfile(profile);
    }
  });
