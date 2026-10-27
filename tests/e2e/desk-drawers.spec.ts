import { expect, test } from '@playwright/test';
import type { ElectronApplication } from '@playwright/test';
import path from 'node:path';
import { SqliteCampaignRepository } from '../../src/main/persistence/repository';
import type { WaterlooCampaign } from '../../src/domain/waterloo-schema';
import {
  launchDesktop,
  removeTestProfile,
  testProfile,
  openDeskDrawer,
  closeDeskDrawer,
  showHelperChoice,
} from './profile';

for (const packaged of [false, true])
  test(`${packaged ? 'packaged' : 'built'} map-first drawers, keyboard dismissal, Helper reveal and retained drafts`, async () => {
    const profile = testProfile();
    const repo = new SqliteCampaignRepository(
      path.join(profile, 'campaigns.sqlite'),
    );
    const c = repo.create({
      title: 'Map-first acceptance',
      profile: 'simultaneous_fontenoy',
      actor: 'Test player',
      reason: 'Isolated interface acceptance.',
    }).active as WaterlooCampaign;
    repo.close();
    let app: ElectronApplication | null = null;
    try {
      app = await launchDesktop(profile, packaged);
      const page = await app.firstWindow();
      await page.context().setOffline(true);
      const map = page.getByRole('region', {
        name: 'Hex campaign map',
        exact: true,
      });
      await expect(map).toBeVisible();
      await expect(page.locator('.desk-drawer[open]')).toHaveCount(0);
      await expect(page.locator('.compact-helper')).not.toHaveAttribute('open');
      await expect(
        page.getByRole('button', { name: 'Lock French orders', exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', {
          name: 'Resolve simultaneous movement',
          exact: true,
        }),
      ).not.toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Finish shared phase', exact: true }),
      ).not.toBeVisible();
      await page.screenshot({
        path: `test-results/${packaged ? 'packaged' : 'built'}-compact-desk.png`,
      });
      const bounds = await map.boundingBox(),
        viewport =
          page.viewportSize() ??
          (await page.evaluate(() => ({
            width: innerWidth,
            height: innerHeight,
          })));
      expect(bounds!.y).toBeLessThan(320);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
        viewport.height + 10,
      );
      await page
        .getByRole('button', { name: 'Lock French orders', exact: true })
        .focus();
      await page.keyboard.press('Tab');
      await expect(
        page.locator('[data-drawer="Orders"] > summary'),
      ).toBeFocused();
      await openDeskDrawer(page, 'Campaign tools');
      await expect(
        page.getByRole('region', {
          name: 'Maurice Fontenoy campaign',
          exact: true,
        }),
      ).toBeVisible();
      await openDeskDrawer(page, 'Map options');
      await expect(
        page.locator('[data-drawer="Campaign tools"]'),
      ).not.toHaveAttribute('open');
      await page
        .getByRole('combobox', { name: 'Map overlay', exact: true })
        .selectOption('control');
      await closeDeskDrawer(page, 'Map options');
      await page
        .getByRole('button', {
          name: `Select ${c.corps[0]!.name}`,
          exact: true,
        })
        .click();
      await expect(page.locator('[data-drawer="Orders"]')).toHaveAttribute(
        'open',
      );
      await page.getByRole('button', { name: 'Hex 4,2', exact: true }).click();
      await closeDeskDrawer(page, 'Orders');
      await openDeskDrawer(page, 'Orders');
      await expect(
        page.getByLabel('Hex route draft', { exact: true }),
      ).toContainText('3,2 → 4,2');
      await expect(
        page.getByRole('combobox', { name: 'Travel mode', exact: true }),
      ).not.toBeVisible();
      await page
        .getByRole('button', { name: 'Save movement segment', exact: true })
        .click();
      await closeDeskDrawer(page, 'Orders');
      await page
        .getByRole('button', {
          name: `Select ${c.corps[0]!.name}`,
          exact: true,
        })
        .click({ button: 'right' });
      await page
        .getByRole('menuitem', { name: 'Inspect formation', exact: true })
        .click();
      await expect(page.locator('[data-drawer="Formation"]')).toHaveAttribute(
        'open',
      );
      await expect(
        page.getByRole('region', { name: 'Formation drawer', exact: true }),
      ).toContainText(c.fontenoy!.units[0]!.displayName);
      await closeDeskDrawer(page, 'Formation');
      await page
        .getByRole('combobox', { name: 'Map view', exact: true })
        .selectOption('french');
      await showHelperChoice(page, 'Show me: Review scouting and intelligence');
      await expect(
        page.locator('[data-drawer="Intelligence"]'),
      ).toHaveAttribute('open');
      await expect(
        page.locator('[data-helper="intelligence"]'),
      ).toHaveAttribute('open');
      await page
        .getByRole('button', { name: 'Request scouting', exact: true })
        .click();
      const question = page.getByRole('textbox', {
        name: 'Scouting question',
        exact: true,
      });
      await question.fill('Keep this unfinished request.');
      await question.press('Escape');
      await expect(
        page.locator('[data-drawer="Intelligence"]'),
      ).not.toHaveAttribute('open');
      await expect(
        page.locator('[data-drawer="Intelligence"] > summary'),
      ).toBeFocused();
      await openDeskDrawer(page, 'Intelligence');
      await expect(question).toHaveValue('Keep this unfinished request.');
      await page.getByRole('button', { name: 'Hex 6,4', exact: true }).click();
      await expect(
        page.getByRole('combobox', { name: 'Area to scout', exact: true }),
      ).toHaveValue('6,4');
      await page.setViewportSize({ width: 720, height: 800 });
      await expect(question).toBeVisible();
      const sheet = await page
        .getByRole('region', { name: 'Intelligence drawer', exact: true })
        .boundingBox();
      expect(sheet!.x).toBeGreaterThanOrEqual(0);
      expect(sheet!.x + sheet!.width).toBeLessThanOrEqual(720);
      const saved = await page.evaluate(() =>
        window.desktop.getCampaignLibrary(),
      );
      expect(
        saved.ok &&
          saved.value.active?.schemaVersion === 3 &&
          saved.value.active.fontenoy!.intelligence,
      ).toBeUndefined();
      await app.evaluate(({ dialog }) => {
        dialog.showMessageBoxSync = () => 1;
      });
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
    }
  });
