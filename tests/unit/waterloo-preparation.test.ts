// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  applyWaterlooCommand,
  firstMovementAt,
  seedWaterloo,
  estimateReinforcement,
} from '../../src/domain/waterloo';
import type {
  WaterlooCampaign as Campaign,
  WaterlooCommand,
  WithdrawalOrder,
} from '../../src/domain/waterloo-schema';
import { waterlooCampaignSchema } from '../../src/domain/waterloo-schema';
const now = '2026-10-25T12:00:00.000Z';
const act = (c: Campaign, command: WaterlooCommand) =>
  applyWaterlooCommand(c, { command, recordId: randomUUID(), timestamp: now });
const seed = () =>
  act(seedWaterloo('Preparation', randomUUID, now), {
    kind: 'enable-preparation',
  });
function withdrawal(
  c: Campaign,
  index: number,
  enemy: number,
  path: string[],
  priority = index,
): WithdrawalOrder {
  return {
    corpsId: c.corps[index]!.id,
    enemyId: c.corps[enemy]!.id,
    path,
    priority,
  };
}
function resolve(
  c: Campaign,
  french: WithdrawalOrder[] = [],
  allied: WithdrawalOrder[] = [],
) {
  c = act(c, {
    kind: 'withdrawals',
    side: 'french',
    orders: french,
    lock: true,
  });
  c = act(c, {
    kind: 'withdrawals',
    side: 'allied',
    orders: allied,
    lock: true,
  });
  return act(c, { kind: 'resolve-withdrawals' });
}
describe('ordinary detachments and simultaneous withdrawals', () => {
  it('allows the empty road-adjacent HQ fallback only when its army has no on-map units', () => {
    let c = seed();
    for (const f of c.corps.filter(
      (f) => f.kind !== 'detachment' && f.side === 'french',
    )) {
      f.status = 'blown';
      f.hexId = null;
      f.returnSlot = 3;
    }
    c = act(c, {
      kind: 'place-hqs',
      placements: [{ hqId: c.hqs[0]!.id, hexId: '8,4', mode: 'normal' }],
    });
    expect(c.hqs[0]!.hexId).toBe('8,4');
    expect(() =>
      act(c, {
        kind: 'place-hqs',
        placements: [{ hqId: c.hqs[0]!.id, hexId: '9,4', mode: 'normal' }],
      }),
    ).toThrow('HQ placement');
    const ordinary = seed();
    expect(() =>
      act(ordinary, {
        kind: 'place-hqs',
        placements: [
          { hqId: ordinary.hqs[0]!.id, hexId: '8,4', mode: 'normal' },
        ],
      }),
    ).toThrow('HQ placement');
  });
  it('accepts a trapped withdrawal as blown but rejects the same choice when a legal retreat exists', () => {
    const open = seed();
    open.corps[0]!.hexId = '5,4';
    open.corps[2]!.hexId = '6,4';
    const make = (c: Campaign): WithdrawalOrder => ({
      corpsId: c.corps[0]!.id,
      enemyId: c.corps[2]!.id,
      path: ['5,4'],
      priority: 0,
      blocked: true,
    });
    expect(() => resolve(open, [make(open)])).toThrow('legal retreat exists');
    const trapped = structuredClone(open);
    for (const h of trapped.hexes)
      if (['4,4', '5,3', '6,3', '4,5', '5,5'].includes(h.id))
        h.terrain = 'water';
    const result = resolve(trapped, [make(trapped)]);
    expect(result.corps[0]!.status).toBe('blown');
    expect(result.corps[0]!.returnSlot).toBe(3);
    expect(result.cursor).toBe(420);
  });
  it('permits a retreat through a friendly screen and freezes HQ placement after deployment', () => {
    let c = seed();
    const id = c.corps[4]!.id;
    c = act(c, {
      kind: 'deploy-detachment',
      corpsId: id,
      hqId: c.hqs[0]!.id,
      hexId: '0,0',
      source: 'hq',
    });
    expect(() =>
      act(c, {
        kind: 'place-hqs',
        placements: [{ hqId: c.hqs[0]!.id, hexId: '2,3', mode: 'normal' }],
      }),
    ).toThrow('before detachment');
    c.corps[0]!.hexId = '5,4';
    c.corps[2]!.hexId = '6,4';
    c.corps.find((f) => f.id === id)!.hexId = '3,4';
    c = resolve(c, [withdrawal(c, 0, 2, ['5,4', '4,4', '3,4', '2,4'])]);
    expect(c.corps[0]!.hexId).toBe('2,4');
    expect(c.corps.find((f) => f.id === id)!.hexId).toBe('3,4');
  });
  it('doubles only Normal HQ road tracing and respects an unbridged major river', () => {
    let c = seed();
    c.hqs[0]!.normalRange = 2;
    c.hqs[0]!.battleRange = 2;
    const id = c.corps[4]!.id;
    const deployed = act(c, {
      kind: 'deploy-detachment',
      corpsId: id,
      hqId: c.hqs[0]!.id,
      hexId: '6,4',
      source: 'hq',
    });
    expect(deployed.corps.find((f) => f.id === id)!.hexId).toBe('6,4');
    c.hqs[0]!.mode = 'battle';
    expect(() =>
      act(c, {
        kind: 'deploy-detachment',
        corpsId: id,
        hqId: c.hqs[0]!.id,
        hexId: '6,4',
        source: 'hq',
      }),
    ).toThrow('trace');
    c = act(c, {
      kind: 'deploy-detachment',
      corpsId: id,
      hqId: c.hqs[0]!.id,
      hexId: '6,4',
      source: 'parent',
    });
    expect(c.corps.find((f) => f.id === id)!.status).toBe('ready');
    const blocked = seed();
    blocked.hqs[0]!.normalRange = 2;
    blocked.edges.find((e) => e.from === '5,4' && e.to === '6,4')!.crossing =
      'major';
    expect(() =>
      act(blocked, {
        kind: 'deploy-detachment',
        corpsId: blocked.corps[4]!.id,
        hqId: blocked.hqs[0]!.id,
        hexId: '6,4',
        source: 'hq',
      }),
    ).toThrow('trace');
  });
  it('reviews a stacked screen separately and applies a manually recalled detachment without corps losses', () => {
    let c = seed();
    c.corps[0]!.hexId = '5,4';
    c.corps[2]!.hexId = '6,4';
    const d = c.corps[4]!;
    d.status = 'ready';
    d.hexId = '5,4';
    d.detachment!.deployedByHqId = c.hqs[0]!.id;
    c = resolve(c);
    c = act(c, { kind: 'orders', side: 'french', orders: [], lock: true });
    c = act(c, { kind: 'orders', side: 'allied', orders: [], lock: true });
    c.encounters.push({
      id: 'review-screen',
      at: c.cursor,
      hexId: '6,4',
      corpsIds: [c.corps[0]!.id, c.corps[2]!.id, d.id],
      reason: 'Screen contact fixture',
      settled: false,
      battleId: null,
    });
    c = act(c, {
      kind: 'declare-battle',
      encounterId: 'review-screen',
      title: 'Screen battle',
    });
    const b = c.battles[0]!;
    const result = {
      game: 'Any game',
      outcome: 'Agreed retreat',
      endAt: c.cursor + 60,
      notes: 'Screen recalled after defending.',
      effects: b.initial.map((f) => ({
        corpsId: f.id,
        disposition:
          f.id === d.id ? ('recalled' as const) : ('retained' as const),
        hexId: f.id === d.id ? null : f.hexId,
        exhausted: false,
        arrivalAt: null,
      })),
    };
    c = act(c, {
      kind: 'result',
      battleId: b.id,
      result,
      reason: 'Manual tactical review.',
    });
    c = act(c, { kind: 'approve-result', battleId: b.id });
    c = act(c, { kind: 'resolve' });
    expect(c.corps.find((f) => f.id === d.id)!.status).toBe('reserve');
    expect(
      c.corps.find((f) => f.id === d.id)!.detachment!.availableFromTurn,
    ).toBe(2);
    expect(c.corps[0]!.status).toBe('ready');
    expect(c.corps[0]!.hexId).toBe('5,4');
    expect(
      c.battles[0]!.baseline.find((f) => f.id === d.id)!.detachment!
        .deployedByHqId,
    ).toBe(c.hqs[0]!.id);
    const corrected = structuredClone(result);
    const screenEffect = corrected.effects.find((f) => f.corpsId === d.id)!;
    screenEffect.disposition = 'retained';
    screenEffect.hexId = '5,4';
    c = act(c, {
      kind: 'result',
      battleId: b.id,
      result: corrected,
      reason: 'Corrected screen disposition.',
    });
    expect(c.corps.find((f) => f.id === d.id)!.detachment!.deployedByHqId).toBe(
      c.hqs[0]!.id,
    );
    expect(
      c.corps.find((f) => f.id === d.id)!.detachment!.availableFromTurn,
    ).toBe(1);
    expect(c.battles[0]!.results).toHaveLength(2);
  });
  it('preserves the organization-before-withdrawal formation of a holding infantry corps', () => {
    let c = seed();
    c.corps[0]!.hexId = '5,4';
    c.corps[2]!.hexId = '6,4';
    c = resolve(c, [], [withdrawal(c, 2, 0, ['6,4', '7,4', '8,4', '9,4'])]);
    expect(c.corps[0]!.formation).toBe('battle');
    expect(c.corps[0]!.hexId).toBe('5,4');
  });
  it('permits recall/redeployment on the following phase and retains HQ deployment when a parent is lost', () => {
    let c = seed();
    const det = c.corps[4]!;
    c = act(c, {
      kind: 'deploy-detachment',
      corpsId: det.id,
      hqId: c.hqs[0]!.id,
      hexId: '0,0',
      source: 'hq',
    });
    c = act(c, { kind: 'recall-detachment', corpsId: det.id });
    c = resolve(c);
    c = act(c, { kind: 'orders', side: 'french', orders: [], lock: true });
    c = act(c, { kind: 'orders', side: 'allied', orders: [], lock: true });
    c = act(c, { kind: 'resolve' });
    c = act(c, { kind: 'finalize' });
    c.corps[0]!.status = 'eliminated';
    c.corps[0]!.hexId = null;
    c = act(c, {
      kind: 'deploy-detachment',
      corpsId: det.id,
      hqId: c.hqs[0]!.id,
      hexId: '0,0',
      source: 'hq',
    });
    expect(c.corps.find((f) => f.id === det.id)!.status).toBe('ready');
  });
  it('enables explicitly without altering the old profile or adding tactical roster copies', () => {
    const old = seedWaterloo('Old', randomUUID, now);
    expect(old.preparation).toBeUndefined();
    const c = act(old, { kind: 'enable-preparation' });
    expect(old.corps).toHaveLength(4);
    expect(c.corps).toHaveLength(8);
    expect(c.corps.slice(0, 4)).toEqual(old.corps);
    expect(
      c.corps
        .slice(4)
        .every(
          (f) => f.status === 'reserve' && f.hexId === null && f.detachment,
        ),
    ).toBe(true);
    expect(waterlooCampaignSchema.safeParse(c).success).toBe(true);
    expect(() => act(c, { kind: 'enable-preparation' })).toThrow('already');
  });
  it('places one associated detachment per HQ and makes recall unavailable until next phase', () => {
    let c = seed();
    const screens = c.corps.filter(
      (f) => f.kind === 'detachment' && f.side === 'french',
    );
    c = act(c, {
      kind: 'deploy-detachment',
      corpsId: screens[0]!.id,
      hqId: c.hqs[0]!.id,
      hexId: '0,0',
      source: 'hq',
    });
    expect(c.corps.find((f) => f.id === screens[0]!.id)!.hexId).toBe('0,0');
    expect(() =>
      act(c, {
        kind: 'deploy-detachment',
        corpsId: screens[1]!.id,
        hqId: c.hqs[0]!.id,
        hexId: '0,1',
        source: 'hq',
      }),
    ).toThrow('already placed');
    c.corps[2]!.hexId = '0,1';
    c = act(c, { kind: 'recall-detachment', corpsId: screens[0]!.id });
    const f = c.corps.find((f) => f.id === screens[0]!.id)!;
    expect(f.status).toBe('reserve');
    expect(f.detachment!.availableFromTurn).toBe(2);
    expect(() =>
      act(c, {
        kind: 'deploy-detachment',
        corpsId: f.id,
        hqId: c.hqs[0]!.id,
        hexId: '0,0',
        source: 'hq',
      }),
    ).toThrow('available reserve');
  });
  it('rejects friendly influence, cross-army HQs, blocked traces and stationary detachment movement', () => {
    const c = seed(),
      d = c.corps[4]!;
    expect(() =>
      act(c, {
        kind: 'deploy-detachment',
        corpsId: d.id,
        hqId: c.hqs[0]!.id,
        hexId: '4,4',
        source: 'hq',
      }),
    ).toThrow('outside all');
    expect(() =>
      act(c, {
        kind: 'deploy-detachment',
        corpsId: d.id,
        hqId: c.hqs[1]!.id,
        hexId: '0,0',
        source: 'hq',
      }),
    ).toThrow('associated');
    expect(() =>
      act(c, {
        kind: 'deploy-detachment',
        corpsId: d.id,
        hqId: c.hqs[0]!.id,
        hexId: '0,0',
        source: 'parent',
      }),
    ).toThrow('trace');
    const ready = resolve(c);
    expect(() =>
      act(ready, {
        kind: 'orders',
        side: 'french',
        orders: [
          {
            corpsId: d.id,
            priority: 0,
            segments: [
              {
                path: ['0,0', '1,0'],
                roadOnly: false,
                hqId: c.hqs[0]!.id,
                startAt: 390,
              },
            ],
          },
        ],
        lock: false,
      }),
    ).toThrow('available friendly');
  });
  it('requires independent withdrawal locks before movement and preserves one lock without movement', () => {
    let c = seed();
    expect(() =>
      act(c, { kind: 'orders', side: 'french', orders: [], lock: true }),
    ).toThrow('withdrawals');
    c = act(c, { kind: 'withdrawals', side: 'french', orders: [], lock: true });
    expect(c.cursor).toBe(360);
    expect(c.corps[0]!.hexId).toBe('3,4');
    expect(() => act(c, { kind: 'resolve-withdrawals' })).toThrow('Both sides');
    expect(() =>
      act(c, {
        kind: 'place-hqs',
        placements: [{ hqId: c.hqs[0]!.id, hexId: '2,4', mode: 'normal' }],
      }),
    ).toThrow('before withdrawal');
    c = act(c, { kind: 'reset-withdrawals' });
    expect(c.preparation!.submissions.every((s) => !s.locked)).toBe(true);
    c = resolve(c);
    expect(c.cursor).toBe(360);
    expect(firstMovementAt(c)).toBe(390);
    expect(() => act(c, { kind: 'resolve-withdrawals' })).toThrow('already');
  });
  it('resolves both retreats together, credits concurrent preparation and prevents a second march', () => {
    let c = seed();
    c.corps[0]!.hexId = '5,4';
    c.corps[2]!.hexId = '6,4';
    c = resolve(
      c,
      [withdrawal(c, 0, 2, ['5,4', '4,4', '3,4', '2,4'])],
      [withdrawal(c, 2, 0, ['6,4', '7,4', '8,4', '9,4'])],
    );
    expect(c.corps[0]!.hexId).toBe('2,4');
    expect(c.corps[2]!.hexId).toBe('9,4');
    expect(c.cursor).toBe(420);
    expect(firstMovementAt(c)).toBe(420);
    expect(() =>
      act(c, {
        kind: 'orders',
        side: 'french',
        orders: [
          {
            corpsId: c.corps[0]!.id,
            priority: 0,
            segments: [
              {
                path: ['2,4', '3,4'],
                roadOnly: true,
                startAt: 420,
                hqId: c.hqs[0]!.id,
              },
            ],
          },
        ],
        lock: false,
      }),
    ).toThrow('available friendly');
    c = act(c, {
      kind: 'orders',
      side: 'french',
      orders: [
        {
          corpsId: c.corps[1]!.id,
          priority: 0,
          segments: [
            {
              path: ['1,6', '2,6'],
              roadOnly: false,
              startAt: 420,
              hqId: c.hqs[0]!.id,
            },
          ],
        },
      ],
      lock: true,
    });
    c = act(c, { kind: 'orders', side: 'allied', orders: [], lock: true });
    c = act(c, { kind: 'resolve' });
    c = act(c, { kind: 'finalize' });
    expect(c.preparation!.resolved).toBe(false);
    expect(c.preparation!.withdrawnCorpsIds).toEqual([]);
    expect(c.preparation!.deploymentHqIds).toEqual([]);
  });
  it('blows a retreat blocked by a friendly corps instead of stacking or passing through', () => {
    let c = seed();
    c.corps[0]!.hexId = '5,4';
    c.corps[2]!.hexId = '6,4';
    c.corps[1]!.hexId = '3,4';
    c = resolve(c, [withdrawal(c, 0, 2, ['5,4', '4,4', '3,4', '2,4'])]);
    expect(c.corps[0]!.status).toBe('blown');
    expect(c.corps[0]!.hexId).toBeNull();
    expect(c.corps[0]!.returnSlot).toBe(3);
    expect(c.corps[1]!.hexId).toBe('3,4');
    expect(c.cursor).toBe(420);
  });
  it('resolves opposing convergence without giving either side array-order priority', () => {
    const c = seed();
    c.corps[0]!.hexId = '3,4';
    c.corps[1]!.hexId = '10,4';
    c.corps[2]!.hexId = '2,4';
    c.corps[3]!.hexId = '9,4';
    const french = [withdrawal(c, 0, 2, ['3,4', '4,4', '5,4', '6,4'])],
      allied = [withdrawal(c, 3, 1, ['9,4', '8,4', '7,4', '6,4'])];
    const a = resolve(c, french, allied);
    const reversed = structuredClone(c);
    reversed.corps.reverse();
    reversed.preparation!.submissions.reverse();
    const b = resolve(reversed, french, allied);
    for (const id of [french[0]!.corpsId, allied[0]!.corpsId]) {
      expect(a.corps.find((f) => f.id === id)!.status).toBe('blown');
      expect(b.corps.find((f) => f.id === id)!.status).toBe('blown');
    }
  });
  it('uses explicit friendly priority for a contested retreat hex', () => {
    let c = seed();
    c.corps[0]!.hexId = '3,4';
    c.corps[1]!.hexId = '3,5';
    c.corps[2]!.hexId = '2,4';
    c.corps[3]!.hexId = '2,5';
    c = resolve(c, [
      withdrawal(c, 0, 2, ['3,4', '4,4', '5,4', '6,4'], 9),
      withdrawal(c, 1, 3, ['3,5', '4,5', '5,4', '6,4'], 1),
    ]);
    expect(c.corps[0]!.status).toBe('blown');
    expect(c.corps[1]!.hexId).toBe('6,4');
  });
  it('rejects illegal retreat geometry and holds withdrawn troops out of reinforcement forecasts', () => {
    let c = seed();
    c.corps[0]!.hexId = '5,4';
    c.corps[2]!.hexId = '6,4';
    expect(() =>
      act(c, {
        kind: 'withdrawals',
        side: 'french',
        orders: [withdrawal(c, 0, 2, ['5,4', '5,3', '6,3', '7,3'])],
        lock: false,
      }),
    ).toThrow('retreat step');
    c = resolve(c, [withdrawal(c, 0, 2, ['5,4', '4,4', '3,4', '2,4'])]);
    const fakeBattle = {
      id: randomUUID(),
      encounterId: 'x',
      title: 'Future',
      startAt: c.cursor,
      expectedEndAt: c.cursor + 240,
      hexId: '4,4',
      charts: c.charts,
      initial: [c.corps[2]!, c.corps[3]!],
      reinforcements: [],
      reinforcementForces: [],
      results: [],
      approved: false,
      appliedVersion: 0,
      baseline: [],
      appliedSerial: null,
    };
    expect(estimateReinforcement(c, fakeBattle, c.corps[0]!)).toBeNull();
  });
});
