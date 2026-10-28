import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import {
  channels,
  noInput,
  diagnosticSchema,
  appInfoSchema,
} from '../shared/contracts';
import { isTrustedDocument } from './security';
import { SqliteCampaignRepository } from './persistence/repository';
import type { CampaignRepository } from './persistence/repository';
import { registerCampaignIpc } from './campaign-ipc';
import { KsRepository } from './persistence/ks-repository';
import { registerKsIpc } from './ks-ipc';

// Also isolates automated test profiles from the player's real saves.
app.setName('maurice-campaign-companion');
const profile = app.commandLine.getSwitchValue('user-data-dir');
if (profile) {
  mkdirSync(path.resolve(profile), { recursive: true });
  app.setPath('userData', path.resolve(profile));
}
const ownsInstance = app.requestSingleInstanceLock();
if (!ownsInstance) app.quit();

let window: BrowserWindow | null = null;
let repository: CampaignRepository | null = null;
let ksRepository: KsRepository | null = null;
const rendererFile = path.join(__dirname, '../renderer/index.html');
const devOrigin =
  !app.isPackaged &&
  process.env.ELECTRON_RENDERER_URL === 'http://127.0.0.1:5173'
    ? process.env.ELECTRON_RENDERER_URL
    : undefined;

function log(message: string): boolean {
  try {
    const directory = app.getPath('logs');
    mkdirSync(directory, { recursive: true });
    appendFileSync(
      path.join(directory, 'diagnostics.log'),
      JSON.stringify({ at: new Date().toISOString(), message }) + '\n',
    );
    return true;
  } catch {
    console.error('Unable to write application diagnostic');
    return false;
  }
}
function assertSender(event: IpcMainInvokeEvent) {
  if (
    !window ||
    event.sender !== window.webContents ||
    event.senderFrame !== window.webContents.mainFrame ||
    !isTrustedDocument(event.senderFrame.url, rendererFile, devOrigin)
  )
    throw new Error('Untrusted IPC sender');
}
function createWindow() {
  window = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 900,
    minHeight: 650,
    show: false,
    backgroundColor: '#292c2e',
    title: 'Maurice Campaign Companion',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
    },
  });
  window.removeMenu();
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.on('will-attach-webview', (event) =>
    event.preventDefault(),
  );
  window.webContents.on('will-prevent-unload', (event) => {
    if (!window) return;
    const choice = dialog.showMessageBoxSync(window, {
      type: 'question',
      title: 'Discard unsaved edits?',
      message: 'Close the companion and discard unsaved campaign edits?',
      detail:
        'Committed actions have already been saved. Uncommitted edits will be lost.',
      buttons: ['Keep editing', 'Discard and close'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    if (choice === 1) event.preventDefault();
  });
  window.webContents.session.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );
  window.webContents.session.setPermissionCheckHandler(() => false);
  window.webContents.on('render-process-gone', (_event, details) => {
    log(`Renderer exited: ${details.reason}`);
  });
  window.webContents.on(
    'did-fail-load',
    (_event, code, description, _url, isMainFrame) => {
      // Reload and close cancel a previous navigation (Chromium ERR_ABORTED).
      if (code === -3 || !isMainFrame) return;
      log(`Load failed ${code}: ${description}`);
      dialog.showErrorBox(
        'Unable to open companion',
        'The application screen could not load. Restart the application.',
      );
    },
  );
  window.once('ready-to-show', () => window?.show());
  window.on('closed', () => {
    window = null;
  });
  if (devOrigin) void window.loadURL(devOrigin).catch(logLoadError);
  else void window.loadFile(rendererFile).catch(logLoadError);
}

function logLoadError(error: unknown) {
  if (error instanceof Error && 'code' in error && error.code === 'ERR_ABORTED')
    return;
  log(String(error));
}

process.on('uncaughtException', (error) => {
  log(error.stack ?? error.message);
  dialog.showErrorBox(
    'Application error',
    'An unexpected application error occurred. Please restart the companion.',
  );
  app.exit(1);
});
process.on('unhandledRejection', (error: unknown) => {
  log(String(error));
});
void app.whenReady().then(() => {
  if (!ownsInstance) return;
  try {
    mkdirSync(app.getPath('userData'), { recursive: true });
    repository = new SqliteCampaignRepository(
      path.join(app.getPath('userData'), 'campaigns.sqlite'),
    );
    // Validate the recovered record before exposing the window; never reset a bad database.
    repository.library();
  } catch (error) {
    log(`Database startup failed: ${String(error)}`);
    dialog.showErrorBox(
      'Unable to open campaign storage',
      'The campaign database could not be opened or validated. Your saves have not been replaced. Preserve the application data directory and check the local diagnostic log before retrying.',
    );
    app.quit();
    return;
  }
  registerCampaignIpc(repository, () => window, assertSender, log);
  registerKsIpc(
    () => {
      ksRepository ??= new KsRepository(
        path.join(app.getPath('userData'), 'free-ks.sqlite'),
      );
      return ksRepository;
    },
    () => window,
    assertSender,
    log,
  );
  ipcMain.handle(channels.info, (event, input: unknown) => {
    assertSender(event);
    noInput.parse(input);
    return appInfoSchema.parse({
      version: app.getVersion(),
      platform: process.platform,
      milestone: 'F',
    });
  });
  ipcMain.handle(channels.confirm, async (event, input: unknown) => {
    assertSender(event);
    noInput.parse(input);
    if (!window) return false;
    const result = await dialog.showMessageBox(window, {
      type: 'question',
      title: 'Reset session notice?',
      message: 'Clear the diagnostic notice for this session?',
      detail: 'This action does not save or change a campaign.',
      buttons: ['Cancel', 'Reset notice'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    return result.response === 1;
  });
  ipcMain.handle(channels.log, (event, input: unknown) => {
    assertSender(event);
    const entry = diagnosticSchema.parse(input);
    return { recorded: log(`${entry.source}: ${entry.message}`) };
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('second-instance', () => {
  if (window?.isMinimized()) window.restore();
  window?.focus();
});
app.on('will-quit', () => {
  ksRepository?.close();
  ksRepository = null;
  repository?.close();
  repository = null;
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
