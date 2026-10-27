import { expect, it } from 'vitest';
import {
  seedFontenoyOperational,
  cloneFontenoyOperational,
} from '../../src/domain/fontenoy-operational';
import { seedWaterloo } from '../../src/domain/waterloo';
import { waterlooCampaignSchema } from '../../src/domain/waterloo-schema';
import type { WaterlooCampaign } from '../../src/domain/waterloo-schema';
import type { IntelligenceInput } from '../../src/domain/simultaneous-intelligence-schema';
import {
  canRequestScouting,
  intelligenceView,
} from '../../src/domain/simultaneous-intelligence';
import {
  simultaneousStep as step,
  operationalNow as now,
  unitBattleCampaign,
  applyUnitBattle,
  unitBattleResult,
} from '../fixtures/simultaneous-aftermath';
const uuid = () => crypto.randomUUID();
const seed = () => seedFontenoyOperational('Scouting', uuid, now);
function request(c = seed(), index = 0) {
  return step(c, {
    kind: 'maurice-scout-request',
    input: {
      corpsId: c.corps[index]!.id,
      hexId: '6,4',
      question: 'What was seen on this approach?',
    },
  });
}
const identified: IntelligenceInput = {
  level: 'identified',
  hexId: '6,4',
  expiresAfterTurn: 1,
  label: 'Approved enemy identity',
  details: 'Two observed infantry units; no cards disclosed.',
  notes: 'Approved for the requesting side.',
};
function report(c: WaterlooCampaign, input = identified, expectedVersion = 0) {
  return step(c, {
    kind: 'maurice-intelligence-report',
    requestId: c.fontenoy!.intelligence!.requests[0]!.id,
    input,
    expectedVersion,
    reason: 'Private umpire rationale',
  });
}
function advance(c: WaterlooCampaign) {
  for (const side of ['french', 'allied'] as const)
    c = step(c, { kind: 'orders', side, orders: [], lock: true });
  c = step(c, { kind: 'resolve' });
  return step(c, { kind: 'finalize' });
}
it('records a hex request without inventing success, target identity, movement cost or automatic outcome', () => {
  const c = seed(),
    before = structuredClone(c),
    next = request(c);
  expect(c).toEqual(before);
  expect(next.corps).toEqual(c.corps);
  expect(next.submissions).toEqual(c.submissions);
  expect(next.hqs).toEqual(c.hqs);
  expect(next.cursor).toBe(c.cursor);
  expect(next.fontenoy!.units).toEqual(c.fontenoy!.units);
  expect(next.fontenoy!.siege).toEqual(c.fontenoy!.siege);
  expect(intelligenceView(next, 'french')[0]).toMatchObject({
    status: 'pending',
    observation: null,
  });
  expect(intelligenceView(next, 'allied')).toEqual([]);
  expect(JSON.stringify(next.log)).not.toContain('What was seen');
});
it('rejects invalid hexes, unavailable scouts, locked sides, archived and non-Fontenoy campaigns', () => {
  const c = seed();
  expect(() =>
    step(c, {
      kind: 'maurice-scout-request',
      input: { corpsId: c.corps[0]!.id, hexId: 'missing', question: 'Observe' },
    }),
  ).toThrow('map hex');
  for (const status of ['blown', 'eliminated', 'reserve'] as const) {
    const copy = structuredClone(c);
    copy.corps[0]!.status = status;
    expect(() => request(copy)).toThrow('ready formation');
  }
  const locked = step(c, {
    kind: 'orders',
    side: 'french',
    orders: [],
    lock: true,
  });
  expect(() => request(locked)).toThrow('unlocked');
  expect(canRequestScouting(locked, locked.corps[2]!)).toBe(true);
  const archived = structuredClone(c);
  archived.status = 'archived';
  expect(() => request(archived)).toThrow('read-only');
  expect(() => request(seedWaterloo('Legacy profile', uuid, now))).toThrow(
    'Fontenoy',
  );
});
it('blocks unanswered duplicate requests but does not impose invented range or dice thresholds', () => {
  const c = request();
  expect(() => request(c)).toThrow('unanswered request');
  const reviewed = report(c, {
    level: 'none',
    notes: 'No intelligence released; not proof of absence.',
  });
  expect(() => request(reviewed)).not.toThrow();
});
it('requires resolved preparation and excludes withdrawn formations and unresolved battle commitments', () => {
  const c = step(seed(), { kind: 'enable-preparation' });
  expect(() => request(c)).toThrow('after preparation');
  expect(() => request(unitBattleCampaign())).toThrow('ready formation');
  const withdrawn = seed();
  withdrawn.preparation = {
    ...c.preparation!,
    resolved: true,
    withdrawnCorpsIds: [withdrawn.corps[0]!.id],
  };
  expect(canRequestScouting(withdrawn, withdrawn.corps[0]!)).toBe(false);
});
it('freezes released intelligence independently of actual enemy positions, rosters and statuses', () => {
  const c = report(request()),
    before = intelligenceView(c, 'french');
  const changed = structuredClone(c);
  changed.corps[2]!.hexId = '9,4';
  changed.corps[2]!.status = 'eliminated';
  changed.corps[2]!.roster = 'SECRET LIVE ROSTER';
  expect(intelligenceView(changed, 'french')).toEqual(before);
  const visible = JSON.stringify(before);
  expect(visible).toContain('Two observed');
  for (const secret of [
    'SECRET LIVE ROSTER',
    'Private umpire rationale',
    changed.corps[2]!.id,
  ])
    expect(visible).not.toContain(secret);
  expect(intelligenceView(c, 'allied')).toEqual([]);
});
it('replaces reports through immutable corrections, rejects stale/no-op edits and supports withdrawal', () => {
  const c = report(request()),
    first = structuredClone(c.fontenoy!.intelligence!.reports[0]);
  expect(() => report(c, identified, 0)).toThrow('changed');
  expect(() => report(c, identified, 1)).toThrow('Change the report');
  const corrected = report(
    c,
    {
      level: 'located',
      hexId: '7,4',
      expiresAfterTurn: 2,
      notes: 'Corrected observed location.',
    },
    1,
  );
  expect(corrected.fontenoy!.intelligence!.reports[0]).toEqual(first);
  expect(intelligenceView(corrected, 'french')[0]!.observation).toMatchObject({
    hexId: '7,4',
  });
  const withdrawn = report(
    corrected,
    { level: 'none', notes: 'Earlier observation withdrawn.' },
    2,
  );
  expect(intelligenceView(withdrawn, 'french')[0]).toMatchObject({
    version: 3,
    observation: { level: 'none' },
  });
  expect(JSON.stringify(intelligenceView(withdrawn, 'french'))).not.toContain(
    'Approved enemy identity',
  );
});
it('expires snapshots at phase advancement without blocking unanswered requests or finalization', () => {
  const c = report(request()),
    advanced = advance(c),
    item = intelligenceView(advanced, 'french')[0]!;
  expect(item.status).toBe('expired');
  expect(item.observation).toBeNull();
  expect(JSON.stringify(item)).not.toContain('Approved enemy identity');
  const corrected = report(
    advanced,
    {
      ...identified,
      details: 'Corrected historical estimate.',
    } as IntelligenceInput,
    1,
  );
  expect(corrected.fontenoy!.intelligence!.reports.at(-1)!.observedAt).toBe(
    c.fontenoy!.intelligence!.reports[0]!.observedAt,
  );
  expect(intelligenceView(corrected, 'french')[0]!.status).toBe('expired');
  expect(
    intelligenceView(
      report(corrected, { level: 'none', notes: 'Withdraw old report.' }, 2),
      'french',
    )[0]!.observation,
  ).toMatchObject({ level: 'none' });
  expect(() => report(advance(request()))).toThrow('current phase');
  expect(intelligenceView(advance(request()), 'french')[0]!.status).toBe(
    'unanswered',
  );
});
it('releases at a settled checkpoint and rejects invalid expiry and unknown report references', () => {
  let c = request();
  expect(() =>
    report(c, { ...identified, expiresAfterTurn: 0 } as IntelligenceInput),
  ).toThrow();
  expect(() =>
    report(c, { ...identified, hexId: 'absent' } as IntelligenceInput),
  ).toThrow('map position');
  for (const side of ['french', 'allied'] as const)
    c = step(c, { kind: 'orders', side, orders: [], lock: true });
  c = step(c, { kind: 'resolve' });
  expect(c.phase).toBe('checkpoint');
  expect(() => report(c)).not.toThrow();
  expect(() =>
    step(c, {
      kind: 'maurice-intelligence-report',
      requestId: uuid(),
      expectedVersion: 0,
      input: identified,
      reason: 'No request',
    }),
  ).toThrow('current phase');
});
it('validates ownership, chronology, duplicate identities and report revision/reference tampering', () => {
  const c = report(request());
  const mutate = (edit: (copy: WaterlooCampaign) => void) => {
    const copy = structuredClone(c);
    edit(copy);
    expect(waterlooCampaignSchema.safeParse(copy).success).toBe(false);
  };
  mutate((c) => {
    c.fontenoy!.intelligence!.requests[0]!.side = 'allied';
  });
  mutate((c) => {
    c.fontenoy!.intelligence!.reports[0]!.version = 2;
  });
  mutate((c) => {
    c.fontenoy!.intelligence!.reports[0]!.requestId = uuid();
  });
  mutate((c) => {
    c.fontenoy!.intelligence!.reports[0]!.id =
      c.fontenoy!.intelligence!.requests[0]!.id;
  });
  mutate((c) => {
    c.fontenoy!.intelligence!.reports[0]!.at = c.cursor + 5;
  });
  mutate((c) => {
    c.fontenoy!.intelligence!.reports[0]!.timestamp =
      '2020-01-01T00:00:00.000Z';
  });
});
it('preserves optional-field compatibility and starts setup clones without intelligence history', () => {
  const c = seed();
  expect(c.fontenoy!.intelligence).toBeUndefined();
  expect(waterlooCampaignSchema.safeParse(c).success).toBe(true);
  const copy = cloneFontenoyOperational(
    report(request(c)),
    'Fresh reconnaissance',
    uuid,
    now,
  );
  expect(copy.fontenoy!.intelligence).toBeUndefined();
});
it('prevents battle-effect rewrites after downstream intelligence decisions', () => {
  let c = unitBattleCampaign();
  const earlier = request().fontenoy!.intelligence!;
  earlier.requests[0]!.input.corpsId = c.corps[0]!.id;
  c.fontenoy!.intelligence = earlier;
  c = report(applyUnitBattle(c));
  const result = unitBattleResult(c);
  expect(() =>
    step(c, {
      kind: 'result',
      battleId: c.battles[0]!.id,
      result,
      reason: 'Rewrite after scouting',
    }),
  ).toThrow();
});
