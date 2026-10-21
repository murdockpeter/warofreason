import { expect, test } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  navigateTo,
  launchDesktop,
  removeTestProfile,
  testProfile,
} from './profile';

async function library(page: Page) {
  const result = await page.evaluate(() => window.desktop.getCampaignLibrary());
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}
async function chooseImport(app: ElectronApplication, filename: string) {
  await app.evaluate(({ dialog }, filename) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [filename],
    });
  }, filename);
}

for (const packaged of [false, true]) {
  test(`${packaged ? 'packaged' : 'built'} campaign lifecycle survives restarts and rejects unsafe imports`, async () => {
    test.setTimeout(90000);
    const profile = testProfile();
    const destinationProfile = testProfile();
    let app: ElectronApplication | null = null;
    try {
      app = await launchDesktop(profile, packaged);
      let page = await app.firstWindow();
      await expect(
        page.getByRole('button', { name: 'New campaign', exact: true }),
      ).toBeEnabled();
      await page
        .getByRole('button', { name: 'New campaign', exact: true })
        .click();
      await page
        .getByRole('textbox', { name: 'Campaign title' })
        .fill('Local persistence smoke');
      await page
        .getByRole('textbox', { name: 'Recorded by' })
        .fill('Smoke player');
      await page.getByRole('button', { name: 'Create and save' }).click();
      await expect(
        page.getByRole('region', { name: 'Open campaign', exact: true }),
      ).toContainText('Local persistence smoke');
      const originalId = (await library(page)).active!.id;
      await page
        .getByRole('button', { name: 'Rename campaign', exact: true })
        .click();
      await page
        .getByRole('textbox', { name: 'Campaign title' })
        .fill('Uncommitted change');
      await page.getByRole('button', { name: 'Undo last edit' }).click();
      await expect(
        page.getByRole('textbox', { name: 'Campaign title' }),
      ).toHaveValue('Local persistence smoke');
      await page
        .getByRole('textbox', { name: 'Campaign title' })
        .fill('Persisted campaign');
      await navigateTo(page, 'Campaign Map');
      await expect(
        page.getByRole('region', { name: 'Campaign status' }),
      ).toContainText('Uncommitted draft');
      await navigateTo(page, 'Dashboard');
      await expect(
        page.getByRole('textbox', { name: 'Campaign title' }),
      ).toHaveValue('Persisted campaign');
      await page.getByRole('button', { name: 'Save changes' }).click();
      await expect(
        page.getByRole('region', { name: 'Open campaign', exact: true }),
      ).toContainText('Persisted campaign');
      for (let restart = 0; restart < 2; restart++) {
        await app.close();
        app = null;
        app = await launchDesktop(profile, packaged);
        page = await app.firstWindow();
        await expect(
          page.getByRole('region', { name: 'Open campaign', exact: true }),
        ).toContainText('Persisted campaign');
        const recovered = await library(page);
        expect(recovered.active?.id).toBe(originalId);
        expect(recovered.events.map((event) => event.category)).toEqual([
          'created',
          'renamed',
        ]);
      }
      await page
        .getByRole('button', { name: 'Clone campaign', exact: true })
        .click();
      await page
        .getByRole('textbox', { name: 'Campaign title' })
        .fill('Independent copy');
      await page.getByRole('button', { name: 'Clone and save' }).click();
      await expect(
        page.getByRole('region', { name: 'Open campaign', exact: true }),
      ).toContainText('Independent copy');
      expect((await library(page)).active?.id).not.toBe(originalId);
      await page
        .getByRole('button', { name: 'Open Persisted campaign', exact: true })
        .click();
      await expect(
        page.getByRole('region', { name: 'Open campaign', exact: true }),
      ).toContainText('Persisted campaign');
      const exportedFile = path.join(profile, 'saved-campaign.json');
      await app.evaluate(({ dialog }, filename) => {
        dialog.showSaveDialog = async () => ({
          canceled: false,
          filePath: filename,
        });
      }, exportedFile);
      await page.getByRole('button', { name: 'Export saved JSON' }).click();
      await expect(page.getByRole('status')).toContainText('exported');
      expect(JSON.parse(readFileSync(exportedFile, 'utf8')).formatVersion).toBe(
        2,
      );
      await app.evaluate(({ dialog }) => {
        dialog.showMessageBox = async () => ({
          response: 0,
          checkboxChecked: false,
        });
      });
      await page
        .getByRole('button', { name: 'Archive campaign', exact: true })
        .click();
      await expect(
        page.getByRole('button', { name: 'Archive campaign', exact: true }),
      ).toBeEnabled();
      expect((await library(page)).active?.status).toBe('draft');
      await app.evaluate(({ dialog }) => {
        dialog.showMessageBox = async () => ({
          response: 1,
          checkboxChecked: false,
        });
      });
      await page
        .getByRole('button', { name: 'Archive campaign', exact: true })
        .click();
      await expect(
        page.getByRole('button', { name: 'Rename campaign', exact: true }),
      ).toBeDisabled();
      const beforeInvalid = await library(page);
      expect(beforeInvalid.active?.status).toBe('archived');
      expect(beforeInvalid.events.map((event) => event.category)).toEqual([
        'created',
        'renamed',
        'archived',
      ]);
      const badFile = path.join(profile, 'bad.json');
      writeFileSync(badFile, '{truncated');
      await chooseImport(app, badFile);
      await page.getByRole('button', { name: 'Import JSON' }).click();
      await expect(page.getByRole('alert')).toContainText('not valid JSON');
      expect(await library(page)).toEqual(beforeInvalid);
      const unsupported = JSON.parse(readFileSync(exportedFile, 'utf8'));
      unsupported.formatVersion = 99;
      writeFileSync(badFile, JSON.stringify(unsupported));
      await page.getByRole('button', { name: 'Import JSON' }).click();
      await expect(page.getByRole('alert')).toContainText('formatVersion');
      expect(await library(page)).toEqual(beforeInvalid);
      await chooseImport(app, exportedFile);
      await page.getByRole('button', { name: 'Import JSON' }).click();
      await expect(page.getByRole('alert')).toContainText('already exists');
      expect(await library(page)).toEqual(beforeInvalid);
      await page.screenshot({
        path: `test-results/${packaged ? 'packaged' : 'built'}-campaigns.png`,
        fullPage: true,
      });
      // Exit without the repository close hook, then verify committed WAL recovery.
      const exited = new Promise<void>((resolve) =>
        app!.process().once('exit', () => resolve()),
      );
      await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
      await exited;
      app = null;
      app = await launchDesktop(profile, packaged);
      page = await app.firstWindow();
      await expect(
        page.getByRole('region', { name: 'Open campaign', exact: true }),
      ).toContainText('Archived record');
      expect(await library(page)).toEqual(beforeInvalid);
      await app.close();
      app = null;
      app = await launchDesktop(destinationProfile, packaged);
      page = await app.firstWindow();
      await expect(
        page.getByRole('button', { name: 'Import JSON' }),
      ).toBeEnabled();
      await chooseImport(app, exportedFile);
      await page.getByRole('button', { name: 'Import JSON' }).click();
      await expect(
        page.getByRole('region', { name: 'Open campaign', exact: true }),
      ).toContainText('Persisted campaign');
      const imported = await library(page);
      expect(imported.active?.id).toBe(originalId);
      expect(imported.events.map((event) => event.category)).toEqual([
        'created',
        'renamed',
        'imported',
      ]);
      await app.close();
      app = null;
      app = await launchDesktop(destinationProfile, packaged);
      page = await app.firstWindow();
      await expect(
        page.getByRole('region', { name: 'Open campaign', exact: true }),
      ).toContainText('Persisted campaign');
      expect(await library(page)).toEqual(imported);
      await page
        .getByRole('button', { name: 'Rename campaign', exact: true })
        .click();
      await page
        .getByRole('textbox', { name: 'Campaign title' })
        .fill('Uncommitted close test');
      await app.evaluate(({ app, dialog, BrowserWindow }) => {
        Reflect.set(app, 'closePrompts', 0);
        dialog.showMessageBoxSync = () => {
          Reflect.set(
            app,
            'closePrompts',
            Number(Reflect.get(app, 'closePrompts')) + 1,
          );
          return 0;
        };
        BrowserWindow.getAllWindows()[0]!.close();
      });
      await expect
        .poll(() =>
          app!.evaluate(({ app }) => Reflect.get(app, 'closePrompts')),
        )
        .toBe(1);
      await expect(
        page.getByRole('textbox', { name: 'Campaign title' }),
      ).toHaveValue('Uncommitted close test');
      const closed = new Promise<void>((resolve) =>
        app!.process().once('exit', () => resolve()),
      );
      await app
        .evaluate(({ dialog, BrowserWindow }) => {
          dialog.showMessageBoxSync = () => 1;
          BrowserWindow.getAllWindows()[0]!.close();
        })
        .catch(() => {});
      await closed;
      app = null;
      app = await launchDesktop(destinationProfile, packaged);
      page = await app.firstWindow();
      await expect(
        page.getByRole('region', { name: 'Open campaign', exact: true }),
      ).toContainText('Persisted campaign');
      expect(await library(page)).toEqual(imported);
      await expect(
        page.getByRole('textbox', { name: 'Campaign title' }),
      ).toHaveCount(0);
    } finally {
      if (app && app.process().exitCode === null) await app.close();
      removeTestProfile(profile);
      removeTestProfile(destinationProfile);
    }
  });
}
