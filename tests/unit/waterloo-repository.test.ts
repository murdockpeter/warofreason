// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SqliteCampaignRepository } from '../../src/main/persistence/repository';
import { exportSchema } from '../../src/domain/campaign';
import type {
  WaterlooCampaign,
  WaterlooCommand,
} from '../../src/domain/waterloo-schema';
let directory: string, repo: SqliteCampaignRepository;
const audit = {
  actor: 'Test umpire',
  reason: 'Verified simultaneous campaign action.',
};
beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), 'maurice-waterloo-test-'));
  repo = new SqliteCampaignRepository(path.join(directory, 'campaigns.sqlite'));
});
afterEach(() => {
  repo.close();
  if (
    !path
      .resolve(directory)
      .startsWith(path.join(tmpdir(), 'maurice-waterloo-test-'))
  )
    throw new Error('Unsafe cleanup');
  rmSync(directory, { recursive: true, force: true });
});
const current = () => repo.library().active as WaterlooCampaign;
function action(command: WaterlooCommand) {
  const c = current();
  return repo.waterloo({
    ...audit,
    id: c.id,
    expectedRevision: c.revision,
    command,
  });
}
describe('simultaneous campaign persistence', () => {
  it('replays opt-in preparation through locks, restart and import without rewriting earlier snapshots', () => {
    repo.createWaterloo({ ...audit, title: 'Preparation persistence' });
    const old = repo.exportCampaign({ id: current().id, expectedRevision: 1 });
    action({ kind: 'enable-preparation' });
    const screen = current().corps.find(
      (f) => f.detachment && f.side === 'french',
    )!;
    action({
      kind: 'deploy-detachment',
      corpsId: screen.id,
      hqId: current().hqs[0]!.id,
      hexId: '0,0',
      source: 'hq',
    });
    action({ kind: 'withdrawals', side: 'french', orders: [], lock: true });
    repo.close();
    repo = new SqliteCampaignRepository(
      path.join(directory, 'campaigns.sqlite'),
    );
    expect(current().preparation!.submissions[0]!.locked).toBe(true);
    action({ kind: 'withdrawals', side: 'allied', orders: [], lock: true });
    action({ kind: 'resolve-withdrawals' });
    const c = current(),
      data = repo.exportCampaign({ id: c.id, expectedRevision: c.revision });
    expect(data.events[0]!.after).toEqual(old.events[0]!.after);
    expect(exportSchema.safeParse(data).success).toBe(true);
    const destination = new SqliteCampaignRepository(':memory:');
    try {
      destination.importCampaign(data);
      expect(
        (destination.library().active as WaterlooCampaign).preparation,
      ).toEqual(c.preparation);
      expect((destination.library().active as WaterlooCampaign).corps).toEqual(
        c.corps,
      );
    } finally {
      destination.close();
    }
    const forged = structuredClone(data);
    if (forged.formatVersion !== 2) throw new Error('Expected current format');
    const enabled = forged.events.find(
      (e) => e.waterlooAction?.command.kind === 'enable-preparation',
    )!;
    enabled.waterlooAction!.recordId = '11111111-1111-4111-8111-111111111111';
    expect(exportSchema.safeParse(forged).success).toBe(false);
  });
  it('persists one-side locks without movement and replays resolution across restart and transfer', () => {
    repo.createWaterloo({ ...audit, title: 'Portable simultaneous game' });
    let c = current();
    action({
      kind: 'orders',
      side: 'french',
      orders: [
        {
          corpsId: c.corps[0]!.id,
          priority: 0,
          segments: [
            {
              path: ['3,4', '4,4'],
              roadOnly: true,
              startAt: 390,
              hqId: c.hqs[0]!.id,
            },
          ],
        },
      ],
      lock: true,
    });
    repo.close();
    repo = new SqliteCampaignRepository(
      path.join(directory, 'campaigns.sqlite'),
    );
    expect(current().submissions[0]!.locked).toBe(true);
    expect(current().corps[0]!.hexId).toBe('3,4');
    action({ kind: 'orders', side: 'allied', orders: [], lock: true });
    action({ kind: 'resolve' });
    c = current();
    expect(c.corps[0]!.hexId).toBe('4,4');
    const data = repo.exportCampaign({
      id: c.id,
      expectedRevision: c.revision,
    });
    expect(exportSchema.safeParse(data).success).toBe(true);
    const destination = new SqliteCampaignRepository(':memory:');
    try {
      destination.importCampaign(data);
      expect((destination.library().active as WaterlooCampaign).corps).toEqual(
        c.corps,
      );
      expect(destination.library().events.at(-1)!.category).toBe('imported');
    } finally {
      destination.close();
    }
  });
  it('rejects stale and invalid commands atomically', () => {
    repo.createWaterloo({ ...audit, title: 'Atomic orders' });
    const before = repo.library(),
      c = current();
    expect(() =>
      repo.waterloo({
        ...audit,
        id: c.id,
        expectedRevision: 0,
        command: { kind: 'resolve' },
      }),
    ).toThrow();
    expect(() => action({ kind: 'resolve' })).toThrow('Both sides');
    expect(repo.library()).toEqual(before);
    action({ kind: 'orders', side: 'french', orders: [], lock: true });
    expect(() =>
      repo.waterloo({
        ...audit,
        id: c.id,
        expectedRevision: c.revision,
        command: { kind: 'reset-orders' },
      }),
    ).toThrow('changed');
  });
  it('rejects a journal whose command or after-state has been forged', () => {
    repo.createWaterloo({ ...audit, title: 'Replay validation' });
    action({ kind: 'orders', side: 'french', orders: [], lock: true });
    const c = current();
    const data = repo.exportCampaign({
      id: c.id,
      expectedRevision: c.revision,
    });
    const forged = structuredClone(data);
    if (
      forged.campaign.schemaVersion !== 3 ||
      forged.events.at(-1)!.after.schemaVersion !== 3
    )
      throw new Error('Expected Waterloo');
    (forged.events.at(-1)!.after as WaterlooCampaign).corps[0]!.hexId = '4,4';
    forged.campaign = structuredClone(forged.events.at(-1)!.after);
    expect(exportSchema.safeParse(forged).success).toBe(false);
    const wrongReceipt = structuredClone(data);
    if (wrongReceipt.formatVersion !== 2)
      throw new Error('Expected current backup');
    wrongReceipt.events.at(-1)!.waterlooAction!.command = {
      kind: 'reset-orders',
    };
    expect(exportSchema.safeParse(wrongReceipt).success).toBe(false);
  });
  it('clones to an independent opening scenario and archives read-only', () => {
    repo.createWaterloo({ ...audit, title: 'Original' });
    const source = current();
    action({ kind: 'orders', side: 'french', orders: [], lock: true });
    const c = current();
    repo.clone({
      ...audit,
      id: c.id,
      expectedRevision: c.revision,
      title: 'Copy',
    });
    const copy = current();
    expect(copy.id).not.toBe(source.id);
    expect(copy.seed).not.toBe(source.seed);
    expect(copy.corps[0]!.id).not.toBe(source.corps[0]!.id);
    expect(copy.phase).toBe('planning');
    expect(copy.submissions.every((s) => !s.locked)).toBe(true);
    expect(repo.library().events).toHaveLength(1);
    repo.archive({ ...audit, id: copy.id, expectedRevision: copy.revision });
    expect(() => action({ kind: 'resolve' })).toThrow('Archived');
  });
  it('keeps legacy Fontenoy creation, export and import alongside the new profile', () => {
    const old = repo.create({
      ...audit,
      title: 'Fontenoy remains available',
    }).active!;
    expect(old.schemaVersion).toBe(2);
    repo.createWaterloo({ ...audit, title: 'New profile' });
    repo.open(old.id);
    expect(repo.library().active).toEqual(old);
    expect(
      exportSchema.safeParse(
        repo.exportCampaign({ id: old.id, expectedRevision: old.revision }),
      ).success,
    ).toBe(true);
  });
});
