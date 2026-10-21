import { _electron as electron } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Page } from '@playwright/test';

export async function navigateTo(page: Page, name: string) {
  const button = page.getByRole('button', { name, exact: true });
  if (!(await button.isVisible()))
    await page.locator('.campaign-navigation > summary').click();
  await button.click();
}
export async function selectMapView(page: Page, view: string) {
  const select = page.getByRole('combobox', { name: 'Map view' });
  if (!(await select.isVisible()))
    await page.locator('.map-options > summary').click();
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
