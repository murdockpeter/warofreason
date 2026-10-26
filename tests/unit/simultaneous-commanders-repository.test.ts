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
it('atomically journals commander decisions through restart/import, rejects changed receipts and clones the baseline', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'maurice-officer-test-'));
  const file = path.join(directory, 'campaigns.sqlite');
  const clean = () => {
    if (
      !path
        .resolve(directory)
        .startsWith(path.join(tmpdir(), 'maurice-officer-test-'))
    )
      throw new Error('Unsafe test cleanup.');
    rmSync(directory, { recursive: true, force: true });
  };
  let repo = new SqliteCampaignRepository(file);
  const destination = new SqliteCampaignRepository(':memory:'),
    rejected = new SqliteCampaignRepository(':memory:');
  const audit = { actor: 'Umpire', reason: 'Manual officer review.' };
  const current = () => repo.library().active as WaterlooCampaign;
  const act = (command: WaterlooCommand) =>
    repo.waterloo({
      id: current().id,
      expectedRevision: current().revision,
      command,
      ...audit,
    });
  try {
    const source = repo.create({ title: 'Officer setup', ...audit })
      .active as FontenoyCampaign;
    repo.clone({
      id: source.id,
      expectedRevision: 1,
      profile: 'simultaneous_fontenoy',
      title: 'Officer operations',
      ...audit,
    });
    act({ kind: 'maurice-commanders-enable' });
    const baseline = current().fontenoy!.commanders.map((u) => u.displayName);
    const arrival: WaterlooCommand = {
      kind: 'maurice-commander',
      action: {
        kind: 'arrival',
        side: 'french',
        displayName: 'Local notable',
        notableReference: 'Private card reference',
        notes: 'Arrival explicitly agreed.',
      },
    };
    const before = repo.library();
    const check = new DatabaseSync(file);
    check.exec(
      "CREATE TRIGGER fail_officer_event BEFORE INSERT ON campaign_events BEGIN SELECT RAISE(ABORT, 'simulated officer journal failure'); END;",
    );
    try {
      expect(() => act(arrival)).toThrow();
      expect(repo.library()).toEqual(before);
    } finally {
      check.exec('DROP TRIGGER fail_officer_event');
      check.close();
    }
    act(arrival);
    const id = current().fontenoy!.commanders.at(-1)!.id;
    act({
      kind: 'maurice-commander',
      action: {
        kind: 'attachment',
        commanderId: id,
        corpsId: current().corps[0]!.id,
        notes: 'Attachment agreed.',
      },
    });
    act({
      kind: 'maurice-commander',
      action: {
        kind: 'details',
        commanderId: id,
        displayName: 'Local notable',
        notableReference: 'Updated private reference',
        notes: 'Reference corrected.',
      },
    });
    for (const side of ['french', 'allied'] as const)
      act({ kind: 'orders', side, orders: [], lock: true });
    act({ kind: 'resolve' });
    act({
      kind: 'maurice-commander',
      action: {
        kind: 'status',
        commanderId: id,
        status: 'retired',
        notes: 'Retirement manually resolved.',
      },
    });
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
    const tampered = structuredClone(exported);
    (
      tampered.campaign as WaterlooCampaign
    ).fontenoy!.officers!.records[2]!.action.notes = 'Rewritten explanation.';
    expect(() => rejected.importCampaign(tampered)).toThrow();
    const originalId = current().id;
    repo.clone({
      id: originalId,
      expectedRevision: current().revision,
      title: 'Baseline clone',
      ...audit,
    });
    expect(current().fontenoy!.officers).toBeUndefined();
    expect(current().fontenoy!.commanders.map((u) => u.displayName)).toEqual(
      baseline,
    );
    expect(repo.open(originalId).active).toEqual(saved.active);
    expect(repo.open(source.id).active!.revision).toBe(1);
  } finally {
    repo.close();
    destination.close();
    rejected.close();
    clean();
  }
});
