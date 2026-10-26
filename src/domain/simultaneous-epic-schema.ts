import { z } from 'zod';
import { idSchema } from './legacy-campaign';
export const epicInputSchema = z
  .object({
    source: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('battle'), battleId: idSchema }).strict(),
      z
        .object({
          kind: z.literal('campaign'),
          title: z.string().trim().min(1).max(160),
        })
        .strict(),
    ]),
    points: z
      .object({
        french: z.number().int().min(0).max(10000).nullable(),
        allied: z.number().int().min(0).max(10000).nullable(),
      })
      .strict(),
    notes: z.string().trim().min(1).max(4000),
  })
  .strict();
export const epicCommandSchema = z
  .object({
    kind: z.literal('maurice-epic-record'),
    entryId: idSchema.nullable(),
    expectedVersion: z.number().int().min(0).max(500),
    input: epicInputSchema,
    reason: z.string().trim().min(1).max(4000),
  })
  .strict();
export const epicLedgerSchema = z
  .object({
    ruleId: z.literal('maurice_manual_epic_v0.1'),
    enabledAt: z.number().int().min(0).max(1000000),
    revisions: z
      .array(
        z
          .object({
            id: idSchema,
            entryId: idSchema,
            version: z.number().int().min(1).max(500),
            supersedesId: idSchema.nullable(),
            turn: z.number().int().min(1).max(100),
            at: z.number().int().min(0).max(1000000),
            timestamp: z.iso.datetime(),
            battleVersion: z.number().int().min(1).nullable(),
            input: epicInputSchema,
            reason: z.string().trim().min(1).max(4000),
          })
          .strict(),
      )
      .max(500),
  })
  .strict();
export type EpicInput = z.infer<typeof epicInputSchema>;
export type EpicCommand = z.infer<typeof epicCommandSchema>;
export type EpicRevision = z.infer<
  typeof epicLedgerSchema
>['revisions'][number];
