import { seedKs } from '../../src/domain/crimean-ks';
import type { KsForce } from '../../src/domain/crimean-ks';
export const ksNow = '2026-10-27T12:00:00.000Z';
export const ksSeed = () =>
  seedKs('Crimean test scenario', crypto.randomUUID(), ksNow);
export const ksForce = (): KsForce => ({
  id: crypto.randomUUID(),
  name: 'Umpire-entered brigade',
  allegiance: 'britain',
  kind: 'infantry',
  mapId: 'crimea_wyld_1855',
  position: { x: 0.42, y: 0.6 },
  strength: '2 battalions; approximate strength supplied by umpire',
  commander: 'Scenario commander',
  condition: 'Awaiting orders',
  composition: 'Scenario roster, not an asserted historical return.',
  notes: '',
  status: 'active',
  intent: null,
});
