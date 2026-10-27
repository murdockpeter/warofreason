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
import { intelligenceView } from '../../src/domain/simultaneous-intelligence';

it('saves intelligence atomically with stale-write guards, restart, portable replay, tamper rejection and clean clones', () => {
  const directory = mkdtempSync(
    path.join(tmpdir(), 'maurice-intelligence-test-'),
  );
  const file = path.join(directory, 'campaigns.sqlite');
  const clean = () => {
    if (
      !path
        .resolve(directory)
        .startsWith(path.join(tmpdir(), 'maurice-intelligence-test-'))
    )
      throw new Error('Unsafe test cleanup.');
    rmSync(directory, { recursive: true, force: true });
  };
  let repo = new SqliteCampaignRepository(file);
  const destination = new SqliteCampaignRepository(':memory:'),
    rejected = new SqliteCampaignRepository(':memory:');
  const audit = { actor: 'Umpire', reason: 'Manual scouting acceptance.' };
  const current = () => repo.library().active as WaterlooCampaign;
  const act = (command: WaterlooCommand) =>
    repo.waterloo({
      id: current().id,
      expectedRevision: current().revision,
      command,
      ...audit,
    });
  try {
    repo.create({
      title: 'Scouting operations',
      profile: 'simultaneous_fontenoy',
      ...audit,
    });
    const command: WaterlooCommand = {
      kind: 'maurice-scout-request',
      input: {
        corpsId: current().corps[0]!.id,
        hexId: '6,4',
        question: 'Observe the approach.',
      },
    };
    const before = repo.library(),
      db = new DatabaseSync(file);
    db.exec(
      "CREATE TRIGGER fail_scout_event BEFORE INSERT ON campaign_events BEGIN SELECT RAISE(ABORT, 'simulated scouting journal failure'); END;",
    );
    try {
      expect(() => act(command)).toThrow();
      expect(repo.library()).toEqual(before);
    } finally {
      db.exec('DROP TRIGGER fail_scout_event');
      db.close();
    }
    act(command);
    expect(() =>
      repo.waterloo({
        id: current().id,
        expectedRevision: before.active!.revision,
        command,
        ...audit,
      }),
    ).toThrow();
    const report: WaterlooCommand = {
      kind: 'maurice-intelligence-report',
      requestId: current().fontenoy!.intelligence!.requests[0]!.id,
      expectedVersion: 0,
      input: {
        level: 'estimated',
        hexId: '6,4',
        expiresAfterTurn: 2,
        label: 'Distant troops',
        details: 'Approximate strength agreed at table.',
        notes: 'Player release.',
      },
      reason: 'Private referee reasoning.',
    };
    act(report);
    const first = structuredClone(current().fontenoy!.intelligence!.reports[0]);
    act({
      ...report,
      expectedVersion: 1,
      input: { level: 'none', notes: 'Observation withdrawn.' },
      reason: 'Corrected report.',
    });
    expect(current().fontenoy!.intelligence!.reports[0]).toEqual(first);
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
    expect(imported.fontenoy!.intelligence).toEqual(
      current().fontenoy!.intelligence,
    );
    expect(intelligenceView(imported, 'french')[0]!.observation).toEqual({
      level: 'none',
      notes: 'Observation withdrawn.',
    });
    const altered = structuredClone(exported);
    (
      altered.campaign as WaterlooCampaign
    ).fontenoy!.intelligence!.reports[0]!.reason =
      'Rewritten private rationale';
    expect(() => rejected.importCampaign(altered)).toThrow();
    const id = current().id;
    repo.clone({
      id,
      expectedRevision: current().revision,
      title: 'Fresh scouting setup',
      ...audit,
    });
    expect(current().fontenoy!.intelligence).toBeUndefined();
    expect(repo.open(id).active).toEqual(saved.active);
  } finally {
    repo.close();
    destination.close();
    rejected.close();
    clean();
  }
});
