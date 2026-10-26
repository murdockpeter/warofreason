import { z } from 'zod';
import { idSchema } from './legacy-campaign';
import { fontenoyCommanderSchema } from './fontenoy-schema';
const notes = z.string().trim().min(1).max(4000);
export const officerActionSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('arrival'),
      side: z.enum(['french', 'allied']),
      displayName: z.string().trim().min(1).max(120),
      notableReference: z.string().trim().max(4000),
      notes,
    })
    .strict(),
  z
    .object({
      kind: z.literal('details'),
      commanderId: idSchema,
      displayName: z.string().trim().min(1).max(120),
      notableReference: z.string().trim().max(4000),
      notes,
    })
    .strict(),
  z
    .object({
      kind: z.literal('status'),
      commanderId: idSchema,
      status: z.enum(['active', 'retired', 'lost']),
      notes,
    })
    .strict(),
  z
    .object({
      kind: z.literal('attachment'),
      commanderId: idSchema,
      corpsId: idSchema.nullable(),
      notes,
    })
    .strict(),
]);
export const simultaneousCommandersSchema = z
  .object({
    ruleId: z.literal('maurice_commanders_v0.1'),
    enabledAt: z.number().int().min(0).max(1000000),
    baseline: z.array(fontenoyCommanderSchema).max(1000),
    assignments: z
      .array(z.object({ commanderId: idSchema, corpsId: idSchema }).strict())
      .max(1000),
    records: z
      .array(
        z
          .object({
            id: idSchema,
            turn: z.number().int().min(1).max(100),
            at: z.number().int().min(0).max(1000000),
            timestamp: z.iso.datetime(),
            action: officerActionSchema,
            before: fontenoyCommanderSchema.nullable(),
            after: fontenoyCommanderSchema,
            fromCorpsId: idSchema.nullable(),
            toCorpsId: idSchema.nullable(),
          })
          .strict(),
      )
      .max(500),
  })
  .strict();
export type OfficerAction = z.infer<typeof officerActionSchema>;
