import type {
  Campaign,
  CampaignExport,
} from '../../src/domain/legacy-campaign';

export const testId = (number: number) =>
  `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
export function campaignFixture(): Campaign {
  const timestamp = '2026-10-21T12:00:00.000Z';
  return {
    id: testId(1),
    schemaVersion: 1,
    moduleId: 'fontenoy',
    moduleVersion: 'unconfigured',
    rulesetVersion: 'unconfigured',
    title: 'Test campaign (not scenario data)',
    status: 'draft',
    revision: 1,
    turn: 0,
    date: null,
    activeSide: null,
    settings: {},
    seed: testId(2),
    createdAt: timestamp,
    updatedAt: timestamp,
    factions: [
      { id: testId(3), side: 'french', displayName: 'Test French' },
      { id: testId(4), side: 'allied', displayName: 'Test Allied' },
    ],
    units: [
      {
        id: testId(5),
        factionId: testId(3),
        displayName: 'Test regular infantry',
        type: 'regular_infantry',
        quality: 'trained',
        currentStatus: 'ready',
        provenance: 'house_rule_v0.1',
      },
    ],
    commanders: [
      { id: testId(6), factionId: testId(3), displayName: 'Test commander' },
    ],
    squares: [{ id: testId(7), row: 0, column: 0, locationName: null }],
    columns: [
      {
        id: testId(8),
        factionId: testId(3),
        displayName: 'Test column',
        squareId: testId(7),
        unitIds: [testId(5)],
        commanderIds: [testId(6)],
      },
    ],
  };
}
export function exportFixture(campaign = campaignFixture()): CampaignExport {
  return {
    format: 'maurice-campaign',
    formatVersion: 1,
    exportedAt: campaign.updatedAt,
    campaign,
    events: [
      {
        id: testId(99),
        campaignId: campaign.id,
        category: 'created',
        actor: 'Test player',
        reason: 'Test fixture only, no scenario assertions.',
        timestamp: campaign.updatedAt,
        rulesetVersion: 'unconfigured',
        sourceCampaignId: null,
        before: null,
        after: structuredClone(campaign),
      },
    ],
  };
}
