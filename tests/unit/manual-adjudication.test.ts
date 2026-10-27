// @vitest-environment node
import { expect, it } from 'vitest';
import {
  seedFontenoyOperational,
  cloneFontenoyOperational,
} from '../../src/domain/fontenoy-operational';
import {
  canAdjudicate,
  manualPlacement,
  manualPhaseEnd,
  newManualRuling,
} from '../../src/domain/manual-adjudication';
import type { ManualRuling } from '../../src/domain/manual-adjudication-schema';
import { waterlooCampaignSchema } from '../../src/domain/waterloo-schema';
import type { WaterlooCampaign } from '../../src/domain/waterloo-schema';
import { waterlooBriefHtml } from '../../src/domain/waterloo-brief';
import { defaultSimultaneousSiegePolicy } from '../../src/domain/simultaneous-siege';
import {
  simultaneousStep as step,
  operationalNow as now,
  unitBattleCampaign,
  applyUnitBattle,
  unitBattleResult,
} from '../fixtures/simultaneous-aftermath';

const uuid = () => crypto.randomUUID();
const seed = () => seedFontenoyOperational('Manual umpire', uuid, now);
function ruling(c: WaterlooCampaign): ManualRuling {
  const r = newManualRuling(c, c.corps[0]!.id);
  r.placements[0]!.hexId = c.hexes.at(-1)!.id;
  r.decision = 'Players agreed a march across open ground.';
  return r;
}
const act = (c: WaterlooCampaign, r = ruling(c)) =>
  step(c, { kind: 'manual-adjudication', ruling: r });

it('bypasses path/terrain calculations, records exact changes and keeps source, roster and policy state unchanged', () => {
  const c = seed();
  c.hexes.at(-1)!.terrain = 'water';
  const before = structuredClone(c),
    r = ruling(c);
  r.placements[0]!.reportedStrength = 'Approximately 2,000 men';
  r.endAt += 60;
  const result = act(c, r);
  expect(c).toEqual(before);
  expect(result.corps[0]).toMatchObject({
    hexId: c.hexes.at(-1)!.id,
    reportedStrength: 'Approximately 2,000 men',
    availableAt: r.endAt,
  });
  expect(result.cursor).toBe(c.cursor + 60);
  expect(result.effectSerial).toBe(c.effectSerial + 1);
  expect(result.fontenoy).toEqual(c.fontenoy);
  expect(result.battles).toEqual([]);
  expect(result.encounters).toEqual([]);
  expect(result.adjudications![0]).toMatchObject({
    before: [manualPlacement(c.corps[0]!)],
    after: [r.placements[0]],
    ruling: r,
    fromAt: c.cursor,
  });
});

it('allows atomic swaps and rejects collisions, invalid references, posture, duplicates and unexplained/no-op edits', () => {
  const c = seed(),
    r = ruling(c);
  r.placements[0]!.hexId = c.corps[1]!.hexId;
  expect(() => act(c, r)).toThrow('stack');
  r.placements.push({
    ...manualPlacement(c.corps[1]!),
    hexId: c.corps[0]!.hexId,
  });
  expect(act(c, r).corps[1]!.hexId).toBe(c.corps[0]!.hexId);
  for (const edit of [
    (r: ManualRuling) => {
      r.placements[0]!.hexId = 'not-a-hex';
    },
    (r: ManualRuling) => {
      r.placements[0]!.corpsId = uuid();
    },
    (r: ManualRuling) => {
      r.placements.push(r.placements[0]!);
    },
    (r: ManualRuling) => {
      r.placements[0]!.formation = 'exhausted';
    },
    (r: ManualRuling) => {
      r.decision = ' ';
    },
  ]) {
    const bad = ruling(c);
    edit(bad);
    expect(() => act(c, bad)).toThrow();
  }
  expect(() =>
    act(c, { ...newManualRuling(c), decision: 'No actual changes.' }),
  ).toThrow('Choose a map');
});

it('protects saved/locked orders, battles, preparation submissions, siege review, archive and concluded games', () => {
  const c = seed();
  const locked = step(c, {
    kind: 'orders',
    side: 'french',
    orders: [],
    lock: true,
  });
  expect(canAdjudicate(locked)).toBe(false);
  expect(() => act(locked)).toThrow('clear planning');
  expect(() => act(unitBattleCampaign())).toThrow();
  const preparation = step(c, { kind: 'enable-preparation' });
  preparation.preparation!.submissions[0]!.locked = true;
  expect(() => act(preparation)).toThrow('preparation');
  expect(() => act({ ...c, status: 'archived' })).toThrow('Archived');
  const sieged = step(c, {
    kind: 'maurice-siege-policy',
    policy: defaultSimultaneousSiegePolicy(c),
  });
  const r = ruling(sieged);
  r.finishPhase = true;
  r.endAt = manualPhaseEnd(c.turn);
  const checkpoint = act(sieged, r);
  expect(checkpoint.fontenoy!.siege.progress).toBe(
    sieged.fontenoy!.siege.progress,
  );
  expect(checkpoint.fontenoy!.siege.campaign!.victory).toBeNull();
  expect(() => step(checkpoint, { kind: 'finalize' })).toThrow();
});

it('advances manually to a checkpoint without automated effects, waives empty preparation and resumes rules-assisted turns', () => {
  const c = step(seed(), { kind: 'enable-preparation' }),
    r = ruling(c);
  r.finishPhase = true;
  r.endAt = manualPhaseEnd(c.turn);
  const checkpoint = act(c, r);
  expect(checkpoint.phase).toBe('checkpoint');
  expect(checkpoint.preparation!.resolved).toBe(true);
  expect(checkpoint.preparation!.submissions.every((s) => s.locked)).toBe(true);
  const next = step(checkpoint, { kind: 'finalize' });
  expect(next.turn).toBe(2);
  expect(next.phase).toBe('planning');
  expect(next.corps[0]!.hexId).toBe(r.placements[0]!.hexId);
  expect(next.adjudications).toEqual(checkpoint.adjudications);
  expect(next.preparation!.resolved).toBe(false);
});

it('rejects backward, out-of-phase and non-five-minute clocks and preserves fixed checkpoint time', () => {
  const c = seed();
  for (const r of [
    { ...ruling(c), endAt: c.cursor - 5 },
    { ...ruling(c), endAt: c.cursor + 1 },
    { ...ruling(c), endAt: manualPhaseEnd(c.turn) + 5 },
    { ...ruling(c), finishPhase: true },
  ])
    expect(() => act(c, r)).toThrow();
  const r = ruling(c);
  r.finishPhase = true;
  r.endAt = manualPhaseEnd(c.turn);
  const checkpoint = act(c, r),
    edit = ruling(checkpoint);
  edit.placements[0]!.reportedStrength = 'Reviewed at checkpoint';
  expect(() => act(checkpoint, edit)).not.toThrow();
  expect(() =>
    act(checkpoint, { ...edit, endAt: checkpoint.cursor + 5 }),
  ).toThrow('checkpoint');
});

it('records existing unit losses and restorations while conserving identities and requiring coherent formation status', () => {
  const c = seed(),
    f = c.corps[0]!,
    link = c.fontenoy!.formations.find((p) => p.corpsId === f.id)!;
  const r = ruling(c);
  r.units = link.unitIds.map((unitId) => ({ unitId, status: 'lost' }));
  expect(() => act(c, r)).toThrow('every unit lost');
  r.placements[0]!.status = 'eliminated';
  r.placements[0]!.hexId = null;
  const lost = act(c, r);
  expect(lost.fontenoy!.units.map((u) => u.id)).toEqual(
    c.fontenoy!.units.map((u) => u.id),
  );
  const restore = ruling(lost);
  restore.placements[0]!.status = 'ready';
  restore.units = [{ unitId: link.unitIds[0]!, status: 'ready' }];
  const restored = act(lost, restore);
  expect(
    restored.fontenoy!.units.filter((u) => u.currentStatus === 'lost'),
  ).toHaveLength(link.unitIds.length - 1);
  expect(restored.corps[0]!.status).toBe('ready');
});

it('keeps scheduled recoveries and frozen battle evidence intact and prevents dependent result rewrites', () => {
  const c = applyUnitBattle(unitBattleCampaign());
  const r = ruling(c),
    recovering = c.fontenoy!.units.find(
      (u) => u.currentStatus === 'recovering',
    )!;
  r.units = [{ unitId: recovering.id, status: 'ready' }];
  expect(() => act(c, r)).toThrow('Scheduled unit recoveries');
  r.units = [];
  const after = act(c, r);
  expect(after.battles).toEqual(c.battles);
  expect(after.fontenoy!.aftermath).toEqual(c.fontenoy!.aftermath);
  expect(() =>
    step(after, {
      kind: 'result',
      battleId: c.battles[0]!.id,
      result: unitBattleResult(c),
      reason: 'Rewrite after manual ruling.',
    }),
  ).toThrow();
});

it('moves headquarters, keeps corrections append-only and starts clones without live strength or ruling history', () => {
  const c = seed(),
    r = ruling(c);
  r.hqs = [{ hqId: c.hqs[0]!.id, hexId: c.hexes.at(-1)!.id }];
  r.placements[0]!.reportedStrength = 'Private campaign estimate';
  const first = act(c, r),
    correction = ruling(first);
  correction.placements[0]!.hexId = c.corps[0]!.hexId;
  correction.correctsId = first.adjudications![0]!.id;
  correction.decision = 'Correct the destination using a new ruling.';
  const second = act(first, correction);
  expect(second.adjudications![0]).toEqual(first.adjudications![0]);
  expect(second.adjudications![1]!.ruling.correctsId).toBe(
    first.adjudications![0]!.id,
  );
  expect(() => act(second, { ...correction, correctsId: uuid() })).toThrow(
    'existing ruling',
  );
  const clone = cloneFontenoyOperational(second, 'Fresh map', uuid, now);
  expect(clone.adjudications).toBeUndefined();
  expect(clone.corps[0]!.reportedStrength).toBeUndefined();
});

it('rejects altered ruling chronology, snapshots, duplicate record identities and dangling correction references', () => {
  const c = act(seed());
  for (const edit of [
    (c: WaterlooCampaign) => {
      c.adjudications![0]!.ruling.correctsId = uuid();
    },
    (c: WaterlooCampaign) => {
      c.adjudications![0]!.after[0]!.hexId = 'unknown';
    },
    (c: WaterlooCampaign) => {
      c.adjudications![0]!.effectSerial = c.effectSerial + 1;
    },
    (c: WaterlooCampaign) => {
      c.adjudications!.push(c.adjudications![0]!);
    },
    (c: WaterlooCampaign) => {
      c.adjudications![0]!.unitsBefore.push({ unitId: uuid(), status: 'lost' });
    },
    (c: WaterlooCampaign) => {
      c.adjudications![0]!.fromAt = c.cursor + 5;
    },
  ]) {
    const copy = structuredClone(c);
    edit(copy);
    expect(waterlooCampaignSchema.safeParse(copy).success).toBe(false);
  }
});

it('includes the frozen umpire strength estimate in a battle brief with HTML escaping', () => {
  const c = unitBattleCampaign();
  c.battles[0]!.initial[0]!.reportedStrength = 'About <2,000> men';
  expect(waterlooBriefHtml(c, c.battles[0]!)).toContain(
    'About &lt;2,000&gt; men',
  );
});
