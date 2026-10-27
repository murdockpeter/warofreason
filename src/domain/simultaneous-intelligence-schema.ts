import { z } from 'zod';
import { idSchema } from './legacy-campaign';

const phase = z.number().int().min(1).max(100);
const at = z.number().int().min(0).max(1000000);
const explanation = z.string().trim().min(1).max(4000);
export const reconnaissanceInputSchema = z
  .object({
    corpsId: idSchema,
    hexId: z.string().min(1).max(40),
    question: explanation,
  })
  .strict();
export const intelligenceInputSchema = z.discriminatedUnion('level', [
  z.object({ level: z.literal('none'), notes: explanation }).strict(),
  z
    .object({
      level: z.literal('located'),
      hexId: z.string().min(1).max(40),
      expiresAfterTurn: phase,
      notes: explanation,
    })
    .strict(),
  z
    .object({
      level: z.enum(['estimated', 'identified']),
      hexId: z.string().min(1).max(40),
      expiresAfterTurn: phase,
      label: z.string().trim().min(1).max(160),
      details: explanation,
      notes: explanation,
    })
    .strict(),
]);
export const intelligenceCommandSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('maurice-scout-request'),
      input: reconnaissanceInputSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('maurice-intelligence-report'),
      requestId: idSchema,
      expectedVersion: z.number().int().min(0).max(500),
      input: intelligenceInputSchema,
      reason: explanation,
    })
    .strict(),
]);
export const intelligenceLedgerSchema = z
  .object({
    ruleId: z.literal('manual_reconnaissance_v0.1'),
    requests: z
      .array(
        z
          .object({
            id: idSchema,
            side: z.enum(['french', 'allied']),
            turn: phase,
            at,
            timestamp: z.iso.datetime(),
            input: reconnaissanceInputSchema,
          })
          .strict(),
      )
      .max(500),
    reports: z
      .array(
        z
          .object({
            id: idSchema,
            requestId: idSchema,
            version: z.number().int().min(1).max(500),
            supersedesId: idSchema.nullable(),
            observedAt: at,
            observedTurn: phase,
            turn: phase,
            at,
            timestamp: z.iso.datetime(),
            input: intelligenceInputSchema,
            reason: explanation,
          })
          .strict(),
      )
      .max(500),
  })
  .strict();
export type IntelligenceInput = z.infer<typeof intelligenceInputSchema>;
export type ReconnaissanceInput = z.infer<typeof reconnaissanceInputSchema>;
export type IntelligenceCommand = z.infer<typeof intelligenceCommandSchema>;
export type IntelligenceLedger = z.infer<typeof intelligenceLedgerSchema>;
