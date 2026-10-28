import { BrowserWindow, dialog, ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { randomInt, randomUUID } from 'node:crypto';
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
  operationalInputSchema,
  playerExportInputSchema,
  tabletopInputSchema,
  aftermathInputSchema,
  battleDocumentInputSchema,
  waterlooInputSchema,
  cloneCampaignSchema,
} from '../shared/campaign-contracts';
import { CampaignError, validationMessage } from './persistence/errors';
import type { CampaignRepository } from './persistence/repository';
import {
  readCampaignFile,
  writeCampaignFile,
  writeJsonFile,
} from './persistence/files';
import { projectOperationalView } from '../domain/operations';
import { applyTabletopCommand } from '../domain/tabletop';
import { applyAftermathCommand } from '../domain/aftermath';
import { battleBriefHtml } from '../domain/battle-brief';
import { waterlooBriefHtml } from '../domain/waterloo-brief';
import { applyWaterlooCommand } from '../domain/waterloo';
import { writeAtomicFile } from './persistence/files';

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
  handle(campaignChannels.waterlooCreate, createCampaignSchema, (input) =>
    repository.createWaterloo(input),
  );
  handle(
    campaignChannels.waterlooAction,
    waterlooInputSchema,
    async (input) => {
      if (
        [
          'resolve',
          'manual-adjudication',
          'historical-roster-review',
          'historical-regroup',
          'expand-regional-map',
          'result',
          'approve-result',
          'finalize',
          'reset-orders',
          'return-corps',
          'enable-preparation',
          'resolve-withdrawals',
          'maurice-recovery-policy',
          'maurice-commanders-enable',
          'maurice-epic-enable',
          'maurice-epic-record',
          'maurice-scout-request',
          'maurice-intelligence-report',
          'maurice-commander',
          'maurice-siege-policy',
          'maurice-siege-review',
          'reset-withdrawals',
        ].includes(input.command.kind)
      ) {
        const current = repository.exportCampaign({
          id: input.id,
          expectedRevision: input.expectedRevision,
        }).campaign;
        if (current.schemaVersion !== 3)
          throw new CampaignError(
            'validation',
            'Open a simultaneous campaign.',
          );
        try {
          applyWaterlooCommand(current, {
            command: input.command,
            recordId: randomUUID(),
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          throw new CampaignError(
            'validation',
            error instanceof Error ? error.message : 'Invalid campaign action.',
          );
        }
        const response = await dialog.showMessageBox(parent(), {
          type: 'question',
          title: 'Confirm campaign action?',
          message: `Confirm ${input.command.kind.replaceAll('-', ' ')}?`,
          detail:
            'The reviewed action is saved with a replayable campaign journal entry. Tactical results are entered manually.',
          buttons: ['Keep reviewing', 'Confirm campaign action'],
          defaultId: 0,
          cancelId: 0,
          noLink: true,
        });
        if (response.response !== 1) return repository.library();
      }
      return repository.waterloo(input);
    },
  );
  handle(campaignChannels.aftermath, aftermathInputSchema, async (input) => {
    if (
      ['apply-battle', 'finalize-turn', 'commander-status'].includes(
        input.command.kind,
      )
    ) {
      const campaign = repository.exportCampaign({
        id: input.id,
        expectedRevision: input.expectedRevision,
      }).campaign;
      if (campaign.schemaVersion !== 2)
        throw new CampaignError('validation', 'Open a configured campaign.');
      try {
        applyAftermathCommand(campaign, {
          command: input.command,
          recordId: randomUUID(),
          timestamp: new Date(
            Math.max(Date.now(), Date.parse(campaign.updatedAt)),
          ).toISOString(),
        });
      } catch (error) {
        throw new CampaignError(
          'validation',
          error instanceof Error ? error.message : 'Invalid campaign action.',
        );
      }
      const response = await dialog.showMessageBox(parent(), {
        type: 'question',
        title: 'Commit campaign changes?',
        message:
          input.command.kind === 'apply-battle'
            ? 'Apply the reviewed post-battle campaign changes?'
            : input.command.kind === 'finalize-turn'
              ? 'Finalize this completed turn’s recovery, siege and victory checkpoint?'
              : 'Record this commander status change?',
        detail:
          'These are explicit campaign house-rule changes. They are journaled with before/after state and cannot be silently undone. Tactical disruption and Army Morale are not carried into campaign exhaustion.',
        buttons: ['Keep reviewing', 'Commit campaign changes'],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      });
      if (response.response !== 1) return repository.library();
    }
    return repository.aftermath(input);
  });
  ipcMain.handle(campaignChannels.scoutDie, (event, input: unknown) => {
    assertSender(event);
    noInput.parse(input);
    return randomInt(1, 7);
  });
  handle(campaignChannels.tabletop, tabletopInputSchema, async (input) => {
    if (input.command.kind === 'record-result') {
      const campaign = repository.exportCampaign({
        id: input.id,
        expectedRevision: input.expectedRevision,
      }).campaign;
      if (campaign.schemaVersion !== 2)
        throw new CampaignError('validation', 'Open a configured campaign.');
      try {
        applyTabletopCommand(campaign, {
          command: input.command,
          recordId: randomUUID(),
          timestamp: new Date(
            Math.max(Date.now(), Date.parse(campaign.updatedAt)),
          ).toISOString(),
        });
      } catch (error) {
        throw new CampaignError(
          'validation',
          error instanceof Error ? error.message : 'Invalid result.',
        );
      }
      const response = await dialog.showMessageBox(parent(), {
        type: 'question',
        title: 'Confirm tabletop result?',
        message: 'Save this battle outcome and every unit/commander result?',
        detail:
          'This creates an immutable journal entry. No losses, quality changes, persistent disruption, siege progress or victory result will be applied. Post-battle campaign effects require separate review in Milestone F.',
        buttons: ['Keep editing', 'Confirm battle result'],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      });
      if (response.response !== 1) return repository.library();
    }
    return repository.tabletop(input);
  });
  handle(
    campaignChannels.battleBrief,
    battleDocumentInputSchema,
    async (input) => {
      const ref = { id: input.id, expectedRevision: input.expectedRevision };
      const initial = repository.exportCampaign(ref).campaign;
      if (
        !(initial.schemaVersion === 3
          ? initial.battles.some((b) => b.id === input.battleId)
          : initial.schemaVersion === 2 &&
            initial.tabletop?.battles.some((b) => b.id === input.battleId))
      )
        throw new CampaignError('validation', 'Choose a saved battle brief.');
      const selected = await dialog.showSaveDialog(parent(), {
        title: 'Save printable battle brief (both sides)',
        defaultPath: `battle-${input.battleId}.${input.format}`,
        filters: [
          {
            name: input.format === 'pdf' ? 'Printable PDF' : 'Offline HTML',
            extensions: [input.format],
          },
        ],
      });
      if (selected.canceled || !selected.filePath) return { cancelled: true };
      if (!selected.filePath.toLowerCase().endsWith(`.${input.format}`))
        throw new CampaignError(
          'file',
          `Save the brief with a .${input.format} extension.`,
        );
      const current = repository.exportCampaign(ref).campaign;
      if (current.schemaVersion === 1)
        throw new CampaignError(
          'validation',
          'Campaign changed; reload before exporting.',
        );
      const html =
        current.schemaVersion === 3
          ? waterlooBriefHtml(
              current,
              current.battles.find((b) => b.id === input.battleId)!,
            )
          : battleBriefHtml(
              current,
              current.tabletop!.battles.find((b) => b.id === input.battleId)!,
            );
      if (input.format === 'html') writeAtomicFile(selected.filePath, html);
      else {
        const printWindow = new BrowserWindow({
          show: false,
          webPreferences: {
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
          },
        });
        printWindow.webContents.setWindowOpenHandler(() => ({
          action: 'deny',
        }));
        try {
          await printWindow.loadURL(
            `data:text/html;charset=UTF-8,${encodeURIComponent(html)}`,
          );
          const pdf = await printWindow.webContents.printToPDF({
            printBackground: true,
            pageSize: 'A4',
            preferCSSPageSize: true,
          });
          writeAtomicFile(selected.filePath, pdf);
        } finally {
          if (!printWindow.isDestroyed()) printWindow.destroy();
        }
      }
      return { cancelled: false };
    },
  );
  handle(campaignChannels.operations, operationalInputSchema, async (input) => {
    if (input.command.kind === 'resolve') {
      const campaign = repository.exportCampaign({
        id: input.id,
        expectedRevision: input.expectedRevision,
      }).campaign;
      if (campaign.schemaVersion !== 2)
        throw new CampaignError('validation', 'Open a configured campaign.');
      const response = await dialog.showMessageBox(parent(), {
        type: 'question',
        title: 'Commit operational resolution?',
        message: `Resolve ${campaign.activeSide} orders for turn ${campaign.turn}?`,
        detail:
          'This commits movement, records engagement candidates and advances the faction or campaign day using your provisional house rules. Issued orders remain in the journal. Committed resolution cannot be undone.',
        buttons: ['Keep reviewing', 'Resolve orders'],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      });
      if (response.response !== 1) return repository.library();
    }
    return repository.operate(input);
  });
  handle(
    campaignChannels.playerExport,
    playerExportInputSchema,
    async (input) => {
      const ref = { id: input.id, expectedRevision: input.expectedRevision };
      const campaign = repository.exportCampaign(ref).campaign;
      if (campaign.schemaVersion !== 2)
        throw new CampaignError('validation', 'Open a configured campaign.');
      const selected = await dialog.showSaveDialog(parent(), {
        title: 'Export faction view (not a campaign backup)',
        defaultPath: `${input.view}-turn-${campaign.turn}.json`,
        filters: [{ name: 'Faction view JSON', extensions: ['json'] }],
      });
      if (selected.canceled || !selected.filePath) return { cancelled: true };
      const current = repository.exportCampaign(ref).campaign;
      if (current.schemaVersion !== 2)
        throw new CampaignError(
          'validation',
          'Campaign changed. Reload before exporting.',
        );
      writeJsonFile(
        selected.filePath,
        projectOperationalView(current, input.view),
      );
      return { cancelled: false };
    },
  );
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
        'The map and operational setup are provisional house rules. Starting records turn 1. Operational play can then be enabled from Campaign Map; siege progression and tabletop resolution remain later milestones.',
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
  handle(campaignChannels.clone, cloneCampaignSchema, (input) =>
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
