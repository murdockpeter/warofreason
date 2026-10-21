import { z } from 'zod';
import { idSchema } from './legacy-campaign';
import { factionSchema } from './vocabulary';

export const aftermathRulesSchema = z
  .object({
    ruleId: z.literal('house_rule_v0.1/aftermath-1'),
    strategy: z.enum(['conscript_rebuild_v1', 'manual_review_v1']),
    allowRegularRebuild: z.boolean(),
    irregularRecovery: z.enum(['lost', 'same_quality']),
    artilleryRecovery: z.enum(['lost', 'same_quality']),
    recoveryTurns: z.number().int().min(1).max(100),
    retiredRestTurns: z.number().int().min(0).max(100),
    siegeThreshold: z.number().int().min(1).max(10000),
    siegeIncrement: z.number().int().min(0).max(1000),
    exhaustionThreshold: z.number().int().min(1).max(10000).nullable(),
    deadlineOutcome: z.enum(['french', 'allied', 'draw']),
    conflictOutcome: z.enum(['french', 'allied', 'draw']),
  })
  .strict();
export const commanderStatusSchema = z.enum(['active', 'lost', 'retired']);
export const siegeConditionsSchema = z
  .object({
    invested: z.boolean(),
    supplied: z.boolean(),
    relieved: z.boolean(),
  })
  .strict();
const text = z.string().trim().max(4000);
const points = z
  .object({
    french: z.number().int().min(0).max(10000).nullable(),
    allied: z.number().int().min(0).max(10000).nullable(),
  })
  .strict();
const exhaustion = z
  .object({
    french: z.number().int().min(0).max(10000),
    allied: z.number().int().min(0).max(10000),
  })
  .strict();
export const battleAftermathInputSchema = z
  .object({
    battleId: idSchema,
    broken: z
      .array(
        z
          .object({ unitId: idSchema, action: z.enum(['recover', 'lost']) })
          .strict(),
      )
      .max(38),
    commanders: z
      .array(
        z
          .object({ commanderId: idSchema, status: commanderStatusSchema })
          .strict(),
      )
      .max(1000),
    positions: z
      .array(z.object({ columnId: idSchema, squareId: idSchema }).strict())
      .min(2)
      .max(38),
    epicPoints: points,
    exhaustionDelta: exhaustion,
    notes: text.min(1),
  })
  .strict();
export const aftermathCommandSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('enable') }).strict(),
  z.object({ kind: z.literal('rules'), rules: aftermathRulesSchema }).strict(),
  z
    .object({
      kind: z.literal('apply-battle'),
      input: battleAftermathInputSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('siege-conditions'),
      conditions: siegeConditionsSchema,
      notes: text.min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('exhaustion'),
      values: exhaustion,
      notes: text.min(1),
    })
    .strict(),
  z.object({ kind: z.literal('finalize-turn') }).strict(),
  z
    .object({
      kind: z.literal('commander-arrived'),
      side: factionSchema,
      displayName: z.string().trim().min(1).max(120),
      notableReference: text,
      notes: text.min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('commander-status'),
      commanderId: idSchema,
      status: commanderStatusSchema,
      notes: text.min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('commander-attach'),
      commanderId: idSchema,
      columnId: idSchema.nullable(),
      notes: text.min(1),
    })
    .strict(),
]);
export const aftermathReceiptSchema = z
  .object({
    command: aftermathCommandSchema,
    recordId: idSchema,
    timestamp: z.iso.datetime(),
  })
  .strict();
const unitChangeSchema = z
  .object({
    unitId: idSchema,
    beforeStatus: z.enum(['ready', 'recovering', 'lost']),
    afterStatus: z.enum(['ready', 'recovering', 'lost']),
    beforeQuality: z.enum(['elite', 'trained', 'conscript']).nullable(),
    afterQuality: z.enum(['elite', 'trained', 'conscript']).nullable(),
    dueTurn: z.number().int().min(1).max(200).nullable(),
  })
  .strict();
export const aftermathReviewSchema = z
  .object({
    id: idSchema,
    battleId: idSchema,
    turn: z.number().int().min(1).max(100),
    timestamp: z.iso.datetime(),
    rules: aftermathRulesSchema,
    input: battleAftermathInputSchema,
    unitChanges: z.array(unitChangeSchema).max(38),
  })
  .strict();
export const victorySchema = z
  .object({
    winner: z.enum(['french', 'allied', 'draw']),
    turn: z.number().int().min(1).max(100),
    reasons: z.array(z.string().min(1).max(500)).min(1).max(10),
    timestamp: z.iso.datetime(),
  })
  .strict();
export const aftermathSchema = z
  .object({
    rules: aftermathRulesSchema,
    conditions: siegeConditionsSchema,
    exhaustion,
    pendingTurn: z.number().int().min(1).max(100).nullable(),
    reviews: z.array(aftermathReviewSchema).max(100),
    recoveries: z
      .array(
        z
          .object({
            unitId: idSchema,
            battleId: idSchema,
            dueTurn: z.number().int().min(1).max(200),
            recoveredAtTurn: z.number().int().min(1).max(100).nullable(),
          })
          .strict(),
      )
      .max(3800),
    boundaries: z
      .array(
        z
          .object({
            turn: z.number().int().min(1).max(100),
            timestamp: z.iso.datetime(),
            progressBefore: z.number().int().min(0).max(10000),
            progressAfter: z.number().int().min(0).max(10000),
            recoveredUnitIds: z.array(idSchema).max(38),
            rules: aftermathRulesSchema,
            conditions: siegeConditionsSchema,
            exhaustion,
            victory: victorySchema.nullable(),
          })
          .strict(),
      )
      .max(100),
    victory: victorySchema.nullable(),
  })
  .strict();
export type AftermathRules = z.infer<typeof aftermathRulesSchema>;
export type AftermathCommand = z.infer<typeof aftermathCommandSchema>;
export type AftermathReceipt = z.infer<typeof aftermathReceiptSchema>;
export type BattleAftermathInput = z.infer<typeof battleAftermathInputSchema>;
