import { z } from 'zod';
import { idSchema } from './legacy-campaign';
import { fontenoyUnitSchema } from './fontenoy-schema';
import { unitRecoveryRulesSchema } from './unit-recovery';
import { unitResultSchema } from './tabletop-schema';

export const simultaneousRecoveryPolicySchema = z
  .object({
    ruleId: z.literal('maurice_aftermath_v0.1'),
    rules: unitRecoveryRulesSchema,
    minutesPerRecoveryTurn: z.number().int().min(60).max(144000).multipleOf(60),
  })
  .strict();
export const mauriceObservationsSchema = z
  .object({
    units: z
      .array(
        unitResultSchema.extend({
          recovery: z.enum(['recover', 'lost']).nullable(),
        }),
      )
      .max(38),
    armyMorale: z
      .object({
        french: z.number().int().min(0).max(1000).nullable(),
        allied: z.number().int().min(0).max(1000).nullable(),
      })
      .strict(),
  })
  .strict();
export const simultaneousAftermathSchema = z
  .object({
    policy: simultaneousRecoveryPolicySchema,
    recoveries: z
      .array(
        z
          .object({
            unitId: idSchema,
            battleId: idSchema,
            dueAt: z.number().int().min(0).max(1000000),
            recoveredAt: z.number().int().min(0).max(1000000).nullable(),
          })
          .strict(),
      )
      .max(3800),
  })
  .strict();
export const simultaneousBattleAftermathSchema = z
  .object({
    policy: simultaneousRecoveryPolicySchema,
    appliedVersion: z.number().int().min(1),
    baseline: z.array(fontenoyUnitSchema).max(38),
    changes: z
      .array(
        z
          .object({
            unitId: idSchema,
            before: fontenoyUnitSchema,
            after: fontenoyUnitSchema,
            dueAt: z.number().int().min(0).max(1000000).nullable(),
          })
          .strict(),
      )
      .max(38),
  })
  .strict();
export type SimultaneousRecoveryPolicy = z.infer<
  typeof simultaneousRecoveryPolicySchema
>;
