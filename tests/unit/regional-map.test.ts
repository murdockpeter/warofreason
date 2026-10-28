// @vitest-environment node
import { expect, it } from 'vitest';
import {
  seedFontenoyOperational,
  cloneFontenoyOperational,
} from '../../src/domain/fontenoy-operational';
import {
  hasOriginalFontenoyMap,
  regionalBounds,
} from '../../src/domain/regional-map';
import { historicalSeed } from '../fixtures/historical-profile';
import {
  simultaneousStep as step,
  operationalNow as now,
} from '../fixtures/simultaneous-aftermath';
import { newManualRuling } from '../../src/domain/manual-adjudication';
import {
  travelMinutes,
  hexDistance,
  inZone,
  seedWaterloo,
} from '../../src/domain/waterloo';
import { waterlooCampaignSchema } from '../../src/domain/waterloo-schema';
import type { WaterlooCampaign } from '../../src/domain/waterloo-schema';
import { SqliteCampaignRepository } from '../../src/main/persistence/repository';

const seed = () =>
  seedFontenoyOperational('Regional map', () => crypto.randomUUID(), now);
it('adds a connected 36 by 24 board around all four edges while preserving the complete original scenario and saved orders', () => {
  let old = seed();
  const f = old.corps[0]!;
  old = step(old, {
    kind: 'orders',
    side: 'french',
    lock: false,
    orders: [
      {
        corpsId: f.id,
        priority: 0,
        segments: [
          {
            path: [f.hexId!, '4,2'],
            startAt: 390,
            hqId: old.hqs.find((h) => h.army === f.army)!.id,
            roadOnly: false,
          },
        ],
      },
    ],
  });
  const expanded = step(old, { kind: 'expand-regional-map' });
  expect(old.hexes).toHaveLength(96);
  expect(expanded.hexes).toHaveLength(864);
  expect(expanded.hexes.slice(0, 96)).toEqual(old.hexes);
  expect(expanded.edges.slice(0, old.edges.length)).toEqual(old.edges);
  expect(expanded.corps).toEqual(old.corps);
  expect(expanded.hqs).toEqual(old.hqs);
  expect(expanded.submissions).toEqual(old.submissions);
  expect(expanded.fontenoy!.formations).toEqual(old.fontenoy!.formations);
  expect(expanded.fontenoy!.kilometresPerHex).toBe(
    old.fontenoy!.kilometresPerHex,
  );
  expect(expanded.cursor).toBe(old.cursor);
  const reached = new Set(['0,0']);
  for (let i = 0; i < 60; i++)
    for (const e of expanded.edges) {
      if (reached.has(e.from)) reached.add(e.to);
      if (reached.has(e.to)) reached.add(e.from);
    }
  expect(reached.size).toBe(864);
  for (const h of expanded.hexes.slice(96))
    expect(h).toMatchObject({ terrain: 'clear', name: '' });
  expect(Math.min(...expanded.hexes.map((h) => h.q))).toBe(regionalBounds.minQ);
  expect(Math.max(...expanded.hexes.map((h) => h.r))).toBe(regionalBounds.maxR);
  const bad = structuredClone(expanded);
  bad.hexes.pop();
  expect(waterlooCampaignSchema.safeParse(bad).success).toBe(false);
});
it('allows manual placement and normal movement beyond the former border without inventing roads or changing costs', () => {
  let c = step(seed(), { kind: 'expand-regional-map' });
  const ruling = newManualRuling(c, c.corps[0]!.id);
  ruling.placements[0]!.hexId = '0,0';
  ruling.hqs = [{ hqId: c.hqs[0]!.id, hexId: '0,0' }];
  ruling.decision =
    'Place the force at the former western edge for a maneuver test.';
  c = step(c, { kind: 'manual-adjudication', ruling });
  expect(travelMinutes(c, c.corps[0]!, '0,0', '-1,0', false)).toBe(30);
  expect(() => travelMinutes(c, c.corps[0]!, '0,0', '-1,0', true)).toThrow(
    'road',
  );
  c = step(c, {
    kind: 'orders',
    side: 'french',
    lock: true,
    orders: [
      {
        corpsId: c.corps[0]!.id,
        priority: 0,
        segments: [
          {
            path: ['0,0', '-1,0', '-2,0'],
            startAt: 390,
            hqId: c.hqs[0]!.id,
            roadOnly: false,
          },
        ],
      },
    ],
  });
  c = step(c, { kind: 'orders', side: 'allied', lock: true, orders: [] });
  c = step(c, { kind: 'resolve' });
  expect(c.corps[0]!.hexId).toBe('-2,0');
});
it('keeps old maps unchanged until requested, defaults new historical maps to regional, and rejects locked/repeated/archived expansions', () => {
  const c = seed();
  expect(hasOriginalFontenoyMap(c)).toBe(true);
  const locked = step(c, {
    kind: 'orders',
    side: 'french',
    lock: true,
    orders: [],
  });
  expect(() => step(locked, { kind: 'expand-regional-map' })).toThrow(
    'unlocked planning',
  );
  expect(() =>
    step({ ...c, status: 'archived' }, { kind: 'expand-regional-map' }),
  ).toThrow('read-only');
  const historical = historicalSeed();
  expect(historical.hexes).toHaveLength(864);
  expect(() => step(historical, { kind: 'expand-regional-map' })).toThrow(
    'original Fontenoy',
  );
  expect(historicalSeed(true).hexes).toHaveLength(96);
  const clone = cloneFontenoyOperational(
    historical,
    'Regional clone',
    () => crypto.randomUUID(),
    now,
  );
  expect(clone.hexes).toEqual(historical.hexes);
  expect(clone.fontenoy!.regionalMap).toBe(historical.fontenoy!.regionalMap);
});
it('journals an existing-map expansion and replays a portable export without losing its original starting topology', () => {
  const repo = new SqliteCampaignRepository(':memory:'),
    destination = new SqliteCampaignRepository(':memory:');
  try {
    const old = repo.create({
      title: 'Original map',
      profile: 'simultaneous_fontenoy',
      actor: 'Test umpire',
      reason: 'Map expansion test.',
    }).active as WaterlooCampaign;
    repo.waterloo({
      id: old.id,
      expectedRevision: old.revision,
      command: { kind: 'expand-regional-map' },
      actor: 'Test umpire',
      reason: 'Add maneuvering space.',
    });
    const saved = repo.library().active as WaterlooCampaign;
    const portable = repo.exportCampaign({
      id: saved.id,
      expectedRevision: saved.revision,
    });
    expect(portable.events[0]!.after).toMatchObject({ hexes: old.hexes });
    const imported = destination.importCampaign(portable)
      .active as WaterlooCampaign;
    expect(imported.hexes).toEqual(saved.hexes);
    expect(imported.edges).toEqual(saved.edges);
    const tampered = structuredClone(portable);
    (tampered.campaign as WaterlooCampaign).hexes.at(-1)!.terrain = 'woods';
    expect(() =>
      new SqliteCampaignRepository(':memory:').importCampaign(tampered),
    ).toThrow();
  } finally {
    repo.close();
    destination.close();
  }
});
it('preserves terrain and major-river zone behavior after replacing exhaustive grid scans with neighbor traversal', () => {
  const c = seedWaterloo('Zone equivalence', () => crypto.randomUUID(), now),
    f = c.corps[0]!;
  c.hexes.find((h) => h.id === '5,3')!.terrain = 'water';
  if (c.edges[0]) c.edges[0].crossing = 'major';
  function reference(target: string, radius: number) {
    let frontier = [f.hexId!];
    const seen = new Set(frontier);
    if (target === f.hexId) return true;
    for (let i = 0; i < radius; i++) {
      const next: string[] = [];
      for (const from of frontier)
        for (const h of c.hexes) {
          const edge = c.edges.find(
            (e) =>
              (e.from === from && e.to === h.id) ||
              (e.to === from && e.from === h.id),
          );
          if (
            !seen.has(h.id) &&
            hexDistance(c, from, h.id) === 1 &&
            edge?.crossing !== 'major' &&
            h.terrain !== 'water'
          ) {
            if (h.id === target) return true;
            seen.add(h.id);
            next.push(h.id);
          }
        }
      frontier = next;
    }
    return false;
  }
  for (const radius of [1, 2])
    for (const h of c.hexes)
      expect(inZone(c, h.id, f, radius)).toBe(reference(h.id, radius));
});
