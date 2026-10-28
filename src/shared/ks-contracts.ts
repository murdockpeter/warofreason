import { z } from 'zod';
import {
  ksAuditSchema,
  ksCommandSchema,
  ksLibrarySchema,
} from '../domain/crimean-ks';
import { resultSchema, fileResultSchema } from './campaign-contracts';
export const ksRefSchema = z.object({ id: z.uuid() }).strict();
export const ksRevisionSchema = ksRefSchema.extend({
  expectedRevision: z.number().int().positive(),
});
export const ksCreateSchema = ksAuditSchema.extend({
  title: z.string().trim().min(1).max(120),
});
export const ksActionSchema = ksRevisionSchema.extend({
  ...ksAuditSchema.shape,
  command: ksCommandSchema,
});
export const ksLibraryResultSchema = resultSchema(ksLibrarySchema);
export type KsResult = z.infer<typeof ksLibraryResultSchema>;
export interface KsApi {
  getKsLibrary(): Promise<KsResult>;
  createKsCampaign(input: z.infer<typeof ksCreateSchema>): Promise<KsResult>;
  openKsCampaign(input: z.infer<typeof ksRefSchema>): Promise<KsResult>;
  commitKsRuling(input: z.infer<typeof ksActionSchema>): Promise<KsResult>;
  importKsCampaign(): Promise<KsResult>;
  exportKsCampaign(
    input: z.infer<typeof ksRevisionSchema>,
  ): Promise<z.infer<typeof fileResultSchema>>;
}
export const ksChannels = {
  library: 'ks:library',
  create: 'ks:create',
  open: 'ks:open',
  action: 'ks:ruling',
  import: 'ks:import',
  export: 'ks:export',
} as const;
