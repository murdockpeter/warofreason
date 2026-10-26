import { expect, it } from 'vitest';
import {
  seedFontenoyOperational,
  cloneFontenoyOperational,
} from '../../src/domain/fontenoy-operational';
import { seedWaterloo } from '../../src/domain/waterloo';
import { waterlooCampaignSchema } from '../../src/domain/waterloo-schema';
import {
  defaultSimultaneousSiegePolicy,
  defaultSiegeReview,
  previewSiegeCheckpoint,
} from '../../src/domain/simultaneous-siege';
import type { WaterlooCampaign } from '../../src/domain/waterloo-schema';
import {
  simultaneousStep as step,
  operationalNow as now,
  unitBattleCampaign,
  applyUnitBattle,
  emptySharedPhase,
} from '../fixtures/simultaneous-aftermath';
const uuid = () => crypto.randomUUID();
function seed() {
  return seedFontenoyOperational('Siege test', uuid, now);
}
function enable(c = seed(), hours = 48, threshold = 6) {
  const policy = defaultSimultaneousSiegePolicy(c);
  policy.minutesPerSiegeTurn = hours * 60;
  policy.rules.siegeThreshold = threshold;
  return step(c, { kind: 'maurice-siege-policy', policy });
}
function checkpoint(c: WaterlooCampaign) {
  for (const side of ['french', 'allied'] as const)
    c = step(c, { kind: 'orders', side, orders: [], lock: true });
  return step(c, { kind: 'resolve' });
}
function review(c: WaterlooCampaign, supplied = true) {
  const review = defaultSiegeReview(c);
  review.conditions = { invested: true, supplied, relieved: false };
  review.notes =
    'Both players confirm conditions for the whole displayed interval.';
  return step(c, { kind: 'maurice-siege-review', review });
}
function finish(c: WaterlooCampaign, supplied = true) {
  return step(review(checkpoint(c), supplied), { kind: 'finalize' });
}

it('enables prospectively without crediting source progress, inferred supply or past calendar time', () => {
  const c = seed();
  c.fontenoy!.siege.progress = 3;
  const old = structuredClone(c);
  const enabled = enable(c);
  expect(c).toEqual(old);
  expect(enabled.fontenoy!.siege.progress).toBe(3);
  expect(enabled.fontenoy!.siege.campaign).toMatchObject({
    enabledAt: 360,
    lastCheckpointAt: 360,
    eligibleMinutes: 0,
    pendingReview: null,
    checkpoints: [],
    victory: null,
  });
  expect(defaultSimultaneousSiegePolicy(c)).toMatchObject({
    minutesPerSiegeTurn: 2880,
    deadlineAt: 31680,
  });
  expect(defaultSiegeReview(c).conditions.supplied).toBe(false);
});
it('leaves pre-policy campaigns compatible and rejects siege commands in other scenarios', () => {
  const c = step(checkpoint(seed()), { kind: 'finalize' });
  expect(c.fontenoy!.siege.campaign).toBeUndefined();
  expect(() =>
    step(seedWaterloo('Reference', uuid, now), {
      kind: 'maurice-siege-policy',
      policy: defaultSimultaneousSiegePolicy(seed()),
    }),
  ).toThrow('Fontenoy');
});
it('requires clear planning for policies and fully settled checkpoints for condition reviews', () => {
  const c = checkpoint(enable());
  expect(() =>
    step(c, {
      kind: 'maurice-siege-policy',
      policy: defaultSimultaneousSiegePolicy(c),
    }),
  ).toThrow('clear planning');
  const planning = enable();
  expect(() => review(planning)).toThrow('Finish all movement');
  expect(() => review(unitBattleCampaign())).toThrow('Finish all movement');
});
it('requires current explained review and applies neither progress nor victory before finalization', () => {
  const c = checkpoint(enable(seed(), 1, 1));
  expect(() => step(c, { kind: 'finalize' })).toThrow('Review Tournai');
  const reviewed = review(c);
  expect(reviewed.fontenoy!.siege.progress).toBe(0);
  expect(reviewed.fontenoy!.siege.campaign!.victory).toBeNull();
  expect(
    previewSiegeCheckpoint(
      reviewed,
      reviewed.fontenoy!.siege.campaign!.pendingReview!,
    ),
  ).toMatchObject({ progressAfter: 6, victory: { winner: 'french' } });
  const blank = defaultSiegeReview(c);
  expect(() =>
    step(c, { kind: 'maurice-siege-review', review: blank }),
  ).toThrow();
  expect(() => step(reviewed, { kind: 'finalize' })).not.toThrow();
});
it('accumulates source-cadence calendar hours across AM/PM and explicitly attested overnight intervals', () => {
  let c = enable();
  for (let i = 0; i < 4; i++) c = finish(c);
  expect(c.fontenoy!.siege).toMatchObject({
    progress: 0,
    campaign: { eligibleMinutes: 2160 },
  });
  c = finish(c);
  expect(c.fontenoy!.siege).toMatchObject({
    progress: 1,
    campaign: { eligibleMinutes: 360 },
  });
  expect(c.fontenoy!.siege.campaign!.checkpoints[2]).toMatchObject({
    fromAt: 1080,
    at: 2160,
  });
  expect(() => step(c, { kind: 'finalize' })).toThrow('Finish all movement');
});
it('pauses unsupplied investment, retains prior partial eligible time and never infers relief from map positions', () => {
  let c = enable(seed(), 12);
  c = finish(c);
  c = finish(c, false);
  expect(c.fontenoy!.siege).toMatchObject({
    progress: 0,
    campaign: { eligibleMinutes: 360 },
  });
  c = finish(c);
  expect(c.fontenoy!.siege).toMatchObject({
    progress: 2,
    campaign: { eligibleMinutes: 0, victory: null },
  });
});
it('uninvested supplied intervals earn no progress', () => {
  let c = checkpoint(enable(seed(), 1));
  const r = defaultSiegeReview(c);
  r.conditions = { invested: false, supplied: true, relieved: false };
  r.notes = 'No investment exists.';
  c = step(step(c, { kind: 'maurice-siege-review', review: r }), {
    kind: 'finalize',
  });
  expect(c.fontenoy!.siege.progress).toBe(0);
});
it('confirmed relief stops accrual and wins only when the reviewed checkpoint is finalized', () => {
  let c = review(checkpoint(enable(seed(), 1)));
  const r = { ...c.fontenoy!.siege.campaign!.pendingReview! };
  r.conditions.relieved = true;
  c = step(c, {
    kind: 'maurice-siege-review',
    review: {
      conditions: r.conditions,
      exhaustion: r.exhaustion,
      notes: 'Relief confirmed by both players.',
    },
  });
  c = step(c, { kind: 'finalize' });
  expect(c.fontenoy!.siege).toMatchObject({
    progress: 0,
    status: 'relieved',
    campaign: { victory: { winner: 'allied' } },
  });
});
it.each(['french', 'allied', 'draw'] as const)(
  'uses %s conflict policy for concurrent siege/exhaustion at the deadline',
  (winner) => {
    const policy = defaultSimultaneousSiegePolicy(seed());
    policy.minutesPerSiegeTurn = 360;
    policy.deadlineAt = 720;
    policy.rules.siegeThreshold = 1;
    policy.rules.conflictOutcome = winner;
    let c = step(seed(), { kind: 'maurice-siege-policy', policy });
    c = checkpoint(c);
    const r = defaultSiegeReview(c);
    r.conditions = { invested: true, supplied: true, relieved: false };
    r.exhaustion.french = 10;
    r.notes = 'Independent exhaustion and siege conditions both verified.';
    c = step(step(c, { kind: 'maurice-siege-review', review: r }), {
      kind: 'finalize',
    });
    expect(c.fontenoy!.siege.campaign!.victory).toMatchObject({ winner });
    expect(c.fontenoy!.siege.campaign!.victory!.reasons).toHaveLength(3);
  },
);
it('uses deadline fallback only when no explicit condition wins, at the completed checkpoint clock', () => {
  const policy = defaultSimultaneousSiegePolicy(seed());
  policy.deadlineAt = 1080;
  policy.rules.deadlineOutcome = 'draw';
  let c = step(seed(), { kind: 'maurice-siege-policy', policy });
  c = finish(c, false);
  expect(c.fontenoy!.siege.campaign!.victory).toBeNull();
  c = finish(c, false);
  expect(c.fontenoy!.siege.campaign!.victory).toMatchObject({
    winner: 'draw',
    at: 1080,
    turn: 2,
  });
});
it('does not equate battle morale or loss counts to operational exhaustion', () => {
  const c = finish(enable(seed(), 48), false);
  expect(c.fontenoy!.siege.campaign!.checkpoints[0]!.review.exhaustion).toEqual(
    { french: 0, allied: 0 },
  );
  const p = defaultSimultaneousSiegePolicy(c);
  p.rules.exhaustionThreshold = null;
  let d = step(c, { kind: 'maurice-siege-policy', policy: p });
  d = checkpoint(d);
  const r = defaultSiegeReview(d);
  r.exhaustion = { french: 100, allied: 100 };
  r.notes = 'Threshold disabled.';
  d = step(step(d, { kind: 'maurice-siege-review', review: r }), {
    kind: 'finalize',
  });
  expect(d.fontenoy!.siege.campaign!.victory).toBeNull();
});
it('preserves recorded rules and explanations when prospective policies change', () => {
  const c = finish(enable());
  const before = structuredClone(c.fontenoy!.siege.campaign!.checkpoints);
  const policy = defaultSimultaneousSiegePolicy(c);
  policy.rules.siegeThreshold = 9;
  const d = step(c, { kind: 'maurice-siege-policy', policy });
  expect(d.fontenoy!.siege.campaign!.checkpoints).toEqual(before);
  policy.minutesPerSiegeTurn = 60;
  expect(() => step(d, { kind: 'maurice-siege-policy', policy })).toThrow(
    'carried forward',
  );
  policy.deadlineAt = d.cursor;
  expect(() => step(d, { kind: 'maurice-siege-policy', policy })).toThrow(
    'after the current',
  );
});
it('freezes concluded campaigns and clones a fresh unconfigured siege without changing history', () => {
  const c = finish(enable(seed(), 1, 1));
  const old = structuredClone(c);
  expect(() => step(c, { kind: 'finalize' })).toThrow('concluded');
  expect(() => step(c, { kind: 'reset-orders' })).toThrow('concluded');
  const d = cloneFontenoyOperational(c, 'New opening', uuid, now);
  expect(d.fontenoy!.siege).toMatchObject({
    progress: 0,
    status: 'not_started',
  });
  expect(d.fontenoy!.siege.campaign).toBeUndefined();
  expect(c).toEqual(old);
});
it('rejects tampered checkpoint summaries, conditions, clock, review and outcome metadata', () => {
  const c = finish(enable());
  for (const tamper of [
    (d: WaterlooCampaign) => {
      d.fontenoy!.siege.progress++;
    },
    (d: WaterlooCampaign) => {
      d.fontenoy!.siege.campaign!.checkpoints[0]!.fromAt++;
    },
    (d: WaterlooCampaign) => {
      d.fontenoy!.siege.campaign!.checkpoints[0]!.review.conditions.supplied = false;
    },
    (d: WaterlooCampaign) => {
      d.fontenoy!.siege.campaign!.eligibleMinutes++;
    },
    (d: WaterlooCampaign) => {
      d.fontenoy!.siege.campaign!.pendingReview = {
        ...defaultSiegeReview(d),
        notes: 'Wrong phase',
        turn: d.turn,
        at: d.cursor,
      };
    },
  ]) {
    const d = structuredClone(c);
    tamper(d);
    expect(waterlooCampaignSchema.safeParse(d).success).toBe(false);
  }
  const ended = finish(enable(seed(), 1, 1));
  ended.fontenoy!.siege.campaign!.victory!.winner = 'allied';
  expect(waterlooCampaignSchema.safeParse(ended).success).toBe(false);
});

it('processes due unit recovery in the same concluding checkpoint without opening another phase', () => {
  let c = step(applyUnitBattle(unitBattleCampaign()), { kind: 'finalize' });
  while (c.cursor < 3240) c = emptySharedPhase(c);
  expect(c.fontenoy!.units[0]!.currentStatus).toBe('recovering');
  const turn = c.turn;
  c = finish(enable(c, 1, 1));
  expect(c.turn).toBe(turn);
  expect(c.phase).toBe('checkpoint');
  expect(c.fontenoy!.siege.campaign!.victory?.winner).toBe('french');
  expect(c.fontenoy!.units[0]!.currentStatus).toBe('ready');
  expect(c.fontenoy!.aftermath!.recoveries[0]!.recoveredAt).toBe(c.cursor);
});
it('bounds the agreed deadline to the supported 100-phase window', () => {
  const c = seed();
  c.fontenoy!.sourceSchedule.turnCount = 100;
  expect(defaultSimultaneousSiegePolicy(c).deadlineAt).toBe(71640);
  const policy = defaultSimultaneousSiegePolicy(c);
  policy.deadlineAt++;
  expect(() => step(c, { kind: 'maurice-siege-policy', policy })).toThrow();
});
