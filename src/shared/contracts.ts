import { z } from 'zod';
import type { CampaignApi } from './campaign-contracts';
import type { KsApi } from './ks-contracts';

export const channels = {
  info: 'app:info',
  confirm: 'app:confirm-reset',
  log: 'app:log-error',
} as const;
export const noInput = z.undefined();
export const appInfoSchema = z
  .object({
    version: z.string().min(1),
    platform: z.enum(['win32', 'linux', 'darwin']),
    milestone: z.literal('F'),
  })
  .strict();
export const diagnosticSchema = z
  .object({
    source: z.enum(['renderer', 'boundary']),
    message: z.string().trim().min(1).max(1000),
  })
  .strict();
export const confirmationSchema = z.boolean();
export const logResultSchema = z.object({ recorded: z.boolean() }).strict();
export interface DesktopApi extends CampaignApi, KsApi {
  getAppInfo(): Promise<z.infer<typeof appInfoSchema>>;
  confirmResetSession(): Promise<boolean>;
  logError(
    input: z.infer<typeof diagnosticSchema>,
  ): Promise<z.infer<typeof logResultSchema>>;
}
