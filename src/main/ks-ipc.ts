import { dialog, ipcMain } from 'electron';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';
import {
  ksChannels,
  ksActionSchema,
  ksCreateSchema,
  ksRefSchema,
  ksRevisionSchema,
} from '../shared/ks-contracts';
import { noInput } from '../shared/contracts';
import { KsRepository } from './persistence/ks-repository';
import { ksExportSchema } from '../domain/crimean-ks';
import { readJsonFile, writeJsonFile } from './persistence/files';
import { CampaignError } from './persistence/errors';

export function registerKsIpc(
  getRepository: () => KsRepository,
  getWindow: () => BrowserWindow | null,
  assertSender: (e: IpcMainInvokeEvent) => void,
  log: (message: string) => boolean,
) {
  function handle<T extends z.ZodType>(
    name: string,
    schema: T,
    action: (input: z.infer<T>) => unknown | Promise<unknown>,
  ) {
    ipcMain.handle(name, async (event, raw: unknown) => {
      assertSender(event);
      try {
        return { ok: true, value: await action(schema.parse(raw)) };
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
              message: `Invalid Free KS data: ${error.issues[0]?.message ?? 'Review the entered values.'}`,
            },
          };
        log(`Free KS action failed: ${String(error)}`);
        return {
          ok: false,
          error: {
            code: 'validation',
            message:
              error instanceof Error
                ? error.message.slice(0, 1000)
                : 'Free KS action failed; no changes were saved.',
          },
        };
      }
    });
  }
  const parent = () => {
    const w = getWindow();
    if (!w) throw new Error('Reopen the application window.');
    return w;
  };
  handle(ksChannels.library, noInput, () => getRepository().library());
  handle(ksChannels.create, ksCreateSchema, (input) =>
    getRepository().create(input),
  );
  handle(ksChannels.open, ksRefSchema, (input) => getRepository().open(input));
  handle(ksChannels.action, ksActionSchema, (input) =>
    getRepository().act(input),
  );
  handle(ksChannels.import, noInput, async () => {
    const selected = await dialog.showOpenDialog(parent(), {
      title: 'Import Crimean Free KS campaign',
      properties: ['openFile'],
      filters: [{ name: 'Free KS JSON', extensions: ['json'] }],
    });
    if (selected.canceled || !selected.filePaths[0])
      return getRepository().library();
    return getRepository().import(
      ksExportSchema.parse(readJsonFile(selected.filePaths[0])),
    );
  });
  handle(ksChannels.export, ksRevisionSchema, async (input) => {
    getRepository().export(input);
    const selected = await dialog.showSaveDialog(parent(), {
      title: 'Export Crimean Free KS campaign',
      defaultPath: 'crimean-free-ks.json',
      filters: [{ name: 'Free KS JSON', extensions: ['json'] }],
    });
    if (selected.canceled || !selected.filePath) return { cancelled: true };
    writeJsonFile(selected.filePath, getRepository().export(input));
    return { cancelled: false };
  });
}
