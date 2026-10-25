// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { SqliteCampaignRepository } from '../../src/main/persistence/repository';
import {
  seedFontenoyOperational,
  cloneFontenoyOperational,
} from '../../src/domain/fontenoy-operational';
import { applyWaterlooCommand } from '../../src/domain/waterloo';
import { waterlooCampaignSchema } from '../../src/domain/waterloo-schema';
import { waterlooBriefHtml } from '../../src/domain/waterloo-brief';
import { exportSchema } from '../../src/domain/campaign';
import type { FontenoyCampaign } from '../../src/domain/campaign';
import type {
  WaterlooCampaign,
  WaterlooCommand,
} from '../../src/domain/waterloo-schema';
const now = '2026-10-25T12:00:00.000Z';
const audit = {
  actor: 'Maurice player',
  reason: 'Fontenoy operational acceptance.',
};
const step = (c: WaterlooCampaign, command: WaterlooCommand) =>
  applyWaterlooCommand(c, { command, recordId: randomUUID(), timestamp: now });
describe('Maurice-centred Fontenoy operations', () => {
  it('uses the exact Maurice scenario roster, commanders, 1745 calendar and Fontenoy geography', () => {
    const c = seedFontenoyOperational('Maurice campaign', randomUUID, now);
    expect(c.moduleId).toBe('fontenoy-operational');
    expect(c.rulesetVersion).toBe('maurice_operational_v0.1');
    expect(c.startDate).toBe('1745-05-01');
    expect(c.hexes).toHaveLength(96);
    expect(c.hexes.map((h) => h.name)).toEqual(
      expect.arrayContaining([
        'Tournai',
        'Fontenoy',
        'Lille',
        'Ath',
        'Soignies',
      ]),
    );
    expect(c.fontenoy!.units).toHaveLength(38);
    for (const [contingent, count] of [
      ['french', 20],
      ['dutch', 7],
      ['anglo_allied', 11],
    ] as const)
      expect(
        c.fontenoy!.units.filter((u) => u.contingent === contingent),
      ).toHaveLength(count);
    expect(c.corps.map((f) => f.name)).toEqual([
      'French Column A',
      'French Column B',
      'Dutch Column',
      'Anglo-Allied Column',
    ]);
    expect(c.hqs.map((h) => h.name)).toEqual([
      'Maurice de Saxe',
      'Dutch command',
      'Duke of Cumberland',
    ]);
    expect(c.fontenoy!.siege.hexId).toBe('3,2');
    expect(c.fontenoy!.kilometresPerHex).toBeNull();
    expect(c.edges.every((e) => !e.road)).toBe(true);
    expect(JSON.stringify(c)).not.toMatch(
      /Napoleon|Blücher|Prussian|1815|Crossroads/,
    );
  });
  it('copies saved Fontenoy setup without overwriting its history, unit facts or configured edges', () => {
    const repo = new SqliteCampaignRepository(':memory:');
    try {
      let source = repo.create({ ...audit, title: 'Saved Fontenoy' })
        .active as FontenoyCampaign;
      source.columns[0]!.displayName = 'Saxe advance column';
      source.settings.map.roadEdges = [
        {
          from: source.squares.find((s) => s.column === 3 && s.row === 2)!.id,
          to: source.squares.find((s) => s.column === 4 && s.row === 2)!.id,
          provenance: 'house_rule_v0.1',
        },
      ];
      repo.saveSetup({
        ...audit,
        id: source.id,
        expectedRevision: source.revision,
        settings: source.settings,
        columns: source.columns,
        commanders: source.commanders,
      });
      source = repo.library().active as FontenoyCampaign;
      const original = repo.exportCampaign({
        id: source.id,
        expectedRevision: source.revision,
      });
      const copied = repo.clone({
        ...audit,
        id: source.id,
        expectedRevision: source.revision,
        title: 'Simultaneous Fontenoy',
        profile: 'simultaneous_fontenoy',
      });
      const c = copied.active as WaterlooCampaign;
      expect(c.corps[0]!.name).toBe('Saxe advance column');
      expect(
        c.edges.some(
          (e) =>
            e.road &&
            [e.from, e.to].includes('3,2') &&
            [e.from, e.to].includes('4,2'),
        ),
      ).toBe(true);
      expect(copied.events[0]!.sourceCampaignId).toBe(source.id);
      expect(
        c.fontenoy!.units.map((u) => [u.contingent, u.type, u.quality]),
      ).toEqual(source.units.map((u) => [u.contingent, u.type, u.quality]));
      repo.open(source.id);
      expect(
        repo.exportCampaign({
          id: source.id,
          expectedRevision: source.revision,
        }).events,
      ).toEqual(original.events);
    } finally {
      repo.close();
    }
  });
  it('keeps a Fontenoy operational clone in Fontenoy with fresh roster identities', () => {
    const c = seedFontenoyOperational('Maurice', randomUUID, now),
      copy = cloneFontenoyOperational(c, 'Maurice copy', randomUUID, now);
    expect(copy.moduleId).toBe('fontenoy-operational');
    expect(copy.fontenoy!.units).toHaveLength(38);
    expect(copy.fontenoy!.units[0]!.id).not.toBe(c.fontenoy!.units[0]!.id);
    expect(copy.corps[0]!.id).not.toBe(c.corps[0]!.id);
    expect(copy.hqs[0]!.name).toBe('Maurice de Saxe');
    expect(copy.hexes).toEqual(c.hexes);
    expect(copy.date).toBe('1745-05-01');
  });
  it('freezes actual Maurice units into a manually resolved tactical brief', () => {
    let c = seedFontenoyOperational('Fontenoy', randomUUID, now);
    c.corps[0]!.hexId = '5,4';
    c.corps[2]!.hexId = '7,4';
    for (const [side, index] of [
      ['french', 0],
      ['allied', 2],
    ] as const)
      c = step(c, {
        kind: 'orders',
        side,
        orders: [
          {
            corpsId: c.corps[index]!.id,
            priority: 0,
            segments: [
              {
                path: [c.corps[index]!.hexId!, '6,4'],
                roadOnly: false,
                hqId: c.hqs.find((h) => h.army === c.corps[index]!.army)!.id,
                startAt: 390,
              },
            ],
          },
        ],
        lock: true,
      });
    c = step(c, { kind: 'resolve' });
    c = step(c, {
      kind: 'declare-battle',
      encounterId: c.encounters[0]!.id,
      title: 'Maurice field battle',
    });
    const b = c.battles[0]!;
    expect(b.maurice!.flatMap((f) => f.units)).toHaveLength(17);
    const frozen = structuredClone(b.maurice);
    c.fontenoy!.units[0]!.displayName = 'Later roster annotation';
    expect(b.maurice).toEqual(frozen);
    const html = waterlooBriefHtml(c, b);
    expect(html).toContain('Frozen Maurice rosters');
    expect(html).toContain('Maurice / Fontenoy, 1745');
    expect(html).toContain('Maurice de Saxe');
    expect(html).not.toContain('Later roster annotation');
  });
  it('exports/replays the Maurice profile and preparation extension through the existing repository', () => {
    const repo = new SqliteCampaignRepository(':memory:'),
      destination = new SqliteCampaignRepository(':memory:');
    try {
      let c = repo.create({
        ...audit,
        title: 'Fontenoy simultaneous',
        profile: 'simultaneous_fontenoy',
      }).active as WaterlooCampaign;
      repo.waterloo({
        ...audit,
        id: c.id,
        expectedRevision: c.revision,
        command: { kind: 'enable-preparation' },
      });
      c = repo.library().active as WaterlooCampaign;
      expect(c.preparation!.ruleId).toBe('maurice_preparation_v0.1');
      expect(repo.library().events.at(-1)!.category).toBe(
        'simultaneous_action',
      );
      const data = repo.exportCampaign({
        id: c.id,
        expectedRevision: c.revision,
      });
      expect(exportSchema.safeParse(data).success).toBe(true);
      destination.importCampaign(data);
      expect(
        (destination.library().active as WaterlooCampaign).fontenoy,
      ).toEqual(c.fontenoy);
    } finally {
      repo.close();
      destination.close();
    }
  });
  it('rejects changing the setting to Prussian forces or inventing Maurice scenario qualities', () => {
    const c = seedFontenoyOperational('Maurice', randomUUID, now);
    const wrong = structuredClone(c);
    wrong.corps[2]!.army = 'prussian';
    expect(waterlooCampaignSchema.safeParse(wrong).success).toBe(false);
    c.fontenoy!.units[0]!.quality = 'conscript';
    expect(waterlooCampaignSchema.safeParse(c).success).toBe(false);
  });
});
