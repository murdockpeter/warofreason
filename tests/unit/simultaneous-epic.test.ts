import { expect, it } from 'vitest';
import {
  seedFontenoyOperational,
  cloneFontenoyOperational,
} from '../../src/domain/fontenoy-operational';
import { seedWaterloo, applyWaterlooCommand } from '../../src/domain/waterloo';
import { waterlooCampaignSchema } from '../../src/domain/waterloo-schema';
import type { WaterlooCampaign } from '../../src/domain/waterloo-schema';
import type { EpicInput } from '../../src/domain/simultaneous-epic-schema';
import {
  currentEpicEntries,
  epicSummary,
} from '../../src/domain/simultaneous-epic';
import {
  simultaneousStep as step,
  operationalNow as now,
  unitBattleCampaign,
  applyUnitBattle,
  unitBattleResult,
} from '../fixtures/simultaneous-aftermath';
const uuid = () => crypto.randomUUID();
const seed = () => seedFontenoyOperational('Points test', uuid, now);
const enable = (c = seed()) => step(c, { kind: 'maurice-epic-enable' });
const input = (
  french: number | null = 0,
  allied: number | null = null,
): EpicInput => ({
  source: { kind: 'campaign', title: 'Manually reviewed event' },
  points: { french, allied },
  notes: 'Both players reviewed their own scoring materials.',
});
function record(
  c: WaterlooCampaign,
  value = input(),
  entryId: string | null = null,
  expectedVersion = 0,
) {
  return step(c, {
    kind: 'maurice-epic-record',
    input: value,
    entryId,
    expectedVersion,
    reason: 'Agreed manual entry or correction.',
  });
}
it('opts in without inventing scores and distinguishes unrecorded, zero and partial entries', () => {
  const c = seed(),
    before = structuredClone(c),
    enabled = enable(c);
  expect(c).toEqual(before);
  expect(enabled.fontenoy!.epic!.revisions).toEqual([]);
  expect(epicSummary(enabled, 'french').total).toBeNull();
  const next = record(enabled);
  expect(epicSummary(next, 'french')).toMatchObject({
    total: 0,
    recorded: 1,
    missingValues: 0,
  });
  expect(epicSummary(next, 'allied')).toMatchObject({
    total: null,
    recorded: 0,
    missingValues: 1,
  });
  expect(() => enable(next)).toThrow('already enabled');
});
it('requires opt-in, the Fontenoy profile and explicit non-negative integer values/explanations', () => {
  expect(() => record(seed())).toThrow('Enable manual');
  expect(() => enable(seedWaterloo('Reference', uuid, now))).toThrow(
    'Epic Points',
  );
  for (const bad of [-1, 0.5, 10001, NaN])
    expect(() => record(enable(), input(bad))).toThrow();
  expect(() => record(enable(), { ...input(), notes: ' ' })).toThrow();
});
it('totals only current versions, retaining reasons and allowing missing values to replace mistaken scores', () => {
  let c = record(enable(), input(5, 2));
  const first = structuredClone(currentEpicEntries(c)[0]!);
  c = record(c, input(3, 0), first.entryId, 1);
  expect(epicSummary(c, 'french').total).toBe(3);
  expect(epicSummary(c, 'allied').total).toBe(0);
  expect(c.fontenoy!.epic!.revisions[0]).toEqual(first);
  expect(currentEpicEntries(c)[0]).toMatchObject({
    version: 2,
    supersedesId: first.id,
  });
  c = record(c, input(null, null), first.entryId, 2);
  expect(epicSummary(c, 'french').total).toBeNull();
  c = record(c, {
    ...input(7, 1),
    source: { kind: 'campaign', title: 'Separate event' },
  });
  expect(epicSummary(c, 'french')).toMatchObject({
    total: 7,
    recorded: 1,
    missingValues: 1,
  });
});
it('rejects stale, unknown, no-op and retargeted corrections without changing the source', () => {
  const c = record(enable(), input(4, 2)),
    old = structuredClone(c),
    e = currentEpicEntries(c)[0]!;
  expect(() => record(c, input(3, 1), e.entryId, 0)).toThrow('changed');
  expect(() => record(c, input(3, 1), uuid(), 1)).toThrow('changed');
  expect(() => record(c, input(4, 2), e.entryId, 1)).toThrow(
    'Change the recorded',
  );
  expect(() => record(c, input(3, 1), null, 1)).toThrow('changed');
  expect(() =>
    record(
      c,
      { ...input(3, 1), source: { kind: 'battle', battleId: uuid() } },
      e.entryId,
      1,
    ),
  ).toThrow('original');
  expect(c).toEqual(old);
});
it('records one entry for a reviewed battle, binds its applied version and reports missing battles', () => {
  let c = enable(applyUnitBattle(unitBattleCampaign()));
  const b = c.battles[0]!;
  expect(epicSummary(c, 'french').battlesWithoutEntry).toBe(1);
  const value: EpicInput = {
    ...input(2, 0),
    source: { kind: 'battle', battleId: b.id },
  };
  c = record(c, value);
  expect(epicSummary(c, 'french').battlesWithoutEntry).toBe(0);
  expect(currentEpicEntries(c)[0]!.battleVersion).toBe(b.appliedVersion);
  expect(() => record(c, value)).toThrow('already has');
  const e = currentEpicEntries(c)[0]!;
  c = record(
    c,
    { ...value, points: { french: 3, allied: null } },
    e.entryId,
    1,
  );
  expect(epicSummary(c, 'french').total).toBe(3);
});
it('rejects foreign or unresolved battle sources and blocks unsafe dependent battle corrections', () => {
  const unresolved = unitBattleCampaign();
  expect(() => enable(unresolved)).toThrow('Finish outstanding');
  let c = applyUnitBattle(unresolved);
  const result = unitBattleResult(c),
    command = {
      kind: 'result' as const,
      battleId: c.battles[0]!.id,
      result,
      reason: 'Reviewed result correction.',
    };
  expect(() => step(c, command)).not.toThrow();
  c = enable(c);
  expect(() =>
    record(c, { ...input(), source: { kind: 'battle', battleId: uuid() } }),
  ).toThrow('reviewed battle');
  c = record(c, {
    ...input(),
    source: { kind: 'battle', battleId: c.battles[0]!.id },
  });
  expect(() => step(c, command)).toThrow();
});
it('keeps scoring optional at finalization and never changes units, HQs, morale or strategic conditions', () => {
  let c = enable(applyUnitBattle(unitBattleCampaign()));
  const before = structuredClone({
    units: c.fontenoy!.units,
    hqs: c.hqs,
    siege: c.fontenoy!.siege,
    battles: c.battles,
  });
  c = record(c, input(10000, 10000));
  expect({
    units: c.fontenoy!.units,
    hqs: c.hqs,
    siege: c.fontenoy!.siege,
    battles: c.battles,
  }).toEqual(before);
  expect(() =>
    step(enable(applyUnitBattle(unitBattleCampaign())), { kind: 'finalize' }),
  ).not.toThrow();
});
it('blocks entries during locks, unresolved contacts and archive', () => {
  const c = enable();
  const locked = step(c, {
    kind: 'orders',
    side: 'french',
    orders: [],
    lock: true,
  });
  expect(() => record(locked)).toThrow('clear planning');
  const archived = structuredClone(c);
  archived.status = 'archived';
  expect(() => record(archived)).toThrow('read-only');
});
it('resets scoring in a fresh clone and leaves the original ledger untouched', () => {
  const c = record(enable(), input(3, null)),
    old = structuredClone(c);
  const clone = cloneFontenoyOperational(c, 'Fresh points setup', uuid, now);
  expect(clone.fontenoy!.epic).toBeUndefined();
  expect(c).toEqual(old);
});
it('rejects revision-chain, battle-version, source and chronology tampering', () => {
  let c = enable(applyUnitBattle(unitBattleCampaign()));
  c = record(c, {
    ...input(3, 0),
    source: { kind: 'battle', battleId: c.battles[0]!.id },
  });
  const e = currentEpicEntries(c)[0]!;
  c = record(c, { ...e.input, points: { french: 4, allied: 0 } }, e.entryId, 1);
  const edits = [
    (d: WaterlooCampaign) => {
      d.fontenoy!.epic!.revisions[1]!.version = 3;
    },
    (d: WaterlooCampaign) => {
      d.fontenoy!.epic!.revisions[1]!.supersedesId = uuid();
    },
    (d: WaterlooCampaign) => {
      d.fontenoy!.epic!.revisions[0]!.battleVersion = 10;
    },
    (d: WaterlooCampaign) => {
      d.fontenoy!.epic!.revisions[0]!.at = d.cursor + 1;
    },
    (d: WaterlooCampaign) => {
      d.fontenoy!.epic!.revisions[1]!.input.source = {
        kind: 'campaign',
        title: 'Different source',
      };
    },
  ];
  for (const edit of edits) {
    const d = structuredClone(c);
    edit(d);
    expect(waterlooCampaignSchema.safeParse(d).success).toBe(false);
  }
});
it('rejects identity reuse and preserves earlier battle observations', () => {
  const c = enable(applyUnitBattle(unitBattleCampaign())),
    before = structuredClone(c.battles);
  expect(() =>
    applyWaterlooCommand(c, {
      recordId: c.corps[0]!.id,
      timestamp: now,
      command: {
        kind: 'maurice-epic-record',
        input: input(),
        entryId: null,
        expectedVersion: 0,
        reason: 'Manual.',
      },
    }),
  ).toThrow('identities');
  const next = record(c);
  expect(next.battles).toEqual(before);
});
