import { describe, expect, it } from 'vitest';
import { campaignSchema } from '../../src/domain/campaign';
import {
  fontenoyModule,
  seedFontenoy,
  setupIssues,
  scheduleEndDate,
} from '../../src/domain/fontenoy';
import { editSetup } from '../../src/domain/setup-editing';
import { campaignFixture, testId } from '../fixtures/campaign';

function seed() {
  let index = 1000;
  return seedFontenoy(campaignFixture(), () => testId(index++));
}
describe('versioned Fontenoy module', () => {
  it('seeds the exact published scenario composition and records Dutch/Anglo-Allied provenance', () => {
    const campaign = seed();
    expect(campaignSchema.safeParse(campaign).success).toBe(true);
    expect(
      campaign.units.filter((u) => u.contingent === 'french'),
    ).toHaveLength(20);
    expect(campaign.units.filter((u) => u.contingent === 'dutch')).toHaveLength(
      7,
    );
    expect(
      campaign.units.filter((u) => u.contingent === 'anglo_allied'),
    ).toHaveLength(11);
    for (const group of fontenoyModule.unitGroups)
      expect(
        campaign.units.filter(
          (u) =>
            u.contingent === group.contingent &&
            u.type === group.type &&
            u.quality === group.quality,
        ),
      ).toHaveLength(group.count);
    expect(
      campaign.units.every(
        (u) =>
          u.provenance === 'official_maurice' && u.sourceRef.includes('95'),
      ),
    ).toBe(true);
    expect(
      campaign.columns.every((c) => c.provenance === 'house_rule_v0.1'),
    ).toBe(true);
  });
  it('creates 96 distinct schematic squares, eight places and no invented default route geometry', () => {
    const campaign = seed();
    expect(campaign.squares).toHaveLength(96);
    expect(new Set(campaign.squares.map((s) => s.id)).size).toBe(96);
    expect(
      campaign.squares
        .flatMap((s) => (s.locationName ? [s.locationName] : []))
        .sort(),
    ).toEqual([
      'Antoing',
      'Ath',
      'Fontenoy',
      'Leuze',
      'Lille',
      'Soignies',
      'Tournai',
      'Valenciennes',
    ]);
    expect(campaign.settings.map.roadEdges).toEqual([]);
    expect(campaign.settings.map.riverEdges).toEqual([]);
    expect(campaign.settings.map.kilometresPerSquare).toBeNull();
    expect(scheduleEndDate(campaign.settings.schedule)).toBe('1745-05-22');
  });
  it('transfers units between friendly columns once and rejects opposing ownership without mutating the original', () => {
    const campaign = seed();
    const first = campaign.columns[0]!;
    const second = campaign.columns[1]!;
    const unitId = first.unitIds[0]!;
    const edited = editSetup(
      campaign,
      { kind: 'assign', entity: 'unit', id: unitId, columnId: second.id },
      () => testId(5000),
    );
    expect(edited.columns[0]!.unitIds).not.toContain(unitId);
    expect(edited.columns[1]!.unitIds).toContain(unitId);
    expect(
      edited.columns.flatMap((c) => c.unitIds).filter((id) => id === unitId),
    ).toHaveLength(1);
    expect(campaign.columns[0]!.unitIds).toContain(unitId);
    expect(() =>
      editSetup(
        campaign,
        {
          kind: 'assign',
          entity: 'unit',
          id: unitId,
          columnId: campaign.columns[2]!.id,
        },
        () => testId(5000),
      ),
    ).toThrow('same faction');
  });
  it('preserves squares, forces and assignments when changing map scale or road adjacency', () => {
    const campaign = seed();
    const from = campaign.squares[0]!.id;
    const to = campaign.squares[1]!.id;
    const scaled = editSetup(campaign, { kind: 'scale', value: 5 }, () =>
      testId(5000),
    );
    const connected = editSetup(scaled, { kind: 'add-road', from, to }, () =>
      testId(5000),
    );
    expect(campaignSchema.safeParse(connected).success).toBe(true);
    expect(connected.squares).toEqual(campaign.squares);
    expect(connected.units).toEqual(campaign.units);
    expect(connected.columns).toEqual(campaign.columns);
    const removed = editSetup(
      connected,
      { kind: 'remove-road', from, to },
      () => testId(5000),
    );
    expect(removed.settings.map.roadEdges).toEqual([]);
    const bad = editSetup(
      campaign,
      { kind: 'add-road', from, to: campaign.squares[30]!.id },
      () => testId(5000),
    );
    expect(campaignSchema.safeParse(bad).success).toBe(false);
  });
  it('retains units when removing a column and blocks start until assignments and acknowledgements are complete', () => {
    const campaign = seed();
    expect(setupIssues(campaign)).toHaveLength(2);
    const removed = editSetup(
      campaign,
      { kind: 'remove-column', id: campaign.columns[0]!.id },
      () => testId(5000),
    );
    expect(removed.units).toEqual(campaign.units);
    expect(setupIssues(removed).join(' ')).toContain(
      'need a column assignment',
    );
    campaign.settings.reviewedHouseRules = true;
    campaign.settings.reviewedSchematicMap = true;
    expect(setupIssues(campaign)).toEqual([]);
  });
  it('rejects changed module totals, duplicate assignments, invalid objectives and forged active state', () => {
    const campaign = seed();
    campaign.units[0]!.quality = 'trained';
    expect(campaignSchema.safeParse(campaign).success).toBe(false);
    const duplicate = seed();
    duplicate.columns[1]!.unitIds.push(duplicate.columns[0]!.unitIds[0]!);
    expect(campaignSchema.safeParse(duplicate).success).toBe(false);
    const objective = seed();
    objective.settings.objectives[0]!.squareId = testId(9999);
    expect(campaignSchema.safeParse(objective).success).toBe(false);
    const started = {
      ...seed(),
      status: 'active',
      turn: 1,
      date: '1745-05-01',
      activeSide: 'french',
    };
    expect(campaignSchema.safeParse(started).success).toBe(false);
  });
});
