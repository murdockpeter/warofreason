import { legacyHistoricalExport } from '../fixtures/historical-profile';
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
  test(`${packaged ? 'packaged' : 'built'} playable historical names, complements, review and preserved original campaign`, async () => {
    test.setTimeout(120000);
    const profile = testProfile(),
      file = path.join(profile, 'campaigns.sqlite');
    const repo = new SqliteCampaignRepository(file);
    const old = repo.create({
      title: 'Original abstract roster',
      profile: 'simultaneous_fontenoy',
      actor: 'Test player',
      reason: 'Historical profile compatibility.',
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
      await openDeskDrawer(page, 'Historical OOB');
      await page
        .getByRole('button', {
          name: 'Create historical campaign',
          exact: true,
        })
        .click();
      await expect(
        page.getByRole('region', {
          name: 'Historical roster setup',
          exact: true,
        }),
      ).toBeVisible();
      const seeded = await snapshot(page);
      expect(seeded.id).not.toBe(old.id);
      expect(seeded.fontenoy!.units).toHaveLength(143);
      expect(seeded.corps).toHaveLength(28);
      await expect(
        page.getByRole('button', { name: 'Lock French orders', exact: true }),
      ).toBeDisabled();
      await page
        .getByRole('button', { name: 'Review historical setup', exact: true })
        .click();
      const form = page.getByRole('form', { name: 'Historical roster review' });
      await form
        .getByText('Review proposed tabletop ratings', { exact: true })
        .click();
      const guards = seeded.fontenoy!.units.find(
        (u) => u.displayName === 'Gardes Fran\u00e7aises',
      )!;
      const guardLink = seeded.fontenoy!.formations.find((f) =>
        f.unitIds.includes(guards.id),
      )!;
      const guardFormation = seeded.corps.find(
        (f) => f.id === guardLink.corpsId,
      )!;
      await form
        .locator('summary')
        .filter({ hasText: new RegExp('^' + guardFormation.name + '$') })
        .click();
      await form
        .getByRole('combobox', {
          name: 'Scenario quality for Gardes Françaises',
          exact: true,
        })
        .selectOption('elite');
      for (const name of [
        'I reviewed the regimental record scale and scenario ratings',
        'I reviewed the provisional formations and deployment',
        'I reviewed the battle-date coverage and source gaps',
      ])
        await form.getByRole('checkbox', { name, exact: true }).check();
      await form
        .getByRole('textbox', {
          name: 'Historical setup review notes',
          exact: true,
        })
        .fill(
          'Reviewed historical source coverage and agreed regimental tabletop representation.',
        );
      await form
        .getByRole('button', { name: 'Confirm historical setup', exact: true })
        .click();
      expect(
        (await snapshot(page)).fontenoy!.historicalProfile!.reviewedAt,
      ).toBeNull();
      await expect(
        form.getByRole('checkbox', {
          name: 'I reviewed the regimental record scale and scenario ratings',
          exact: true,
        }),
      ).toBeChecked();
      await confirm(1);
      await form
        .getByRole('button', { name: 'Confirm historical setup', exact: true })
        .click();
      await expect(form).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: 'Lock French orders', exact: true }),
      ).toBeEnabled();
      const source = page.locator('.historical-oob');
      await source
        .getByRole('searchbox', {
          name: 'Search historical roster',
          exact: true,
        })
        .fill('Gardes Françaises');
      await source
        .locator('details > summary')
        .filter({ hasText: 'Gardes Françaises' })
        .click();
      await expect(source).toContainText('Assigned to French infantry');
      await source
        .getByRole('button', {
          name: 'Inspect assigned formation',
          exact: true,
        })
        .click();
      const inspector = page.getByRole('region', {
        name: 'Formation drawer',
        exact: true,
      });
      await expect(inspector).toBeVisible();
      await expect(inspector).toContainText('4 battalions');
      await expect(inspector.locator('table')).toContainText('elite');
      await expect(inspector.locator('table')).not.toContainText(
        'French elite regular infantry 1',
      );
      await inspector.locator('.historical-unit-name').click();
      await expect(
        page.getByRole('dialog', { name: /historical record/ }),
      ).toContainText('Les Gardes Brigade');
      await page.screenshot({
        path: `test-results/${packaged ? 'packaged' : 'built'}-historical-formation.png`,
      });
      await page
        .getByRole('button', { name: /Close .*historical record/ })
        .click();
      await closeDeskDrawer(page, 'Formation');
      await openDeskDrawer(page, 'Historical OOB');
      await source
        .getByRole('combobox', { name: 'Historical contingent', exact: true })
        .selectOption('french');
      await source
        .getByRole('searchbox', {
          name: 'Search historical roster',
          exact: true,
        })
        .fill('Carabiniers');
      await source
        .locator('details > summary')
        .filter({ hasText: 'Carabiniers' })
        .click();
      await expect(source).toContainText('10 squadrons');
      await expect(source).toContainText('Assigned to French horse');
      await source
        .getByRole('button', {
          name: 'Inspect assigned formation',
          exact: true,
        })
        .click();
      await expect(inspector).toContainText('Carabiniers');
      await expect(inspector).toContainText('10 squadrons');
      await closeDeskDrawer(page, 'Formation');
      const horseUnit = seeded.fontenoy!.units.find(
        (u) => u.displayName === 'Carabiniers',
      )!;
      const horseLink = seeded.fontenoy!.formations.find((f) =>
        f.unitIds.includes(horseUnit.id),
      )!;
      const horse = seeded.corps.find((f) => f.id === horseLink.corpsId)!;
      const destination = seeded.edges
        .filter((e) => e.from === horse.hexId || e.to === horse.hexId)
        .map((e) => (e.from === horse.hexId ? e.to : e.from))
        .find((id) => !seeded.corps.some((f) => f.hexId === id))!;
      await page
        .getByRole('button', { name: 'Select ' + horse.name, exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Hex ' + destination, exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Save movement segment', exact: true })
        .click();
      await expect(
        page.getByRole('img', {
          name: /^Saved movement order for French horse/,
        }),
      ).toBeVisible();
      const saved = await snapshot(page);
      expect(
        saved.fontenoy!.units.find(
          (u) => u.displayName === 'Gardes Françaises',
        )!.quality,
      ).toBe('elite');
      await app.close();
      app = await launchDesktop(profile, packaged);
      page = await app.firstWindow();
      expect(await snapshot(page)).toEqual(saved);
      await app.close();
      app = null;
      const reopened = new SqliteCampaignRepository(file);
      try {
        expect(reopened.open(old.id).active).toEqual(old);
      } finally {
        reopened.close();
      }
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

for (const packaged of [false, true])
  test(`${packaged ? 'packaged' : 'built'} explicit legacy setup regroup with native cancellation`, async () => {
    const profile = testProfile();
    const repo = new SqliteCampaignRepository(
      path.join(profile, 'campaigns.sqlite'),
    );
    const old = repo.importCampaign(legacyHistoricalExport())
      .active as WaterlooCampaign;
    repo.close();
    let app: ElectronApplication | null = null;
    try {
      app = await launchDesktop(profile, packaged);
      const page = await app.firstWindow();
      await app.evaluate(({ dialog }) => {
        dialog.showMessageBox = async () => ({
          response: 0,
          checkboxChecked: false,
        });
      });
      const drawer = page.getByRole('region', {
        name: 'Historical OOB drawer',
        exact: true,
      });
      await expect(drawer).toBeVisible();
      await expect(drawer).toContainText('15 French and 13 Allied formations');
      await drawer
        .getByRole('button', {
          name: 'Regroup this historical setup',
          exact: true,
        })
        .click();
      expect(await snapshot(page)).toEqual(old);
      await app.evaluate(({ dialog }) => {
        dialog.showMessageBox = async () => ({
          response: 1,
          checkboxChecked: false,
        });
      });
      await drawer
        .getByRole('button', {
          name: 'Regroup this historical setup',
          exact: true,
        })
        .click();
      await expect(
        drawer.getByRole('button', {
          name: 'Regroup this historical setup',
          exact: true,
        }),
      ).toHaveCount(0);
      const saved = await snapshot(page);
      expect(saved.corps).toHaveLength(28);
      expect(saved.fontenoy!.units).toEqual(old.fontenoy!.units);
      await closeDeskDrawer(page, 'Historical OOB');
      await expect(
        page.getByRole('button', {
          name: 'Select French artillery',
          exact: true,
        }),
      ).toContainText('ART');
      await page.screenshot({
        path: `release/ui-review/${packaged ? 'packaged' : 'built'}-regrouped-map.png`,
      });
      await app.close();
      app = await launchDesktop(profile, packaged);
      expect(await snapshot(await app.firstWindow())).toEqual(saved);
    } finally {
      if (app && app.process().exitCode === null) await app.close();
      removeTestProfile(profile);
    }
  });
