import { _electron as electron, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Page } from '@playwright/test';

export async function openDeskDrawer(page: Page, title: string) {
  const drawer = page.locator(`.desk-drawer[data-drawer="${title}"]`);
  if ((await drawer.getAttribute('open')) === null)
    await drawer.locator(':scope > summary').click();
  await expect(drawer).toHaveAttribute('open');
}
export async function closeDeskDrawer(page: Page, title: string) {
  const drawer = page.locator(`.desk-drawer[data-drawer="${title}"]`);
  if (await drawer.evaluate((e) => e.hasAttribute('open')))
    await drawer
      .getByRole('button', { name: `Close ${title}`, exact: true })
      .click();
}
export async function openPlayerHelper(page: Page) {
  const helper = page.locator('.compact-helper');
  if (
    (await helper.count()) &&
    !(await helper.evaluate((e) => e.hasAttribute('open')))
  )
    await helper.locator(':scope > summary').click();
}
export async function showHelperChoice(page: Page, name: string) {
  await expect(page.locator('.player-helper')).toContainText(
    name.replace('Show me: ', ''),
  );
  await openPlayerHelper(page);
  await page.getByRole('button', { name, exact: true }).click();
}

export async function navigateTo(page: Page, name: string) {
  await expect(page.locator('.topbar')).toBeVisible();
  const button = page.getByRole('button', { name, exact: true });
  if (!(await button.isVisible()))
    await page.locator('.campaign-navigation > summary').click();
  await button.click();
}
export async function selectMapView(page: Page, view: string) {
  const select = page.getByRole('combobox', { name: 'Map view' });
  if (!(await select.isVisible()))
    await openDeskDrawer(page, 'Map options & campaign setup');
  await expect(select).toBeVisible();
  await select.selectOption(view);
}

export function testProfile() {
  return mkdtempSync(path.join(os.tmpdir(), 'maurice-electron-test-'));
}
export function removeTestProfile(directory: string) {
  const resolved = path.resolve(directory);
  if (!resolved.startsWith(path.join(os.tmpdir(), 'maurice-electron-test-')))
    throw new Error('Unsafe test profile cleanup path');
  rmSync(resolved, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 100,
  });
}
export function launchDesktop(
  directory: string,
  packaged = false,
  development = false,
) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_RENDERER_URL;
  if (development) env.ELECTRON_RENDERER_URL = 'http://127.0.0.1:5173';
  return electron.launch({
    args: [...(packaged ? [] : ['.']), `--user-data-dir=${directory}`],
    ...(packaged
      ? {
          executablePath: path.resolve(
            'release/win-unpacked/Maurice Campaign Companion.exe',
          ),
        }
      : {}),
    env,
  });
}
