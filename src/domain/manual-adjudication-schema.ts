import { z } from 'zod';
import { idSchema } from './legacy-campaign';

const minute = z.number().int().min(0).max(1000000).multipleOf(5);
export const manualPlacementSchema = z
  .object({
    corpsId: idSchema,
    hexId: z.string().min(1).max(40).nullable(),
    status: z.enum(['ready', 'blown', 'eliminated']),
    formation: z.enum(['advance', 'battle', 'fresh', 'exhausted']),
    reportedStrength: z.string().trim().max(200),
  })
  .strict();
const unitEdit = z
  .object({
    unitId: idSchema,
    status: z.enum(['ready', 'lost']),
  })
  .strict();
const hqEdit = z
  .object({ hqId: idSchema, hexId: z.string().min(1).max(40) })
  .strict();
export const manualRulingSchema = z
  .object({
    basedOnRevision: z.number().int().positive(),
    placements: z.array(manualPlacementSchema).max(100),
    units: z.array(unitEdit).max(1000),
    hqs: z.array(hqEdit).max(20),
    endAt: minute,
    finishPhase: z.boolean(),
    correctsId: idSchema.nullable(),
    decision: z.string().trim().min(1).max(4000),
  })
  .strict();
const forceSnapshot = manualPlacementSchema
  .extend({
    availableAt: z.number().int().min(0).max(1000000),
    returnSlot: z.number().int().min(0).max(1000000).nullable(),
  })
  .strict();
export const manualRecordSchema = z
  .object({
    id: idSchema,
    turn: z.number().int().min(1).max(100),
    timestamp: z.iso.datetime(),
    effectSerial: z.number().int().min(1).max(1000000),
    ruling: manualRulingSchema,
    fromAt: minute,
    fromPhase: z.enum(['planning', 'checkpoint']),
    before: z.array(forceSnapshot).max(100),
    after: z.array(forceSnapshot).max(100),
    unitsBefore: z.array(unitEdit).max(1000),
    hqsBefore: z.array(hqEdit).max(20),
  })
  .strict();
export type ManualRuling = z.infer<typeof manualRulingSchema>;
export type ManualPlacement = z.infer<typeof manualPlacementSchema>;
