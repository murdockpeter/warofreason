import { expect, test } from '@playwright/test';
import type { ElectronApplication } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  launchDesktop,
  navigateTo,
  removeTestProfile,
  testProfile,
} from './profile';

for (const packaged of [false, true])
  test(`${packaged ? 'packaged' : 'built'} simultaneous hex orders, reinforcement brief and manual result`, async () => {
    test.setTimeout(150000);
    const profile = testProfile();
    let app: ElectronApplication | null = null;
    try {
      app = await launchDesktop(profile, packaged);
      let page = await app.firstWindow();
      page.setDefaultTimeout(15000);
      await page.evaluate(() =>
        window.desktop.createWaterlooCampaign({
          title: 'Crossroads reference campaign',
          actor: 'Reference tester',
          reason: 'Retained reference-profile regression fixture.',
        }),
      );
      await page.reload();
      await expect(
        page.getByRole('heading', {
          name: 'Crossroads reference campaign',
          exact: true,
        }),
      ).toBeVisible();
      await navigateTo(page, 'Campaign Map');
      const snapshot = async () => {
        const response = await page.evaluate(() =>
          window.desktop.getCampaignLibrary(),
        );
        if (!response.ok || response.value.active?.schemaVersion !== 3)
          throw new Error('Expected simultaneous campaign');
        return { ...response.value, active: response.value.active };
      };
      const saveRoute = async (name: string, hexes: string[]) => {
        await page
          .getByRole('button', { name: `Select ${name}`, exact: true })
          .click();
        for (const hex of hexes)
          await page
            .getByRole('button', { name: new RegExp(`^Hex ${hex}(?: |$)`) })
            .click();
        await page
          .getByRole('button', { name: 'Save movement segment', exact: true })
          .click();
        await expect(
          page.getByRole('heading', { name: `Route for ${name}` }),
        ).not.toBeVisible();
      };
      await saveRoute('French I Corps', ['4,4', '5,4']);
      await page
        .getByRole('button', { name: 'Lock French orders', exact: true })
        .click();
      expect((await snapshot()).active.corps[0]!.hexId).toBe('3,4');
      await page
        .getByRole('combobox', { name: 'Planning side', exact: true })
        .selectOption('allied');
      await saveRoute('Anglo-Allied I Corps', ['8,4', '7,4']);
      await page
        .getByRole('button', { name: 'Lock Coalition orders', exact: true })
        .click();
      await expect(page.getByLabel('Submission readiness')).toHaveText(
        'French: locked · Coalition: locked',
      );
      await app.close();
      app = await launchDesktop(profile, packaged);
      page = await app.firstWindow();
      page.setDefaultTimeout(15000);
      await expect(page.getByLabel('Submission readiness')).toHaveText(
        'French: locked · Coalition: locked',
      );
      // A native cancellation retains saved orders and positions.
      await app.evaluate(({ dialog }) => {
        dialog.showMessageBox = async () => ({
          response: 0,
          checkboxChecked: false,
        });
      });
      await page
        .getByRole('button', {
          name: 'Resolve simultaneous movement',
          exact: true,
        })
        .click();
      await expect(
        page.getByRole('button', {
          name: 'Resolve simultaneous movement',
          exact: true,
        }),
      ).toBeEnabled();
      expect((await snapshot()).active.corps[0]!.hexId).toBe('3,4');
      await app.evaluate(({ dialog }) => {
        dialog.showMessageBox = async () => ({
          response: 1,
          checkboxChecked: false,
        });
      });
      await page
        .getByRole('button', {
          name: 'Resolve simultaneous movement',
          exact: true,
        })
        .click();
      await expect(
        page.getByRole('button', { name: 'Finish shared phase', exact: true }),
      ).toBeEnabled();
      expect((await snapshot()).active.corps[0]!.hexId).toBe('5,4');
      expect((await snapshot()).active.corps[2]!.hexId).toBe('7,4');
      await page
        .getByRole('button', { name: 'Finish shared phase', exact: true })
        .click();
      await expect(
        page.getByRole('button', { name: 'Lock French orders', exact: true }),
      ).toBeEnabled();
      await saveRoute('French I Corps', ['6,4']);
      await page
        .getByRole('button', { name: 'Lock French orders', exact: true })
        .click();
      await page
        .getByRole('combobox', { name: 'Planning side', exact: true })
        .selectOption('allied');
      await saveRoute('Anglo-Allied I Corps', ['6,4']);
      await page
        .getByRole('button', { name: 'Lock Coalition orders', exact: true })
        .click();
      await page
        .getByRole('button', {
          name: 'Resolve simultaneous movement',
          exact: true,
        })
        .click();
      await page
        .getByRole('button', { name: 'Declare tactical battle', exact: true })
        .click();
      const battle = page.getByRole('article', {
        name: 'Battle at 6,4',
        exact: true,
      });
      await expect(battle).toBeVisible();
      await battle
        .getByText('Nearby potential reinforcements', { exact: true })
        .click();
      await expect(
        battle.getByRole('button', {
          name: 'Commit French Reserve Cavalry',
          exact: true,
        }),
      ).toBeVisible();
      await battle
        .getByRole('button', {
          name: 'Commit French Reserve Cavalry',
          exact: true,
        })
        .click();
      await expect(
        battle.getByRole('heading', {
          name: 'Committed reinforcements',
          exact: true,
        }),
      ).toBeVisible();
      const destination = path.join(profile, 'reinforcement-brief.html');
      await app.evaluate(({ dialog }, filePath) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath });
      }, destination);
      await battle
        .getByRole('button', { name: 'Save battle HTML', exact: true })
        .click();
      await expect
        .poll(() => {
          try {
            return readFileSync(destination, 'utf8');
          } catch {
            return '';
          }
        })
        .toContain('French Reserve Cavalry');
      const html = readFileSync(destination, 'utf8');
      expect(html).toContain('Earliest');
      expect(html).toContain('likely');
      const pdfPath = path.join(profile, 'reinforcement-brief.pdf');
      await app.evaluate(({ dialog }, filePath) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath });
      }, pdfPath);
      await battle
        .getByRole('button', { name: 'Save battle PDF', exact: true })
        .click();
      await expect
        .poll(() => {
          try {
            return readFileSync(pdfPath).subarray(0, 5).toString();
          } catch {
            return '';
          }
        })
        .toBe('%PDF-');
      const before = (await snapshot()).active;
      await battle
        .getByRole('button', { name: 'Enter manual result', exact: true })
        .click();
      await page
        .getByRole('textbox', { name: 'Tactical game', exact: true })
        .fill('Our tabletop rules');
      await page
        .getByRole('textbox', { name: 'Outcome', exact: true })
        .fill('French marginal victory');
      // Cancelled confirmation retains all manually entered fields.
      await app.evaluate(({ dialog }) => {
        dialog.showMessageBox = async () => ({
          response: 0,
          checkboxChecked: false,
        });
      });
      await page
        .getByRole('button', {
          name: 'Review and confirm manual result',
          exact: true,
        })
        .click();
      await expect(
        page.getByRole('textbox', { name: 'Outcome', exact: true }),
      ).toHaveValue('French marginal victory');
      await app.evaluate(({ dialog }) => {
        dialog.showMessageBox = async () => ({
          response: 1,
          checkboxChecked: false,
        });
      });
      await page
        .getByRole('button', {
          name: 'Review and confirm manual result',
          exact: true,
        })
        .click();
      await expect(
        page.getByRole('form', { name: 'Manual tactical result', exact: true }),
      ).not.toBeVisible();
      expect((await snapshot()).active.corps).toEqual(before.corps);
      await battle
        .getByRole('button', { name: 'Approve campaign effects', exact: true })
        .click();
      await page
        .getByRole('button', {
          name: 'Resolve simultaneous movement',
          exact: true,
        })
        .click();
      await expect(battle).toContainText(
        'campaign effects applied, result revision 1',
      );
      await battle
        .getByRole('button', { name: 'Edit manual result', exact: true })
        .click();
      await page
        .getByRole('textbox', { name: 'Outcome', exact: true })
        .fill('Corrected tactical report');
      await page
        .getByRole('button', {
          name: 'Review and confirm manual result',
          exact: true,
        })
        .click();
      await expect(battle).toContainText(
        'campaign effects applied, result revision 2',
      );
      expect((await snapshot()).active.battles[0]!.results).toHaveLength(2);
      await page
        .getByRole('combobox', { name: 'Map view', exact: true })
        .selectOption('french');
      await expect(
        page.getByRole('region', { name: 'Pending encounters', exact: true }),
      ).not.toBeVisible();
      await expect(
        page.getByRole('combobox', { name: 'Planning side', exact: true }),
      ).not.toBeVisible();
      await page
        .getByRole('combobox', { name: 'Map view', exact: true })
        .selectOption('umpire');
      await page
        .getByRole('region', { name: 'Hex campaign map', exact: true })
        .screenshot({
          path: `test-results/${packaged ? 'packaged' : 'built'}-waterloo-map.png`,
        });
      await app.close();
      app = await launchDesktop(profile, packaged);
      page = await app.firstWindow();
      await expect(
        page.getByRole('article', { name: 'Battle at 6,4', exact: true }),
      ).toContainText('campaign effects applied, result revision 2');
      expect((await snapshot()).active.battles[0]!.reinforcements).toHaveLength(
        1,
      );
    } finally {
      await app?.close();
      removeTestProfile(profile);
    }
  });
