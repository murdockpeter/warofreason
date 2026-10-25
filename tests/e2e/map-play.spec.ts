import { expect, test } from '@playwright/test';
import type { ElectronApplication } from '@playwright/test';
import path from 'node:path';
import { SqliteCampaignRepository } from '../../src/main/persistence/repository';
import type { FontenoyCampaign } from '../../src/domain/campaign';
import { launchDesktop, testProfile, removeTestProfile } from './profile';

for (const packaged of [false, true]) {
  test(`${packaged ? 'packaged' : 'built'} map-first formation menu, two-pane split and saved route`, async () => {
    const profile = testProfile();
    const repo = new SqliteCampaignRepository(
      path.join(profile, 'campaigns.sqlite'),
    );
    const audit = { actor: 'Play tester', reason: 'Map play acceptance.' };
    const c = repo.create({ title: 'Map play', ...audit })
      .active as FontenoyCampaign;
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
    repo.operate({
      id: c.id,
      expectedRevision: 3,
      ...audit,
      command: { kind: 'enable' },
    });
    repo.close();
    let app: ElectronApplication | null = null;
    try {
      app = await launchDesktop(profile, packaged);
      let page = await app.firstWindow();
      await expect(
        page.getByRole('region', { name: 'Interactive campaign map' }),
      ).toBeVisible();
      await expect(page.locator('.campaign-navigation')).not.toHaveAttribute(
        'open',
      );
      await expect(page.locator('.map-options')).not.toHaveAttribute('open');
      await expect(
        page.getByRole('heading', {
          name: 'Movement house rules and roadblocks',
        }),
      ).not.toBeVisible();
      await app.evaluate(({ dialog }) => {
        dialog.showMessageBoxSync = () => 1;
        dialog.showMessageBox = async () => ({
          response: 1,
          checkboxChecked: false,
        });
      });
      const source = () =>
        page.getByRole('button', {
          name: `Select ${c.columns[0]!.displayName}`,
          exact: true,
        });
      await source().click({ button: 'right' });
      await page.getByRole('menuitem', { name: 'Split formation…' }).click();
      const modal = () => page.getByRole('dialog', { name: 'Split formation' });
      await expect(modal()).toBeVisible();
      const moveUnit = () =>
        modal().getByRole('button', {
          name: `Move ${c.units[0]!.displayName} to new formation`,
          exact: true,
        });
      await moveUnit().click();
      await modal().getByRole('button', { name: 'Cancel split' }).click();
      await expect(modal()).not.toBeVisible();
      const snapshot = async () => {
        const result = await page.evaluate(() =>
          window.desktop.getCampaignLibrary(),
        );
        if (!result.ok || result.value.active?.schemaVersion !== 2)
          throw new Error('Expected campaign.');
        return { ...result.value, active: result.value.active };
      };
      expect((await snapshot()).active!.columns).toHaveLength(4);
      await source().focus();
      await source().press('Shift+F10');
      await page.getByRole('menuitem', { name: 'Split formation…' }).click();
      await modal()
        .getByRole('textbox', { name: 'New formation name' })
        .fill('French detachment');
      await moveUnit().click();
      await modal()
        .getByRole('button', { name: new RegExp(c.commanders[0]!.displayName) })
        .click();
      await expect(
        modal().getByRole('region', { name: 'New formation', exact: true }),
      ).toContainText(c.units[0]!.displayName);
      await modal().screenshot({
        path: `test-results/${packaged ? 'packaged' : 'built'}-split-formation.png`,
      });
      await modal().getByRole('button', { name: 'Save split' }).click();
      await expect(modal()).not.toBeVisible();
      const saved = await snapshot();
      expect(saved.active!.columns).toHaveLength(5);
      expect(saved.events.at(-1)!.category).toBe('formation_split');
      const detachment = saved.active!.columns.at(-1)!;
      expect(detachment.unitIds).toEqual([c.units[0]!.id]);
      expect(detachment.commanderIds).toEqual(c.columns[0]!.commanderIds);
      expect(detachment.squareId).toBe(c.columns[0]!.squareId);
      await app.close();
      app = await launchDesktop(profile, packaged);
      page = await app.firstWindow();
      const marker = page.getByRole('button', {
        name: 'Select French detachment',
        exact: true,
      });
      await expect(marker).toBeVisible();
      await marker.click({ button: 'right' });
      await page.getByRole('menuitem', { name: 'Move on map' }).click();
      await page
        .getByRole('button', { name: 'Square E3', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Add order', exact: true })
        .click();
      await expect(
        page.getByRole('region', { name: 'Campaign status' }),
      ).toContainText('Unissued orders');
      await page
        .getByRole('region', { name: 'Interactive campaign map' })
        .screenshot({
          path: `test-results/${packaged ? 'packaged' : 'built'}-map-play.png`,
        });
      await page.getByRole('button', { name: 'Review & end phase' }).click();
      const issued = await snapshot();
      expect(
        (issued.active as FontenoyCampaign).operations!.orders[0]!.columnId,
      ).toBe(detachment.id);
      await page.screenshot({
        path: `test-results/${packaged ? 'packaged' : 'built'}-play-workspace.png`,
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
}
