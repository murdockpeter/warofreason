import { z } from 'zod';

export const factionSchema = z.enum(['french', 'allied']);
export const provenanceSchema = z.enum([
  'official_maurice',
  'historical_scenario',
  'house_rule_v0.1',
]);
const quality = z.enum(['elite', 'trained', 'conscript']);
export const unitClassificationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('regular_infantry'), quality }).strict(),
  z.object({ type: z.literal('regular_cavalry'), quality }).strict(),
  z
    .object({ type: z.literal('irregular_infantry'), quality: z.null() })
    .strict(),
  z
    .object({ type: z.literal('irregular_cavalry'), quality: z.null() })
    .strict(),
  z.object({ type: z.literal('artillery'), quality: z.null() }).strict(),
]);
export type UnitClassification = z.infer<typeof unitClassificationSchema>;
