import { z } from 'zod';
import type { errorSchema } from '../../shared/campaign-contracts';

export class CampaignError extends Error {
  constructor(
    public readonly code: z.infer<typeof errorSchema>['code'],
    message: string,
  ) {
    super(message);
  }
}
export function validationMessage(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join('.') || 'File'}: ${issue.message}`)
    .join('; ')
    .slice(0, 1800);
}
