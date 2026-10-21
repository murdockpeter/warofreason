import { z } from 'zod';
import { idSchema, squareSchema } from './legacy-campaign';
import { factionSchema } from './vocabulary';
import { fontenoyUnitSchema, fontenoyCommanderSchema } from './fontenoy-schema';
import { engagementSchema } from './operations-schema';

const text = z.string().trim().max(4000);
export const scoutingRulesSchema = z
  .object({
    ruleId: z.literal('house_rule_v0.1/tabletop-1'),
    rangeSquares: z.number().int().min(1).max(20),
    battleJoinRange: z.number().int().min(0).max(20),
    expiresAfterTurns: z.number().int().min(1).max(100),
    attemptsPerColumnPerTurn: z.number().int().min(1).max(10),
    eligibleTypes: z
      .array(
        z.enum([
          'regular_infantry',
          'irregular_infantry',
          'regular_cavalry',
          'irregular_cavalry',
          'artillery',
        ]),
      )
      .min(1)
      .max(5),
  })
  .strict();
export const intelligenceStateSchema = z.enum([
  'unknown',
  'located',
  'estimated',
  'identified',
]);
export const scoutInputSchema = z
  .object({
    scoutId: idSchema,
    targetColumnId: idSchema,
    roll: z.number().int().min(1).max(6),
    rollSource: z.enum(['physical', 'app']),
    modifier: z.number().int().min(-20).max(20),
    reason: text.min(1),
    state: intelligenceStateSchema,
    estimate: text,
  })
  .strict();
export const contactSchema = z
  .object({
    id: idSchema,
    observer: factionSchema,
    turn: z.number().int().min(1).max(100),
    date: z.iso.date(),
    timestamp: z.iso.datetime(),
    expiresAtTurn: z.number().int().min(2).max(200),
    input: scoutInputSchema,
    rules: scoutingRulesSchema,
    snapshot: z
      .object({
        squareId: idSchema,
        displayName: z.string().min(1).max(120),
        units: z.array(fontenoyUnitSchema).max(38),
        commanders: z.array(fontenoyCommanderSchema).max(1000),
      })
      .strict(),
  })
  .strict();
export const participantInputSchema = z
  .object({
    columnId: idSchema,
    role: z.enum(['attacker', 'defender']),
    entryEdge: z.enum(['north', 'east', 'south', 'west', 'on_table']),
    reinforcement: z.boolean(),
    arrivalNotes: text,
  })
  .strict();
export const declarationSchema = z
  .object({
    candidate: engagementSchema,
    title: z.string().trim().min(1).max(120),
    participants: z.array(participantInputSchema).min(2).max(38),
    objectives: text.min(1),
    terrainNotes: text,
    specialInstructions: text,
  })
  .strict();
export const battleOutcomeSchema = z.enum([
  'french_decisive',
  'french_marginal',
  'draw',
  'allied_marginal',
  'allied_decisive',
]);
export const unitOutcomeSchema = z.enum([
  'broken',
  'retired',
  'survived',
  'not_engaged',
]);
export const unitResultSchema = z
  .object({
    unitId: idSchema,
    outcome: unitOutcomeSchema,
    disruptedAtEnd: z.boolean().nullable(),
    notes: text,
  })
  .strict();
export const commanderResultSchema = z
  .object({
    commanderId: idSchema,
    status: z.enum(['unchanged', 'lost', 'retired', 'other']),
    notes: text,
  })
  .strict();
export const battleResultSchema = z
  .object({
    outcome: battleOutcomeSchema,
    units: z.array(unitResultSchema).min(2).max(38),
    commanders: z.array(commanderResultSchema).max(1000),
    armyMorale: z
      .object({
        french: z.number().int().min(0).max(1000).nullable(),
        allied: z.number().int().min(0).max(1000).nullable(),
      })
      .strict(),
    notes: text,
  })
  .strict();
export const battleSchema = z
  .object({
    id: idSchema,
    declaration: declarationSchema,
    stage: z.enum(['pending', 'in_progress', 'resolved']),
    createdAt: z.iso.datetime(),
    startedAt: z.iso.datetime().nullable(),
    resolvedAt: z.iso.datetime().nullable(),
    ruleId: z.literal('house_rule_v0.1/tabletop-1'),
    turn: z.number().int().min(1).max(100),
    date: z.iso.date(),
    location: squareSchema,
    participants: z
      .array(
        participantInputSchema.extend({
          displayName: z.string().min(1).max(120),
          side: factionSchema,
          origin: squareSchema,
          units: z.array(fontenoyUnitSchema).min(1).max(38),
          commanders: z.array(fontenoyCommanderSchema).max(1000),
        }),
      )
      .min(2)
      .max(38),
    result: battleResultSchema.nullable(),
  })
  .strict();
export const tabletopSchema = z
  .object({
    rules: scoutingRulesSchema,
    contacts: z.array(contactSchema).max(2000),
    battles: z.array(battleSchema).max(100),
  })
  .strict();
export const tabletopCommandSchema = z.discriminatedUnion('kind', [
  z
    .object({ kind: z.literal('scouting-rules'), rules: scoutingRulesSchema })
    .strict(),
  z.object({ kind: z.literal('scout'), input: scoutInputSchema }).strict(),
  z
    .object({
      kind: z.literal('declare-battle'),
      declaration: declarationSchema,
    })
    .strict(),
  z.object({ kind: z.literal('start-battle'), battleId: idSchema }).strict(),
  z
    .object({
      kind: z.literal('record-result'),
      battleId: idSchema,
      result: battleResultSchema,
    })
    .strict(),
]);
export const tabletopReceiptSchema = z
  .object({
    command: tabletopCommandSchema,
    recordId: idSchema,
    timestamp: z.iso.datetime(),
  })
  .strict();
export type TabletopCommand = z.infer<typeof tabletopCommandSchema>;
export type TabletopReceipt = z.infer<typeof tabletopReceiptSchema>;
export type ScoutInput = z.infer<typeof scoutInputSchema>;
export type Declaration = z.infer<typeof declarationSchema>;
export type Battle = z.infer<typeof battleSchema>;
export type BattleResult = z.infer<typeof battleResultSchema>;
export type ScoutingRules = z.infer<typeof scoutingRulesSchema>;
