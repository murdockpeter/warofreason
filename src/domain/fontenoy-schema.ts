import { z } from 'zod';
import {
  idSchema,
  columnSchema,
  commanderSchema,
  unitSchema,
} from './legacy-campaign';
import { factionSchema } from './vocabulary';

export const edgeSchema = z
  .object({
    from: idSchema,
    to: idSchema,
    provenance: z.literal('house_rule_v0.1'),
  })
  .strict();
export const scheduleSchema = z
  .object({
    startDate: z.iso.date(),
    daysPerTurn: z.number().int().min(1).max(30),
    turnCount: z.number().int().min(1).max(100),
    firstSide: factionSchema,
  })
  .strict();
export const fontenoySettingsSchema = z
  .object({
    provenance: z.literal('house_rule_v0.1'),
    map: z
      .object({
        columns: z.literal(12),
        rows: z.literal(8),
        kilometresPerSquare: z.number().positive().max(1000).nullable(),
        roadEdges: z.array(edgeSchema).max(172),
        riverEdges: z.array(edgeSchema).max(172),
        geography: z.literal('schematic'),
      })
      .strict(),
    schedule: scheduleSchema,
    siege: z
      .object({
        targetSquareId: idSchema,
        status: z.enum(['not_started', 'invested', 'relieved']),
        progress: z.number().int().min(0).max(10000),
      })
      .strict(),
    objectives: z
      .array(
        z
          .object({
            id: idSchema,
            side: factionSchema,
            squareId: idSchema,
            title: z.string().trim().min(1).max(120),
            provenance: z.literal('house_rule_v0.1'),
          })
          .strict(),
      )
      .length(2),
    reviewedHouseRules: z.boolean(),
    reviewedSchematicMap: z.boolean(),
  })
  .strict();
export type FontenoySettings = z.infer<typeof fontenoySettingsSchema>;
export const fontenoyColumnSchema = columnSchema.extend({
  concealment: z.enum(['visible', 'hidden']),
  provenance: z.literal('house_rule_v0.1'),
});
export const fontenoyCommanderSchema = commanderSchema.extend({
  campaignStatus: z.enum(['active', 'lost', 'retired']).optional(),
  notableReference: z.string().max(4000).optional(),
  provenance: z.enum(['historical_scenario', 'house_rule_v0.1']),
  sourceRef: z.string().min(1).max(500),
});
export const fontenoyUnitSchema = unitSchema.safeExtend({
  initialQuality: z.enum(['elite', 'trained']).optional(),
  contingent: z.enum(['french', 'dutch', 'anglo_allied']),
  sourceRef: z.string().min(1).max(500),
});
export const fontenoyModuleSchema = z
  .object({
    id: z.literal('fontenoy'),
    version: z.literal('0.1.0'),
    rulesetVersion: z.literal('house_rule_v0.1'),
    title: z.string(),
    historicalBackground: z.string(),
    historySource: z.string(),
    map: fontenoySettingsSchema.shape.map.omit({ geography: true }),
    locations: z
      .array(
        z
          .object({
            name: z.string(),
            row: z.number().int().min(0).max(7),
            column: z.number().int().min(0).max(11),
          })
          .strict(),
      )
      .length(8),
    unitGroups: z.array(
      z
        .object({
          side: factionSchema,
          contingent: z.enum(['french', 'dutch', 'anglo_allied']),
          type: z.enum(['regular_infantry', 'regular_cavalry', 'artillery']),
          quality: z.enum(['elite', 'trained']).nullable(),
          count: z.number().int().positive(),
        })
        .strict(),
    ),
    unitSource: z.string(),
    schedule: scheduleSchema,
    siege: fontenoySettingsSchema.shape.siege
      .omit({ targetSquareId: true })
      .extend({ targetLocation: z.string() }),
    objectiveDefinitions: z
      .array(
        z
          .object({
            side: factionSchema,
            title: z.string(),
            location: z.string(),
          })
          .strict(),
      )
      .length(2),
    openingColumns: z
      .array(
        z
          .object({
            side: factionSchema,
            name: z.string(),
            location: z.string(),
            commander: z.string().nullable(),
            contingent: z.enum(['french', 'dutch', 'anglo_allied']),
            unitOffset: z.number().int().nonnegative(),
            unitCount: z.number().int().positive(),
            concealment: z.enum(['visible', 'hidden']),
          })
          .strict(),
      )
      .length(4),
  })
  .strict();
