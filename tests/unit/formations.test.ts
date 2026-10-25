// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { preparedTabletop, contactCampaign } from '../fixtures/tabletop';
import { applyOperationalCommand } from '../../src/domain/operations';
import type { OperationalCommand } from '../../src/domain/operations-schema';
import {
  fontenoyCampaignSchema,
  exportSchema,
} from '../../src/domain/campaign';
import { SqliteCampaignRepository } from '../../src/main/persistence/repository';
import type { FontenoyCampaign } from '../../src/domain/campaign';

function split(
  c = preparedTabletop(),
): Extract<OperationalCommand, { kind: 'split' }> {
  return {
    kind: 'split',
    columnId: c.columns[0]!.id,
    newColumnId: crypto.randomUUID(),
    displayName: 'New detachment',
    unitIds: c.columns[0]!.unitIds.slice(0, 2),
    commanderIds: c.columns[0]!.commanderIds,
  };
}
describe('formation splitting', () => {
  it('preserves the exact roster, readiness, quality, position and contingent identity', () => {
    const c = preparedTabletop();
    const command = split(c);
    const changed = applyOperationalCommand(c, command);
    expect(changed.columns).toHaveLength(c.columns.length + 1);
    expect(changed.columns.at(-1)).toMatchObject({
      id: command.newColumnId,
      unitIds: command.unitIds,
      commanderIds: command.commanderIds,
      squareId: c.columns[0]!.squareId,
      concealment: c.columns[0]!.concealment,
    });
    expect(changed.columns[0]!.commanderIds).toEqual([]);
    expect(changed.columns.flatMap((col) => col.unitIds).sort()).toEqual(
      c.columns.flatMap((col) => col.unitIds).sort(),
    );
    expect(changed.units).toEqual(c.units);
    expect(changed.turn).toBe(c.turn);
    expect(fontenoyCampaignSchema.safeParse(changed).success).toBe(true);
    expect(c.columns).toHaveLength(4);
  });
  it.each([
    'all',
    'none',
    'foreign',
    'duplicate',
    'identity',
    'enemy',
    'commander',
  ] as const)('rejects %s transfer without mutation', (variant) => {
    const c = preparedTabletop();
    const before = structuredClone(c);
    const command = split(c);
    if (variant === 'all') command.unitIds = [...c.columns[0]!.unitIds];
    if (variant === 'none') command.unitIds = [];
    if (variant === 'foreign') command.unitIds = [c.columns[2]!.unitIds[0]!];
    if (variant === 'duplicate')
      command.unitIds = [command.unitIds[0]!, command.unitIds[0]!];
    if (variant === 'identity') command.newColumnId = c.units[0]!.id;
    if (variant === 'enemy') command.columnId = c.columns[2]!.id;
    if (variant === 'commander') command.commanderIds = [c.commanders[1]!.id];
    expect(() => applyOperationalCommand(c, command)).toThrow();
    expect(c).toEqual(before);
  });
  it('blocks issued orders and engaged formations', () => {
    const c = preparedTabletop();
    expect(() =>
      applyOperationalCommand(
        applyOperationalCommand(c, { kind: 'issue', orders: [] }),
        split(c),
      ),
    ).toThrow('planning');
    const engaged = contactCampaign();
    expect(() =>
      applyOperationalCommand(engaged, {
        ...split(engaged),
        columnId: engaged.columns[3]!.id,
      }),
    ).toThrow('contact');
  });
  it('round-trips a journaled split and rejects forged transfers and stale revisions', () => {
    const repo = new SqliteCampaignRepository(':memory:');
    const destination = new SqliteCampaignRepository(':memory:');
    const audit = {
      actor: 'Test player',
      reason: 'Player-agreed reorganisation.',
    };
    try {
      const c = repo.create({ title: 'Split test', ...audit })
        .active as FontenoyCampaign;
      c.settings.reviewedHouseRules = true;
      c.settings.reviewedSchematicMap = true;
      repo.saveSetup({
        id: c.id,
        expectedRevision: 1,
        ...audit,
        settings: c.settings,
        columns: c.columns,
        commanders: c.commanders,
      });
      repo.start({ id: c.id, expectedRevision: 2, ...audit });
      repo.operate({
        id: c.id,
        expectedRevision: 3,
        ...audit,
        command: { kind: 'enable' },
      });
      const command = split(repo.library().active as FontenoyCampaign);
      repo.operate({ id: c.id, expectedRevision: 4, ...audit, command });
      const saved = repo.library();
      expect(saved.events.at(-1)!.category).toBe('formation_split');
      expect(() =>
        repo.operate({ id: c.id, expectedRevision: 4, ...audit, command }),
      ).toThrow();
      expect(repo.library()).toEqual(saved);
      const backup = repo.exportCampaign({ id: c.id, expectedRevision: 5 });
      const imported = destination.importCampaign(backup)
        .active as FontenoyCampaign;
      expect(imported.columns).toEqual(
        (saved.active as FontenoyCampaign).columns,
      );
      expect(imported.units).toEqual((saved.active as FontenoyCampaign).units);
      const forged = structuredClone(backup);
      if (
        forged.campaign.schemaVersion !== 2 ||
        forged.events.at(-1)!.after.schemaVersion !== 2
      )
        throw new Error('Configured campaign expected.');
      (forged.events.at(-1)!.after as FontenoyCampaign).columns.at(
        -1,
      )!.squareId = c.columns[2]!.squareId;
      forged.campaign = structuredClone(forged.events.at(-1)!.after);
      expect(exportSchema.safeParse(forged).success).toBe(false);
    } finally {
      repo.close();
      destination.close();
    }
  });
});
