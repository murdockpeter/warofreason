import { contextBridge, ipcRenderer } from 'electron';
import {
  channels,
  appInfoSchema,
  confirmationSchema,
  diagnosticSchema,
  logResultSchema,
} from '../shared/contracts';
import type { DesktopApi } from '../shared/contracts';
import {
  campaignChannels,
  campaignRefSchema,
  revisionRefSchema,
  createCampaignSchema,
  renameCampaignSchema,
  archiveCampaignSchema,
  libraryResultSchema,
  fileResultSchema,
  setupCampaignSchema,
} from '../shared/campaign-contracts';

const api = Object.freeze<DesktopApi>({
  initializeScenario: async (input) =>
    libraryResultSchema.parse(
      await ipcRenderer.invoke(
        campaignChannels.initialize,
        archiveCampaignSchema.parse(input),
      ),
    ),
  saveCampaignSetup: async (input) =>
    libraryResultSchema.parse(
      await ipcRenderer.invoke(
        campaignChannels.setup,
        setupCampaignSchema.parse(input),
      ),
    ),
  startCampaign: async (input) =>
    libraryResultSchema.parse(
      await ipcRenderer.invoke(
        campaignChannels.start,
        archiveCampaignSchema.parse(input),
      ),
    ),
  getCampaignLibrary: async () =>
    libraryResultSchema.parse(
      await ipcRenderer.invoke(campaignChannels.library),
    ),
  createCampaign: async (input) =>
    libraryResultSchema.parse(
      await ipcRenderer.invoke(
        campaignChannels.create,
        createCampaignSchema.parse(input),
      ),
    ),
  renameCampaign: async (input) =>
    libraryResultSchema.parse(
      await ipcRenderer.invoke(
        campaignChannels.rename,
        renameCampaignSchema.parse(input),
      ),
    ),
  cloneCampaign: async (input) =>
    libraryResultSchema.parse(
      await ipcRenderer.invoke(
        campaignChannels.clone,
        renameCampaignSchema.parse(input),
      ),
    ),
  archiveCampaign: async (input) =>
    libraryResultSchema.parse(
      await ipcRenderer.invoke(
        campaignChannels.archive,
        archiveCampaignSchema.parse(input),
      ),
    ),
  openCampaign: async (input) =>
    libraryResultSchema.parse(
      await ipcRenderer.invoke(
        campaignChannels.open,
        campaignRefSchema.parse(input),
      ),
    ),
  importCampaign: async () =>
    libraryResultSchema.parse(
      await ipcRenderer.invoke(campaignChannels.import),
    ),
  exportCampaign: async (input) =>
    fileResultSchema.parse(
      await ipcRenderer.invoke(
        campaignChannels.export,
        revisionRefSchema.parse(input),
      ),
    ),
  confirmDiscardDraft: async () =>
    confirmationSchema.parse(
      await ipcRenderer.invoke(campaignChannels.discard),
    ),
  getAppInfo: async () =>
    appInfoSchema.parse(await ipcRenderer.invoke(channels.info)),
  confirmResetSession: async () =>
    confirmationSchema.parse(await ipcRenderer.invoke(channels.confirm)),
  logError: async (input) =>
    logResultSchema.parse(
      await ipcRenderer.invoke(channels.log, diagnosticSchema.parse(input)),
    ),
});
contextBridge.exposeInMainWorld('desktop', api);
