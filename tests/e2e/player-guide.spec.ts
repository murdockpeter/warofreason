import { expect, test } from '@playwright/test';
import type { ElectronApplication } from '@playwright/test';
import path from 'node:path';
import {
  launchDesktop,
  removeTestProfile,
  selectMapView,
  testProfile,
} from './profile';
import { SqliteCampaignRepository } from '../../src/main/persistence/repository';
import type { FontenoyCampaign } from '../../src/domain/campaign';

for (const packaged of [false, true]) {
  test(`${packaged ? 'packaged' : 'built'} offline manual and redacted formation intelligence modal`, async () => {
    test.setTimeout(60000);
    const profile = testProfile();
    const repo = new SqliteCampaignRepository(
      path.join(profile, 'campaigns.sqlite'),
    );
    const audit = {
      actor: 'Guide tester',
      reason: 'Offline manual and dossier acceptance.',
    };
    const c = repo.create({ title: 'Player guide', ...audit })
      .active as FontenoyCampaign;
    c.settings.reviewedHouseRules = true;
    c.settings.reviewedSchematicMap = true;
    c.columns[1]!.squareId = c.columns[0]!.squareId;
    c.columns[3]!.squareId = c.squares.find(
      (s) => s.row === 2 && s.column === 4,
    )!.id;
    c.columns[3]!.concealment = 'hidden';
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
      command: { kind: 'enable' },
      ...audit,
    });
    repo.tabletop({
      id: c.id,
      expectedRevision: 4,
      command: {
        kind: 'scout',
        input: {
          scoutId: c.columns[1]!.id,
          targetColumnId: c.columns[3]!.id,
          roll: 4,
          rollSource: 'physical',
          modifier: 0,
          reason: 'Umpire identified this column.',
          state: 'identified',
          estimate: '',
        },
      },
      ...audit,
    });
    repo.close();
    let app: ElectronApplication | null = null;
    try {
      app = await launchDesktop(profile, packaged);
      const page = await app.firstWindow();
      await page.context().setOffline(true);
      await expect(
        page.getByRole('region', { name: 'Interactive campaign map' }),
      ).toBeVisible();
      const saved = await page.evaluate(() =>
        window.desktop.getCampaignLibrary(),
      );
      const help = page.getByRole('button', {
        name: 'Help & player manual',
        exact: true,
      });
      await help.click();
      const manual = page.getByRole('dialog', { name: 'Player manual' });
      await expect(
        manual.getByRole('region', { name: 'What to do now' }),
      ).toContainText('Plan your faction’s orders');
      await manual
        .getByRole('button', { name: 'Split formations', exact: true })
        .click();
      await expect(
        manual.getByRole('region', { name: 'Split formations', exact: true }),
      ).toContainText('Both formations stay in the same square');
      await manual.screenshot({
        path: `test-results/${packaged ? 'packaged' : 'built'}-player-manual.png`,
      });
      await manual.getByRole('button', { name: 'Close Player manual' }).click();
      await expect(help).toBeFocused();
      await page.keyboard.press('F1');
      await expect(manual).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(manual).not.toBeVisible();
      const own = page.getByRole('button', {
        name: `Select ${c.columns[0]!.displayName}`,
        exact: true,
      });
      await own.click({ button: 'right' });
      await page
        .getByRole('menuitem', { name: 'Inspect formation', exact: true })
        .click();
      const dossier = page.getByRole('dialog', {
        name: 'Formation intelligence',
      });
      await expect(dossier).toContainText(c.columns[0]!.displayName);
      await expect(
        dossier.getByRole('region', { name: 'Formation roster' }),
      ).toContainText(c.units[0]!.displayName);
      await expect(
        dossier.getByRole('region', { name: 'Formation commanders' }),
      ).toContainText(c.commanders[0]!.displayName);
      await dossier.screenshot({
        path: `test-results/${packaged ? 'packaged' : 'built'}-formation-dossier.png`,
      });
      await page.keyboard.press('Escape');
      await expect(dossier).not.toBeVisible();
      await selectMapView(page, 'french');
      await page
        .getByRole('button', { name: 'Select Opposing column', exact: true })
        .click({ button: 'right' });
      await expect(
        page.getByRole('menuitem', { name: 'Move on map' }),
      ).toBeDisabled();
      await page
        .getByRole('menuitem', { name: 'Inspect formation', exact: true })
        .click();
      await expect(dossier).toContainText('Roster withheld');
      await expect(dossier.getByRole('table')).toHaveCount(0);
      for (const unit of c.units.filter((u) =>
        c.columns[2]!.unitIds.includes(u.id),
      ))
        await expect(dossier).not.toContainText(unit.displayName);
      await dossier
        .getByRole('button', { name: 'Close Formation intelligence' })
        .click();
      await page
        .getByRole('button', {
          name: `Select ${c.columns[3]!.displayName}`,
          exact: true,
        })
        .click({ button: 'right' });
      await page
        .getByRole('menuitem', { name: 'Inspect formation', exact: true })
        .click();
      await expect(dossier).toContainText('Dated scouting report');
      await expect(dossier).toContainText('expires at turn 2');
      await expect(
        dossier.getByRole('columnheader', { name: 'Observed quality' }),
      ).toBeVisible();
      await dossier
        .getByRole('button', { name: 'Close Formation intelligence' })
        .click();
      expect(
        await page.evaluate(() => window.desktop.getCampaignLibrary()),
      ).toEqual(saved);
    } finally {
      if (app && app.process().exitCode === null) await app.close();
      removeTestProfile(profile);
    }
  });
}
