import { expect, test } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import path from 'node:path';
import { SqliteCampaignRepository } from '../../src/main/persistence/repository';
import type { WaterlooCampaign } from '../../src/domain/waterloo-schema';
import {
  launchDesktop,
  testProfile,
  removeTestProfile,
  openDeskDrawer,
  closeDeskDrawer,
} from './profile';
async function snapshot(page: Page) {
  const result = await page.evaluate(() => window.desktop.getCampaignLibrary());
  if (!result.ok) throw new Error(result.error.message);
  return result.value.active as WaterlooCampaign;
}
for (const packaged of [false, true])
  test(`${packaged ? 'packaged' : 'built'} regional expansion, navigation and manual maneuver survive restart`, async () => {
    test.setTimeout(120000);
    const profile = testProfile(),
      file = path.join(profile, 'campaigns.sqlite');
    const repo = new SqliteCampaignRepository(file);
    const old = repo.create({
      title: 'Regional maneuver acceptance',
      profile: 'simultaneous_fontenoy',
      actor: 'Test umpire',
      reason: 'Original map compatibility.',
    }).active as WaterlooCampaign;
    repo.close();
    let app: ElectronApplication | null = null;
    try {
      app = await launchDesktop(profile, packaged);
      let page = await app.firstWindow();
      await page.context().setOffline(true);
      const confirmation = async (response: number) =>
        app!.evaluate(({ dialog }, choice) => {
          dialog.showMessageBox = async () => ({
            response: choice,
            checkboxChecked: false,
          });
          dialog.showMessageBoxSync = () => 1;
        }, response);
      await confirmation(0);
      await page
        .getByRole('combobox', { name: 'Map view', exact: true })
        .selectOption('umpire');
      await openDeskDrawer(page, 'Map options');
      await page
        .getByRole('button', { name: 'Expand campaign map', exact: true })
        .click();
      expect(await snapshot(page)).toEqual(old);
      await confirmation(1);
      await page
        .getByRole('button', { name: 'Expand campaign map', exact: true })
        .click();
      await expect(
        page.getByRole('heading', {
          name: 'Regional map: 36 by 24 hexes',
          exact: true,
        }),
      ).toBeVisible();
      const expanded = await snapshot(page);
      expect(expanded.hexes).toHaveLength(864);
      expect(expanded.corps).toEqual(old.corps);
      await closeDeskDrawer(page, 'Map options');
      const svg = page.locator('.waterloo-map');
      await page
        .getByRole('button', { name: 'Fit region', exact: true })
        .click();
      await expect(svg).toHaveAttribute('viewBox', '-940 -465 2820 1395');
      await expect(
        page.getByRole('status', { name: 'Map zoom', exact: true }),
      ).toHaveText('33%');
      expect(await snapshot(page)).toEqual(expanded);
      await page.screenshot({
        path: `release/ui-review/${packaged ? 'packaged' : 'built'}-regional-overview.png`,
      });
      await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
      const beforePan = await svg.getAttribute('viewBox');
      const box = (await svg.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + 40);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 - 100, box.y + 90, {
        steps: 5,
      });
      await page.mouse.up();
      expect(await svg.getAttribute('viewBox')).not.toBe(beforePan);
      expect(await snapshot(page)).toEqual(expanded);
      await page.mouse.wheel(0, -200);
      await expect(
        page.getByRole('status', { name: 'Map zoom', exact: true }),
      ).not.toHaveText('47%');
      await page
        .getByRole('button', { name: 'Fit region', exact: true })
        .click();
      const force = old.corps[0]!;
      await page
        .getByRole('button', { name: `Select ${force.name}`, exact: true })
        .click({ button: 'right' });
      await page
        .getByRole('menuitem', {
          name: 'Adjudicate manually\u2026',
          exact: true,
        })
        .click();
      await page
        .getByRole('button', { name: 'Hex -10,0', exact: true })
        .click();
      await page
        .getByRole('textbox', {
          name: 'Umpire ruling and rationale',
          exact: true,
        })
        .fill('Agreed march into the newly available western maneuver area.');
      await page
        .getByRole('button', { name: 'Confirm manual ruling', exact: true })
        .click();
      await expect
        .poll(async () => (await snapshot(page)).corps[0]!.hexId)
        .toBe('-10,0');
      const saved = await snapshot(page);
      await page
        .getByRole('button', { name: 'Centre on selected', exact: true })
        .click();
      await page.screenshot({
        path: `release/ui-review/${packaged ? 'packaged' : 'built'}-regional-maneuver.png`,
      });
      await page
        .getByRole('combobox', { name: 'Map view', exact: true })
        .selectOption('french');
      await expect(
        page.getByRole('button', {
          name: `Select ${old.corps.find((f) => f.side === 'allied')!.name}`,
          exact: true,
        }),
      ).toHaveCount(0);
      await app.close();
      app = await launchDesktop(profile, packaged);
      page = await app.firstWindow();
      expect(await snapshot(page)).toEqual(saved);
      await page
        .getByRole('button', { name: 'Centre on selected', exact: true })
        .click();
      await expect(
        page.getByRole('button', { name: `Select ${force.name}`, exact: true }),
      ).toBeVisible();
    } finally {
      if (app && app.process().exitCode === null) await app.close();
      removeTestProfile(profile);
    }
  });
