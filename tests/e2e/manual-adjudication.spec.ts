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
  navigateTo,
} from './profile';

async function snapshot(page: Page) {
  const result = await page.evaluate(() => window.desktop.getCampaignLibrary());
  if (!result.ok) throw new Error(result.error.message);
  return result.value.active as WaterlooCampaign;
}
for (const packaged of [false, true])
  test(`${packaged ? 'packaged' : 'built'} reviewed manual rulings, map updates, private history and phase handoff`, async () => {
    test.setTimeout(120000);
    const profile = testProfile(),
      repo = new SqliteCampaignRepository(
        path.join(profile, 'campaigns.sqlite'),
      );
    const original = repo.create({
      title: 'Manual adjudication acceptance',
      profile: 'simultaneous_fontenoy',
      actor: 'Test umpire',
      reason: 'Isolated manual acceptance.',
    }).active as WaterlooCampaign;
    repo.close();
    let app: ElectronApplication | null = null;
    try {
      app = await launchDesktop(profile, packaged);
      const confirm = async (response: number) =>
        app!.evaluate(({ dialog }, choice) => {
          dialog.showMessageBox = async () => ({
            response: choice,
            checkboxChecked: false,
          });
          dialog.showMessageBoxSync = () => 1;
        }, response);
      await confirm(0);
      let page = await app.firstWindow();
      await page.context().setOffline(true);
      const formation = original.corps[0]!,
        unit = original.fontenoy!.units.find((u) =>
          original
            .fontenoy!.formations.find((f) => f.corpsId === formation.id)!
            .unitIds.includes(u.id),
        )!;
      await page
        .getByRole('button', { name: `Select ${formation.name}`, exact: true })
        .click({ button: 'right' });
      await page
        .getByRole('menuitem', { name: 'Adjudicate manually…', exact: true })
        .click();
      const drawer = page.locator('[data-drawer="Adjudication"]');
      await expect(drawer).toHaveAttribute('open');
      const target = original.hexes.at(-1)!.id;
      await page
        .getByRole('button', { name: `Hex ${target}`, exact: true })
        .click();
      await page
        .getByLabel(`Reported strength for ${formation.name}`, { exact: true })
        .fill('About 2,000 men');
      await page
        .getByText(`Unit availability · ${formation.name}`, { exact: true })
        .click();
      await page
        .getByRole('combobox', {
          name: `Availability for ${unit.displayName}`,
          exact: true,
        })
        .selectOption('lost');
      await page
        .getByRole('textbox', {
          name: 'Umpire ruling and rationale',
          exact: true,
        })
        .fill(
          'Private umpire rationale: agreed woodland march and one unavailable unit.',
        );
      await expect(
        page.getByRole('region', { name: 'Manual ruling preview' }),
      ).toContainText(target);
      await page
        .getByRole('button', { name: 'Confirm manual ruling', exact: true })
        .click();
      expect(await snapshot(page)).toEqual(original);
      await expect(
        page.getByRole('textbox', {
          name: 'Umpire ruling and rationale',
          exact: true,
        }),
      ).not.toHaveValue('');
      await navigateTo(page, 'Dashboard');
      await navigateTo(page, 'Campaign Map');
      await expect(drawer).toHaveAttribute('open');
      await expect(
        page.getByLabel(`Reported strength for ${formation.name}`, {
          exact: true,
        }),
      ).toHaveValue('About 2,000 men');
      await page
        .getByRole('region', { name: 'Manual ruling preview' })
        .scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `test-results/${packaged ? 'packaged' : 'built'}-manual-preview.png`,
      });
      await confirm(1);
      await page
        .getByRole('button', { name: 'Confirm manual ruling', exact: true })
        .click();
      await expect(drawer).not.toHaveAttribute('open');
      await openDeskDrawer(page, 'Adjudication');
      await expect(
        page.getByRole('button', { name: 'New manual ruling', exact: true }),
      ).toBeVisible();
      const first = await snapshot(page);
      expect(first.corps[0]!.hexId).toBe(target);
      expect(
        first.fontenoy!.units.find((u) => u.id === unit.id)!.currentStatus,
      ).toBe('lost');
      await closeDeskDrawer(page, 'Adjudication');
      await page
        .getByRole('button', { name: `Select ${formation.name}`, exact: true })
        .click({ button: 'right' });
      await page
        .getByRole('menuitem', { name: 'Inspect formation', exact: true })
        .click();
      await expect(
        page.getByText(
          'Reported strength: About 2,000 men · umpire-entered estimate',
          { exact: true },
        ),
      ).toBeVisible();
      await closeDeskDrawer(page, 'Formation');
      await page
        .getByRole('combobox', { name: 'Map view', exact: true })
        .selectOption('french');
      await expect(page.locator('[data-drawer="Adjudication"]')).toHaveCount(0);
      await expect(page.getByText(/Private umpire rationale:/)).toHaveCount(0);
      await page
        .getByRole('combobox', { name: 'Map view', exact: true })
        .selectOption('umpire');
      await openDeskDrawer(page, 'Adjudication');
      await page
        .getByText('Manual ruling history · 1', { exact: true })
        .click();
      await drawer
        .locator('.manual-adjudication > details > details > summary')
        .click();
      await page
        .getByRole('button', {
          name: 'Record correction to this ruling',
          exact: true,
        })
        .click();
      await page
        .getByRole('button', {
          name: new RegExp(`^Hex ${formation.hexId}(?: |$)`),
        })
        .click();
      await page
        .getByText(`Unit availability · ${formation.name}`, { exact: true })
        .click();
      await page
        .getByRole('combobox', {
          name: `Availability for ${unit.displayName}`,
          exact: true,
        })
        .selectOption('ready');
      await page
        .getByRole('textbox', {
          name: 'Umpire ruling and rationale',
          exact: true,
        })
        .fill(
          'Correct the location and restore the unit through a new ruling.',
        );
      await page
        .getByRole('button', { name: 'Confirm manual ruling', exact: true })
        .click();
      await expect(drawer).not.toHaveAttribute('open');
      await openDeskDrawer(page, 'Adjudication');
      await expect(
        page.getByRole('button', { name: 'New manual ruling', exact: true }),
      ).toBeVisible();
      let saved = await snapshot(page);
      expect(saved.adjudications![0]).toEqual(first.adjudications![0]);
      expect(saved.adjudications![1]!.ruling.correctsId).toBe(
        first.adjudications![0]!.id,
      );
      expect(saved.corps[0]!.hexId).toBe(formation.hexId);
      await page
        .getByRole('button', { name: 'New manual ruling', exact: true })
        .click();
      await page
        .getByLabel('Finish movement manually at phase end', { exact: true })
        .check();
      await page
        .getByRole('textbox', {
          name: 'Umpire ruling and rationale',
          exact: true,
        })
        .fill('Finish the remaining movement interval manually.');
      await page
        .getByRole('button', { name: 'Confirm manual ruling', exact: true })
        .click();
      await expect(
        page.getByRole('button', { name: 'Finish shared phase', exact: true }),
      ).toBeVisible();
      await closeDeskDrawer(page, 'Adjudication');
      await page
        .getByRole('button', { name: 'Finish shared phase', exact: true })
        .click();
      await expect.poll(async () => (await snapshot(page)).turn).toBe(2);
      saved = await snapshot(page);
      expect(saved.adjudications).toHaveLength(3);
      expect(
        saved.fontenoy!.units.find((u) => u.id === unit.id)!.currentStatus,
      ).toBe('ready');
      await app.close();
      app = await launchDesktop(profile, packaged);
      page = await app.firstWindow();
      await page.context().setOffline(true);
      expect(await snapshot(page)).toEqual(saved);
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
