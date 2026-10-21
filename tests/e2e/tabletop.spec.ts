import { selectMapView } from './profile';
import { expect, test } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import {
  navigateTo,
  launchDesktop,
  testProfile,
  removeTestProfile,
} from './profile';
import { SqliteCampaignRepository } from '../../src/main/persistence/repository';
import type { FontenoyCampaign } from '../../src/domain/campaign';

async function snapshot(page: Page) {
  const result = await page.evaluate(() => window.desktop.getCampaignLibrary());
  if (!result.ok || result.value.active?.schemaVersion !== 2)
    throw new Error('Expected configured campaign.');
  return { ...result.value, active: result.value.active };
}
for (const packaged of [false, true]) {
  test(`${packaged ? 'packaged' : 'built'} scouting, printable battle brief and confirmed manual result round trip`, async () => {
    test.setTimeout(120000);
    const profile = testProfile();
    const destination = testProfile();
    const audit = {
      actor: 'Tabletop tester',
      reason: 'Milestone E acceptance.',
    };
    const repo = new SqliteCampaignRepository(
      path.join(profile, 'campaigns.sqlite'),
    );
    const seeded = repo.create({ title: 'Tabletop acceptance', ...audit })
      .active as FontenoyCampaign;
    seeded.settings.reviewedHouseRules = true;
    seeded.settings.reviewedSchematicMap = true;
    seeded.columns[1]!.squareId = seeded.columns[0]!.squareId;
    seeded.columns[3]!.squareId = seeded.squares.find(
      (s) => s.row === 2 && s.column === 4,
    )!.id;
    seeded.columns[3]!.concealment = 'hidden';
    repo.saveSetup({
      id: seeded.id,
      expectedRevision: 1,
      settings: seeded.settings,
      columns: seeded.columns,
      commanders: seeded.commanders,
      ...audit,
    });
    repo.start({ id: seeded.id, expectedRevision: 2, ...audit });
    repo.operate({
      id: seeded.id,
      expectedRevision: 3,
      ...audit,
      command: { kind: 'enable' },
    });
    repo.close();
    let app: ElectronApplication | null = null;
    try {
      app = await launchDesktop(profile, packaged);
      let page = await app.firstWindow();
      await navigateTo(page, 'Battle Log');
      await page
        .getByRole('button', { name: 'Record scouting', exact: true })
        .click();
      await page
        .getByRole('combobox', { name: 'Scout column' })
        .selectOption(seeded.columns[1]!.id);
      await page
        .getByRole('combobox', { name: 'Scouting target' })
        .selectOption(seeded.columns[3]!.id);
      if (packaged) {
        await page.getByRole('button', { name: 'Roll scouting die' }).click();
        await expect(
          page.getByRole('spinbutton', { name: 'Die result (d6)' }),
        ).not.toHaveValue('');
      } else
        await page
          .getByRole('spinbutton', { name: 'Die result (d6)' })
          .fill('4');
      await page
        .getByRole('spinbutton', { name: 'Agreed modifier' })
        .fill('-1');
      await page
        .getByRole('combobox', { name: 'Intelligence released' })
        .selectOption('identified');
      await page
        .getByRole('textbox', { name: 'Modifier and adjudication reason' })
        .fill('Visibility agreed by umpire; identified manually.');
      await page.getByRole('button', { name: 'Save scouting report' }).click();
      await expect(
        page.getByRole('region', { name: 'Scouting journal' }),
      ).toContainText('identified');
      const scouted = await snapshot(page);
      const report = scouted.active.tabletop!.contacts[0]!;
      expect(report.input.rollSource).toBe(packaged ? 'app' : 'physical');
      expect(report.input.roll).toBeGreaterThanOrEqual(1);
      expect(report.input.roll).toBeLessThanOrEqual(6);
      expect(report.input.modifier).toBe(-1);
      await navigateTo(page, 'Campaign Map');
      await selectMapView(page, 'french');
      await page
        .getByRole('button', {
          name: `Select ${seeded.columns[3]!.displayName}`,
          exact: true,
        })
        .click();
      await page.locator('.formation-inspection > summary').click();
      await expect(
        page.getByRole('region', { name: 'Map inspector' }),
      ).toContainText('Intelligence: identified');
      await selectMapView(page, 'umpire');
      await page
        .getByRole('button', {
          name: `Select ${seeded.columns[0]!.displayName}`,
          exact: true,
        })
        .click();
      await page
        .getByRole('button', { name: 'Square E3', exact: true })
        .click();
      await page.getByRole('button', { name: 'Add order' }).click();
      await page.locator('.map-orders > summary').click();
      await page
        .getByRole('button', { name: 'Issue orders', exact: true })
        .click();
      await app.evaluate(({ dialog }) => {
        dialog.showMessageBox = async () => ({
          response: 1,
          checkboxChecked: false,
        });
      });
      await page
        .getByRole('button', { name: 'Resolve orders', exact: true })
        .click();
      await expect(
        page.getByRole('region', { name: 'Engagement candidates' }),
      ).toBeVisible();
      await navigateTo(page, 'Battle Log');
      await page
        .getByRole('button', { name: 'Declare Battle', exact: true })
        .click();
      await page
        .getByRole('combobox', {
          name: `Entry edge for ${seeded.columns[0]!.displayName}`,
        })
        .selectOption('west');
      await page
        .getByRole('button', { name: 'Next step', exact: true })
        .click();
      await page
        .getByRole('textbox', { name: 'Battle title' })
        .fill('Fontenoy tabletop acceptance');
      await page
        .getByRole('textbox', { name: 'Battle objectives', exact: true })
        .fill('Player-agreed objective: hold the crossing.');
      await page
        .getByRole('textbox', { name: 'Terrain notes', exact: true })
        .fill('Terrain agreed using players’ own Maurice materials.');
      await page
        .getByRole('textbox', { name: 'Special setup instructions' })
        .fill('<script>alert("test")</script> is a private note, not markup.');
      await page
        .getByRole('button', { name: 'Next step', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Save battle declaration', exact: true })
        .click();
      await expect(
        page.getByRole('region', { name: 'Battle brief' }),
      ).toContainText('Fontenoy tabletop acceptance');
      const declared = await snapshot(page);
      const battle = declared.active.tabletop!.battles[0]!;
      expect(battle.participants.flatMap((p) => p.units)).toHaveLength(21);
      const htmlFile = path.join(profile, 'battle-brief.html');
      await app.evaluate(({ dialog }, filename) => {
        dialog.showSaveDialog = async () => ({
          canceled: false,
          filePath: filename,
        });
      }, htmlFile);
      await page.getByRole('button', { name: 'Export brief HTML' }).click();
      await expect(
        page.getByText(
          'Battle brief saved. Open the PDF or HTML file to print it.',
        ),
      ).toBeVisible();
      const html = readFileSync(htmlFile, 'utf8');
      expect(html).toContain('house_rule_v0.1/tabletop-1');
      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>');
      expect(html).toContain('Cumberland');
      const pdfFile = path.join(profile, 'battle-brief.pdf');
      await app.evaluate(({ dialog }, filename) => {
        dialog.showSaveDialog = async () => ({
          canceled: false,
          filePath: filename,
        });
      }, pdfFile);
      await page.getByRole('button', { name: 'Save printable PDF' }).click();
      await expect
        .poll(() => {
          try {
            return readFileSync(pdfFile).subarray(0, 5).toString();
          } catch {
            return '';
          }
        })
        .toBe('%PDF-');
      expect(readFileSync(pdfFile).length).toBeGreaterThan(1000);
      await page.getByRole('region', { name: 'Battle brief' }).screenshot({
        path: `test-results/${packaged ? 'packaged' : 'built'}-battle-brief.png`,
      });
      await app.close();
      app = await launchDesktop(profile, packaged);
      page = await app.firstWindow();
      await navigateTo(page, 'Battle Log');
      await page.getByRole('button', { name: 'Begin tabletop battle' }).click();
      await page.getByRole('button', { name: 'Enter battle result' }).click();
      await page
        .getByRole('combobox', { name: 'Battle outcome', exact: true })
        .selectOption('french_marginal');
      await page
        .getByRole('button', { name: 'Mark remaining units survived' })
        .click();
      const first = battle.participants[0]!.units[0]!;
      await page
        .getByRole('combobox', {
          name: `Outcome ${first.displayName}`,
          exact: true,
        })
        .selectOption('broken');
      await page
        .getByRole('combobox', {
          name: `Disruption ${first.displayName}`,
          exact: true,
        })
        .selectOption('true');
      await page
        .getByRole('spinbutton', {
          name: 'Final french Army Morale (optional)',
        })
        .fill('7');
      const commander = battle.participants[0]!.commanders[0]!;
      await page
        .getByRole('combobox', {
          name: `Status ${commander.displayName}`,
          exact: true,
        })
        .selectOption('retired');
      await page
        .getByRole('textbox', { name: 'Battle result notes' })
        .fill('Physical tabletop result, checked by both players.');
      const beforeCancel = await snapshot(page);
      await app.evaluate(({ dialog }) => {
        dialog.showMessageBox = async () => ({
          response: 0,
          checkboxChecked: false,
        });
      });
      await page
        .getByRole('button', { name: 'Review and confirm result' })
        .click();
      await expect(
        page.getByText('No changes committed. Your draft is still available.'),
      ).toBeVisible();
      expect(await snapshot(page)).toEqual(beforeCancel);
      await navigateTo(page, 'Campaign Map');
      await expect(
        page.getByRole('region', { name: 'Campaign status' }),
      ).toContainText('Uncommitted tabletop draft');
      await navigateTo(page, 'Battle Log');
      await expect(
        page.getByRole('combobox', { name: 'Battle outcome', exact: true }),
      ).toHaveValue('french_marginal');
      await app.evaluate(({ dialog }) => {
        dialog.showMessageBox = async () => ({
          response: 1,
          checkboxChecked: false,
        });
      });
      await page
        .getByRole('button', { name: 'Review and confirm result' })
        .click();
      await expect(
        page.getByRole('region', { name: 'Confirmed tabletop result' }),
      ).toContainText('french marginal');
      const confirmed = await snapshot(page);
      expect(confirmed.active.units).toEqual(seeded.units);
      expect(confirmed.active.commanders).toEqual(seeded.commanders);
      expect(
        confirmed.active.tabletop!.battles[0]!.result!.units[0]!.outcome,
      ).toBe('broken');
      expect(confirmed.events.at(-1)!.category).toBe('battle_result_recorded');
      const backup = path.join(profile, 'campaign.json');
      await app.evaluate(({ dialog }, filename) => {
        dialog.showSaveDialog = async () => ({
          canceled: false,
          filePath: filename,
        });
      }, backup);
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
      await app.evaluate(({ dialog }, filename) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [filename],
        });
      }, backup);
      await page
        .getByRole('button', { name: 'Import JSON', exact: true })
        .click();
      await expect(
        page.getByRole('region', { name: 'Open campaign', exact: true }),
      ).toContainText('Tabletop acceptance');
      expect((await snapshot(page)).active.tabletop).toEqual(
        confirmed.active.tabletop,
      );
      await app.close();
      app = await launchDesktop(destination, packaged);
      page = await app.firstWindow();
      expect((await snapshot(page)).active.tabletop).toEqual(
        confirmed.active.tabletop,
      );
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
