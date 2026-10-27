// @vitest-environment node
import { expect, it } from 'vitest';
import {
  historicalSeed,
  reviewHistorical,
} from '../fixtures/historical-profile';
import {
  historicalRoster,
  historicalComplement,
} from '../../src/domain/historical-profile';
import {
  seedFontenoyOperational,
  cloneFontenoyOperational,
} from '../../src/domain/fontenoy-operational';
import { waterlooCampaignSchema } from '../../src/domain/waterloo-schema';
import type { WaterlooCampaign } from '../../src/domain/waterloo-schema';
import {
  newManualRuling,
  manualPlacement,
} from '../../src/domain/manual-adjudication';
import { defaultSimultaneousRecoveryPolicy } from '../../src/domain/simultaneous-aftermath';
import { waterlooBriefHtml } from '../../src/domain/waterloo-brief';
import {
  simultaneousStep as step,
  operationalNow as now,
  unitBattleResult,
  applyUnitBattle,
} from '../fixtures/simultaneous-aftermath';

it('assigns every historical organization exactly once to named campaign formations with immutable source identities', () => {
  const c = historicalSeed(),
    m = c.fontenoy!;
  expect(m.units).toHaveLength(143);
  expect(c.corps).toHaveLength(28);
  expect(new Set(m.units.map((u) => u.historical!.organizationId))).toEqual(
    new Set(historicalRoster.map((o) => o.id)),
  );
  const assigned = m.formations.flatMap((f) => f.unitIds);
  expect(assigned).toHaveLength(143);
  expect(new Set(assigned).size).toBe(143);
  expect(c.startDate).toBe('1745-05-11');
  expect(m.units.every((u) => u.provenance === 'house_rule_v0.1')).toBe(true);
  expect(
    m.units
      .filter((u) => u.type.startsWith('regular_'))
      .every((u) => u.quality === 'trained'),
  ).toBe(true);
  const guards = m.units.find((u) => u.displayName === 'Gardes Françaises')!;
  expect(historicalComplement(guards.historical!.organizationId)).toBe(
    '4 battalions',
  );
  const link = m.formations.find((f) => f.unitIds.includes(guards.id))!;
  expect(c.corps.find((f) => f.id === link.corpsId)!.name).toEqual(
    expect.stringMatching(/^French infantry/),
  );
  expect(m.units.some((u) => u.displayName === 'Karolyi Hussars')).toBe(true);
});

it('requires explicit adaptation review before orders, manual rulings or battle rules, then accepts reviewed house ratings', () => {
  const c = historicalSeed();
  expect(() =>
    step(c, { kind: 'orders', side: 'french', orders: [], lock: true }),
  ).toThrow('Review the historical');
  expect(() =>
    step(c, {
      kind: 'manual-adjudication',
      ruling: { ...newManualRuling(c), decision: 'Bypass review.' },
    }),
  ).toThrow('Review the historical');
  const ratings = structuredClone(
    c.fontenoy!.historicalProfile!.openingRatings,
  );
  ratings[0]!.quality = 'elite';
  const review = {
    ratings,
    acknowledgedScale: true,
    acknowledgedDeployment: true,
    acknowledgedSourceGaps: true,
    notes: 'Agreed scenario ratings, not inferred historical grades.',
  };
  expect(() =>
    step(c, {
      kind: 'historical-roster-review',
      review: { ...review, acknowledgedScale: false },
    }),
  ).toThrow();
  expect(() =>
    step(c, {
      kind: 'historical-roster-review',
      review: { ...review, ratings: ratings.slice(1) },
    }),
  ).toThrow('every regular');
  const accepted = step(c, { kind: 'historical-roster-review', review });
  expect(
    accepted.fontenoy!.units.find((u) => u.id === ratings[0]!.unitId)!.quality,
  ).toBe('elite');
  expect(c.fontenoy!.historicalProfile!.reviewedAt).toBeNull();
  expect(() =>
    step(accepted, { kind: 'orders', side: 'french', orders: [], lock: true }),
  ).not.toThrow();
  expect(() => reviewHistorical(accepted)).toThrow('fresh historical');
});

it('rejects missing, duplicate, foreign, renamed or reclassified historical identities and broken ownership/rating mappings', () => {
  const c = historicalSeed();
  for (const mutate of [
    (c: WaterlooCampaign) => {
      c.fontenoy!.units.pop();
    },
    (c: WaterlooCampaign) => {
      c.fontenoy!.units[0]!.historical = c.fontenoy!.units[1]!.historical;
    },
    (c: WaterlooCampaign) => {
      c.fontenoy!.units[0]!.historical!.organizationId = 'not-in-catalogue';
    },
    (c: WaterlooCampaign) => {
      c.fontenoy!.units[0]!.displayName = 'Invented regiment';
    },
    (c: WaterlooCampaign) => {
      c.fontenoy!.units[0]!.quality = 'elite';
    },
    (c: WaterlooCampaign) => {
      c.fontenoy!.units[0]!.provenance = 'official_maurice';
    },
    (c: WaterlooCampaign) => {
      c.fontenoy!.units[0]!.factionId = c.fontenoy!.factions.find(
        (f) => f.side === 'allied',
      )!.id;
    },
    (c: WaterlooCampaign) => {
      c.fontenoy!.formations[1]!.unitIds.push(c.fontenoy!.units[0]!.id);
    },
  ]) {
    const copy = structuredClone(c);
    mutate(copy);
    expect(waterlooCampaignSchema.safeParse(copy).success).toBe(false);
  }
  const original = seedFontenoyOperational(
    'Original profile',
    () => crypto.randomUUID(),
    now,
  );
  expect(original.fontenoy!.units).toHaveLength(38);
  original.fontenoy!.units.pop();
  expect(waterlooCampaignSchema.safeParse(original).success).toBe(false);
});

export function historicalBattle() {
  let c = reviewHistorical(historicalSeed(true));
  c = step(c, {
    kind: 'maurice-recovery-policy',
    policy: defaultSimultaneousRecoveryPolicy(c),
  });
  const ruling = newManualRuling(c);
  ruling.decision = 'Place field armies for an isolated test engagement.';
  ruling.placements = [
    { ...manualPlacement(c.corps[0]!), hexId: '5,4' },
    { ...manualPlacement(c.corps[3]!), hexId: '7,4' },
  ];
  c = step(c, { kind: 'manual-adjudication', ruling });
  for (const index of [0, 3]) {
    const f = c.corps[index]!;
    c = step(c, {
      kind: 'orders',
      side: f.side,
      lock: true,
      orders: [
        {
          corpsId: f.id,
          priority: 0,
          segments: [
            {
              path: [f.hexId!, '6,4'],
              startAt: 390,
              hqId: c.hqs.find((h) => h.army === f.army)!.id,
              roadOnly: false,
            },
          ],
        },
      ],
    });
  }
  c = step(c, { kind: 'resolve' });
  return step(c, {
    kind: 'declare-battle',
    encounterId: c.encounters[0]!.id,
    title: 'Historical roster engagement',
  });
}
it('freezes linked identities and more than 38 records in a printable battle, preserves sources through loss/recovery and clones cleanly', () => {
  const c = historicalBattle(),
    battle = c.battles[0]!;
  expect(battle.maurice!.flatMap((f) => f.units)).toHaveLength(55);
  const html = waterlooBriefHtml(c, battle);
  expect(html).toContain('Gardes Françaises');
  expect(html).toContain('4 battalions');
  expect(html).toContain('Frozen historical regimental rosters');
  const applied = applyUnitBattle(c, unitBattleResult(c));
  expect(applied.fontenoy!.units[0]!.currentStatus).toBe('recovering');
  expect(applied.fontenoy!.units[0]!.historical).toEqual(
    c.fontenoy!.units[0]!.historical,
  );
  expect(applied.battles[0]!.maurice).toEqual(battle.maurice);
  const clone = cloneFontenoyOperational(
    applied,
    'Fresh historical setup',
    () => crypto.randomUUID(),
    now,
  );
  expect(clone.fontenoy!.units).toHaveLength(143);
  expect(clone.corps).toHaveLength(14);
  expect(clone.fontenoy!.historicalProfile!.reviewedAt).toBeNull();
  expect(clone.fontenoy!.units.every((u) => u.currentStatus === 'ready')).toBe(
    true,
  );
  expect(
    new Set(
      clone.fontenoy!.historicalProfile!.openingRatings.map((r) => r.unitId),
    ),
  ).toEqual(
    new Set(
      clone
        .fontenoy!.units.filter((u) => u.type.startsWith('regular_'))
        .map((u) => u.id),
    ),
  );
  expect(clone.adjudications).toBeUndefined();
  expect(clone.battles).toEqual([]);
});
