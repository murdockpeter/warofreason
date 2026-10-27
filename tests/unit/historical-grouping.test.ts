// @vitest-environment node
import { expect, it } from 'vitest';
import {
  historicalSeed,
  reviewHistorical,
  legacyHistoricalExport,
} from '../fixtures/historical-profile';
import { simultaneousStep as step } from '../fixtures/simultaneous-aftermath';
import {
  historicalFormationGroups,
  historicalFormationSize,
} from '../../src/domain/historical-grouping';
import { canRegroupHistorical } from '../../src/domain/historical-profile';
import { fontenoyHistoricalCatalogue } from '../../src/domain/fontenoy-historical';
import { SqliteCampaignRepository } from '../../src/main/persistence/repository';
import type { WaterlooCampaign } from '../../src/domain/waterloo-schema';

const command =
  (): import('../../src/domain/waterloo-schema').WaterlooCommand & {
    kind: 'historical-regroup';
  } => ({
    kind: 'historical-regroup' as const,
    regroup: {
      corpsIds: historicalFormationGroups.map(() => crypto.randomUUID()),
      notes: 'Common grouping basis reviewed; deployment remains provisional.',
    },
  });
it('uses the same reported-subunit basis for both coalitions, conserves all records, and labels artillery separately', () => {
  const c = historicalSeed();
  expect(c.corps.filter((f) => f.side === 'french')).toHaveLength(15);
  expect(c.corps.filter((f) => f.side === 'allied')).toHaveLength(13);
  expect(new Set(c.corps.map((f) => f.hexId)).size).toBe(c.corps.length);
  expect(
    new Set(historicalFormationGroups.flatMap((f) => f.organizationIds)).size,
  ).toBe(143);
  for (const brigade of fontenoyHistoricalCatalogue.organizations.filter((o) =>
    /brigade/i.test(o.displayName),
  )) {
    const members = fontenoyHistoricalCatalogue.organizations.filter(
      (o) =>
        o.parentId === brigade.id && !['army', 'formation'].includes(o.kind),
    );
    if (members.length)
      expect(
        historicalFormationGroups.filter((g) =>
          members.some((m) => g.organizationIds.includes(m.id)),
        ),
      ).toHaveLength(1);
  }
  for (const [i, group] of historicalFormationGroups.entries()) {
    const size = historicalFormationSize(c, c.corps[i]!.id);
    if (group.arm === 'artillery') expect(size.allArtillery).toBe(true);
    else if (!group.uncertain)
      expect(Number.parseInt(size.label)).toBeLessThanOrEqual(
        group.arm === 'foot' ? 12 : 24,
      );
    else expect(size.label).toContain('?');
  }
});
it('explicitly regroups an untouched old setup preserving regiment IDs and grades, and rejects repeat, progressed and invalid-ID requests', () => {
  const c = historicalSeed(true);
  delete c.fontenoy!.historicalProfile!.groupingVersion;
  const next = step(c, command());
  expect(next.fontenoy!.units).toEqual(c.fontenoy!.units);
  expect(next.fontenoy!.historicalProfile!.openingRatings).toEqual(
    c.fontenoy!.historicalProfile!.openingRatings,
  );
  expect(next.startDate).toBe(c.startDate);
  expect(next.cursor).toBe(c.cursor);
  expect(next.hqs.map((h) => h.id)).toEqual(c.hqs.map((h) => h.id));
  expect(next.corps).toHaveLength(28);
  expect(canRegroupHistorical(next)).toBe(false);
  expect(() => step(next, command())).toThrow('untouched');
  expect(() => step(reviewHistorical(c), command())).toThrow('untouched');
  const bad = command();
  bad.regroup.corpsIds[0] = c.fontenoy!.units[0]!.id;
  expect(() => step(c, bad)).toThrow('fresh unique');
  const duplicate = command();
  duplicate.regroup.corpsIds.fill(duplicate.regroup.corpsIds[0]!);
  expect(() => step(c, duplicate)).toThrow('fresh unique');
  expect(c.corps).toHaveLength(14);
});
it('imports legacy grouping without a version, persists explicit regroup and replays the exported command history', () => {
  const repo = new SqliteCampaignRepository(':memory:'),
    destination = new SqliteCampaignRepository(':memory:');
  try {
    const old = repo.importCampaign(legacyHistoricalExport())
      .active as WaterlooCampaign;
    repo.waterloo({
      id: old.id,
      expectedRevision: old.revision,
      actor: 'Test umpire',
      reason: 'Regroup setup.',
      command: command(),
    });
    const saved = repo.library().active as WaterlooCampaign;
    const exported = repo.exportCampaign({
      id: saved.id,
      expectedRevision: saved.revision,
    });
    const imported = destination.importCampaign(exported)
      .active as WaterlooCampaign;
    expect(imported.fontenoy).toEqual(saved.fontenoy);
    expect(imported.corps).toEqual(saved.corps);
    expect(imported.fontenoy!.units).toEqual(old.fontenoy!.units);
  } finally {
    repo.close();
    destination.close();
  }
});
