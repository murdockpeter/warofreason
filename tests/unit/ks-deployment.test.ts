// @vitest-environment node
import { expect, it } from 'vitest';
import { almaRoster, almaById } from '../../src/domain/alma-roster';
import { applyKsCommand, ksCampaignSchema } from '../../src/domain/crimean-ks';
import { deploymentLayout } from '../../src/domain/ks-deployment';
import { KsRepository } from '../../src/main/persistence/ks-repository';
import { ksSeed, ksForce, ksNow } from '../fixtures/crimean-ks';

const stage = () => ({
  kind: 'stage-roster' as const,
  rosterId: almaRoster.id,
  forceIds: almaRoster.entries.map(() => crypto.randomUUID()),
});
it('stages the complete dated catalogue without invented positions, clock, ratings or subordinate identities', () => {
  expect(almaById.size).toBe(almaRoster.entries.length);
  expect(new Set(almaRoster.entries.map((e) => e.allegiance))).toEqual(
    new Set(['britain', 'france', 'russia', 'ottoman']),
  );
  expect(
    almaRoster.entries.filter((e) => e.allegiance === 'ottoman'),
  ).toHaveLength(1);
  expect(almaRoster.entries.some((e) => e.name.includes('17th Lancers'))).toBe(
    true,
  );
  const old = applyKsCommand(
      ksSeed(),
      { kind: 'add-force', force: ksForce() },
      ksNow,
    ),
    c = applyKsCommand(old, stage(), ksNow);
  expect(c.forces).toEqual(old.forces);
  expect(c.campaignTime).toBe(old.campaignTime);
  expect(c.deploymentArea!.forces).toHaveLength(almaRoster.entries.length);
  for (const f of c.deploymentArea!.forces) {
    expect(f).not.toHaveProperty('position');
    expect(f).not.toHaveProperty('mapId');
    expect(f).not.toHaveProperty('rating');
  }
  expect(old).not.toHaveProperty('deploymentArea');
  expect(() => applyKsCommand(c, stage(), ksNow)).toThrow('already loaded');
});
it('deploys selected original identities atomically and prevents duplicates, missing records and source rewriting', () => {
  const c = applyKsCommand(ksSeed(), stage(), ksNow),
    ids = c.deploymentArea!.forces.slice(0, 3).map((f) => f.id),
    placements = deploymentLayout(ids, { x: 0.6, y: 0.4 }, 1.4);
  const command = {
    kind: 'deploy-staged' as const,
    mapId: 'sevastopol_airey_1856' as const,
    placements,
  };
  const after = applyKsCommand(c, command, ksNow);
  expect(after.forces.map((f) => f.id)).toEqual(ids);
  expect(after.deploymentArea!.forces).toHaveLength(
    almaRoster.entries.length - 3,
  );
  expect(after.forces[0]!.historical).toEqual(
    c.deploymentArea!.forces[0]!.historical,
  );
  expect(c.forces).toEqual([]);
  expect(() => applyKsCommand(after, command, ksNow)).toThrow('pasted twice');
  expect(() =>
    applyKsCommand(
      c,
      {
        ...command,
        placements: [
          ...placements,
          { forceId: crypto.randomUUID(), position: { x: 0.5, y: 0.5 } },
        ],
      },
      ksNow,
    ),
  ).toThrow();
  expect(c.forces).toEqual([]);
  const missing = structuredClone(after);
  missing.deploymentArea!.forces.pop();
  expect(ksCampaignSchema.safeParse(missing).success).toBe(false);
  const collision = structuredClone(c);
  collision.deploymentArea!.forces[1]!.id =
    collision.deploymentArea!.forces[0]!.id;
  expect(ksCampaignSchema.safeParse(collision).success).toBe(false);
  const renamed = { ...after.forces[0]!, name: 'Umpire display name' };
  expect(
    applyKsCommand(after, { kind: 'edit-force', force: renamed }, ksNow)
      .forces[0]!.historical,
  ).toEqual(renamed.historical);
  expect(() =>
    applyKsCommand(
      after,
      { kind: 'edit-force', force: { ...renamed, historical: undefined } },
      ksNow,
    ),
  ).toThrow();
  expect(() =>
    applyKsCommand(
      after,
      { kind: 'add-force', force: { ...renamed, id: crypto.randomUUID() } },
      ksNow,
    ),
  ).toThrow();
  const all = applyKsCommand(
    c,
    {
      ...command,
      placements: deploymentLayout(
        c.deploymentArea!.forces.map((f) => f.id),
        { x: 0.5, y: 0.5 },
        1.4,
      ),
    },
    ksNow,
  );
  expect(all.deploymentArea!.forces).toEqual([]);
  expect(() => applyKsCommand(all, stage(), ksNow)).toThrow('already loaded');
});
it('keeps bulk counter layouts distinct and inside both sheets near every edge', () => {
  const ids = almaRoster.entries.map((e) => e.id);
  for (const aspect of [8102 / 5814, 5888 / 4284])
    for (const anchor of [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 0.5, y: 0.5 },
    ]) {
      const p = deploymentLayout(ids, anchor, aspect);
      expect(
        new Set(p.map((p) => `${p.position.x},${p.position.y}`)).size,
      ).toBe(ids.length);
      for (const { position } of p) {
        expect(position.x).toBeGreaterThanOrEqual(0);
        expect(position.x).toBeLessThanOrEqual(1);
        expect(position.y).toBeGreaterThanOrEqual(0);
        expect(position.y).toBeLessThanOrEqual(1);
      }
    }
});
it('replays staged and deployed records through repository export/import with library summaries kept small', () => {
  const repo = new KsRepository(':memory:'),
    imported = new KsRepository(':memory:');
  const audit = {
    actor: 'Test umpire',
    reason: 'Reviewed dated Alma source identities.',
  };
  try {
    repo.create({ title: 'Alma staging', ...audit });
    const act = (command: Parameters<typeof applyKsCommand>[1]) => {
      const c = repo.library().active!;
      return repo.act({
        id: c.id,
        expectedRevision: c.revision,
        command,
        ...audit,
      });
    };
    act(stage());
    const c = repo.library().active!;
    act({
      kind: 'deploy-staged',
      mapId: 'crimea_wyld_1855',
      placements: deploymentLayout(
        c.deploymentArea!.forces.slice(0, 8).map((f) => f.id),
        { x: 0.5, y: 0.5 },
        1.4,
      ),
    });
    const saved = repo.library();
    expect(saved.campaigns[0]).not.toHaveProperty('deploymentArea');
    const portable = repo.export({
      id: saved.active!.id,
      expectedRevision: saved.active!.revision,
    });
    expect(imported.import(portable)).toEqual(saved);
    expect(saved.events.at(-1)!.command?.kind).toBe('deploy-staged');
  } finally {
    repo.close();
    imported.close();
  }
});
