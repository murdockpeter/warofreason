// @vitest-environment node
import { expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { SqliteCampaignRepository } from '../../src/main/persistence/repository';
import type { FontenoyCampaign } from '../../src/domain/campaign';
import { exportSchema } from '../../src/domain/campaign';
import type {
  WaterlooCampaign,
  WaterlooCommand,
} from '../../src/domain/waterloo-schema';
import { defaultSimultaneousRecoveryPolicy } from '../../src/domain/simultaneous-aftermath';
import { unitBattleResult } from '../fixtures/simultaneous-aftermath';

it('atomically replays unit observations, rebuilding and recovery through restart, import and setup cloning', () => {
  const directory = mkdtempSync(
    path.join(tmpdir(), 'maurice-unit-recovery-test-'),
  );
  const file = path.join(directory, 'campaigns.sqlite');
  const clean = () => {
    if (
      !path
        .resolve(directory)
        .startsWith(path.join(tmpdir(), 'maurice-unit-recovery-test-'))
    )
      throw new Error('Unsafe test cleanup.');
    rmSync(directory, { recursive: true, force: true });
  };
  let repo = new SqliteCampaignRepository(file);
  const destination = new SqliteCampaignRepository(':memory:');
  const audit = {
    actor: 'Maurice player',
    reason: 'Reviewed per-unit campaign consequences.',
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
    const source = repo.create({ title: 'Original setup', ...audit })
      .active as FontenoyCampaign;
    source.columns[0]!.squareId = source.squares.find(
      (s) => s.column === 5 && s.row === 4,
    )!.id;
    source.columns[2]!.squareId = source.squares.find(
      (s) => s.column === 7 && s.row === 4,
    )!.id;
    repo.saveSetup({
      id: source.id,
      expectedRevision: source.revision,
      columns: source.columns,
      commanders: source.commanders,
      settings: source.settings,
      ...audit,
    });
    repo.clone({
      id: source.id,
      expectedRevision: 2,
      profile: 'simultaneous_fontenoy',
      title: 'Operational recovery',
      ...audit,
    });
    const policy = defaultSimultaneousRecoveryPolicy(current());
    policy.minutesPerRecoveryTurn = 60;
    act({ kind: 'maurice-recovery-policy', policy });
    for (const [side, index] of [
      ['french', 0],
      ['allied', 2],
    ] as const) {
      const c = current();
      act({
        kind: 'orders',
        side,
        lock: true,
        orders: [
          {
            corpsId: c.corps[index]!.id,
            priority: 0,
            segments: [
              {
                path: [c.corps[index]!.hexId!, '6,4'],
                roadOnly: false,
                startAt: 390,
                hqId: c.hqs.find((h) => h.army === c.corps[index]!.army)!.id,
              },
            ],
          },
        ],
      });
    }
    act({ kind: 'resolve' });
    act({
      kind: 'declare-battle',
      encounterId: current().encounters[0]!.id,
      title: 'Recorded Maurice battle',
    });
    const battleId = current().battles[0]!.id;
    const result = unitBattleResult(current());
    const before = repo.library();
    const invalid = structuredClone(result);
    invalid.maurice!.units.pop();
    expect(() =>
      act({ kind: 'result', battleId, result: invalid, reason: 'Incomplete.' }),
    ).toThrow('exactly once');
    expect(repo.library()).toEqual(before);
    act({
      kind: 'result',
      battleId,
      result,
      reason: 'Actual tabletop observations.',
    });
    act({ kind: 'approve-result', battleId });
    const approved = repo.library();
    const check = new DatabaseSync(file);
    check.exec(
      "CREATE TRIGGER fail_unit_event BEFORE INSERT ON campaign_events BEGIN SELECT RAISE(ABORT, 'simulated aftermath write failure'); END;",
    );
    try {
      expect(() => act({ kind: 'resolve' })).toThrow();
      expect(repo.library()).toEqual(approved);
    } finally {
      check.exec('DROP TRIGGER fail_unit_event');
      check.close();
    }
    act({ kind: 'resolve' });
    expect(current().fontenoy!.units[0]).toMatchObject({
      quality: 'conscript',
      currentStatus: 'recovering',
    });
    const applied = repo.library();
    repo.close();
    repo = new SqliteCampaignRepository(file);
    expect(repo.library()).toEqual(applied);
    act({ kind: 'finalize' });
    expect(current().fontenoy!.units[0]).toMatchObject({
      quality: 'conscript',
      currentStatus: 'ready',
    });
    const data = repo.exportCampaign({
      id: current().id,
      expectedRevision: current().revision,
    });
    expect(exportSchema.safeParse(data).success).toBe(true);
    const imported = destination.importCampaign(data)
      .active as WaterlooCampaign;
    expect(imported.fontenoy).toEqual(current().fontenoy);
    const clone = destination.clone({
      id: imported.id,
      expectedRevision: imported.revision,
      title: 'Fresh setup',
      ...audit,
    }).active as WaterlooCampaign;
    expect(clone.fontenoy!.units[0]).toMatchObject({
      quality: 'elite',
      currentStatus: 'ready',
    });
    expect(clone.fontenoy!.aftermath).toBeUndefined();
    const tampered = structuredClone(data);
    if (tampered.formatVersion !== 2)
      throw new Error('Expected current export.');
    tampered.events.at(-1)!.waterlooAction!.command = {
      kind: 'maurice-recovery-policy',
      policy,
    };
    expect(exportSchema.safeParse(tampered).success).toBe(false);
    const saved = repo.library();
    repo.close();
    repo = new SqliteCampaignRepository(file);
    expect(repo.library()).toEqual(saved);
  } finally {
    repo.close();
    destination.close();
    clean();
  }
});
