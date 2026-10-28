// @vitest-environment node
import { expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { KsRepository } from '../../src/main/persistence/ks-repository';
import { SqliteCampaignRepository } from '../../src/main/persistence/repository';
import { ksForce } from '../fixtures/crimean-ks';
import type { KsCommand } from '../../src/domain/crimean-ks';

function removeTestDirectory(directory: string) {
  const prefix = path.join(os.tmpdir(), 'warofreason-ks-test-');
  if (!path.resolve(directory).startsWith(prefix))
    throw new Error('Unsafe test cleanup');
  rmSync(directory, { recursive: true, force: true });
}

it('keeps Maurice saves intact while independently creating, journalling, restarting, exporting and importing manual KS rulings', () => {
  const prefix = path.join(os.tmpdir(), 'warofreason-ks-test-'),
    directory = mkdtempSync(prefix),
    filename = path.join(directory, 'free-ks.sqlite');
  const maurice = new SqliteCampaignRepository(
    path.join(directory, 'campaigns.sqlite'),
  );
  let repo = new KsRepository(filename);
  const destination = new KsRepository(':memory:'),
    rejected = new KsRepository(':memory:');
  const audit = {
    actor: 'Test umpire',
    reason: 'Agreed free-form scenario outcome.',
  };
  const current = () => repo.library().active!;
  const act = (command: KsCommand) =>
    repo.act({
      id: current().id,
      expectedRevision: current().revision,
      command,
      ...audit,
    });
  try {
    maurice.create({
      title: 'Unrelated Maurice save',
      profile: 'historical_fontenoy',
      ...audit,
    });
    const old = maurice.library();
    repo.create({ title: 'Crimean Free KS', ...audit });
    const f = ksForce();
    act({ kind: 'add-force', force: f });
    const before = repo.library();
    const db = new DatabaseSync(filename);
    db.exec(
      "CREATE TRIGGER fail_ks_journal BEFORE INSERT ON ks_events BEGIN SELECT RAISE(ABORT,'simulated KS journal failure'); END;",
    );
    try {
      expect(() => act({ kind: 'set-time', campaignTime: '09:00' })).toThrow();
      expect(repo.library()).toEqual(before);
    } finally {
      db.exec('DROP TRIGGER fail_ks_journal');
      db.close();
    }
    expect(() =>
      repo.act({
        id: current().id,
        expectedRevision: 1,
        command: { kind: 'note' },
        ...audit,
      }),
    ).toThrow('changed');
    act({
      kind: 'set-intent',
      forceId: f.id,
      intent: {
        mapId: f.mapId,
        points: [f.position, { x: 0.6, y: 0.4 }],
        text: 'March intent; not adjudicated movement.',
      },
    });
    act({
      kind: 'move-force',
      forceId: f.id,
      mapId: 'sevastopol_airey_1856',
      position: { x: 0.5, y: 0.5 },
      clearIntent: true,
    });
    act({ kind: 'set-time', campaignTime: '20 September 1854, 09:00' });
    act({ kind: 'note' });
    const saved = repo.library();
    repo.close();
    repo = new KsRepository(filename);
    expect(repo.library()).toEqual(saved);
    const portable = repo.export({
      id: current().id,
      expectedRevision: current().revision,
    });
    expect(destination.import(portable)).toEqual(saved);
    expect(() => destination.import(portable)).toThrow('already present');
    const tampered = structuredClone(portable);
    tampered.campaign.forces[0]!.strength = 'Invented change without ruling';
    tampered.events.at(-1)!.after = structuredClone(tampered.campaign);
    expect(() => rejected.import(tampered)).toThrow();
    expect(rejected.library().campaigns).toEqual([]);
    expect(maurice.library()).toEqual(old);
    act({ kind: 'archive' });
    expect(() => act({ kind: 'note' })).toThrow('read-only');
  } finally {
    repo.close();
    destination.close();
    rejected.close();
    maurice.close();
    removeTestDirectory(directory);
  }
}, 15000);
it('rejects unsupported KS storage versions rather than overwriting or resetting them', () => {
  const prefix = path.join(os.tmpdir(), 'warofreason-ks-test-'),
    directory = mkdtempSync(prefix),
    file = path.join(directory, 'newer.sqlite');
  try {
    const db = new DatabaseSync(file);
    db.exec('PRAGMA user_version=99');
    db.close();
    expect(() => new KsRepository(file)).toThrow('Unsupported');
    const check = new DatabaseSync(file);
    expect(check.prepare('PRAGMA user_version').get()?.user_version).toBe(99);
    check.close();
  } finally {
    removeTestDirectory(directory);
  }
});
