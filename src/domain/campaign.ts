import { z } from 'zod';
import { jsonEqual } from './json-equal';
import { aftermathSchema, aftermathReceiptSchema } from './aftermath-schema';
import {
  applyAftermathCommand,
  aftermathCategories,
  aftermathIssues,
} from './aftermath';
import * as legacy from './legacy-campaign';
import { factionSchema } from './vocabulary';
import {
  fontenoyColumnSchema,
  fontenoyCommanderSchema,
  fontenoySettingsSchema,
  fontenoyUnitSchema,
} from './fontenoy-schema';
import { forceIssues, setupIssues } from './fontenoy';
import { operationsSchema } from './operations-schema';
import { tabletopSchema, tabletopReceiptSchema } from './tabletop-schema';
import {
  applyTabletopCommand,
  tabletopCategories,
  tabletopIssues,
} from './tabletop';
import {
  applyOperationalCommand,
  campaignDate,
  operationsIssues,
  operationalCategories,
} from './operations';
export { idSchema, titleSchema } from './legacy-campaign';

const configuredBase = legacy.campaignBaseSchema.extend({
  schemaVersion: z.literal(2),
  moduleVersion: z.literal('0.1.0'),
  rulesetVersion: z.literal('house_rule_v0.1'),
  status: z.enum(['draft', 'active', 'archived']),
  turn: z.number().int().min(0).max(100),
  operations: operationsSchema.optional(),
  tabletop: tabletopSchema.optional(),
  aftermath: aftermathSchema.optional(),
  date: z.iso.date().nullable(),
  activeSide: factionSchema.nullable(),
  settings: fontenoySettingsSchema,
  units: z.array(fontenoyUnitSchema).length(38),
  commanders: z.array(fontenoyCommanderSchema).max(1000),
  columns: z.array(fontenoyColumnSchema).max(1000),
  squares: z.array(legacy.squareSchema).length(96),
});
export type FontenoyCampaign = z.infer<typeof configuredBase>;
export const fontenoyCampaignSchema = configuredBase.superRefine(
  (campaign, ctx) => {
    // Reuse the legacy aggregate integrity checks, with only v2-specific metadata removed.
    const referenceCampaign = { ...campaign };
    delete referenceCampaign.operations;
    delete referenceCampaign.tabletop;
    delete referenceCampaign.aftermath;
    const referenceCheck = legacy.campaignSchema.safeParse({
      ...referenceCampaign,
      schemaVersion: 1,
      moduleVersion: 'unconfigured',
      rulesetVersion: 'unconfigured',
      status: 'draft',
      turn: 0,
      date: null,
      activeSide: null,
      settings: {},
      units: campaign.units.map(
        ({
          id,
          displayName,
          factionId,
          currentStatus,
          provenance,
          type,
          quality,
        }) => ({
          id,
          displayName,
          factionId,
          currentStatus,
          provenance,
          type,
          quality,
        }),
      ),
      columns: campaign.columns.map(
        ({ id, displayName, factionId, squareId, unitIds, commanderIds }) => ({
          id,
          displayName,
          factionId,
          squareId,
          unitIds,
          commanderIds,
        }),
      ),
      commanders: campaign.commanders.map(({ id, displayName, factionId }) => ({
        id,
        displayName,
        factionId,
      })),
    });
    if (!referenceCheck.success)
      for (const issue of referenceCheck.error.issues)
        ctx.addIssue({
          code: 'custom',
          path: issue.path,
          message: issue.message,
        });
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });
    for (const message of forceIssues(campaign)) issue(['units'], message);
    if (campaign.factions.length !== 2)
      issue(['factions'], 'The module requires French and Allied factions.');
    const side = new Map(campaign.factions.map((f) => [f.id, f.side]));
    campaign.units.forEach((unit, index) => {
      if (
        unit.initialQuality &&
        !['regular_infantry', 'regular_cavalry'].includes(unit.type)
      )
        issue(
          ['units', index],
          'Only regular units can retain an opening quality for rebuilding.',
        );
      if (
        side.get(unit.factionId) !==
        (unit.contingent === 'french' ? 'french' : 'allied')
      )
        issue(
          ['units', index, 'contingent'],
          'Contingent must match faction ownership.',
        );
    });
    const squares = new Map(campaign.squares.map((s) => [s.id, s]));
    for (const square of campaign.squares)
      if (square.row >= 8 || square.column >= 12)
        issue(['squares'], 'Square lies outside the schematic grid.');
    if (!squares.has(campaign.settings.siege.targetSquareId))
      issue(['settings', 'siege'], 'Siege target must reference a map square.');
    const identities = new Set(
      [
        campaign.id,
        ...campaign.factions,
        ...campaign.units,
        ...campaign.commanders,
        ...campaign.columns,
        ...campaign.squares,
      ].map((item) => (typeof item === 'string' ? item : item.id)),
    );
    for (const objective of campaign.settings.objectives) {
      if (identities.has(objective.id))
        issue(['settings', 'objectives'], 'Objective IDs must be unique.');
      identities.add(objective.id);
      if (!squares.has(objective.squareId))
        issue(
          ['settings', 'objectives'],
          'Objective map reference does not exist.',
        );
    }
    if (new Set(campaign.settings.objectives.map((o) => o.side)).size !== 2)
      issue(
        ['settings', 'objectives'],
        'Each faction needs its own proposed objective.',
      );
    for (const key of ['roadEdges', 'riverEdges'] as const) {
      const edges = new Set<string>();
      for (const edge of campaign.settings.map[key]) {
        const from = squares.get(edge.from);
        const to = squares.get(edge.to);
        const edgeKey = [edge.from, edge.to].sort().join(':');
        if (
          !from ||
          !to ||
          Math.abs(from.row - to.row) + Math.abs(from.column - to.column) !== 1
        )
          issue(
            ['settings', 'map', key],
            'Schematic edges must join existing orthogonally adjacent squares.',
          );
        if (edges.has(edgeKey))
          issue(['settings', 'map', key], 'Duplicate map edge.');
        edges.add(edgeKey);
      }
    }
    if (
      campaign.turn === 0 &&
      (campaign.status === 'active' ||
        campaign.date !== null ||
        campaign.activeSide !== null)
    )
      issue(
        ['status'],
        'A draft has not begun and has no current day or active side.',
      );
    if (campaign.turn > 0) {
      if (
        campaign.status === 'draft' ||
        campaign.turn > campaign.settings.schedule.turnCount ||
        campaign.date !== campaignDate(campaign, campaign.turn) ||
        campaign.activeSide === null ||
        (!campaign.operations &&
          (campaign.turn !== 1 ||
            campaign.activeSide !== campaign.settings.schedule.firstSide))
      )
        issue(
          ['status'],
          'Started state must match the reviewed opening schedule.',
        );
      for (const message of setupIssues(campaign)) issue(['settings'], message);
    }
    for (const message of operationsIssues(campaign))
      issue(['operations'], message);
    for (const message of tabletopIssues(campaign))
      issue(['tabletop'], message);
    for (const message of aftermathIssues(campaign))
      issue(['aftermath'], message);
  },
);
export const campaignSchema = z.discriminatedUnion('schemaVersion', [
  legacy.campaignSchema,
  fontenoyCampaignSchema,
]);
export type Campaign = z.infer<typeof campaignSchema>;
export const campaignEventSchema = legacy.campaignEventSchema.extend({
  category: z.enum([
    'created',
    'renamed',
    'cloned',
    'archived',
    'imported',
    'scenario_loaded',
    'setup_changed',
    'started',
    'operations_enabled',
    'movement_rules_changed',
    'orders_issued',
    'orders_reopened',
    'orders_resolved',
    'formation_split',
    'scouting_rules_changed',
    'scouted',
    'battle_declared',
    'battle_started',
    'battle_result_recorded',
    'aftermath_enabled',
    'aftermath_rules_changed',
    'battle_aftermath_applied',
    'siege_conditions_recorded',
    'campaign_exhaustion_recorded',
    'campaign_turn_finalized',
    'commander_arrived',
    'commander_status_changed',
    'commander_attached',
  ]),
  rulesetVersion: z.enum(['unconfigured', 'house_rule_v0.1']),
  before: campaignSchema.nullable(),
  after: campaignSchema,
  tabletopAction: tabletopReceiptSchema.optional(),
  aftermathAction: aftermathReceiptSchema.optional(),
});
export type CampaignEvent = z.infer<typeof campaignEventSchema>;
const currentExportSchema = z
  .object({
    format: z.literal('maurice-campaign'),
    formatVersion: z.literal(2),
    exportedAt: z.iso.datetime(),
    campaign: campaignSchema,
    events: z.array(campaignEventSchema).min(1).max(2000),
  })
  .strict()
  .superRefine((value, ctx) => {
    let previous: Campaign | null = null;
    const ids = new Set<string>();
    for (const [index, event] of value.events.entries()) {
      const issue = (message: string) =>
        ctx.addIssue({ code: 'custom', path: ['events', index], message });
      const tabletopKind = (
        Object.keys(tabletopCategories) as (keyof typeof tabletopCategories)[]
      ).find((kind) => tabletopCategories[kind] === event.category);
      if (!!tabletopKind !== !!event.tabletopAction)
        issue('Only tabletop events require an action receipt.');
      const aftermathKind = (
        Object.keys(aftermathCategories) as (keyof typeof aftermathCategories)[]
      ).find((kind) => aftermathCategories[kind] === event.category);
      if (!!aftermathKind !== !!event.aftermathAction)
        issue('Only aftermath events require their action receipt.');
      if (ids.has(event.id)) issue('Duplicate event ID.');
      ids.add(event.id);
      if (
        event.campaignId !== value.campaign.id ||
        event.after.id !== value.campaign.id ||
        event.after.revision !== index + 1 ||
        !jsonEqual(event.before, previous)
      )
        issue(
          'Journal revisions and snapshots must form an unbroken chain for one campaign.',
        );
      if (
        event.timestamp !== event.after.updatedAt ||
        event.rulesetVersion !== event.after.rulesetVersion
      )
        issue('Event metadata must match the saved snapshot.');
      if ((index === 0) !== ['created', 'cloned'].includes(event.category))
        issue('Journal must begin with creation or cloning, exactly once.');
      if ((event.category === 'cloned') !== (event.sourceCampaignId !== null))
        issue('Only clones have a source campaign reference.');
      if (previous) {
        if (
          previous.createdAt !== event.after.createdAt ||
          previous.seed !== event.after.seed ||
          Date.parse(event.timestamp) < Date.parse(previous.updatedAt)
        )
          issue('Campaign identity and chronology must remain stable.');
        if (previous.status === 'archived' && event.category !== 'imported')
          issue('Archived records are read-only.');
        if (
          Object.values(operationalCategories).some(
            (category) => category === event.category,
          ) &&
          (previous.schemaVersion !== 2 || event.after.schemaVersion !== 2)
        )
          issue(
            'Operational journal actions require configured campaign snapshots.',
          );
        let expected: Record<string, unknown> = {
          ...previous,
          revision: event.after.revision,
          updatedAt: event.timestamp,
        };
        if (event.category === 'renamed') expected.title = event.after.title;
        if (event.category === 'archived') expected.status = 'archived';
        if (event.category === 'scenario_loaded') {
          if (
            previous.schemaVersion !== 1 ||
            event.after.schemaVersion !== 2 ||
            event.after.status !== 'draft'
          )
            issue('Scenario loading must upgrade an unconfigured draft.');
          expected = {
            ...event.after,
            id: previous.id,
            title: previous.title,
            createdAt: previous.createdAt,
            seed: previous.seed,
          };
        }
        if (
          event.category === 'setup_changed' &&
          previous.schemaVersion === 2 &&
          event.after.schemaVersion === 2 &&
          previous.status === 'draft' &&
          event.after.status === 'draft'
        )
          expected = {
            ...expected,
            settings: event.after.settings,
            columns: event.after.columns,
            commanders: event.after.commanders,
          };
        if (
          event.category === 'started' &&
          previous.schemaVersion === 2 &&
          previous.status === 'draft'
        )
          expected = {
            ...expected,
            status: 'active',
            turn: 1,
            date: previous.settings.schedule.startDate,
            activeSide: previous.settings.schedule.firstSide,
          };
        if (previous.schemaVersion === 2 && event.after.schemaVersion === 2) {
          if (aftermathKind && event.aftermathAction) {
            try {
              if (
                event.aftermathAction.command.kind !== aftermathKind ||
                event.aftermathAction.timestamp !== event.timestamp
              )
                throw new Error('Mismatched aftermath receipt.');
              expected = {
                ...applyAftermathCommand(previous, event.aftermathAction),
                revision: event.after.revision,
                updatedAt: event.timestamp,
              };
            } catch {
              issue('Aftermath journal action is invalid.');
            }
          }
          if (tabletopKind && event.tabletopAction) {
            try {
              if (
                event.tabletopAction.command.kind !== tabletopKind ||
                event.tabletopAction.timestamp !== event.timestamp
              )
                throw new Error('Mismatched tabletop receipt.');
              expected = {
                ...applyTabletopCommand(previous, event.tabletopAction),
                revision: event.after.revision,
                updatedAt: event.timestamp,
              };
            } catch {
              issue('Tabletop journal action is invalid.');
            }
          }
          const kind = (
            Object.keys(
              operationalCategories,
            ) as (keyof typeof operationalCategories)[]
          ).find((key) => operationalCategories[key] === event.category);
          if (kind) {
            try {
              const beforeColumns = previous.columns;
              const command =
                kind === 'split'
                  ? (() => {
                      const added =
                        event.after.schemaVersion === 2
                          ? event.after.columns.filter(
                              (c) => !beforeColumns.some((p) => p.id === c.id),
                            )
                          : [];
                      if (added.length !== 1)
                        throw new Error('Expected one new formation.');
                      const column = added[0]!;
                      const source = beforeColumns.find((c) =>
                        column.unitIds.every((id) => c.unitIds.includes(id)),
                      );
                      if (!source) throw new Error('Missing split source.');
                      return {
                        kind,
                        columnId: source.id,
                        newColumnId: column.id,
                        displayName: column.displayName,
                        unitIds: column.unitIds,
                        commanderIds: column.commanderIds,
                      };
                    })()
                  : kind === 'configure'
                    ? { kind, rules: event.after.operations!.rules }
                    : kind === 'issue'
                      ? { kind, orders: event.after.operations!.orders }
                      : { kind };
              expected = {
                ...applyOperationalCommand(previous, command),
                revision: event.after.revision,
                updatedAt: event.timestamp,
              };
            } catch {
              issue('Operational journal action is invalid.');
            }
          }
        }
        if (
          tabletopKind &&
          (previous.schemaVersion !== 2 || event.after.schemaVersion !== 2)
        )
          issue('Tabletop actions require configured campaigns.');
        if (
          aftermathKind &&
          (previous.schemaVersion !== 2 || event.after.schemaVersion !== 2)
        )
          issue('Aftermath actions require configured campaigns.');
        if (!jsonEqual(expected, event.after))
          issue('Recorded change does not match its journal category.');
      }
      previous = event.after;
    }
    if (!jsonEqual(previous, value.campaign))
      ctx.addIssue({
        code: 'custom',
        path: ['campaign'],
        message: 'Campaign must equal the final journal snapshot.',
      });
  });
export const exportSchema = z.discriminatedUnion('formatVersion', [
  legacy.exportSchema,
  currentExportSchema,
]);
export type CampaignExport = z.infer<typeof exportSchema>;
export const campaignSummarySchema = legacy.campaignSummarySchema.extend({
  status: z.enum(['draft', 'active', 'archived']),
});
export const librarySchema = z
  .object({
    campaigns: z.array(campaignSummarySchema),
    active: campaignSchema.nullable(),
    events: z.array(campaignEventSchema),
  })
  .strict();
export type CampaignLibrary = z.infer<typeof librarySchema>;
