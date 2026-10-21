import { z } from 'zod';
import {
  factionSchema,
  provenanceSchema,
  unitClassificationSchema,
} from './vocabulary';

export const idSchema = z.uuid();
export const titleSchema = z
  .string()
  .trim()
  .min(1, 'Enter a campaign title.')
  .max(120);
const nameSchema = z.string().trim().min(1).max(120);
const timestampSchema = z.iso.datetime();
const entity = { id: idSchema, displayName: nameSchema };
const faction = z
  .object({ id: idSchema, side: factionSchema, displayName: nameSchema })
  .strict();
export const unitSchema = z
  .object({
    ...entity,
    factionId: idSchema,
    currentStatus: z.enum(['ready', 'recovering', 'lost']),
    provenance: provenanceSchema,
    type: z.enum([
      'regular_infantry',
      'regular_cavalry',
      'irregular_infantry',
      'irregular_cavalry',
      'artillery',
    ]),
    quality: z.enum(['elite', 'trained', 'conscript']).nullable(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      !unitClassificationSchema.safeParse({
        type: value.type,
        quality: value.quality,
      }).success
    )
      ctx.addIssue({
        code: 'custom',
        path: ['quality'],
        message:
          'Only regular infantry and cavalry have regular quality; irregular units and artillery require null.',
      });
  });
export const commanderSchema = z
  .object({ ...entity, factionId: idSchema })
  .strict();
export const squareSchema = z
  .object({
    id: idSchema,
    row: z.number().int().nonnegative(),
    column: z.number().int().nonnegative(),
    locationName: nameSchema.nullable(),
  })
  .strict();
export const columnSchema = z
  .object({
    ...entity,
    factionId: idSchema,
    squareId: idSchema.nullable(),
    unitIds: z.array(idSchema).max(10000),
    commanderIds: z.array(idSchema).max(1000),
  })
  .strict();

export const campaignBaseSchema = z
  .object({
    id: idSchema,
    schemaVersion: z.literal(1),
    moduleId: z.literal('fontenoy'),
    moduleVersion: z.literal('unconfigured'),
    rulesetVersion: z.literal('unconfigured'),
    title: titleSchema,
    status: z.enum(['draft', 'archived']),
    revision: z.number().int().positive(),
    turn: z.literal(0),
    date: z.null(),
    activeSide: z.null(),
    settings: z.object({}).strict(),
    seed: idSchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    factions: z.array(faction).max(2),
    units: z.array(unitSchema).max(10000),
    commanders: z.array(commanderSchema).max(1000),
    columns: z.array(columnSchema).max(1000),
    squares: z.array(squareSchema).max(10000),
  })
  .strict();
export const campaignSchema = campaignBaseSchema.superRefine(
  (campaign, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });
    if (Date.parse(campaign.updatedAt) < Date.parse(campaign.createdAt))
      issue(['updatedAt'], 'Updated time must not precede creation time.');
    const allIds = new Set<string>([campaign.id]);
    for (const key of [
      'factions',
      'units',
      'commanders',
      'columns',
      'squares',
    ] as const) {
      campaign[key].forEach((item, index) => {
        if (allIds.has(item.id))
          issue(
            [key, index, 'id'],
            'Entity IDs must be unique within the campaign.',
          );
        allIds.add(item.id);
      });
    }
    if (
      new Set(campaign.factions.map((f) => f.side)).size !==
      campaign.factions.length
    )
      issue(['factions'], 'A faction side may appear only once.');
    const factionIds = new Set(campaign.factions.map((f) => f.id));
    const units = new Map(campaign.units.map((u) => [u.id, u]));
    const commanders = new Map(campaign.commanders.map((c) => [c.id, c]));
    const squares = new Set(campaign.squares.map((s) => s.id));
    const coordinates = campaign.squares.map((s) => `${s.row}:${s.column}`);
    if (new Set(coordinates).size !== coordinates.length)
      issue(['squares'], 'Map coordinates must be unique.');
    for (const key of ['units', 'commanders', 'columns'] as const)
      campaign[key].forEach((item, i) => {
        if (!factionIds.has(item.factionId))
          issue([key, i, 'factionId'], 'Faction reference does not exist.');
      });
    const assignedUnits = new Set<string>();
    const assignedCommanders = new Set<string>();
    campaign.columns.forEach((column, i) => {
      if (column.squareId !== null && !squares.has(column.squareId))
        issue(
          ['columns', i, 'squareId'],
          'Map square reference does not exist.',
        );
      for (const [key, records, assigned] of [
        ['unitIds', units, assignedUnits],
        ['commanderIds', commanders, assignedCommanders],
      ] as const) {
        column[key].forEach((id, j) => {
          const record = records.get(id);
          if (!record)
            issue(
              ['columns', i, key, j],
              'Assigned entity reference does not exist.',
            );
          else if (record.factionId !== column.factionId)
            issue(
              ['columns', i, key, j],
              'A column can contain only its own faction’s entities.',
            );
          if (assigned.has(id))
            issue(
              ['columns', i, key, j],
              'An entity may be assigned to only one column, once.',
            );
          assigned.add(id);
        });
      }
    });
  },
);
export type Campaign = z.infer<typeof campaignSchema>;

export const campaignEventSchema = z
  .object({
    id: idSchema,
    campaignId: idSchema,
    category: z.enum(['created', 'renamed', 'cloned', 'archived', 'imported']),
    actor: nameSchema,
    reason: z.string().trim().min(1).max(500),
    timestamp: timestampSchema,
    rulesetVersion: z.literal('unconfigured'),
    sourceCampaignId: idSchema.nullable(),
    before: campaignSchema.nullable(),
    after: campaignSchema,
  })
  .strict();
export type CampaignEvent = z.infer<typeof campaignEventSchema>;

export const exportSchema = z
  .object({
    format: z.literal('maurice-campaign'),
    formatVersion: z.literal(1),
    exportedAt: timestampSchema,
    campaign: campaignSchema,
    events: z.array(campaignEventSchema).min(1).max(2000),
  })
  .strict()
  .superRefine((value, ctx) => {
    let previous: Campaign | null = null;
    const ids = new Set<string>();
    value.events.forEach((event, index) => {
      const invalid = (message: string) =>
        ctx.addIssue({ code: 'custom', path: ['events', index], message });
      if (ids.has(event.id)) invalid('Journal event IDs must be unique.');
      ids.add(event.id);
      if (
        event.campaignId !== value.campaign.id ||
        event.after.id !== value.campaign.id
      )
        invalid('Journal campaign ID does not match.');
      if (
        event.after.revision !== index + 1 ||
        JSON.stringify(event.before) !== JSON.stringify(previous)
      )
        invalid(
          'Journal revisions and before/after snapshots must form an unbroken chain.',
        );
      if (event.timestamp !== event.after.updatedAt)
        invalid('Journal timestamp must match the saved revision.');
      if (index === 0 && !['created', 'cloned'].includes(event.category))
        invalid('Journal must begin with creation or cloning.');
      if (index > 0 && ['created', 'cloned'].includes(event.category))
        invalid('Creation can appear only at the start of the journal.');
      if (
        previous &&
        (event.after.createdAt !== previous.createdAt ||
          event.after.seed !== previous.seed ||
          Date.parse(event.timestamp) < Date.parse(previous.updatedAt))
      )
        invalid(
          'Campaign identity and chronological history must remain stable.',
        );
      if (previous) {
        const expected = {
          ...previous,
          revision: event.after.revision,
          updatedAt: event.timestamp,
        };
        if (event.category === 'renamed') expected.title = event.after.title;
        if (event.category === 'archived') expected.status = 'archived';
        if (JSON.stringify(expected) !== JSON.stringify(event.after))
          invalid('The recorded change does not match its journal category.');
        if (previous.status === 'archived' && event.category !== 'imported')
          invalid('Archived campaign records are read-only.');
      }
      if ((event.category === 'cloned') !== (event.sourceCampaignId !== null))
        invalid('Only clone events have a source campaign reference.');
      previous = event.after;
    });
    if (JSON.stringify(previous) !== JSON.stringify(value.campaign))
      ctx.addIssue({
        code: 'custom',
        path: ['campaign'],
        message: 'Campaign must match the final journal snapshot.',
      });
  });
export type CampaignExport = z.infer<typeof exportSchema>;

export const campaignSummarySchema = campaignBaseSchema.pick({
  id: true,
  title: true,
  status: true,
  revision: true,
  updatedAt: true,
});
export const librarySchema = z
  .object({
    campaigns: z.array(campaignSummarySchema),
    active: campaignSchema.nullable(),
    events: z.array(campaignEventSchema),
  })
  .strict();
export type CampaignLibrary = z.infer<typeof librarySchema>;
