import { z } from 'zod';
import { jsonEqual } from './json-equal';
import { almaRosterId } from './alma-roster';
import {
  stageAlmaRoster,
  deployStagedForces,
  historicalKsIssues,
} from './ks-deployment';

export const ksHistoricalIdentitySchema = z
  .object({
    rosterId: z.literal(almaRosterId),
    organizationId: z.string().min(1).max(100),
  })
  .strict();

export const ksMapSchema = z.enum([
  'crimea_wyld_1855',
  'sevastopol_airey_1856',
]);
export const ksPositionSchema = z
  .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })
  .strict();
export const ksForceSchema = z
  .object({
    id: z.uuid(),
    historical: ksHistoricalIdentitySchema.optional(),
    name: z.string().trim().min(1).max(120),
    allegiance: z.enum([
      'russia',
      'britain',
      'france',
      'ottoman',
      'sardinia',
      'neutral',
    ]),
    kind: z.enum([
      'infantry',
      'cavalry',
      'artillery',
      'naval',
      'supply',
      'hq',
      'other',
    ]),
    mapId: ksMapSchema,
    position: ksPositionSchema,
    strength: z.string().trim().max(200),
    commander: z.string().trim().max(120),
    condition: z.string().trim().max(500),
    composition: z.string().trim().max(4000),
    notes: z.string().trim().max(4000),
    status: z.enum(['active', 'retired']),
    intent: z
      .object({
        mapId: ksMapSchema,
        points: z.array(ksPositionSchema).min(2).max(100),
        text: z.string().trim().min(1).max(2000),
      })
      .strict()
      .nullable(),
  })
  .strict();
export const ksStagedForceSchema = ksForceSchema
  .omit({ mapId: true, position: true, status: true, intent: true })
  .required({ historical: true });
export type KsStagedForce = z.infer<typeof ksStagedForceSchema>;
const ksCampaignBase = z
  .object({
    schemaVersion: z.literal(1),
    moduleId: z.literal('crimean_free_ks'),
    moduleVersion: z.literal('0.1.0'),
    id: z.uuid(),
    title: z.string().trim().min(1).max(120),
    revision: z.number().int().positive(),
    status: z.enum(['active', 'archived']),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    campaignTime: z.string().trim().max(120),
    forces: z.array(ksForceSchema).max(1000),
    deploymentArea: z
      .object({
        loadedRosterIds: z.array(z.literal(almaRosterId)).max(20),
        forces: z.array(ksStagedForceSchema).max(1000),
      })
      .strict()
      .optional(),
  })
  .strict();
export const ksCampaignSchema = ksCampaignBase.superRefine((c, ctx) => {
  for (const message of historicalKsIssues(c))
    ctx.addIssue({ code: 'custom', message });
  if (new Set(c.forces.map((f) => f.id)).size !== c.forces.length)
    ctx.addIssue({
      code: 'custom',
      message: 'Force identities must be unique.',
    });
  if (Date.parse(c.updatedAt) < Date.parse(c.createdAt))
    ctx.addIssue({ code: 'custom', message: 'Save chronology is invalid.' });
});
export const ksCommandSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('stage-roster'),
      rosterId: z.literal(almaRosterId),
      forceIds: z.array(z.uuid()).min(1).max(1000),
    })
    .strict(),
  z
    .object({
      kind: z.literal('deploy-staged'),
      mapId: ksMapSchema,
      placements: z
        .array(
          z.object({ forceId: z.uuid(), position: ksPositionSchema }).strict(),
        )
        .min(1)
        .max(1000),
    })
    .strict(),
  z.object({ kind: z.literal('add-force'), force: ksForceSchema }).strict(),
  z.object({ kind: z.literal('edit-force'), force: ksForceSchema }).strict(),
  z
    .object({
      kind: z.literal('move-force'),
      forceId: z.uuid(),
      mapId: ksMapSchema,
      position: ksPositionSchema,
      clearIntent: z.boolean(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('set-intent'),
      forceId: z.uuid(),
      intent: ksForceSchema.shape.intent,
    })
    .strict(),
  z
    .object({
      kind: z.literal('set-time'),
      campaignTime: z.string().trim().min(1).max(120),
    })
    .strict(),
  z
    .object({
      kind: z.literal('rename'),
      title: z.string().trim().min(1).max(120),
    })
    .strict(),
  z.object({ kind: z.literal('archive') }).strict(),
  z.object({ kind: z.literal('note') }).strict(),
]);
export type KsCampaign = z.infer<typeof ksCampaignSchema>;
export type KsForce = z.infer<typeof ksForceSchema>;
export type KsPosition = z.infer<typeof ksPositionSchema>;
export type KsCommand = z.infer<typeof ksCommandSchema>;
export type KsMapId = z.infer<typeof ksMapSchema>;
export const ksAuditSchema = z
  .object({
    actor: z.string().trim().min(1).max(120),
    reason: z.string().trim().min(1).max(4000),
  })
  .strict();
export function seedKs(
  title: string,
  id: string,
  timestamp: string,
): KsCampaign {
  return ksCampaignSchema.parse({
    schemaVersion: 1,
    moduleId: 'crimean_free_ks',
    moduleVersion: '0.1.0',
    id,
    title,
    revision: 1,
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp,
    campaignTime: '',
    forces: [],
  });
}
export function applyKsCommand(
  before: KsCampaign,
  raw: KsCommand,
  timestamp: string,
): KsCampaign {
  const command = ksCommandSchema.parse(raw),
    c = structuredClone(ksCampaignSchema.parse(before));
  if (c.status === 'archived')
    throw new Error('Archived KS campaigns are read-only.');
  if (Date.parse(timestamp) < Date.parse(c.updatedAt))
    throw new Error('Rulings must retain save chronology.');
  const force =
    'forceId' in command
      ? c.forces.find((f) => f.id === command.forceId)
      : null;
  if ('forceId' in command && !force)
    throw new Error('The selected force no longer exists.');
  switch (command.kind) {
    case 'stage-roster':
      stageAlmaRoster(c, command.forceIds);
      break;
    case 'deploy-staged':
      deployStagedForces(c, command.mapId, command.placements);
      break;
    case 'add-force':
      if (command.force.historical)
        throw new Error(
          'Load historical identities through the deployment area.',
        );
      if (
        c.forces.some((f) => f.id === command.force.id) ||
        command.force.id === c.id
      )
        throw new Error('Provide a fresh force identity.');
      c.forces.push(command.force);
      break;
    case 'edit-force': {
      const index = c.forces.findIndex((f) => f.id === command.force.id);
      if (index < 0) throw new Error('The selected force no longer exists.');
      if (
        !jsonEqual(
          c.forces[index]!.historical ?? null,
          command.force.historical ?? null,
        )
      )
        throw new Error('Historical source identities cannot be rewritten.');
      c.forces[index] = command.force;
      break;
    }
    case 'move-force':
      if (force!.status !== 'active')
        throw new Error('Restore the retired force before placing it.');
      force!.mapId = command.mapId;
      force!.position = command.position;
      if (command.clearIntent) force!.intent = null;
      break;
    case 'set-intent':
      if (force!.status !== 'active')
        throw new Error('Restore the retired force before recording intent.');
      if (command.intent && command.intent.mapId !== force!.mapId)
        throw new Error(
          'Draw intent on the force’s current map sheet. Transfer it through an explicit placement ruling first.',
        );
      force!.intent = command.intent;
      break;
    case 'set-time':
      c.campaignTime = command.campaignTime;
      break;
    case 'rename':
      c.title = command.title;
      break;
    case 'archive':
      c.status = 'archived';
      break;
    case 'note':
      break;
  }
  if (command.kind !== 'note' && jsonEqual(c, before))
    throw new Error('Make a change or discard the draft.');
  c.revision++;
  c.updatedAt = timestamp;
  return ksCampaignSchema.parse(c);
}
export const ksEventSchema = z
  .object({
    id: z.uuid(),
    campaignId: z.uuid(),
    timestamp: z.iso.datetime(),
    actor: ksAuditSchema.shape.actor,
    reason: ksAuditSchema.shape.reason,
    category: z.enum(['created', 'ruling']),
    command: ksCommandSchema.nullable(),
    before: ksCampaignSchema.nullable(),
    after: ksCampaignSchema,
  })
  .strict();
export type KsEvent = z.infer<typeof ksEventSchema>;
export const ksExportSchema = z
  .object({
    format: z.literal('war-of-reason-free-ks'),
    formatVersion: z.literal(1),
    exportedAt: z.iso.datetime(),
    campaign: ksCampaignSchema,
    events: z.array(ksEventSchema).min(1).max(2000),
  })
  .strict()
  .superRefine((data, ctx) => {
    let previous: KsCampaign | null = null;
    const ids = new Set<string>();
    for (const [index, event] of data.events.entries()) {
      const fail = () =>
        ctx.addIssue({
          code: 'custom',
          message:
            'KS journal identity, chronology or replay does not match its snapshots.',
        });
      if (
        ids.has(event.id) ||
        event.campaignId !== data.campaign.id ||
        event.after.id !== data.campaign.id ||
        event.after.revision !== index + 1 ||
        event.after.updatedAt !== event.timestamp ||
        !jsonEqual(event.before, previous)
      )
        fail();
      ids.add(event.id);
      try {
        const expected =
          index === 0
            ? seedKs(event.after.title, event.after.id, event.timestamp)
            : applyKsCommand(previous!, event.command!, event.timestamp);
        if (
          event.category !== (index === 0 ? 'created' : 'ruling') ||
          (index === 0 && event.command !== null) ||
          !jsonEqual(expected, event.after)
        )
          fail();
      } catch {
        fail();
      }
      previous = event.after;
    }
    if (!jsonEqual(previous, data.campaign))
      ctx.addIssue({
        code: 'custom',
        message: 'KS campaign must match the final journal snapshot.',
      });
  });
export type KsExport = z.infer<typeof ksExportSchema>;
export const ksLibrarySchema = z
  .object({
    campaigns: z.array(
      ksCampaignBase.omit({ forces: true, deploymentArea: true }),
    ),
    active: ksCampaignSchema.nullable(),
    events: z.array(ksEventSchema),
  })
  .strict();
export type KsLibrary = z.infer<typeof ksLibrarySchema>;
