import { z } from 'zod';
import { tabletopCommandSchema } from '../domain/tabletop-schema';
import { aftermathCommandSchema } from '../domain/aftermath-schema';
import { idSchema, librarySchema, titleSchema } from '../domain/campaign';
import {
  operationalCommandSchema,
  mapViewSchema,
} from '../domain/operations-schema';
import {
  fontenoySettingsSchema,
  fontenoyColumnSchema,
  fontenoyCommanderSchema,
} from '../domain/fontenoy-schema';

const audit = {
  actor: z.string().trim().min(1).max(120),
  reason: z.string().trim().min(1).max(500),
};
export const campaignRefSchema = z.object({ id: idSchema }).strict();
export const revisionRefSchema = campaignRefSchema.extend({
  expectedRevision: z.number().int().positive(),
});
export const createCampaignSchema = z
  .object({ title: titleSchema, ...audit })
  .strict();
export const renameCampaignSchema = revisionRefSchema.extend({
  title: titleSchema,
  ...audit,
});
export const archiveCampaignSchema = revisionRefSchema.extend(audit);
export const operationalInputSchema = archiveCampaignSchema.extend({
  command: operationalCommandSchema,
});
export const tabletopInputSchema = archiveCampaignSchema.extend({
  command: tabletopCommandSchema,
});
export type TabletopInput = z.infer<typeof tabletopInputSchema>;
export const aftermathInputSchema = archiveCampaignSchema.extend({
  command: aftermathCommandSchema,
});
export type AftermathInput = z.infer<typeof aftermathInputSchema>;
export const battleDocumentInputSchema = revisionRefSchema.extend({
  battleId: idSchema,
  format: z.enum(['html', 'pdf']),
});
export type BattleDocumentInput = z.infer<typeof battleDocumentInputSchema>;
export const scoutRollSchema = z.number().int().min(1).max(6);
export type OperationalInput = z.infer<typeof operationalInputSchema>;
export const playerExportInputSchema = revisionRefSchema.extend({
  view: mapViewSchema.exclude(['umpire']),
});
export const setupCampaignSchema = archiveCampaignSchema.extend({
  settings: fontenoySettingsSchema,
  columns: z.array(fontenoyColumnSchema).max(1000),
  commanders: z.array(fontenoyCommanderSchema).max(1000),
});
export type SetupCampaignInput = z.infer<typeof setupCampaignSchema>;
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type RenameCampaignInput = z.infer<typeof renameCampaignSchema>;
export type ArchiveCampaignInput = z.infer<typeof archiveCampaignSchema>;
export type RevisionRef = z.infer<typeof revisionRefSchema>;
export const errorSchema = z
  .object({
    code: z.enum(['validation', 'conflict', 'not_found', 'storage', 'file']),
    message: z.string().min(1).max(2000),
  })
  .strict();
export function resultSchema<T extends z.ZodType>(value: T) {
  return z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), value }).strict(),
    z.object({ ok: z.literal(false), error: errorSchema }).strict(),
  ]);
}
export const libraryResultSchema = resultSchema(librarySchema);
export const fileResultSchema = resultSchema(
  z.object({ cancelled: z.boolean() }).strict(),
);
export type LibraryResult = z.infer<typeof libraryResultSchema>;
export type FileResult = z.infer<typeof fileResultSchema>;
export interface CampaignApi {
  commitAftermathAction(input: AftermathInput): Promise<LibraryResult>;
  commitTabletopAction(input: TabletopInput): Promise<LibraryResult>;
  rollScoutingDie(): Promise<number>;
  exportBattleBrief(input: BattleDocumentInput): Promise<FileResult>;
  commitOperationalAction(input: OperationalInput): Promise<LibraryResult>;
  exportPlayerView(
    input: z.infer<typeof playerExportInputSchema>,
  ): Promise<FileResult>;
  initializeScenario(input: ArchiveCampaignInput): Promise<LibraryResult>;
  saveCampaignSetup(input: SetupCampaignInput): Promise<LibraryResult>;
  startCampaign(input: ArchiveCampaignInput): Promise<LibraryResult>;
  getCampaignLibrary(): Promise<LibraryResult>;
  createCampaign(input: CreateCampaignInput): Promise<LibraryResult>;
  renameCampaign(input: RenameCampaignInput): Promise<LibraryResult>;
  cloneCampaign(input: RenameCampaignInput): Promise<LibraryResult>;
  archiveCampaign(input: ArchiveCampaignInput): Promise<LibraryResult>;
  openCampaign(
    input: z.infer<typeof campaignRefSchema>,
  ): Promise<LibraryResult>;
  importCampaign(): Promise<LibraryResult>;
  exportCampaign(input: RevisionRef): Promise<FileResult>;
  confirmDiscardDraft(): Promise<boolean>;
}
export const campaignChannels = {
  aftermath: 'campaign:aftermath-action',
  tabletop: 'campaign:tabletop-action',
  scoutDie: 'campaign:scout-die',
  battleBrief: 'campaign:export-battle-brief',
  operations: 'campaign:operational-action',
  playerExport: 'campaign:export-player-view',
  initialize: 'campaign:initialize-fontenoy',
  setup: 'campaign:save-setup',
  start: 'campaign:start',
  library: 'campaign:library',
  create: 'campaign:create',
  rename: 'campaign:rename',
  clone: 'campaign:clone',
  archive: 'campaign:archive',
  open: 'campaign:open',
  import: 'campaign:import',
  export: 'campaign:export',
  discard: 'campaign:confirm-discard',
} as const;
