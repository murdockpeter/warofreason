import { z } from 'zod';
import { idSchema } from './legacy-campaign';
import { factionSchema } from './vocabulary';

export const movementRulesSchema = z
  .object({
    ruleId: z.literal('house_rule_v0.1/operations-1'),
    movementPoints: z.number().int().min(1).max(30),
    roadCost: z.number().int().min(1).max(30),
    offRoadCost: z.number().int().min(1).max(30),
    riverCrossingCost: z.number().int().min(0).max(30),
    blockedSquareIds: z.array(idSchema).max(96),
  })
  .strict();
export const movementOrderSchema = z
  .object({
    columnId: idSchema,
    path: z.array(idSchema).min(1).max(96),
  })
  .strict();
export const engagementSchema = z
  .object({
    attackerId: idSchema,
    defenderId: idSchema,
    squareId: idSchema,
    turn: z.number().int().positive().max(100),
    ruleId: z.literal('house_rule_v0.1/operations-1'),
  })
  .strict();
export const operationsSchema = z
  .object({
    rules: movementRulesSchema,
    phase: z.enum(['planning', 'resolution', 'finished']),
    orders: z.array(movementOrderSchema).max(1000),
    engagements: z.array(engagementSchema).max(1000),
  })
  .strict();
export const operationalCommandSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('split'),
      columnId: idSchema,
      newColumnId: idSchema,
      displayName: z.string().trim().min(1).max(120),
      unitIds: z.array(idSchema).min(1).max(38),
      commanderIds: z.array(idSchema).max(1000),
    })
    .strict(),
  z.object({ kind: z.literal('enable') }).strict(),
  z
    .object({ kind: z.literal('configure'), rules: movementRulesSchema })
    .strict(),
  z
    .object({
      kind: z.literal('issue'),
      orders: z.array(movementOrderSchema).max(1000),
    })
    .strict(),
  z.object({ kind: z.literal('reopen') }).strict(),
  z.object({ kind: z.literal('resolve') }).strict(),
]);
export const mapViewSchema = z.enum(['umpire', 'french', 'allied']);
export type MapView = z.infer<typeof mapViewSchema>;
export type Side = z.infer<typeof factionSchema>;
export type MovementOrder = z.infer<typeof movementOrderSchema>;
export type MovementRules = z.infer<typeof movementRulesSchema>;
export type OperationalCommand = z.infer<typeof operationalCommandSchema>;
