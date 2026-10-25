// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  applyWaterlooCommand,
  campaignTime,
  estimateReinforcement,
  hexDistance,
  inZone,
  phaseStart,
  seedWaterloo,
  travelMinutes,
} from '../../src/domain/waterloo';
import type {
  WaterlooCampaign,
  WaterlooCommand,
  WaterlooOrder,
  WaterlooResult,
} from '../../src/domain/waterloo-schema';
import { waterlooCampaignSchema } from '../../src/domain/waterloo-schema';
import { waterlooBriefHtml } from '../../src/domain/waterloo-brief';
const now = '2026-10-25T12:00:00.000Z';
const seed = () => seedWaterloo('Crossroads test', randomUUID, now);
function action(c: WaterlooCampaign, command: WaterlooCommand) {
  return applyWaterlooCommand(c, {
    command,
    recordId: randomUUID(),
    timestamp: now,
  });
}
function order(
  c: WaterlooCampaign,
  index: number,
  path: string[],
  roadOnly = true,
): WaterlooOrder {
  const f = c.corps[index]!;
  return {
    corpsId: f.id,
    priority: index,
    segments: [
      {
        path,
        roadOnly,
        hqId: c.hqs.find((h) => h.army === f.army)!.id,
        startAt: c.cursor + 30,
      },
    ],
  };
}
function lock(
  c: WaterlooCampaign,
  french: WaterlooOrder[] = [],
  allied: WaterlooOrder[] = [],
) {
  return action(
    action(c, { kind: 'orders', side: 'french', orders: french, lock: true }),
    { kind: 'orders', side: 'allied', orders: allied, lock: true },
  );
}
function contactCampaign() {
  const c = seed();
  c.corps[0]!.hexId = '5,4';
  c.corps[2]!.hexId = '7,4';
  const locked = lock(
    c,
    [order(c, 0, ['5,4', '6,4'])],
    [order(c, 2, ['7,4', '6,4'])],
  );
  return action(locked, { kind: 'resolve' });
}
function battleCampaign() {
  const c = contactCampaign();
  return action(c, {
    kind: 'declare-battle',
    encounterId: c.encounters[0]!.id,
    title: 'Test battle',
  });
}
function resultFor(c: WaterlooCampaign): WaterlooResult {
  const b = c.battles[0]!;
  return {
    game: 'Any tactical game',
    outcome: 'French success',
    endAt: b.startAt + 120,
    notes: 'Manually adjudicated.',
    effects: [...b.initial, ...b.reinforcementForces].map((f) => ({
      corpsId: f.id,
      disposition: 'retained',
      hexId: f.hexId,
      exhausted: false,
      arrivalAt: null,
    })),
  };
}
describe('simultaneous hex campaign', () => {
  it('records an explicit umpire arrival override and rejects an override without a reason', () => {
    let c = battleCampaign();
    const f = c.corps[1]!;
    f.hexId = '4,5';
    const battleId = c.battles[0]!.id;
    expect(() =>
      action(c, {
        kind: 'reinforce',
        battleId,
        corpsId: f.id,
        entryEdge: 'West',
        notes: '',
        arrivalOverride: { at: c.cursor + 30, reason: '' },
      }),
    ).toThrow();
    c = action(c, {
      kind: 'reinforce',
      battleId,
      corpsId: f.id,
      entryEdge: 'West',
      notes: '',
      arrivalOverride: {
        at: c.cursor + 30,
        reason: 'Agreed table-scale arrival.',
      },
    });
    const arrival = c.battles[0]!.reinforcements[0]!;
    expect(arrival.earliest).toBe(c.cursor + 30);
    expect(arrival.latest).toBe(arrival.earliest);
    expect(arrival.notes).toContain('Agreed table-scale arrival');
  });
  it('allows reviewed HQ repositioning only before orders and outside enemy influence', () => {
    let c = seed();
    const id = c.hqs[0]!.id;
    c = action(c, {
      kind: 'place-hqs',
      placements: [{ hqId: id, hexId: '2,3', mode: 'battle' }],
    });
    expect(c.hqs[0]!.hexId).toBe('2,3');
    expect(c.hqs[0]!.mode).toBe('battle');
    expect(() =>
      action(c, {
        kind: 'place-hqs',
        placements: [{ hqId: id, hexId: '8,4', mode: 'normal' }],
      }),
    ).toThrow('placement');
    c = action(c, { kind: 'orders', side: 'allied', orders: [], lock: true });
    expect(() =>
      action(c, {
        kind: 'place-hqs',
        placements: [{ hqId: id, hexId: '2,4', mode: 'normal' }],
      }),
    ).toThrow('before movement');
  });
  it('returns a due blown corps only to an empty legal hex adjacent to its own HQ', () => {
    let c = seed();
    const f = c.corps[0]!;
    f.status = 'blown';
    f.hexId = null;
    f.returnSlot = 1;
    expect(() =>
      action(c, {
        kind: 'return-corps',
        corpsIds: [f.id],
        hexIds: [c.hqs[0]!.hexId],
      }),
    ).toThrow('empty hex');
    c = action(c, { kind: 'return-corps', corpsIds: [f.id], hexIds: ['3,4'] });
    expect(c.corps[0]!.status).toBe('ready');
    expect(c.corps[0]!.returnSlot).toBeNull();
    expect(() =>
      action(c, { kind: 'return-corps', corpsIds: [f.id], hexIds: ['3,4'] }),
    ).toThrow('due blown');
  });
  it('uses the opponent-reviewed two-corps cap and eliminates other due corps', () => {
    let c = seed();
    c.corps[0]!.status = 'blown';
    c.corps[0]!.hexId = null;
    c.corps[0]!.returnSlot = 1;
    c.corps[1]!.status = 'blown';
    c.corps[1]!.hexId = null;
    c.corps[1]!.returnSlot = 1;
    c.corps.push({ ...c.corps[0]!, id: randomUUID(), name: 'Third due corps' });
    expect(() =>
      action(c, {
        kind: 'return-corps',
        corpsIds: [c.corps[0]!.id],
        hexIds: ['3,4'],
      }),
    ).toThrow('exactly two');
    c = action(c, {
      kind: 'return-corps',
      corpsIds: [c.corps[0]!.id, c.corps[1]!.id],
      hexIds: ['3,4', '2,3'],
    });
    expect(c.corps.at(-1)!.status).toBe('eliminated');
  });
  it('freezes chart context for battle briefs across later campaign configuration', () => {
    const c = battleCampaign();
    const b = c.battles[0]!;
    c.charts.weather = 'rain';
    c.charts.tacticalTurnMinutes = 10;
    expect(waterlooBriefHtml(c, b)).toContain('Weather: dry');
    expect(b.charts.tacticalTurnMinutes).toBeNull();
  });
  it('creates an independently validated hex profile with distinct Coalition armies', () => {
    const c = seed();
    expect(waterlooCampaignSchema.safeParse(c).success).toBe(true);
    expect(c.hexes).toHaveLength(117);
    expect(c.corps.map((f) => f.army)).toContain('prussian');
    expect(hexDistance(c, '3,4', '4,3')).toBe(1);
    expect(phaseStart(3)).toBe(1800);
    expect(campaignTime(c, 1800)).toBe('1815-06-17 06:00');
  });
  it('uses whole-road mode, terrain, weather and bridge times without tactical combat', () => {
    const c = seed(),
      f = c.corps[0]!;
    expect(travelMinutes(c, f, '3,4', '4,4', true)).toBe(15);
    expect(travelMinutes(c, f, '5,4', '6,4', true)).toBe(30);
    expect(travelMinutes(c, f, '4,2', '5,2', false)).toBe(60);
    expect(() => travelMinutes(c, f, '4,2', '5,2', true)).toThrow(
      'connected roads',
    );
    c.charts.weather = 'rain';
    expect(travelMinutes(c, f, '3,4', '4,4', true)).toBe(25);
    expect(travelMinutes(c, f, '3,4', '4,4', false)).toBe(120);
    c.edges.find((e) => e.from === '5,4' && e.to === '6,4')!.crossing = 'major';
    expect(() => travelMinutes(c, f, '5,4', '6,4', true)).toThrow('bridges');
  });
  it('blocks control across an unbridged major river', () => {
    const c = seed();
    const f = c.corps[0]!;
    f.hexId = '5,4';
    expect(inZone(c, '6,4', f, 1)).toBe(true);
    c.edges.find((e) => e.from === '5,4' && e.to === '6,4')!.crossing = 'major';
    expect(inZone(c, '6,4', f, 1)).toBe(false);
  });
  it('does not move or advance time on one lock and rejects unilateral resolution', () => {
    const c = seed();
    const locked = action(c, {
      kind: 'orders',
      side: 'french',
      orders: [order(c, 0, ['3,4', '4,4'])],
      lock: true,
    });
    expect(locked.corps).toEqual(c.corps);
    expect(locked.cursor).toBe(360);
    expect(() => action(locked, { kind: 'resolve' })).toThrow('Both sides');
    expect(() =>
      action(locked, {
        kind: 'orders',
        side: 'french',
        orders: [],
        lock: false,
      }),
    ).toThrow('already locked');
  });
  it('moves both sides on the same timeline and advances the shared phase only on finalize', () => {
    const c = seed();
    const moved = action(
      lock(c, [order(c, 0, ['3,4', '4,4'])], [order(c, 2, ['9,4', '8,4'])]),
      { kind: 'resolve' },
    );
    expect(moved.corps[0]!.hexId).toBe('4,4');
    expect(moved.corps[2]!.hexId).toBe('8,4');
    expect(moved.turn).toBe(1);
    expect(moved.cursor).toBe(720);
    expect(moved.phase).toBe('checkpoint');
    const next = action(moved, { kind: 'finalize' });
    expect(next.turn).toBe(2);
    expect(next.cursor).toBe(720);
    expect(next.submissions.every((s) => !s.locked && !s.orders.length)).toBe(
      true,
    );
  });
  it('retains repeated activations with a finite three-segment budget', () => {
    const c = seed();
    c.corps[2]!.hexId = '12,8';
    c.corps[3]!.hexId = '12,6';
    const o = order(c, 0, ['3,4', '4,4']);
    o.segments.push({ ...o.segments[0]!, path: ['4,4', '5,4'], startAt: 405 });
    const moved = action(lock(c, [o]), { kind: 'resolve' });
    expect(moved.corps[0]!.hexId).toBe('5,4');
    const bad = structuredClone(o);
    bad.segments[0]!.path = [
      '3,4',
      '4,4',
      '5,4',
      '6,4',
      '7,4',
      '8,4',
      '9,4',
      '10,4',
      '11,4',
      '12,4',
    ];
    expect(() => lock(c, [bad])).toThrow('allowance');
  });
  it('rejects wrong ownership, cross-army command and nonadjacent paths', () => {
    const c = seed();
    expect(() => lock(c, [order(c, 2, ['9,4', '8,4'])])).toThrow('friendly');
    const o = order(c, 2, ['9,4', '8,4']);
    o.segments[0]!.hqId = c.hqs[2]!.id;
    expect(() => lock(c, [], [o])).toThrow('this army');
    expect(() => lock(c, [order(c, 0, ['3,4', '6,4'])])).toThrow('adjacent');
  });
  it('handles equal-time hostile destinations without moving either force or depending on save order', () => {
    const c = contactCampaign();
    expect(c.phase).toBe('adjudication');
    expect(c.cursor).toBe(390);
    expect(c.corps[0]!.hexId).toBe('5,4');
    expect(c.corps[2]!.hexId).toBe('7,4');
    expect(c.encounters).toHaveLength(1);
    const start = seed();
    start.corps[0]!.hexId = '5,4';
    start.corps[2]!.hexId = '7,4';
    let reverse = action(start, {
      kind: 'orders',
      side: 'allied',
      orders: [order(start, 2, ['7,4', '6,4'])],
      lock: true,
    });
    reverse = action(reverse, {
      kind: 'orders',
      side: 'french',
      orders: [order(start, 0, ['5,4', '6,4'])],
      lock: true,
    });
    reverse.corps.reverse();
    reverse = action(reverse, { kind: 'resolve' });
    expect(reverse.cursor).toBe(c.cursor);
    expect(reverse.corps.find((f) => f.name === 'French I Corps')!.hexId).toBe(
      '5,4',
    );
    expect(reverse.encounters[0]!.reason).toBe(c.encounters[0]!.reason);
  });
  it('stops infantry at an influence boundary and does not invent a battle', () => {
    const c = seed();
    const moved = action(
      lock(c, [order(c, 0, ['3,4', '4,4', '5,4', '6,4', '7,4'])]),
      { kind: 'resolve' },
    );
    expect(moved.corps[0]!.hexId).toBe('7,4');
    expect(moved.encounters).toHaveLength(0);
    expect(moved.marches[0]!.stopped).toBe(true);
  });
  it('keeps a friendly corps behind an occupied hex and never swaps corps', () => {
    const c = seed();
    c.corps[1]!.hexId = '4,4';
    const moved = action(
      lock(c, [order(c, 0, ['3,4', '4,4']), order(c, 1, ['4,4', '3,4'])]),
      { kind: 'resolve' },
    );
    expect(moved.corps[0]!.hexId).toBe('3,4');
    expect(moved.corps[1]!.hexId).toBe('4,4');
  });
  it('settles a contact as a stand-off and blocks early phase finalization', () => {
    let c = contactCampaign();
    expect(() => action(c, { kind: 'finalize' })).toThrow('Finish');
    c = action(c, { kind: 'stand-off', encounterId: c.encounters[0]!.id });
    c = action(c, { kind: 'resolve' });
    expect(c.phase).toBe('checkpoint');
    expect(c.battles).toHaveLength(0);
  });
  it('calculates a feasible reinforcement window and prevents overlapping commitments', () => {
    let c = battleCampaign();
    const f = c.corps[1]!;
    f.hexId = '4,5';
    const estimate = estimateReinforcement(c, c.battles[0]!, f);
    expect(estimate).not.toBeNull();
    expect(estimate!.earliest).toBeGreaterThan(c.cursor);
    expect(estimate!.earliest).toBeLessThanOrEqual(estimate!.likely);
    expect(estimate!.likely).toBeLessThanOrEqual(estimate!.latest);
    c = action(c, {
      kind: 'reinforce',
      battleId: c.battles[0]!.id,
      corpsId: f.id,
      entryEdge: 'West',
      notes: 'Agreed approach.',
    });
    expect(c.corps.find((p) => p.id === f.id)!.hexId).toBe('4,5');
    expect(
      estimateReinforcement(
        c,
        c.battles[0]!,
        c.corps.find((p) => p.id === f.id)!,
      ),
    ).toBeNull();
    expect(() =>
      action(c, {
        kind: 'reinforce',
        battleId: c.battles[0]!.id,
        corpsId: f.id,
        entryEdge: 'West',
        notes: '',
      }),
    ).toThrow('feasible');
  });
  it('does not report blocked cavalry as a possible reinforcement', () => {
    const c = battleCampaign();
    const f = c.corps[1]!;
    f.hexId = '8,4';
    expect(estimateReinforcement(c, c.battles[0]!, f)).toBeNull();
  });
  it('records results separately, applies at battle end once, and supports audited compensation', () => {
    let c = battleCampaign();
    const b = c.battles[0]!,
      result = resultFor(c);
    result.effects[0]!.disposition = 'blown';
    result.effects[0]!.hexId = null;
    const unchanged = structuredClone(c.corps);
    c = action(c, {
      kind: 'result',
      battleId: b.id,
      result,
      reason: 'Tabletop result.',
    });
    expect(c.corps).toEqual(unchanged);
    expect(() => action(c, { kind: 'resolve' })).toThrow('approve');
    c = action(c, { kind: 'approve-result', battleId: b.id });
    c = action(c, { kind: 'resolve' });
    expect(c.battles[0]!.appliedVersion).toBe(1);
    expect(
      c.corps.find((f) => f.id === result.effects[0]!.corpsId)!.status,
    ).toBe('blown');
    expect(() => action(c, { kind: 'approve-result', battleId: b.id })).toThrow(
      'unapproved',
    );
    const corrected = structuredClone(result);
    corrected.effects[0]!.disposition = 'retained';
    corrected.effects[0]!.hexId = unchanged.find(
      (f) => f.id === corrected.effects[0]!.corpsId,
    )!.hexId;
    c = action(c, {
      kind: 'result',
      battleId: b.id,
      result: corrected,
      reason: 'Corrected transcription.',
    });
    expect(c.battles[0]!.results).toHaveLength(2);
    expect(
      c.corps.find((f) => f.id === corrected.effects[0]!.corpsId)!.status,
    ).toBe('ready');
    c = action(c, { kind: 'finalize' });
    expect(() =>
      action(c, {
        kind: 'result',
        battleId: b.id,
        result: corrected,
        reason: 'Late correction.',
      }),
    ).toThrow('depend');
  });
  it('keeps time monotonic for battles ending in the next AM/PM slot', () => {
    let c = battleCampaign();
    const b = c.battles[0]!,
      result = resultFor(c);
    result.endAt = 780;
    c = action(c, {
      kind: 'result',
      battleId: b.id,
      result,
      reason: 'Long battle.',
    });
    c = action(c, { kind: 'approve-result', battleId: b.id });
    c = action(c, { kind: 'resolve' });
    expect(c.cursor).toBe(780);
    c = action(c, { kind: 'finalize' });
    expect(c.turn).toBe(2);
    expect(c.cursor).toBe(780);
  });
  it('rejects missing effects, impossible stacking and arrivals before the approach is feasible', () => {
    let c = battleCampaign();
    const b = c.battles[0]!,
      result = resultFor(c);
    result.effects[1] = structuredClone(result.effects[0]!);
    expect(() =>
      action(c, {
        kind: 'result',
        battleId: b.id,
        result,
        reason: 'Incomplete.',
      }),
    ).toThrow('every committed');
    const stacked = resultFor(c);
    stacked.effects[1]!.hexId = stacked.effects[0]!.hexId;
    expect(() =>
      action(c, {
        kind: 'result',
        battleId: b.id,
        result: stacked,
        reason: 'Bad positions.',
      }),
    ).toThrow('stack');
    c.corps[1]!.hexId = '4,5';
    c = action(c, {
      kind: 'reinforce',
      battleId: b.id,
      corpsId: c.corps[1]!.id,
      entryEdge: 'West',
      notes: '',
    });
    const arrival = resultFor(c);
    arrival.effects.at(-1)!.arrivalAt = c.cursor;
    expect(() =>
      action(c, {
        kind: 'result',
        battleId: b.id,
        result: arrival,
        reason: 'Too soon.',
      }),
    ).toThrow('feasible');
  });
  it('escapes printable briefs and omits uncommitted candidate rosters', () => {
    const c = battleCampaign(),
      b = c.battles[0]!;
    b.title = '<script>bad()</script>';
    const html = waterlooBriefHtml(c, b);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain(c.corps[1]!.roster);
    expect(html).toContain('No later forces committed');
  });
});
