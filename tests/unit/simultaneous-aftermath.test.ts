// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  applyUnitBattle,
  emptySharedPhase,
  simultaneousStep as step,
  unitBattleCampaign,
  unitBattleResult,
  operationalNow,
} from '../fixtures/simultaneous-aftermath';
import {
  seedFontenoyOperational,
  cloneFontenoyOperational,
} from '../../src/domain/fontenoy-operational';
import { defaultSimultaneousRecoveryPolicy } from '../../src/domain/simultaneous-aftermath';
import { waterlooCampaignSchema } from '../../src/domain/waterloo-schema';

describe('simultaneous Maurice unit aftermath', () => {
  it('requires explicit removal of an empty field formation and blocks a blown return before its units recover', () => {
    let c = unitBattleCampaign();
    const result = unitBattleResult(c);
    const force = c.battles[0]!.maurice![0]!;
    for (const row of result.maurice!.units)
      if (force.units.some((u) => u.id === row.unitId)) {
        row.outcome = 'broken';
        row.recovery = 'recover';
      }
    expect(() => applyUnitBattle(c, result)).toThrow('without ready units');
    result.effects[0]!.disposition = 'blown';
    result.effects[0]!.hexId = null;
    c = step(applyUnitBattle(c, result), { kind: 'finalize' });
    c = emptySharedPhase(c);
    expect(c.corps[0]!.status).toBe('blown');
    expect(
      c
        .fontenoy!.units.filter((u) => force.units.some((p) => p.id === u.id))
        .every((u) => u.currentStatus === 'recovering'),
    ).toBe(true);
    expect(() =>
      step(c, {
        kind: 'return-corps',
        corpsIds: [c.corps[0]!.id],
        hexIds: ['3,3'],
      }),
    ).toThrow('ready Maurice unit');
  });
  it('requires explicit prospective policy enablement and retains earlier results unchanged', () => {
    let c = unitBattleCampaign(false);
    const result = unitBattleResult(c);
    c = applyUnitBattle(c, result);
    expect(c.fontenoy!.aftermath).toBeUndefined();
    expect(c.fontenoy!.units.every((u) => u.currentStatus === 'ready')).toBe(
      true,
    );
    const old = structuredClone(c.battles);
    c = step(c, { kind: 'finalize' });
    c = step(c, {
      kind: 'maurice-recovery-policy',
      policy: defaultSimultaneousRecoveryPolicy(c),
    });
    expect(c.battles).toEqual(old);
    expect(c.fontenoy!.aftermath!.recoveries).toEqual([]);
    expect(c.fontenoy!.aftermath!.policy.minutesPerRecoveryTurn).toBe(2880);
  });
  it('records and approves without changing units, then applies rebuilding once at battle end', () => {
    let c = unitBattleCampaign();
    const before = structuredClone(c.fontenoy!.units);
    const b = c.battles[0]!;
    const result = unitBattleResult(c);
    const frozen = structuredClone(b.maurice);
    c = step(c, {
      kind: 'result',
      battleId: b.id,
      result,
      reason: 'Manual battle.',
    });
    c = step(c, { kind: 'approve-result', battleId: b.id });
    expect(c.fontenoy!.units).toEqual(before);
    c = step(c, { kind: 'resolve' });
    expect(c.fontenoy!.units[0]).toMatchObject({
      quality: 'conscript',
      initialQuality: 'elite',
      currentStatus: 'recovering',
    });
    expect(c.fontenoy!.units).toHaveLength(38);
    expect(c.battles[0]!.maurice).toEqual(frozen);
    expect(c.battles[0]!.results[0]!.result.maurice!.armyMorale.french).toBe(7);
    expect(c.fontenoy!.units[0]).not.toHaveProperty('disruptedAtEnd');
    expect(c.fontenoy!.aftermath!.recoveries[0]!.dueAt).toBe(
      result.endAt + 2880,
    );
    expect(() => step(c, { kind: 'resolve' })).toThrow('Finalize');
    expect(c.fontenoy!.aftermath!.recoveries).toHaveLength(1);
    expect(waterlooCampaignSchema.safeParse(c).success).toBe(true);
  });
  it('converts legacy recovery turns to calendar time and returns units only at finalized phase checkpoints', () => {
    let c = applyUnitBattle(unitBattleCampaign());
    const due = c.fontenoy!.aftermath!.recoveries[0]!.dueAt;
    c = step(c, { kind: 'finalize' });
    expect(c.cursor).toBe(720);
    expect(c.fontenoy!.units[0]!.currentStatus).toBe('recovering');
    for (let count = 0; count < 8 && c.cursor < due; count++) {
      const before = c.cursor;
      c = emptySharedPhase(c);
      if (c.cursor < due)
        expect(c.fontenoy!.units[0]!.currentStatus).toBe('recovering');
      expect(c.cursor).toBeGreaterThan(before);
    }
    expect(c.fontenoy!.units[0]).toMatchObject({
      currentStatus: 'ready',
      quality: 'conscript',
    });
    expect(
      c.fontenoy!.aftermath!.recoveries[0]!.recoveredAt,
    ).toBeGreaterThanOrEqual(due);
  });
  it.each([
    'missing',
    'duplicate',
    'foreign',
    'forbidden',
    'not-engaged',
  ] as const)('rejects %s observations without changing the source', (kind) => {
    const c = unitBattleCampaign();
    const before = structuredClone(c);
    const result = unitBattleResult(c);
    if (kind === 'missing') result.maurice!.units.pop();
    if (kind === 'duplicate')
      result.maurice!.units[1] = structuredClone(result.maurice!.units[0]!);
    if (kind === 'foreign') result.maurice!.units[0]!.unitId = randomUUID();
    if (kind === 'forbidden') result.maurice!.units[0]!.recovery = 'lost';
    if (kind === 'not-engaged') result.effects[0]!.disposition = 'not_engaged';
    expect(() =>
      step(c, {
        kind: 'result',
        battleId: c.battles[0]!.id,
        result,
        reason: 'Invalid observations.',
      }),
    ).toThrow();
    expect(c).toEqual(before);
  });
  it('supports explicit loss and retired rest variants', () => {
    let c = seedFontenoyOperational('Variants', randomUUID, operationalNow);
    const policy = defaultSimultaneousRecoveryPolicy(c);
    policy.rules.strategy = 'manual_review_v1';
    policy.rules.retiredRestTurns = 1;
    // Use the fixture's genuine frozen roster, then select the same explicit policy before play.
    c = unitBattleCampaign();
    c.fontenoy!.aftermath!.policy = policy;
    const result = unitBattleResult(c);
    result.maurice!.units[0]!.recovery = 'lost';
    result.maurice!.units[1]!.outcome = 'retired';
    c = applyUnitBattle(c, result);
    expect(c.fontenoy!.units[0]!.currentStatus).toBe('lost');
    expect(c.fontenoy!.units[1]).toMatchObject({
      quality: 'elite',
      currentStatus: 'recovering',
    });
  });
  it('applies chosen artillery recovery without assigning regular quality', () => {
    let c = unitBattleCampaign(true, 1);
    const result = unitBattleResult(c);
    result.maurice!.units.forEach((u) => {
      u.outcome = 'survived';
      u.recovery = null;
    });
    const artillery = c.battles[0]!.maurice!.flatMap((f) => f.units).find(
      (u) => u.type === 'artillery',
    )!;
    const row = result.maurice!.units.find((u) => u.unitId === artillery.id)!;
    row.outcome = 'broken';
    row.recovery = 'lost';
    const lost = applyUnitBattle(c, result);
    expect(
      lost.fontenoy!.units.find((u) => u.id === artillery.id),
    ).toMatchObject({ currentStatus: 'lost', quality: null });
    c.fontenoy!.aftermath!.policy.rules.artilleryRecovery = 'same_quality';
    row.recovery = 'recover';
    c = applyUnitBattle(c, result);
    expect(c.fontenoy!.units.find((u) => u.id === artillery.id)).toMatchObject({
      currentStatus: 'recovering',
      quality: null,
    });
  });
  it('freezes only ready units into subsequent briefs and retains original battle snapshots', () => {
    let c = applyUnitBattle(unitBattleCampaign());
    const original = structuredClone(c.battles[0]!.maurice);
    const recoveringId = c.fontenoy!.units[0]!.id;
    c = step(c, { kind: 'finalize' });
    for (const [side, index] of [
      ['french', 0],
      ['allied', 2],
    ] as const)
      c = step(c, {
        kind: 'orders',
        side,
        lock: true,
        orders: [
          {
            corpsId: c.corps[index]!.id,
            priority: 0,
            segments: [
              {
                path: [c.corps[index]!.hexId!, '6,4'],
                roadOnly: false,
                startAt: c.cursor + 30,
                hqId: c.hqs.find((h) => h.army === c.corps[index]!.army)!.id,
              },
            ],
          },
        ],
      });
    c = step(c, { kind: 'resolve' });
    c = step(c, {
      kind: 'declare-battle',
      encounterId: c.encounters.find((e) => !e.settled)!.id,
      title: 'Second battle',
    });
    expect(
      c.battles[1]!.maurice!.flatMap((f) => f.units).map((u) => u.id),
    ).not.toContain(recoveringId);
    expect(c.battles[0]!.maurice).toEqual(original);
  });
  it('does not recompute existing recovery dates after a later reviewed policy change', () => {
    let c = step(applyUnitBattle(unitBattleCampaign()), { kind: 'finalize' });
    const before = structuredClone(c.fontenoy!.aftermath!.recoveries);
    const policy = defaultSimultaneousRecoveryPolicy(c);
    policy.minutesPerRecoveryTurn = 60;
    c = step(c, { kind: 'maurice-recovery-policy', policy });
    expect(c.fontenoy!.aftermath!.recoveries).toEqual(before);
  });
  it('restores the exact unit baseline and recovery queue for safe result correction, then blocks dependent corrections', () => {
    let c = unitBattleCampaign();
    const original = structuredClone(c.fontenoy!.units);
    const result = unitBattleResult(c);
    c = applyUnitBattle(c, result);
    const corrected = structuredClone(result);
    corrected.maurice!.units[0]!.outcome = 'survived';
    corrected.maurice!.units[0]!.recovery = null;
    c = step(c, {
      kind: 'result',
      battleId: c.battles[0]!.id,
      result: corrected,
      reason: 'Corrected unit transcription.',
    });
    expect(c.fontenoy!.units).toEqual(original);
    expect(c.fontenoy!.aftermath!.recoveries).toHaveLength(0);
    expect(c.battles[0]!.aftermath!.appliedVersion).toBe(2);
    c = step(c, { kind: 'finalize' });
    expect(() =>
      step(c, {
        kind: 'result',
        battleId: c.battles[0]!.id,
        result,
        reason: 'Unsafe late correction.',
      }),
    ).toThrow('depend');
  });
  it('clones an independent opening setup without inheriting losses, schedules or conscript classifications', () => {
    const c = applyUnitBattle(unitBattleCampaign());
    const clone = cloneFontenoyOperational(
      c,
      'New setup',
      randomUUID,
      operationalNow,
    );
    expect(clone.fontenoy!.aftermath).toBeUndefined();
    expect(clone.fontenoy!.units[0]).toMatchObject({
      quality: 'elite',
      currentStatus: 'ready',
    });
    expect(clone.fontenoy!.units[0]!.initialQuality).toBeUndefined();
    expect(c.fontenoy!.units[0]!.quality).toBe('conscript');
  });
});
