import { expect, it } from 'vitest';
import {
  seedFontenoyOperational,
  cloneFontenoyOperational,
} from '../../src/domain/fontenoy-operational';
import { waterlooCampaignSchema } from '../../src/domain/waterloo-schema';
import type {
  WaterlooCampaign,
  WaterlooCommand,
} from '../../src/domain/waterloo-schema';
import { seedWaterloo, applyWaterlooCommand } from '../../src/domain/waterloo';
import { commanderRecordIssues } from '../../src/domain/simultaneous-commanders';
import { defaultSimultaneousSiegePolicy } from '../../src/domain/simultaneous-siege';
import { waterlooBriefHtml } from '../../src/domain/waterloo-brief';
import {
  simultaneousStep as step,
  operationalNow as now,
  unitBattleCampaign,
  applyUnitBattle,
  unitBattleResult,
} from '../fixtures/simultaneous-aftermath';
const uuid = () => crypto.randomUUID();
const seed = () => seedFontenoyOperational('Officer review', uuid, now);
const enable = (c = seed()) => step(c, { kind: 'maurice-commanders-enable' });
const notes = 'Both players resolved this decision manually.';
const arrival = (c: WaterlooCampaign, side: 'french' | 'allied' = 'french') =>
  step(c, {
    kind: 'maurice-commander',
    action: {
      kind: 'arrival',
      side,
      displayName: 'Player officer',
      notableReference: 'My private card title',
      notes,
    },
  });
const officer = (c: WaterlooCampaign) => c.fontenoy!.commanders.at(-1)!;
const attach = (c: WaterlooCampaign, id: string, corpsId: string | null) =>
  step(c, {
    kind: 'maurice-commander',
    action: { kind: 'attachment', commanderId: id, corpsId, notes },
  });
const status = (
  c: WaterlooCampaign,
  id: string,
  value: 'active' | 'lost' | 'retired',
) =>
  step(c, {
    kind: 'maurice-commander',
    action: { kind: 'status', commanderId: id, status: value, notes },
  });
function checkpoint(c: WaterlooCampaign) {
  for (const side of ['french', 'allied'] as const)
    c = step(c, { kind: 'orders', side, orders: [], lock: true });
  return step(c, { kind: 'resolve' });
}
it('enables prospectively with an exact roster and attachment baseline without changing the source', () => {
  const c = seed(),
    before = structuredClone(c),
    next = enable(c);
  expect(c).toEqual(before);
  expect(next.fontenoy!.commanders).toEqual(c.fontenoy!.commanders);
  expect(next.fontenoy!.officers).toMatchObject({
    ruleId: 'maurice_commanders_v0.1',
    baseline: c.fontenoy!.commanders,
    records: [],
    enabledAt: c.cursor,
  });
  expect(next.fontenoy!.officers!.assignments).toHaveLength(
    c.fontenoy!.formations.flatMap((f) => f.commanderIds).length,
  );
  expect(() => enable(next)).toThrow('already enabled');
});
it('requires opt-in and rejects the wrong scenario, empty explanations and identity collisions', () => {
  const c = seed();
  expect(() => arrival(c)).toThrow('Enable commander');
  expect(() => enable(seedWaterloo('Reference', uuid, now))).toThrow(
    'Fontenoy',
  );
  const enabled = enable(c);
  expect(() =>
    step(enabled, {
      kind: 'maurice-commander',
      action: {
        kind: 'arrival',
        side: 'allied',
        displayName: 'Officer',
        notableReference: '',
        notes: ' ',
      },
    }),
  ).toThrow();
  expect(() =>
    applyWaterlooCommand(enabled, {
      command: {
        kind: 'maurice-commander',
        action: {
          kind: 'arrival',
          side: 'allied',
          displayName: 'Officer',
          notableReference: '',
          notes,
        },
      },
      recordId: enabled.corps[0]!.id,
      timestamp: now,
    }),
  ).toThrow('identities');
});
it('records arrivals/details with provenance and private references, preserving historical names', () => {
  let c = enable();
  const baseline = structuredClone(c.fontenoy!.officers!.baseline);
  c = arrival(c);
  const id = officer(c).id;
  expect(officer(c)).toMatchObject({
    displayName: 'Player officer',
    campaignStatus: 'active',
    provenance: 'house_rule_v0.1',
    notableReference: 'My private card title',
  });
  c = step(c, {
    kind: 'maurice-commander',
    action: {
      kind: 'details',
      commanderId: id,
      displayName: 'Renamed officer',
      notableReference: '<private reminder>',
      notes,
    },
  });
  expect(officer(c).displayName).toBe('Renamed officer');
  expect(c.fontenoy!.officers!.baseline).toEqual(baseline);
  expect(c.fontenoy!.officers!.records[0]!.after.displayName).toBe(
    'Player officer',
  );
  expect(commanderRecordIssues(c)).toEqual([]);
});
it('transfers once within the faction and supports explicit detachment', () => {
  let c = arrival(enable());
  const id = officer(c).id;
  c = attach(c, id, c.corps[0]!.id);
  const priorAssignments = structuredClone(c.fontenoy!.formations);
  const original = c.fontenoy!.commanders[0]!;
  c = step(c, {
    kind: 'maurice-commander',
    action: {
      kind: 'details',
      commanderId: original.id,
      displayName: `${original.displayName} (alias)`,
      notableReference: '',
      notes,
    },
  });
  expect(c.fontenoy!.formations).toEqual(priorAssignments);
  c = attach(c, id, c.corps[1]!.id);
  expect(
    c
      .fontenoy!.formations.filter((f) => f.commanderIds.includes(id))
      .map((f) => f.corpsId),
  ).toEqual([c.corps[1]!.id]);
  c = attach(c, id, null);
  expect(c.fontenoy!.formations.some((f) => f.commanderIds.includes(id))).toBe(
    false,
  );
  expect(() => attach(c, id, c.corps[2]!.id)).toThrow('own faction');
  expect(() => attach(c, id, uuid())).toThrow('own faction');
});
it.each(['lost', 'retired'] as const)(
  'detaches %s officers and leaves a restored officer unassigned',
  (value) => {
    let c = arrival(enable());
    const id = officer(c).id;
    c = attach(c, id, c.corps[0]!.id);
    c = status(c, id, value);
    expect(
      c.fontenoy!.formations.some((f) => f.commanderIds.includes(id)),
    ).toBe(false);
    expect(() => attach(c, id, c.corps[0]!.id)).toThrow('Only active');
    c = status(c, id, 'active');
    expect(
      c.fontenoy!.formations.some((f) => f.commanderIds.includes(id)),
    ).toBe(false);
    expect(c.fontenoy!.officers!.records.at(-2)).toMatchObject({
      fromCorpsId: c.corps[0]!.id,
      toCorpsId: null,
    });
  },
);
it('blocks officer edits after orders/withdrawal planning and while contacts or battles are unresolved', () => {
  let c = enable();
  c = step(c, { kind: 'orders', side: 'french', orders: [], lock: true });
  expect(() => arrival(c)).toThrow('clear planning');
  const battle = unitBattleCampaign();
  expect(() =>
    status(battle, battle.fontenoy!.commanders[0]!.id, 'lost'),
  ).toThrow('clear planning');
  let p = step(enable(), { kind: 'enable-preparation' });
  p = step(p, { kind: 'withdrawals', side: 'french', orders: [], lock: true });
  expect(() => arrival(p)).toThrow('clear planning');
  p = step(p, { kind: 'withdrawals', side: 'allied', orders: [], lock: true });
  p = step(p, { kind: 'resolve-withdrawals' });
  expect(() => attach(p, p.fontenoy!.commanders[0]!.id, null)).toThrow(
    'clear planning',
  );
  expect(() => arrival(p)).not.toThrow();
});
it('permits resolved status at a settled checkpoint but never transfers there', () => {
  let c = enable();
  c = step(c, {
    kind: 'maurice-siege-policy',
    policy: defaultSimultaneousSiegePolicy(c),
  });
  c = checkpoint(c);
  const id = c.fontenoy!.commanders[0]!.id;
  c = status(c, id, 'lost');
  expect(c.fontenoy!.commanders.find((u) => u.id === id)?.campaignStatus).toBe(
    'lost',
  );
  expect(() => attach(c, id, null)).toThrow('clear planning');
  c = step(c, {
    kind: 'maurice-siege-review',
    review: {
      conditions: { invested: false, supplied: false, relieved: false },
      exhaustion: { french: 0, allied: 0 },
      notes,
    },
  });
  expect(() => status(c, id, 'active')).toThrow('clear planning');
});
it('rejects unavailable initial attachments, eliminated destinations and no-op decisions', () => {
  const c = seed();
  const id = c.fontenoy!.formations[0]!.commanderIds[0]!;
  c.fontenoy!.commanders.find((u) => u.id === id)!.campaignStatus = 'lost';
  expect(() => enable(c)).toThrow('Reconcile');
  const d = enable();
  const existing = d.fontenoy!.commanders[0]!;
  expect(() =>
    step(d, {
      kind: 'maurice-commander',
      action: {
        kind: 'details',
        commanderId: existing.id,
        displayName: existing.displayName,
        notableReference: existing.notableReference ?? '',
        notes,
      },
    }),
  ).toThrow('Choose an officer change');
  const e = arrival(enable());
  e.corps[0]!.status = 'eliminated';
  e.corps[0]!.hexId = null;
  expect(() => attach(e, officer(e).id, e.corps[0]!.id)).toThrow(
    'non-eliminated',
  );
});
it('preserves frozen battle briefs when later officer decisions block dependent corrections', () => {
  // This historical battle predates opt-in; enablement after finalization preserves its exact snapshot.
  let c = applyUnitBattle(unitBattleCampaign());
  const frozen = structuredClone(c.battles[0]);
  c = step(c, { kind: 'finalize' });
  c = enable(c);
  const u = c.fontenoy!.commanders[0]!;
  c = status(c, u.id, 'lost');
  expect(c.battles[0]).toEqual(frozen);
  expect(waterlooBriefHtml(c, c.battles[0]!)).toContain(u.displayName);
  expect(() =>
    step(c, {
      kind: 'result',
      battleId: c.battles[0]!.id,
      result: unitBattleResult(c),
      reason: 'Late revision.',
    }),
  ).toThrow();
});
it('clones the reviewed officer baseline with fresh IDs, excluding later arrivals and decisions', () => {
  let c = enable();
  const baseline = structuredClone(c.fontenoy!.commanders);
  c = arrival(c);
  c = attach(c, officer(c).id, c.corps[0]!.id);
  c = status(c, baseline[0]!.id, 'retired');
  const old = structuredClone(c),
    clone = cloneFontenoyOperational(c, 'Fresh setup', uuid, now);
  expect(clone.fontenoy!.commanders.map((u) => u.displayName)).toEqual(
    baseline.map((u) => u.displayName),
  );
  expect(
    clone.fontenoy!.commanders.every(
      (u) => !c.fontenoy!.commanders.some((old) => old.id === u.id),
    ),
  ).toBe(true);
  expect(clone.fontenoy!.officers).toBeUndefined();
  expect(clone.fontenoy!.formations[0]!.commanderIds).toHaveLength(1);
  expect(c).toEqual(old);
});
it('rejects tampered officer chronology, status, reference, ownership and assignment summaries', () => {
  const c = arrival(enable());
  const edits = [
    (d: WaterlooCampaign) => {
      d.fontenoy!.commanders.at(-1)!.notableReference = 'changed';
    },
    (d: WaterlooCampaign) => {
      d.fontenoy!.officers!.records[0]!.at = d.cursor + 1;
    },
    (d: WaterlooCampaign) => {
      d.fontenoy!.officers!.records[0]!.action.notes = 'Different explanation';
    },
    (d: WaterlooCampaign) => {
      d.fontenoy!.formations[0]!.commanderIds.push(officer(d).id);
    },
    (d: WaterlooCampaign) => {
      d.fontenoy!.commanders.at(-1)!.factionId = uuid();
    },
  ];
  for (const edit of edits) {
    const d = structuredClone(c);
    edit(d);
    expect(waterlooCampaignSchema.safeParse(d).success).toBe(false);
  }
});
it('freezes assigned officers into new briefs, omits later losses, and guards corrections after an officer decision', () => {
  let c = seed();
  c.corps[0]!.hexId = '5,4';
  c.corps[2]!.hexId = '7,4';
  c = arrival(enable(c));
  const id = officer(c).id;
  c = attach(c, id, c.corps[0]!.id);
  const declare = (input: WaterlooCampaign) => {
    let next = input;
    for (const [side, index] of [
      ['french', 0],
      ['allied', 2],
    ] as const)
      next = step(next, {
        kind: 'orders',
        side,
        lock: true,
        orders: [
          {
            corpsId: next.corps[index]!.id,
            priority: 0,
            segments: [
              {
                path: [next.corps[index]!.hexId!, '6,4'],
                roadOnly: false,
                startAt: next.cursor + 30,
                hqId: next.hqs.find((h) => h.army === next.corps[index]!.army)!
                  .id,
              },
            ],
          },
        ],
      });
    next = step(next, { kind: 'resolve' });
    return step(next, {
      kind: 'declare-battle',
      encounterId: next.encounters.find((e) => !e.settled)!.id,
      title: 'Officer snapshot',
    });
  };
  c = declare(c);
  expect(
    c.battles[0]!.maurice!.flatMap((f) => f.commanders).some(
      (u) => u.id === id,
    ),
  ).toBe(true);
  c = applyUnitBattle(c);
  const revision: WaterlooCommand = {
    kind: 'result',
    battleId: c.battles[0]!.id,
    result: unitBattleResult(c),
    reason: 'Reviewed correction.',
  };
  expect(() => step(c, revision)).not.toThrow();
  const frozen = structuredClone(c.battles[0]);
  c = status(c, id, 'lost');
  expect(() => step(c, revision)).toThrow();
  expect(c.battles[0]).toEqual(frozen);
  c = declare(step(c, { kind: 'finalize' }));
  expect(
    c.battles[1]!.maurice!.flatMap((f) => f.commanders).some(
      (u) => u.id === id,
    ),
  ).toBe(false);
  expect(waterlooBriefHtml(c, c.battles[1]!)).not.toContain(
    'My private card title',
  );
});
