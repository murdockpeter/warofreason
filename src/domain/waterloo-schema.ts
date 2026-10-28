import {
  historicalProfileSchema,
  historicalReviewSchema,
  historicalRegroupSchema,
} from './historical-profile-schema';
import { historicalProfileIssues } from './historical-profile';
import {
  manualRecordSchema,
  manualRulingSchema,
} from './manual-adjudication-schema';
import { manualRecordIssues } from './manual-adjudication';
import {
  intelligenceLedgerSchema,
  intelligenceCommandSchema,
} from './simultaneous-intelligence-schema';
import { intelligenceIssues } from './simultaneous-intelligence';
import {
  epicLedgerSchema,
  epicCommandSchema,
} from './simultaneous-epic-schema';
import { epicLedgerIssues } from './simultaneous-epic';
import {
  simultaneousCommandersSchema,
  officerActionSchema,
} from './simultaneous-commanders-schema';
import { commanderRecordIssues } from './simultaneous-commanders';
import {
  simultaneousSiegeSchema,
  simultaneousSiegePolicySchema,
  siegeReviewSchema,
} from './simultaneous-siege-schema';
import { z } from 'zod';
import { siegeVictory } from './siege-victory';
import {
  simultaneousRecoveryPolicySchema,
  simultaneousAftermathSchema,
  simultaneousBattleAftermathSchema,
  mauriceObservationsSchema,
} from './simultaneous-aftermath-schema';
import { idSchema, titleSchema } from './legacy-campaign';
import fontenoyFacts from '../data/fontenoy.v0.1.json' with { type: 'json' };
import {
  fontenoyUnitSchema,
  fontenoyCommanderSchema,
  scheduleSchema,
} from './fontenoy-schema';

export const waterlooSideSchema = z.enum(['french', 'allied']);
const minute = z.number().int().min(0).max(1000000);
const text = z.string().trim().max(4000);
export const hexSchema = z
  .object({
    id: z.string().min(1).max(40),
    q: z.number().int(),
    r: z.number().int(),
    terrain: z.enum(['clear', 'woods', 'rough', 'town', 'water']),
    name: z.string().max(100),
  })
  .strict();
export const hexEdgeSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    road: z.boolean(),
    crossing: z.enum(['none', 'minor', 'bridge', 'major']),
  })
  .strict();
export const corpsSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1).max(120),
    side: waterlooSideSchema,
    army: z.enum(['french', 'anglo_allied', 'prussian', 'dutch']),
    kind: z.enum(['infantry', 'cavalry', 'detachment']),
    formation: z.enum(['advance', 'battle', 'fresh', 'exhausted']),
    hexId: z.string().nullable(),
    status: z.enum(['ready', 'blown', 'eliminated', 'reserve']),
    returnSlot: minute.nullable(),
    roster: z.string().max(4000),
    reportedStrength: z.string().trim().min(1).max(200).optional(),
    availableAt: minute,
    detachment: z
      .object({
        parentCorpsId: idSchema,
        availableFromTurn: z.number().int().min(1).max(101),
        deployedByHqId: idSchema.nullable(),
      })
      .strict()
      .optional(),
  })
  .strict();
export const hqSchema = z
  .object({
    id: idSchema,
    name: z.string(),
    army: z.enum(['french', 'anglo_allied', 'prussian', 'dutch']),
    hexId: z.string(),
    mode: z.enum(['normal', 'battle']),
    normalRange: z.number().int().min(1).max(30),
    battleRange: z.number().int().min(1).max(15),
  })
  .strict();
export const waterlooChartsSchema = z
  .object({
    version: z.enum([
      'waterloo_original_charts_v0.1',
      'maurice_operational_charts_v0.1',
    ]),
    preparationMinutes: z.number().int().min(0).max(120).multipleOf(5),
    battleMinutes: z.number().int().min(30).max(720).multipleOf(5),
    tacticalTurnMinutes: z.number().int().min(1).max(120).nullable(),
    weather: z.enum(['dry', 'rain', 'soft_ground']),
  })
  .strict();
export const segmentSchema = z
  .object({
    path: z.array(z.string()).min(2).max(25),
    roadOnly: z.boolean(),
    hqId: idSchema,
    startAt: minute,
  })
  .strict();
export const corpsOrderSchema = z
  .object({
    corpsId: idSchema,
    priority: z.number().int().min(0).max(1000),
    segments: z.array(segmentSchema).min(1).max(3),
  })
  .strict();
const submissionSchema = z
  .object({
    side: waterlooSideSchema,
    locked: z.boolean(),
    orders: z.array(corpsOrderSchema).max(100),
  })
  .strict();
export const withdrawalOrderSchema = z
  .object({
    corpsId: idSchema,
    enemyId: idSchema,
    path: z.array(z.string()).min(1).max(4),
    priority: z.number().int().min(0).max(1000),
    blocked: z.boolean().optional(),
  })
  .strict();
export const preparationSchema = z
  .object({
    ruleId: z.enum(['waterloo_preparation_v0.1', 'maurice_preparation_v0.1']),
    turn: z.number().int().min(1).max(100),
    startedAt: minute,
    deploymentHqIds: z.array(idSchema).max(20),
    submissions: z
      .array(
        z
          .object({
            side: waterlooSideSchema,
            locked: z.boolean(),
            orders: z.array(withdrawalOrderSchema).max(100),
          })
          .strict(),
      )
      .length(2),
    resolved: z.boolean(),
    resolvedAt: minute.nullable(),
    withdrawnCorpsIds: z.array(idSchema).max(100),
  })
  .strict();
const transitSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    departedAt: minute,
    arrivesAt: minute,
  })
  .strict();
export const marchSchema = z
  .object({
    corpsId: idSchema,
    segment: z.number().int().min(0),
    step: z.number().int().min(0),
    readyAt: minute,
    windowStart: minute.nullable(),
    movedSteps: z.number().int().min(0),
    stopped: z.boolean(),
    transit: transitSchema.nullable(),
  })
  .strict();
export const encounterSchema = z
  .object({
    id: z.string(),
    at: minute,
    hexId: z.string(),
    corpsIds: z.array(idSchema).min(2),
    reason: z.string(),
    settled: z.boolean(),
    battleId: idSchema.nullable(),
  })
  .strict();
export const reinforcementSchema = z
  .object({
    corpsId: idSchema,
    originHexId: z.string(),
    entryHexId: z.string(),
    entryEdge: z.string(),
    path: z.array(z.string()),
    earliest: minute,
    likely: minute,
    latest: minute,
    notes: text,
  })
  .strict();
export const forceEffectSchema = z
  .object({
    corpsId: idSchema,
    disposition: z.enum([
      'retained',
      'retreated',
      'blown',
      'eliminated',
      'not_engaged',
      'recalled',
    ]),
    hexId: z.string().nullable(),
    exhausted: z.boolean(),
    arrivalAt: minute.nullable(),
  })
  .strict();
export const waterlooResultSchema = z
  .object({
    maurice: mauriceObservationsSchema.optional(),
    game: z.string().trim().max(160),
    outcome: z.string().trim().min(1).max(160),
    endAt: minute,
    effects: z.array(forceEffectSchema).min(2).max(100),
    notes: text,
  })
  .strict();
export const waterlooBattleSchema = z
  .object({
    aftermath: simultaneousBattleAftermathSchema.optional(),
    id: idSchema,
    encounterId: z.string(),
    title: z.string().min(1).max(160),
    startAt: minute,
    expectedEndAt: minute,
    hexId: z.string(),
    charts: waterlooChartsSchema,
    initial: z.array(corpsSchema).min(2),
    reinforcements: z.array(reinforcementSchema),
    reinforcementForces: z.array(corpsSchema),
    results: z.array(
      z.object({ result: waterlooResultSchema, reason: text.min(1) }).strict(),
    ),
    approved: z.boolean(),
    appliedVersion: z.number().int().min(0),
    baseline: z.array(corpsSchema),
    appliedSerial: minute.nullable(),
    maurice: z
      .array(
        z
          .object({
            corpsId: idSchema,
            units: z.array(fontenoyUnitSchema),
            commanders: z.array(fontenoyCommanderSchema),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();
export const waterlooCampaignSchema = z
  .object({
    id: idSchema,
    schemaVersion: z.literal(3),
    moduleId: z.enum(['waterloo-sandbox', 'fontenoy-operational']),
    moduleVersion: z.literal('0.1.0'),
    rulesetVersion: z.enum([
      'waterloo_simultaneous_v0.1',
      'maurice_operational_v0.1',
    ]),
    title: titleSchema,
    status: z.enum(['active', 'archived']),
    revision: z.number().int().positive(),
    seed: idSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    date: z.iso.date(),
    startDate: z.iso.date(),
    turn: z.number().int().min(1).max(100),
    activeSide: z.null(),
    cursor: minute,
    phase: z.enum([
      'planning',
      'locked',
      'resolving',
      'adjudication',
      'checkpoint',
    ]),
    charts: waterlooChartsSchema,
    hexes: z.array(hexSchema).min(1).max(1200),
    edges: z.array(hexEdgeSchema).max(4000),
    corps: z.array(corpsSchema).min(2).max(100),
    hqs: z.array(hqSchema).min(2).max(20),
    submissions: z.array(submissionSchema).length(2),
    marches: z.array(marchSchema).max(100),
    encounters: z.array(encounterSchema).max(1000),
    battles: z.array(waterlooBattleSchema).max(100),
    log: z.array(z.string().max(500)).max(3000),
    effectSerial: minute,
    adjudications: z.array(manualRecordSchema).min(1).max(500).optional(),
    preparation: preparationSchema.optional(),
    fontenoy: z
      .object({
        title: z.literal('The Road to Fontenoy, 1745'),
        tacticalGame: z.literal('Maurice'),
        aftermath: simultaneousAftermathSchema.optional(),
        factions: z
          .array(
            z
              .object({
                id: idSchema,
                side: waterlooSideSchema,
                displayName: z.string(),
              })
              .strict(),
          )
          .length(2),
        units: z.array(fontenoyUnitSchema).min(1).max(1000),
        historicalProfile: historicalProfileSchema.optional(),
        commanders: z.array(fontenoyCommanderSchema),
        officers: simultaneousCommandersSchema.optional(),
        epic: epicLedgerSchema.optional(),
        intelligence: intelligenceLedgerSchema.optional(),
        formations: z.array(
          z
            .object({
              corpsId: idSchema,
              unitIds: z.array(idSchema).min(1),
              commanderIds: z.array(idSchema),
              openingHexId: z.string(),
            })
            .strict(),
        ),
        objectives: z
          .array(
            z
              .object({
                side: waterlooSideSchema,
                hexId: z.string(),
                title: z.string(),
              })
              .strict(),
          )
          .length(2),
        siege: z
          .object({
            campaign: simultaneousSiegeSchema.optional(),
            hexId: z.string(),
            status: z.enum(['not_started', 'invested', 'relieved']),
            progress: z.number().int().min(0).max(10000),
          })
          .strict(),
        regionalMap: z.literal('fontenoy_region_3x_v0.1').optional(),
        kilometresPerHex: z.number().positive().nullable(),
        sourceSchedule: scheduleSchema,
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((c, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: 'custom', message });
    const hexes = new Set(c.hexes.map((h) => h.id));
    if (
      c.fontenoy?.regionalMap &&
      (c.hexes.length !== 864 ||
        c.hexes.some(
          (h) =>
            h.q < -12 ||
            h.q > 23 ||
            h.r < -8 ||
            h.r > 15 ||
            h.id !== `${h.q},${h.r}`,
        ))
    )
      issue(
        'The regional Fontenoy map requires all 864 hexes in its versioned 36 by 24 extent.',
      );
    const corps = new Set(c.corps.map((f) => f.id));
    for (const message of manualRecordIssues(c)) issue(message);
    if (
      (c.moduleId === 'fontenoy-operational') !== !!c.fontenoy ||
      (c.moduleId === 'fontenoy-operational') !==
        (c.rulesetVersion === 'maurice_operational_v0.1')
    )
      issue('Operational setting and rules profile must agree.');
    if (c.fontenoy) {
      for (const message of historicalProfileIssues(c)) issue(message);
      for (const message of commanderRecordIssues(c)) issue(message);
      for (const message of epicLedgerIssues(c)) issue(message);
      for (const message of intelligenceIssues(c)) issue(message);
      const siege = c.fontenoy.siege,
        state = siege.campaign;
      if (state) {
        if (
          state.enabledAt > state.lastCheckpointAt ||
          state.lastCheckpointAt > c.cursor ||
          state.eligibleMinutes >= state.policy.minutesPerSiegeTurn
        )
          issue('Invalid siege calendar or carried eligible time.');
        if (
          state.pendingReview &&
          (c.phase !== 'checkpoint' ||
            state.victory ||
            state.pendingReview.turn !== c.turn ||
            state.pendingReview.at !== c.cursor)
        )
          issue('Siege review must match the current unfinished checkpoint.');
        let previousAt = state.enabledAt,
          previousProgress: number | null = null,
          carried = 0,
          previousTurn = 0;
        for (const checkpoint of state.checkpoints) {
          const { review, policy } = checkpoint;
          const eligible =
            review.conditions.invested &&
            review.conditions.supplied &&
            !review.conditions.relieved;
          const total = carried + (eligible ? checkpoint.at - previousAt : 0);
          const increments = Math.floor(total / policy.minutesPerSiegeTurn);
          const progress = Math.min(
            10000,
            checkpoint.progressBefore +
              increments * policy.rules.siegeIncrement,
          );
          const outcome = siegeVictory(
            progress,
            review.conditions,
            review.exhaustion,
            policy.rules,
            checkpoint.at >= policy.deadlineAt,
          );
          if (
            checkpoint.fromAt !== previousAt ||
            checkpoint.at < previousAt ||
            checkpoint.at > c.cursor ||
            checkpoint.turn <= previousTurn ||
            checkpoint.turn > c.turn ||
            checkpoint.eligibleMinutesBefore !== carried ||
            checkpoint.eligibleMinutesAfter !==
              total % policy.minutesPerSiegeTurn ||
            checkpoint.increments !== increments ||
            checkpoint.progressAfter !== progress ||
            (previousProgress !== null &&
              checkpoint.progressBefore !== previousProgress) ||
            JSON.stringify(checkpoint.victory) !== JSON.stringify(outcome) ||
            (previousTurn &&
              state.checkpoints.find((p) => p.turn === previousTurn)?.victory)
          )
            issue(
              'Siege checkpoint history must preserve its reviewed conditions, timing and outcome.',
            );
          previousAt = checkpoint.at;
          previousProgress = checkpoint.progressAfter;
          carried = checkpoint.eligibleMinutesAfter;
          previousTurn = checkpoint.turn;
        }
        const last = state.checkpoints.at(-1);
        if (
          state.lastCheckpointAt !== previousAt ||
          state.eligibleMinutes !== carried ||
          (last && siege.progress !== last.progressAfter)
        )
          issue('Current siege state must agree with its checkpoint history.');
        if (
          last &&
          siege.status !==
            (last.review.conditions.relieved
              ? 'relieved'
              : last.review.conditions.invested
                ? 'invested'
                : 'not_started')
        )
          issue('Siege status must agree with the last finalized conditions.');
        const expectedVictory = last?.victory
          ? {
              ...last.victory,
              turn: last.turn,
              at: last.at,
              timestamp: last.timestamp,
            }
          : null;
        if (
          JSON.stringify(state.victory) !== JSON.stringify(expectedVictory) ||
          (state.victory &&
            (c.phase !== 'checkpoint' ||
              c.turn !== state.victory.turn ||
              c.cursor !== state.victory.at))
        )
          issue('Campaign victory must belong to its final siege checkpoint.');
      }
      for (const group of fontenoyFacts.unitGroups)
        if (
          !c.fontenoy.historicalProfile &&
          c.fontenoy.units.filter(
            (u) =>
              u.contingent === group.contingent &&
              u.type === group.type &&
              (u.initialQuality ?? u.quality) === group.quality,
          ).length !== group.count
        )
          issue(
            'Retain the Maurice Fontenoy unit types and opening qualities.',
          );
      const m = c.fontenoy,
        unitIds = m.units.map((u) => u.id),
        assigned = m.formations.flatMap((f) => f.unitIds),
        commanders = m.formations.flatMap((f) => f.commanderIds);
      if (
        (!m.historicalProfile && unitIds.length !== 38) ||
        new Set(unitIds).size !== unitIds.length ||
        new Set(assigned).size !== unitIds.length ||
        assigned.length !== unitIds.length ||
        assigned.some((id) => !unitIds.includes(id)) ||
        m.formations.length !==
          c.corps.filter((f) => f.kind !== 'detachment').length ||
        new Set(m.formations.map((f) => f.corpsId)).size !== m.formations.length
      )
        issue(
          'The Fontenoy operational roster must assign all profile units exactly once (38 in the original Maurice profile).',
        );
      if (
        !m.historicalProfile &&
        (m.units.filter((u) => u.contingent === 'french').length !== 20 ||
          m.units.filter((u) => u.contingent === 'dutch').length !== 7 ||
          m.units.filter((u) => u.contingent === 'anglo_allied').length !== 11)
      )
        issue('Retain French 20 and Allied 18 (Dutch 7 / Anglo-Allied 11).');
      if (
        new Set(m.factions.map((f) => f.side)).size !== 2 ||
        new Set(m.factions.map((f) => f.id)).size !== 2 ||
        new Set(m.commanders.map((f) => f.id)).size !== m.commanders.length ||
        new Set(commanders).size !== commanders.length
      )
        issue('Invalid Maurice faction or commander identities.');
      for (const f of m.formations) {
        const formation = c.corps.find(
          (p) => p.id === f.corpsId && p.kind !== 'detachment',
        );
        if (
          !formation ||
          !hexes.has(f.openingHexId) ||
          f.unitIds.some(
            (id) =>
              !m.units.some(
                (u) =>
                  u.id === id &&
                  m.factions.some(
                    (side) =>
                      side.id === u.factionId && side.side === formation.side,
                  ),
              ),
          ) ||
          f.commanderIds.some(
            (id) =>
              !m.commanders.some(
                (u) =>
                  u.id === id &&
                  m.factions.some(
                    (side) =>
                      side.id === u.factionId && side.side === formation.side,
                  ),
              ),
          )
        )
          issue('Invalid Fontenoy formation mapping.');
      }
      if (
        m.objectives.some((o) => !hexes.has(o.hexId)) ||
        !hexes.has(m.siege.hexId) ||
        c.corps.some((f) => f.army === 'prussian')
      )
        issue('Fontenoy must retain its own geography and armies.');
      for (const unit of m.units)
        if (
          unit.initialQuality &&
          (!['regular_infantry', 'regular_cavalry'].includes(unit.type) ||
            unit.quality !== 'conscript')
        )
          issue(
            'Opening-quality metadata belongs only to rebuilt regular conscripts.',
          );
      if (m.aftermath) {
        if (
          new Set(
            m.aftermath.recoveries.map((r) => `${r.unitId}:${r.battleId}`),
          ).size !== m.aftermath.recoveries.length
        )
          issue('Duplicate Maurice recovery record.');
        for (const formation of m.formations)
          if (
            c.corps.find((f) => f.id === formation.corpsId)?.status ===
              'ready' &&
            !m.units.some(
              (u) =>
                formation.unitIds.includes(u.id) && u.currentStatus === 'ready',
            )
          )
            issue(
              'A field formation must retain at least one ready Maurice unit.',
            );
        const pending = new Set<string>();
        for (const r of m.aftermath.recoveries) {
          const unit = m.units.find((u) => u.id === r.unitId);
          const battle = c.battles.find((b) => b.id === r.battleId);
          if (
            !unit ||
            !battle?.aftermath?.changes.some(
              (change) =>
                change.unitId === r.unitId && change.dueAt === r.dueAt,
            ) ||
            (r.recoveredAt !== null &&
              (r.recoveredAt < r.dueAt || r.recoveredAt > c.cursor))
          )
            issue('Invalid Maurice recovery references or timing.');
          if (r.recoveredAt === null) {
            if (pending.has(r.unitId) || unit?.currentStatus !== 'recovering')
              issue('Each pending recovery must match one recovering unit.');
            pending.add(r.unitId);
          }
        }
        for (const unit of m.units)
          if (unit.currentStatus === 'recovering' && !pending.has(unit.id))
            issue('Recovering Maurice units need a scheduled return.');
      }
      for (const battle of c.battles) {
        if (battle.maurice) {
          const ids = battle.maurice.flatMap((f) => f.units.map((u) => u.id));
          const committed = [
            ...battle.initial,
            ...battle.reinforcementForces,
          ].filter((f) => f.kind !== 'detachment');
          if (
            new Set(ids).size !== ids.length ||
            new Set(battle.maurice.map((f) => f.corpsId)).size !==
              battle.maurice.length ||
            committed.length !== battle.maurice.length
          )
            issue(
              'Frozen Maurice rosters must match the committed formations once.',
            );
          for (const force of battle.maurice) {
            const link = m.formations.find((f) => f.corpsId === force.corpsId);
            if (
              !committed.some((f) => f.id === force.corpsId) ||
              !link ||
              force.units.some(
                (u) =>
                  !link.unitIds.includes(u.id) ||
                  !m.units.some(
                    (original) =>
                      original.id === u.id &&
                      original.type === u.type &&
                      original.contingent === u.contingent &&
                      original.factionId === u.factionId &&
                      original.historical?.organizationId ===
                        u.historical?.organizationId &&
                      original.historical?.catalogueVersion ===
                        u.historical?.catalogueVersion &&
                      (original.initialQuality ?? original.quality) ===
                        (u.initialQuality ?? u.quality),
                  ),
              )
            )
              issue(
                'Frozen Maurice unit references or classifications are invalid.',
              );
          }
        }
        if (battle.aftermath) {
          const a = battle.aftermath;
          const ids = (battle.maurice ?? []).flatMap((f) =>
            f.units.map((u) => u.id),
          );
          if (
            !m.aftermath ||
            a.appliedVersion !== battle.appliedVersion ||
            a.baseline.length !== ids.length ||
            new Set(a.baseline.map((u) => u.id)).size !== ids.length ||
            a.baseline.some((u) => !ids.includes(u.id)) ||
            new Set(a.changes.map((r) => r.unitId)).size !== a.changes.length ||
            a.changes.some(
              (r) =>
                !ids.includes(r.unitId) ||
                r.before.id !== r.unitId ||
                r.after.id !== r.unitId,
            )
          )
            issue('Invalid Maurice aftermath baseline or result revision.');
        }
      }
    }
    const entityIds = [
      c.id,
      ...c.corps.map((f) => f.id),
      ...c.hqs.map((h) => h.id),
      ...c.battles.map((b) => b.id),
      ...(c.adjudications ?? []).map((r) => r.id),
      ...(c.fontenoy
        ? [
            ...c.fontenoy.factions,
            ...c.fontenoy.units,
            ...c.fontenoy.commanders,
          ].map((f) => f.id)
        : []),
    ];
    if (new Set(entityIds).size !== entityIds.length)
      issue('Entity identities must be unique.');
    if (
      new Set(c.encounters.map((e) => e.id)).size !== c.encounters.length ||
      new Set(c.marches.map((m) => m.corpsId)).size !== c.marches.length
    )
      issue('Duplicate encounter or march.');
    if (
      c.cursor % 5 !== 0 ||
      c.cursor <
        Math.floor((c.turn - 1) / 2) * 1440 + ((c.turn - 1) % 2 ? 720 : 360)
    )
      issue(
        'The shared clock must be on a five-minute tick within or after this phase.',
      );
    if (
      (c.phase === 'locked' && !c.submissions.every((s) => s.locked)) ||
      (c.phase === 'planning' && c.submissions.every((s) => s.locked))
    )
      issue('Phase and submission readiness disagree.');
    if (
      hexes.size !== c.hexes.length ||
      corps.size !== c.corps.length ||
      new Set(c.hqs.map((h) => h.id)).size !== c.hqs.length
    )
      issue('Duplicate hex, corps or HQ identity.');
    if (new Set(c.hexes.map((h) => `${h.q}:${h.r}`)).size !== c.hexes.length)
      issue('Duplicate hex coordinates.');
    const occupied = new Set<string>();
    for (const f of c.corps) {
      if (f.detachment) {
        const parent = c.corps.find(
          (p) =>
            p.id === f.detachment!.parentCorpsId && p.kind !== 'detachment',
        );
        if (
          f.kind !== 'detachment' ||
          !parent ||
          parent.army !== f.army ||
          parent.side !== f.side ||
          (f.detachment.deployedByHqId !== null &&
            !c.hqs.some(
              (h) => h.id === f.detachment!.deployedByHqId && h.army === f.army,
            ))
        )
          issue('Invalid detachment affiliation.');
        if (f.status === 'reserve' && f.detachment.deployedByHqId !== null)
          issue('A reserve detachment is not deployed.');
        if (
          (f.status === 'ready' && f.detachment.deployedByHqId === null) ||
          f.status === 'blown'
        )
          issue(
            'Managed screens must be deployed, recalled or eliminated; they do not use corps rebuilding.',
          );
      }
      if (f.status === 'reserve' && (f.kind !== 'detachment' || !f.detachment))
        issue('Only managed detachments use the reserve status.');
      if ((f.army === 'french') !== (f.side === 'french'))
        issue('Army and side must agree.');
      if (
        (f.kind === 'infantry' &&
          !['advance', 'battle'].includes(f.formation)) ||
        (f.kind === 'cavalry' && !['fresh', 'exhausted'].includes(f.formation))
      )
        issue('Invalid formation for corps type.');
      if (f.hexId !== null && !hexes.has(f.hexId)) issue('Unknown force hex.');
      if (f.status !== 'ready' && f.hexId !== null)
        issue('Removed forces cannot occupy a hex.');
      if (f.status === 'ready' && f.hexId === null)
        issue('Ready forces need a hex.');
      if (f.kind !== 'detachment' && f.hexId !== null) {
        if (occupied.has(f.hexId)) issue('Corps cannot stack.');
        occupied.add(f.hexId);
      }
    }
    if (c.preparation) {
      const p = c.preparation;
      if (!p.resolved && p.startedAt !== c.cursor)
        issue('Unresolved preparation must use its phase-start snapshot.');
      const submittedIds = p.submissions.flatMap((s) =>
        s.orders.map((o) => o.corpsId),
      );
      if (
        (!p.resolved && p.withdrawnCorpsIds.length) ||
        (p.resolved &&
          (p.withdrawnCorpsIds.length !== submittedIds.length ||
            submittedIds.some((id) => !p.withdrawnCorpsIds.includes(id))))
      )
        issue('Withdrawn forces must match the resolved submissions.');
      if (
        p.turn !== c.turn ||
        p.startedAt > c.cursor ||
        p.resolved !== (p.resolvedAt !== null) ||
        (p.resolvedAt !== null &&
          (p.resolvedAt < p.startedAt || p.resolvedAt > c.cursor)) ||
        new Set(p.submissions.map((s) => s.side)).size !== 2
      )
        issue('Invalid preparation clock or readiness.');
      if (
        (p.resolved && !p.submissions.every((s) => s.locked)) ||
        (!p.resolved && c.submissions.some((s) => s.locked || s.orders.length))
      )
        issue('Finish withdrawals before movement planning.');
      if (
        new Set(p.deploymentHqIds).size !== p.deploymentHqIds.length ||
        p.deploymentHqIds.some((id) => !c.hqs.some((h) => h.id === id))
      )
        issue('Invalid HQ deployment allowance.');
      if (
        new Set(p.withdrawnCorpsIds).size !== p.withdrawnCorpsIds.length ||
        p.withdrawnCorpsIds.some((id) => !corps.has(id))
      )
        issue('Invalid withdrawn force.');
      for (const s of p.submissions) {
        if (
          new Set(s.orders.map((o) => o.corpsId)).size !== s.orders.length ||
          new Set(s.orders.map((o) => o.priority)).size !== s.orders.length
        )
          issue('Withdrawal identities and priorities must be unique.');
        for (const o of s.orders)
          if (
            !c.corps.some(
              (f) =>
                f.id === o.corpsId &&
                f.side === s.side &&
                f.kind !== 'detachment',
            ) ||
            !corps.has(o.enemyId) ||
            o.path.some((id) => !hexes.has(id))
          )
            issue('Invalid withdrawal reference.');
      }
      const detachments = c.corps.filter(
        (f) => f.kind === 'detachment' && f.status === 'ready',
      );
      if (new Set(detachments.map((f) => f.hexId)).size !== detachments.length)
        issue('Detachments cannot stack with each other.');
      for (const f of detachments)
        if (
          c.corps.some(
            (other) =>
              other.id !== f.id &&
              other.hexId === f.hexId &&
              other.status === 'ready' &&
              other.side !== f.side,
          )
        )
          issue('Opposing pieces cannot share a detachment hex.');
    }
    for (const e of c.edges)
      if (!hexes.has(e.from) || !hexes.has(e.to))
        issue('Unknown edge endpoint.');
    const edgeIds = c.edges.map((e) => [e.from, e.to].sort().join(':'));
    if (new Set(edgeIds).size !== edgeIds.length) issue('Duplicate map edge.');
    const edgeHexes = new Map(c.hexes.map((h) => [h.id, h]));
    for (const e of c.edges) {
      const a = edgeHexes.get(e.from),
        b = edgeHexes.get(e.to);
      if (
        a &&
        b &&
        Math.max(
          Math.abs(a.q - b.q),
          Math.abs(a.r - b.r),
          Math.abs(a.q + a.r - b.q - b.r),
        ) !== 1
      )
        issue('Map edges must join adjacent hexes.');
    }
    for (const h of c.hqs) if (!hexes.has(h.hexId)) issue('Unknown HQ hex.');
    if (new Set(c.submissions.map((s) => s.side)).size !== 2)
      issue('One submission per side is required.');
    for (const s of c.submissions) {
      if (
        new Set(s.orders.map((o) => o.corpsId)).size !== s.orders.length ||
        new Set(s.orders.map((o) => o.priority)).size !== s.orders.length
      )
        issue('Orders require unique forces and explicit priorities.');
      for (const o of s.orders)
        if (
          !corps.has(o.corpsId) ||
          c.corps.find((f) => f.id === o.corpsId)?.side !== s.side
        )
          issue('Order ownership is invalid.');
      for (const o of s.orders)
        for (const segment of o.segments)
          if (
            segment.path.some((id) => !hexes.has(id)) ||
            !c.hqs.some((h) => h.id === segment.hqId)
          )
            issue('Invalid route or HQ reference.');
    }
    for (const m of c.marches)
      if (
        !corps.has(m.corpsId) ||
        (m.transit && (!hexes.has(m.transit.from) || !hexes.has(m.transit.to)))
      )
        issue('Invalid march reference.');
    for (const e of c.encounters)
      if (!hexes.has(e.hexId) || e.corpsIds.some((id) => !corps.has(id)))
        issue('Invalid encounter reference.');
    for (const b of c.battles)
      if (
        !hexes.has(b.hexId) ||
        !c.encounters.some((e) => e.id === b.encounterId) ||
        [...b.initial, ...b.reinforcementForces].some((f) => !corps.has(f.id))
      )
        issue('Invalid battle reference.');
    for (const e of c.encounters)
      if (
        e.battleId !== null &&
        !c.battles.some((b) => b.id === e.battleId && b.encounterId === e.id)
      )
        issue('Invalid contact battle link.');
    for (const b of c.battles) {
      const committed = [...b.initial, ...b.reinforcementForces].map(
        (f) => f.id,
      );
      if (
        new Set(committed).size !== committed.length ||
        b.appliedVersion > b.results.length ||
        (b.appliedVersion > 0 && !b.approved)
      )
        issue('Invalid battle commitment or result revision.');
      if (
        b.reinforcements.length !== b.reinforcementForces.length ||
        new Set(b.reinforcements.map((r) => r.corpsId)).size !==
          b.reinforcements.length
      )
        issue('Invalid reinforcement commitments.');
      for (const r of b.reinforcements)
        if (
          !b.reinforcementForces.some((f) => f.id === r.corpsId) ||
          !hexes.has(r.originHexId) ||
          !hexes.has(r.entryHexId) ||
          r.path.some((id) => !hexes.has(id)) ||
          r.earliest > r.likely ||
          r.likely > r.latest
        )
          issue('Invalid reinforcement route or time window.');
    }
    if (Date.parse(c.updatedAt) < Date.parse(c.createdAt))
      issue('Invalid campaign chronology.');
  });
export type WaterlooCampaign = z.infer<typeof waterlooCampaignSchema>;
export type WaterlooCorps = z.infer<typeof corpsSchema>;
export type WaterlooOrder = z.infer<typeof corpsOrderSchema>;
export type WaterlooBattle = z.infer<typeof waterlooBattleSchema>;
export type WaterlooResult = z.infer<typeof waterlooResultSchema>;
export type WaterlooSide = z.infer<typeof waterlooSideSchema>;
export type WaterlooMarch = z.infer<typeof marchSchema>;
export type ReinforcementEstimate = z.infer<typeof reinforcementSchema>;
export type WithdrawalOrder = z.infer<typeof withdrawalOrderSchema>;
export const waterlooCommandSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('expand-regional-map') }).strict(),
  z
    .object({
      kind: z.literal('historical-regroup'),
      regroup: historicalRegroupSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('historical-roster-review'),
      review: historicalReviewSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('manual-adjudication'),
      ruling: manualRulingSchema,
    })
    .strict(),
  z.object({ kind: z.literal('maurice-epic-enable') }).strict(),
  epicCommandSchema,
  ...intelligenceCommandSchema.options,
  z.object({ kind: z.literal('maurice-commanders-enable') }).strict(),
  z
    .object({
      kind: z.literal('maurice-commander'),
      action: officerActionSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('maurice-siege-policy'),
      policy: simultaneousSiegePolicySchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('maurice-siege-review'),
      review: siegeReviewSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('maurice-recovery-policy'),
      policy: simultaneousRecoveryPolicySchema,
    })
    .strict(),
  z.object({ kind: z.literal('enable-preparation') }).strict(),
  z
    .object({
      kind: z.literal('deploy-detachment'),
      corpsId: idSchema,
      hqId: idSchema,
      hexId: z.string(),
      source: z.enum(['hq', 'parent']),
    })
    .strict(),
  z
    .object({ kind: z.literal('recall-detachment'), corpsId: idSchema })
    .strict(),
  z
    .object({
      kind: z.literal('withdrawals'),
      side: waterlooSideSchema,
      orders: z.array(withdrawalOrderSchema).max(100),
      lock: z.boolean(),
    })
    .strict(),
  z.object({ kind: z.literal('reset-withdrawals') }).strict(),
  z.object({ kind: z.literal('resolve-withdrawals') }).strict(),
  z
    .object({
      kind: z.literal('orders'),
      side: waterlooSideSchema,
      orders: z.array(corpsOrderSchema).max(100),
      lock: z.boolean(),
    })
    .strict(),
  z.object({ kind: z.literal('reset-orders') }).strict(),
  z
    .object({ kind: z.literal('configure'), charts: waterlooChartsSchema })
    .strict(),
  z.object({ kind: z.literal('resolve') }).strict(),
  z.object({ kind: z.literal('stand-off'), encounterId: z.string() }).strict(),
  z
    .object({
      kind: z.literal('declare-battle'),
      encounterId: z.string(),
      title: z.string().trim().min(1).max(160),
    })
    .strict(),
  z
    .object({
      kind: z.literal('reinforce'),
      battleId: idSchema,
      corpsId: idSchema,
      entryEdge: z.string().trim().min(1).max(120),
      notes: text,
      arrivalOverride: z
        .object({ at: minute, reason: text.min(1) })
        .strict()
        .optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('place-hqs'),
      placements: z
        .array(
          z
            .object({
              hqId: idSchema,
              hexId: z.string(),
              mode: z.enum(['normal', 'battle']),
            })
            .strict(),
        )
        .min(1)
        .max(20),
    })
    .strict(),
  z
    .object({
      kind: z.literal('return-corps'),
      corpsIds: z.array(idSchema).max(2),
      hexIds: z.array(z.string()).max(2),
    })
    .strict(),
  z
    .object({
      kind: z.literal('result'),
      battleId: idSchema,
      result: waterlooResultSchema,
      reason: text.min(1),
    })
    .strict(),
  z.object({ kind: z.literal('approve-result'), battleId: idSchema }).strict(),
  z.object({ kind: z.literal('finalize') }).strict(),
]);
export type WaterlooCommand = z.infer<typeof waterlooCommandSchema>;
export const waterlooReceiptSchema = z
  .object({
    command: waterlooCommandSchema,
    recordId: idSchema,
    timestamp: z.iso.datetime(),
  })
  .strict();
export type WaterlooReceipt = z.infer<typeof waterlooReceiptSchema>;
