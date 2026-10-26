// @vitest-environment node
import { expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { SqliteCampaignRepository } from '../../src/main/persistence/repository';
import type { FontenoyCampaign } from '../../src/domain/campaign';
import type {
  WaterlooCampaign,
  WaterlooCommand,
} from '../../src/domain/waterloo-schema';
import { defaultSimultaneousSiegePolicy } from '../../src/domain/simultaneous-siege';

it('atomically saves siege reviews and outcomes with restart, replay, portable import and a clean clone', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'maurice-siege-test-'));
  const file = path.join(directory, 'campaigns.sqlite');
  const clean = () => {
    if (
      !path
        .resolve(directory)
        .startsWith(path.join(tmpdir(), 'maurice-siege-test-'))
    )
      throw new Error('Unsafe test cleanup.');
    rmSync(directory, { recursive: true, force: true });
  };
  let repo = new SqliteCampaignRepository(file);
  const destination = new SqliteCampaignRepository(':memory:');
  const audit = {
    actor: 'Umpire',
    reason: 'Both players reviewed the provisional siege policy.',
  };
  const current = () => repo.library().active as WaterlooCampaign;
  const act = (command: WaterlooCommand) =>
    repo.waterloo({
      ...audit,
      id: current().id,
      expectedRevision: current().revision,
      command,
    });
  try {
    const source = repo.create({ title: 'Tournai source', ...audit })
      .active as FontenoyCampaign;
    repo.clone({
      id: source.id,
      expectedRevision: source.revision,
      profile: 'simultaneous_fontenoy',
      title: 'Siege acceptance',
      ...audit,
    });
    const policy = defaultSimultaneousSiegePolicy(current());
    policy.minutesPerSiegeTurn = 360;
    policy.rules.siegeThreshold = 1;
    act({ kind: 'maurice-siege-policy', policy });
    for (const side of ['french', 'allied'] as const)
      act({ kind: 'orders', side, orders: [], lock: true });
    act({ kind: 'resolve' });
    const unreviewed = repo.library();
    expect(() => act({ kind: 'finalize' })).toThrow('Review Tournai');
    expect(repo.library()).toEqual(unreviewed);
    act({
      kind: 'maurice-siege-review',
      review: {
        conditions: { invested: true, supplied: true, relieved: false },
        exhaustion: { french: 0, allied: 0 },
        notes: 'Investment and supply confirmed for all six calendar hours.',
      },
    });
    const reviewed = repo.library();
    repo.close();
    repo = new SqliteCampaignRepository(file);
    expect(repo.library()).toEqual(reviewed);
    const check = new DatabaseSync(file);
    check.exec(
      "CREATE TRIGGER fail_siege_event BEFORE INSERT ON campaign_events BEGIN SELECT RAISE(ABORT, 'simulated siege journal failure'); END;",
    );
    try {
      expect(() => act({ kind: 'finalize' })).toThrow();
      expect(repo.library()).toEqual(reviewed);
    } finally {
      check.exec('DROP TRIGGER fail_siege_event');
      check.close();
    }
    act({ kind: 'finalize' });
    expect(current().fontenoy!.siege.campaign!.victory?.winner).toBe('french');
    const concluded = repo.library();
    repo.close();
    repo = new SqliteCampaignRepository(file);
    expect(repo.library()).toEqual(concluded);
    const data = repo.exportCampaign({
      id: current().id,
      expectedRevision: current().revision,
    });
    const imported = destination.importCampaign(data)
      .active as WaterlooCampaign;
    expect(imported.fontenoy).toEqual(current().fontenoy);
    expect(imported.revision).toBe(current().revision + 1);
    const tampered = structuredClone(data);
    const campaign = tampered.campaign as WaterlooCampaign;
    campaign.fontenoy!.siege.campaign!.checkpoints[0]!.review.notes =
      'An altered attestation.';
    const rejected = new SqliteCampaignRepository(':memory:');
    try {
      expect(() => rejected.importCampaign(tampered)).toThrow();
    } finally {
      rejected.close();
    }
    expect(() => act({ kind: 'reset-orders' })).toThrow('concluded');
    const id = current().id;
    repo.clone({
      id,
      expectedRevision: current().revision,
      title: 'Fresh siege',
      ...audit,
    });
    expect(current().fontenoy!.siege.progress).toBe(0);
    expect(current().fontenoy!.siege.campaign).toBeUndefined();
    expect(repo.open(id).active).toEqual(concluded.active);
  } finally {
    repo.close();
    destination.close();
    clean();
  }
});
