import { dialog, ipcMain } from 'electron';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';
import { noInput } from '../shared/contracts';
import {
  campaignChannels,
  campaignRefSchema,
  revisionRefSchema,
  createCampaignSchema,
  renameCampaignSchema,
  archiveCampaignSchema,
  setupCampaignSchema,
} from '../shared/campaign-contracts';
import { CampaignError, validationMessage } from './persistence/errors';
import type { CampaignRepository } from './persistence/repository';
import { readCampaignFile, writeCampaignFile } from './persistence/files';

export function registerCampaignIpc(
  repository: CampaignRepository,
  getWindow: () => BrowserWindow | null,
  assertSender: (event: IpcMainInvokeEvent) => void,
  log: (message: string) => boolean,
) {
  const parent = () => {
    const window = getWindow();
    if (!window)
      throw new CampaignError(
        'storage',
        'The application window is unavailable. Reopen the application.',
      );
    return window;
  };
  function handle<T extends z.ZodType>(
    channel: string,
    schema: T,
    operation: (input: z.infer<T>) => unknown | Promise<unknown>,
  ) {
    ipcMain.handle(channel, async (event, input: unknown) => {
      assertSender(event);
      try {
        return { ok: true, value: await operation(schema.parse(input)) };
      } catch (error) {
        if (error instanceof CampaignError)
          return {
            ok: false,
            error: { code: error.code, message: error.message },
          };
        if (error instanceof z.ZodError)
          return {
            ok: false,
            error: {
              code: 'validation',
              message: `Unsupported or invalid campaign data. ${validationMessage(error)}`,
            },
          };
        log(
          `Campaign operation ${channel} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        return {
          ok: false,
          error: {
            code:
              channel === campaignChannels.import ||
              channel === campaignChannels.export
                ? 'file'
                : 'storage',
            message:
              'The operation could not be completed. Check that the file or data directory is accessible and there is free disk space, then retry. Existing committed data was preserved.',
          },
        };
      }
    });
  }
  handle(campaignChannels.library, noInput, () => repository.library());
  handle(campaignChannels.initialize, archiveCampaignSchema, (input) =>
    repository.initializeScenario(input),
  );
  handle(campaignChannels.setup, setupCampaignSchema, (input) =>
    repository.saveSetup(input),
  );
  handle(campaignChannels.start, archiveCampaignSchema, async (input) => {
    const campaign = repository.exportCampaign({
      id: input.id,
      expectedRevision: input.expectedRevision,
    }).campaign;
    const response = await dialog.showMessageBox(parent(), {
      type: 'question',
      title: 'Start reviewed campaign?',
      message: `Start “${campaign.title}” with the saved setup?`,
      detail:
        'The map and operational setup are provisional house rules. Starting records turn 1; movement, siege progression and tabletop resolution remain future milestones.',
      buttons: ['Keep reviewing', 'Start Campaign'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    return response.response === 1
      ? repository.start(input)
      : repository.library();
  });
  handle(campaignChannels.create, createCampaignSchema, (input) =>
    repository.create(input),
  );
  handle(campaignChannels.rename, renameCampaignSchema, (input) =>
    repository.rename(input),
  );
  handle(campaignChannels.clone, renameCampaignSchema, (input) =>
    repository.clone(input),
  );
  handle(campaignChannels.open, campaignRefSchema, (input) =>
    repository.open(input.id),
  );
  handle(campaignChannels.archive, archiveCampaignSchema, async (input) => {
    const campaign = repository.exportCampaign({
      id: input.id,
      expectedRevision: input.expectedRevision,
    }).campaign;
    const response = await dialog.showMessageBox(parent(), {
      type: 'question',
      title: 'Archive campaign?',
      message: `Archive “${campaign.title}”?`,
      detail:
        'The campaign and its journal will remain available as a read-only record. You can clone it to continue editing.',
      buttons: ['Cancel', 'Archive campaign'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    return response.response === 1
      ? repository.archive(input)
      : repository.library();
  });
  handle(campaignChannels.import, noInput, async () => {
    const selected = await dialog.showOpenDialog(parent(), {
      title: 'Import campaign JSON',
      properties: ['openFile'],
      filters: [{ name: 'Campaign JSON', extensions: ['json'] }],
    });
    if (selected.canceled || !selected.filePaths[0])
      return repository.library();
    return repository.importCampaign(readCampaignFile(selected.filePaths[0]));
  });
  handle(campaignChannels.export, revisionRefSchema, async (input) => {
    repository.exportCampaign(input); // Reject stale/missing campaigns before opening a dialog.
    const selected = await dialog.showSaveDialog(parent(), {
      title: 'Export saved campaign',
      defaultPath: `campaign-${input.id}.json`,
      filters: [{ name: 'Campaign JSON', extensions: ['json'] }],
    });
    if (selected.canceled || !selected.filePath) return { cancelled: true };
    writeCampaignFile(selected.filePath, repository.exportCampaign(input));
    return { cancelled: false };
  });
  ipcMain.handle(campaignChannels.discard, async (event, input: unknown) => {
    assertSender(event);
    noInput.parse(input);
    const response = await dialog.showMessageBox(parent(), {
      type: 'question',
      title: 'Discard draft edits?',
      message: 'Discard the unsaved campaign edits?',
      detail:
        'Committed campaign data and journal entries will remain unchanged.',
      buttons: ['Keep editing', 'Discard edits'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    return response.response === 1;
  });
}
