// @vitest-environment node
import { expect, it } from 'vitest';
import {
  applyKsCommand,
  ksCampaignSchema,
  ksCommandSchema,
} from '../../src/domain/crimean-ks';
import { ksForce, ksNow, ksSeed } from '../fixtures/crimean-ks';
it('starts a separate empty free-form scenario with no automatic clock, movement rules or Maurice unit schema', () => {
  const c = ksSeed();
  expect(c.moduleId).toBe('crimean_free_ks');
  expect(c.forces).toEqual([]);
  expect(c.campaignTime).toBe('');
  expect(c).not.toHaveProperty('charts');
  expect(c).not.toHaveProperty('fontenoy');
  expect(c).not.toHaveProperty('phase');
  expect(ksCampaignSchema.safeParse({ ...c, morale: 10 }).success).toBe(false);
});
it('keeps planned intent distinct from position and transfers the same arbitrary-size force between independent sheets only by explicit ruling', () => {
  const original = ksSeed(),
    f = ksForce();
  let c = applyKsCommand(original, { kind: 'add-force', force: f }, ksNow);
  const intent = {
    mapId: f.mapId,
    points: [f.position, { x: 0.8, y: 0.5 }],
    text: 'Follow the road if the umpire permits.',
  };
  c = applyKsCommand(c, { kind: 'set-intent', forceId: f.id, intent }, ksNow);
  expect(c.forces[0]!.position).toEqual(f.position);
  c = applyKsCommand(
    c,
    {
      kind: 'move-force',
      forceId: f.id,
      mapId: 'sevastopol_airey_1856',
      position: { x: 0.3, y: 0.4 },
      clearIntent: true,
    },
    ksNow,
  );
  expect(c.forces[0]).toMatchObject({
    id: f.id,
    mapId: 'sevastopol_airey_1856',
    position: { x: 0.3, y: 0.4 },
    strength: f.strength,
    condition: f.condition,
    intent: null,
  });
  expect(c.campaignTime).toBe('');
  c = applyKsCommand(
    c,
    {
      kind: 'set-time',
      campaignTime: '20 September 1854, 09:00 — agreed scenario clock',
    },
    ksNow,
  );
  expect(c.forces[0]!.strength).toBe(f.strength);
  expect(original.forces).toEqual([]);
});
it('rejects unknown IDs, duplicate forces, invalid coordinates, foreign-sheet intent, implicit rules fields and edits to archived campaigns', () => {
  const f = ksForce(),
    c = applyKsCommand(ksSeed(), { kind: 'add-force', force: f }, ksNow);
  expect(() =>
    applyKsCommand(c, { kind: 'add-force', force: f }, ksNow),
  ).toThrow('fresh');
  expect(() =>
    applyKsCommand(
      c,
      {
        kind: 'move-force',
        forceId: crypto.randomUUID(),
        mapId: f.mapId,
        position: f.position,
        clearIntent: true,
      },
      ksNow,
    ),
  ).toThrow('no longer exists');
  expect(
    ksCommandSchema.safeParse({
      kind: 'move-force',
      forceId: f.id,
      mapId: f.mapId,
      position: { x: -1, y: 0.5 },
      clearIntent: true,
    }).success,
  ).toBe(false);
  expect(
    ksCommandSchema.safeParse({ kind: 'resolve', losses: 500 }).success,
  ).toBe(false);
  expect(() =>
    applyKsCommand(
      c,
      {
        kind: 'set-intent',
        forceId: f.id,
        intent: {
          mapId: 'sevastopol_airey_1856',
          points: [f.position, { x: 0.7, y: 0.8 }],
          text: 'Wrong sheet.',
        },
      },
      ksNow,
    ),
  ).toThrow('current map sheet');
  const archived = applyKsCommand(c, { kind: 'archive' }, ksNow);
  expect(() => applyKsCommand(archived, { kind: 'note' }, ksNow)).toThrow(
    'read-only',
  );
});
