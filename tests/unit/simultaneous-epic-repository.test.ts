// @vitest-environment node
import { expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SqliteCampaignRepository } from '../../src/main/persistence/repository';
import type { FontenoyCampaign } from '../../src/domain/campaign';
import type {
  WaterlooCampaign,
  WaterlooCommand,
} from '../../src/domain/waterloo-schema';
import {
  currentEpicEntries,
  epicSummary,
} from '../../src/domain/simultaneous-epic';
it('atomically saves points/corrections with restart, portable replay, tamper rejection and clean clones', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'maurice-epic-test-')),
    file = path.join(directory, 'campaigns.sqlite');
  const clean = () => {
    if (
      !path
        .resolve(directory)
        .startsWith(path.join(tmpdir(), 'maurice-epic-test-'))
    )
      throw new Error('Unsafe test cleanup.');
    rmSync(directory, { recursive: true, force: true });
  };
  let repo = new SqliteCampaignRepository(file);
  const destination = new SqliteCampaignRepository(':memory:'),
    rejected = new SqliteCampaignRepository(':memory:');
  const audit = { actor: 'Umpire', reason: 'Manually agreed scoring record.' };
  const current = () => repo.library().active as WaterlooCampaign;
  const act = (command: WaterlooCommand) =>
    repo.waterloo({
      id: current().id,
      expectedRevision: current().revision,
      command,
      ...audit,
    });
  try {
    const source = repo.create({ title: 'Epic setup', ...audit })
      .active as FontenoyCampaign;
    repo.clone({
      id: source.id,
      expectedRevision: 1,
      profile: 'simultaneous_fontenoy',
      title: 'Epic operations',
      ...audit,
    });
    act({ kind: 'maurice-epic-enable' });
    const entry: WaterlooCommand = {
      kind: 'maurice-epic-record',
      entryId: null,
      expectedVersion: 0,
      reason: 'Entered manually.',
      input: {
        source: { kind: 'campaign', title: 'Reviewed campaign event' },
        points: { french: 0, allied: null },
        notes: 'Actual player-entered points.',
      },
    };
    const before = repo.library(),
      db = new DatabaseSync(file);
    db.exec(
      "CREATE TRIGGER fail_epic_event BEFORE INSERT ON campaign_events BEGIN SELECT RAISE(ABORT, 'simulated points journal failure'); END;",
    );
    try {
      expect(() => act(entry)).toThrow();
      expect(repo.library()).toEqual(before);
    } finally {
      db.exec('DROP TRIGGER fail_epic_event');
      db.close();
    }
    act(entry);
    const first = structuredClone(currentEpicEntries(current())[0]!);
    act({
      ...entry,
      entryId: first.entryId,
      expectedVersion: 1,
      reason: 'Corrected French entry.',
      input: { ...first.input, points: { french: 3, allied: 0 } },
    });
    expect(epicSummary(current(), 'french').total).toBe(3);
    expect(current().fontenoy!.epic!.revisions[0]).toEqual(first);
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
    expect(imported.fontenoy).toEqual(current().fontenoy);
    const altered = structuredClone(exported);
    (
      altered.campaign as WaterlooCampaign
    ).fontenoy!.epic!.revisions[1]!.reason = 'Rewritten rationale';
    expect(() => rejected.importCampaign(altered)).toThrow();
    const id = current().id;
    repo.clone({
      id,
      expectedRevision: current().revision,
      title: 'Fresh scoring',
      ...audit,
    });
    expect(current().fontenoy!.epic).toBeUndefined();
    expect(repo.open(id).active).toEqual(saved.active);
  } finally {
    repo.close();
    destination.close();
    rejected.close();
    clean();
  }
});
