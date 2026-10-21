import { describe, expect, it } from 'vitest';
import { seedFontenoy } from '../../src/domain/fontenoy';
import { campaignFixture } from '../fixtures/campaign';
import {
  applyOperationalCommand,
  campaignDate,
  projectOperationalView,
  routeCost,
} from '../../src/domain/operations';
import { fontenoyCampaignSchema } from '../../src/domain/campaign';
import type { FontenoyCampaign } from '../../src/domain/campaign';

function started(): FontenoyCampaign {
  const campaign = seedFontenoy(campaignFixture(), () => crypto.randomUUID());
  campaign.settings.reviewedHouseRules = true;
  campaign.settings.reviewedSchematicMap = true;
  campaign.status = 'active';
  campaign.turn = 1;
  campaign.date = campaign.settings.schedule.startDate;
  campaign.activeSide = campaign.settings.schedule.firstSide;
  return applyOperationalCommand(campaign, { kind: 'enable' });
}
function square(c: FontenoyCampaign, row: number, column: number) {
  return c.squares.find((s) => s.row === row && s.column === column)!.id;
}
describe('provisional operational rules', () => {
  it('records and holds already co-located opposing setup columns when operational play is enabled', () => {
    const c = started();
    delete c.operations;
    c.columns[2]!.squareId = c.columns[0]!.squareId;
    const enabled = applyOperationalCommand(c, { kind: 'enable' });
    expect(enabled.operations!.engagements).toHaveLength(1);
    expect(() =>
      routeCost(enabled, {
        columnId: c.columns[0]!.id,
        path: [c.columns[0]!.squareId!],
      }),
    ).toThrow('tabletop');
    expect(fontenoyCampaignSchema.safeParse(enabled).success).toBe(true);
  });
  it('validates connected paths, road/off-road/river costs, loops and allowance without mutation', () => {
    const c = started();
    const column = c.columns[0]!;
    const start = column.squareId!;
    const east = square(c, 2, 4);
    const next = square(c, 2, 5);
    const order = { columnId: column.id, path: [start, east] };
    expect(routeCost(c, order)).toBe(2);
    expect(() => routeCost(c, { ...order, path: [start, next] })).toThrow(
      'adjacent',
    );
    expect(() =>
      routeCost(c, { ...order, path: [start, east, start] }),
    ).toThrow('revisit');
    expect(() => routeCost(c, { ...order, path: [start, east, next] })).toThrow(
      'allowance',
    );
    c.settings.map.roadEdges = [
      { from: start, to: east, provenance: 'house_rule_v0.1' },
      { from: east, to: next, provenance: 'house_rule_v0.1' },
    ];
    expect(routeCost(c, { ...order, path: [start, east, next] })).toBe(2);
    c.settings.map.riverEdges = [
      { from: start, to: east, provenance: 'house_rule_v0.1' },
    ];
    expect(routeCost(c, order)).toBe(2);
    c.operations!.rules.riverCrossingCost = 2;
    expect(routeCost(c, order)).toBe(3);
    const before = structuredClone(c);
    c.operations!.rules.blockedSquareIds = [east];
    expect(() => routeCost(c, order)).toThrow('blocked');
    expect(c.columns).toEqual(before.columns);
  });
  it('preserves issued orders, supports reopening, then advances factions and days only on committed resolution', () => {
    const c = started();
    const order = {
      columnId: c.columns[0]!.id,
      path: [c.columns[0]!.squareId!, square(c, 2, 4)],
    };
    const issued = applyOperationalCommand(c, {
      kind: 'issue',
      orders: [order],
    });
    expect(issued.columns).toEqual(c.columns);
    expect(issued.operations!.phase).toBe('resolution');
    expect(() =>
      applyOperationalCommand(issued, { kind: 'issue', orders: [] }),
    ).toThrow('planning');
    const reopened = applyOperationalCommand(issued, { kind: 'reopen' });
    expect(reopened.operations!.orders).toEqual([order]);
    expect(reopened.columns).toEqual(c.columns);
    const resolved = applyOperationalCommand(issued, { kind: 'resolve' });
    expect(resolved.columns[0]!.squareId).toBe(order.path[1]);
    expect(resolved.activeSide).toBe('allied');
    expect(resolved.turn).toBe(1);
    expect(resolved.date).toBe(c.date);
    const other = applyOperationalCommand(
      applyOperationalCommand(resolved, { kind: 'issue', orders: [] }),
      { kind: 'resolve' },
    );
    expect(other.turn).toBe(2);
    expect(other.date).toBe(campaignDate(c, 2));
    expect(other.activeSide).toBe('french');
    expect(fontenoyCampaignSchema.safeParse(other).success).toBe(true);
    expect(c.operations!.orders).toEqual([]);
    expect(c.columns[0]!.squareId).toBe(order.path[0]);
  });
  it('stops at hostile contact, refuses passing through, creates deterministic candidates and locks participants', () => {
    const c = started();
    const attacker = c.columns[0]!;
    const enemies = c.columns.filter(
      (col) => col.factionId !== attacker.factionId,
    );
    const target = square(c, 2, 4);
    for (const enemy of enemies) {
      enemy.squareId = target;
      enemy.concealment = 'hidden';
    }
    const order = { columnId: attacker.id, path: [attacker.squareId!, target] };
    expect(() =>
      routeCost(c, { ...order, path: [...order.path, square(c, 2, 5)] }),
    ).toThrow('opposing');
    const resolve = () =>
      applyOperationalCommand(
        applyOperationalCommand(c, { kind: 'issue', orders: [order] }),
        { kind: 'resolve' },
      );
    const after = resolve();
    expect(after).toEqual(resolve());
    expect(after.columns[0]!.squareId).toBe(attacker.squareId);
    expect(after.operations!.engagements.map((e) => e.defenderId)).toEqual(
      enemies.map((e) => e.id).sort(),
    );
    expect(() =>
      routeCost(after, { columnId: enemies[0]!.id, path: [target] }),
    ).toThrow('tabletop');
    expect(fontenoyCampaignSchema.safeParse(after).success).toBe(true);
  });
  it('rejects wrong-side, duplicate orders, draft/archived changes and ends exactly at the configured deadline', () => {
    const c = started();
    const enemy = c.columns.find(
      (col) => col.factionId !== c.columns[0]!.factionId,
    )!;
    expect(() =>
      routeCost(c, { columnId: enemy.id, path: [enemy.squareId!] }),
    ).toThrow('active faction');
    const order = {
      columnId: c.columns[0]!.id,
      path: [c.columns[0]!.squareId!],
    };
    expect(() =>
      applyOperationalCommand(c, { kind: 'issue', orders: [order, order] }),
    ).toThrow('one order');
    for (const status of ['draft', 'archived'] as const)
      expect(() =>
        applyOperationalCommand(
          { ...c, status },
          { kind: 'issue', orders: [] },
        ),
      ).toThrow('Start');
    c.settings.schedule.turnCount = 1;
    let after = c;
    for (let index = 0; index < 2; index++)
      after = applyOperationalCommand(
        applyOperationalCommand(after, { kind: 'issue', orders: [] }),
        { kind: 'resolve' },
      );
    expect(after.operations!.phase).toBe('finished');
    expect(after.turn).toBe(1);
    expect(after.date).toBe(c.date);
    expect(() =>
      applyOperationalCommand(after, { kind: 'issue', orders: [] }),
    ).toThrow('ended');
    expect(fontenoyCampaignSchema.safeParse(after).success).toBe(true);
  });
  it('redacts hidden identities, opposing rosters, commanders, orders and journal from faction serialization', () => {
    const c = started();
    const enemies = c.columns.filter(
      (col) => col.factionId !== c.columns[0]!.factionId,
    );
    enemies[0]!.concealment = 'hidden';
    c.activeSide = 'allied';
    const issued = applyOperationalCommand(c, {
      kind: 'issue',
      orders: [{ columnId: enemies[0]!.id, path: [enemies[0]!.squareId!] }],
    });
    const projected = projectOperationalView(issued, 'french');
    const text = JSON.stringify(projected);
    expect(
      projected.columns.find((col) => col.id === enemies[0]!.id),
    ).toBeUndefined();
    expect(
      projected.columns.find((col) => col.id === enemies[1]!.id)?.units,
    ).toBeNull();
    for (const col of enemies) {
      expect(text).not.toContain(col.displayName);
      for (const id of [...col.unitIds, ...col.commanderIds])
        expect(text).not.toContain(id);
    }
    expect(projected.orders).toEqual([]);
    expect(projected).not.toHaveProperty('events');
    expect(projectOperationalView(c, 'umpire').columns).toHaveLength(4);
  });
  it('rejects forged dates, blocked references and disconnected saved orders', () => {
    const c = started();
    expect(
      fontenoyCampaignSchema.safeParse({ ...c, date: '1745-06-01' }).success,
    ).toBe(false);
    c.operations!.rules.blockedSquareIds = [crypto.randomUUID()];
    expect(fontenoyCampaignSchema.safeParse(c).success).toBe(false);
    c.operations!.rules.blockedSquareIds = [];
    c.operations!.orders = [
      {
        columnId: c.columns[0]!.id,
        path: [c.columns[0]!.squareId!, square(c, 7, 11)],
      },
    ];
    expect(fontenoyCampaignSchema.safeParse(c).success).toBe(false);
  });
});
