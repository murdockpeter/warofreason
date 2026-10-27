// @vitest-environment node
import { expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SqliteCampaignRepository } from '../../src/main/persistence/repository';
import type { WaterlooCampaign } from '../../src/domain/waterloo-schema';
import { newManualRuling } from '../../src/domain/manual-adjudication';

it('atomically journals manual rulings through failure, restart, portable replay, tamper rejection and clean cloning', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'maurice-manual-test-'));
  const file = path.join(directory, 'campaigns.sqlite');
  const clean = () => {
    if (
      !path
        .resolve(directory)
        .startsWith(path.join(tmpdir(), 'maurice-manual-test-'))
    )
      throw new Error('Unsafe test cleanup.');
    rmSync(directory, { recursive: true, force: true });
  };
  let repo = new SqliteCampaignRepository(file);
  const destination = new SqliteCampaignRepository(':memory:'),
    rejected = new SqliteCampaignRepository(':memory:');
  const audit = {
    actor: 'Test umpire',
    reason: 'Players agreed a manual outcome.',
  };
  const current = () => repo.library().active as WaterlooCampaign;
  const command = () => {
    const c = current(),
      ruling = newManualRuling(c, c.corps[0]!.id);
    ruling.placements[0]!.hexId = c.hexes.at(-1)!.id;
    ruling.placements[0]!.reportedStrength = 'About 2,000 men';
    ruling.decision = 'Private umpire explanation.';
    ruling.endAt += 30;
    return { kind: 'manual-adjudication' as const, ruling };
  };
  const act = (input = command()) =>
    repo.waterloo({
      id: current().id,
      expectedRevision: current().revision,
      ...audit,
      command: input,
    });
  try {
    repo.create({
      title: 'Manual operations',
      profile: 'simultaneous_fontenoy',
      ...audit,
    });
    const baseline = repo.library(),
      initial = current(),
      stale = command();
    const db = new DatabaseSync(file);
    db.exec(
      "CREATE TRIGGER fail_manual_event BEFORE INSERT ON campaign_events BEGIN SELECT RAISE(ABORT, 'simulated journal failure'); END;",
    );
    try {
      expect(() => act()).toThrow();
      expect(repo.library()).toEqual(baseline);
    } finally {
      db.exec('DROP TRIGGER fail_manual_event');
      db.close();
    }
    act();
    expect(() => act(stale)).toThrow('campaign changed');
    expect(() =>
      repo.waterloo({
        id: current().id,
        expectedRevision: 1,
        ...audit,
        command: command(),
      }),
    ).toThrow();
    const first = current().adjudications![0]!;
    const correction = command();
    correction.ruling.correctsId = first.id;
    correction.ruling.placements[0]!.hexId = initial.corps[0]!.hexId;
    correction.ruling.decision = 'New ruling corrects the earlier location.';
    act(correction);
    const saved = repo.library();
    repo.close();
    repo = new SqliteCampaignRepository(file);
    expect(repo.library()).toEqual(saved);
    const exported = repo.exportCampaign({
      id: current().id,
      expectedRevision: current().revision,
    });
    const imported = destination.importCampaign(exported)
      .active as WaterlooCampaign;
    expect(imported.adjudications).toEqual(current().adjudications);
    expect(imported.corps).toEqual(current().corps);
    const tampered = structuredClone(exported);
    (tampered.campaign as WaterlooCampaign).adjudications![0]!.ruling.decision =
      'Rewritten explanation.';
    expect(() => rejected.importCampaign(tampered)).toThrow();
    const id = current().id;
    repo.clone({
      id,
      expectedRevision: current().revision,
      title: 'Fresh manual setup',
      ...audit,
    });
    expect(current().adjudications).toBeUndefined();
    expect(current().corps.every((f) => f.reportedStrength === undefined)).toBe(
      true,
    );
    expect(
      current().fontenoy!.units.every((u) => u.currentStatus === 'ready'),
    ).toBe(true);
    expect(repo.open(id).active).toEqual(saved.active);
  } finally {
    repo.close();
    destination.close();
    rejected.close();
    clean();
  }
});
