import { z } from 'zod';
import {
  aftermathRulesSchema,
  siegeConditionsSchema,
} from './aftermath-schema';
// The existing operational engine supports 100 AM/PM phases, ending day 50 at 18:00.
export const latestSiegeDeadline = 49 * 1440 + 1080;
const minute = z.number().int().min(0).max(1000000);
export const simultaneousSiegePolicySchema = z
  .object({
    ruleId: z.literal('maurice_siege_v0.1'),
    rules: aftermathRulesSchema.pick({
      siegeThreshold: true,
      siegeIncrement: true,
      exhaustionThreshold: true,
      deadlineOutcome: true,
      conflictOutcome: true,
    }),
    minutesPerSiegeTurn: z.number().int().min(60).max(144000).multipleOf(60),
    deadlineAt: minute.max(latestSiegeDeadline),
  })
  .strict();
export const siegeReviewSchema = z
  .object({
    conditions: siegeConditionsSchema,
    exhaustion: z
      .object({
        french: z.number().int().min(0).max(10000),
        allied: z.number().int().min(0).max(10000),
      })
      .strict(),
    notes: z.string().trim().min(1).max(4000),
  })
  .strict();
const victory = z
  .object({
    winner: z.enum(['french', 'allied', 'draw']),
    reasons: z.array(z.string().min(1).max(500)).min(1).max(10),
  })
  .strict();
export const siegeCheckpointSchema = z
  .object({
    turn: z.number().int().min(1).max(100),
    at: minute,
    fromAt: minute,
    timestamp: z.iso.datetime(),
    policy: simultaneousSiegePolicySchema,
    review: siegeReviewSchema,
    progressBefore: z.number().int().min(0).max(10000),
    progressAfter: z.number().int().min(0).max(10000),
    eligibleMinutesBefore: minute,
    eligibleMinutesAfter: minute,
    increments: z.number().int().min(0).max(1000000),
    victory: victory.nullable(),
  })
  .strict();
export const simultaneousSiegeSchema = z
  .object({
    policy: simultaneousSiegePolicySchema,
    enabledAt: minute,
    lastCheckpointAt: minute,
    eligibleMinutes: minute,
    pendingReview: siegeReviewSchema
      .extend({ turn: z.number().int().min(1).max(100), at: minute })
      .nullable(),
    checkpoints: z.array(siegeCheckpointSchema).max(100),
    victory: victory
      .extend({
        turn: z.number().int().min(1).max(100),
        at: minute,
        timestamp: z.iso.datetime(),
      })
      .nullable(),
  })
  .strict();
export type SimultaneousSiegePolicy = z.infer<
  typeof simultaneousSiegePolicySchema
>;
export type SiegeReview = z.infer<typeof siegeReviewSchema>;
