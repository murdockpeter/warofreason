// @vitest-environment node
import { expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SqliteCampaignRepository } from '../../src/main/persistence/repository';
import type {
  WaterlooCampaign,
  WaterlooCommand,
} from '../../src/domain/waterloo-schema';
import { newManualRuling } from '../../src/domain/manual-adjudication';

it('persists the expanded linked roster atomically, replays portable history and preserves the original campaign and clone identities', () => {
  const directory = mkdtempSync(
    path.join(tmpdir(), 'maurice-historical-test-'),
  );
  const clean = () => {
    if (
      !path
        .resolve(directory)
        .startsWith(path.join(tmpdir(), 'maurice-historical-test-'))
    )
      throw new Error('Unsafe cleanup');
    rmSync(directory, { recursive: true, force: true });
  };
  const file = path.join(directory, 'campaigns.sqlite');
  let repo = new SqliteCampaignRepository(file);
  const destination = new SqliteCampaignRepository(':memory:'),
    rejected = new SqliteCampaignRepository(':memory:');
  const audit = {
    actor: 'Historical test umpire',
    reason: 'Reviewed source identities and scenario adaptation.',
  };
  const current = () => repo.library().active as WaterlooCampaign;
  const act = (command: WaterlooCommand) =>
    repo.waterloo({
      id: current().id,
      expectedRevision: current().revision,
      ...audit,
      command,
    });
  try {
    const original = repo.create({
      title: 'Original 38-unit game',
      profile: 'simultaneous_fontenoy',
      ...audit,
    }).active!;
    repo.create({
      title: 'Historical regimental game',
      profile: 'historical_fontenoy',
      ...audit,
    });
    expect(current().fontenoy!.units).toHaveLength(143);
    const review: WaterlooCommand = {
      kind: 'historical-roster-review',
      review: {
        ratings: structuredClone(
          current().fontenoy!.historicalProfile!.openingRatings,
        ),
        acknowledgedScale: true,
        acknowledgedDeployment: true,
        acknowledgedSourceGaps: true,
        notes:
          'Regimental representation and proposed ratings reviewed by the players.',
      },
    };
    const initial = repo.library();
    const db = new DatabaseSync(file);
    db.exec(
      "CREATE TRIGGER fail_historical_event BEFORE INSERT ON campaign_events BEGIN SELECT RAISE(ABORT, 'simulated historical journal failure'); END;",
    );
    try {
      expect(() => act(review)).toThrow();
      expect(repo.library()).toEqual(initial);
    } finally {
      db.exec('DROP TRIGGER fail_historical_event');
      db.close();
    }
    act(review);
    const ruling = newManualRuling(current(), current().corps[0]!.id);
    ruling.placements[0]!.hexId = '0,7';
    ruling.units = [
      { unitId: current().fontenoy!.units[0]!.id, status: 'lost' },
    ];
    ruling.decision = 'Manual historical outcome, retaining source identity.';
    act({ kind: 'manual-adjudication', ruling });
    const saved = repo.library();
    repo.close();
    repo = new SqliteCampaignRepository(file);
    expect(repo.library()).toEqual(saved);
    const exported = repo.exportCampaign({
      id: current().id,
      expectedRevision: current().revision,
    });
    expect(
      (destination.importCampaign(exported).active as WaterlooCampaign)
        .fontenoy,
    ).toEqual(current().fontenoy);
    const tampered = structuredClone(exported);
    (
      tampered.campaign as WaterlooCampaign
    ).fontenoy!.historicalProfile!.reviewNotes = 'Rewritten agreement.';
    expect(() => rejected.importCampaign(tampered)).toThrow();
    const id = current().id,
      oldSources = current().fontenoy!.units.map((u) => u.historical);
    repo.clone({
      id,
      expectedRevision: current().revision,
      title: 'Historical setup clone',
      ...audit,
    });
    expect(current().fontenoy!.units.map((u) => u.historical)).toEqual(
      oldSources,
    );
    expect(current().fontenoy!.historicalProfile!.reviewedAt).toBeNull();
    expect(
      current().fontenoy!.units.every((u) => u.currentStatus === 'ready'),
    ).toBe(true);
    expect(current().adjudications).toBeUndefined();
    expect(repo.open(id).active).toEqual(saved.active);
    expect(repo.open(original.id).active).toEqual(original);
  } finally {
    repo.close();
    destination.close();
    rejected.close();
    clean();
  }
}, 30000);
