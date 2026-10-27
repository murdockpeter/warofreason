import { seedHistoricalFontenoy } from '../../src/domain/fontenoy-historical-profile';
import type { WaterlooCampaign } from '../../src/domain/waterloo-schema';
import { exportSchema } from '../../src/domain/campaign';
import {
  simultaneousStep as step,
  operationalNow,
} from './simultaneous-aftermath';
export const historicalSeed = (legacy = false) =>
  seedHistoricalFontenoy(
    'Historical formation links',
    () => crypto.randomUUID(),
    operationalNow,
    legacy ? 'service_arm_v0.1' : 'reported_subunits_v0.2',
  );
export function reviewHistorical(c: WaterlooCampaign) {
  return step(c, {
    kind: 'historical-roster-review',
    review: {
      ratings: structuredClone(c.fontenoy!.historicalProfile!.openingRatings),
      acknowledgedScale: true,
      acknowledgedDeployment: true,
      acknowledgedSourceGaps: true,
      notes:
        'Players reviewed the regimental record scale, provisional deployment and house ratings.',
    },
  });
}

export function legacyHistoricalExport() {
  const c = historicalSeed(true);
  delete c.fontenoy!.historicalProfile!.groupingVersion;
  return exportSchema.parse({
    format: 'maurice-campaign',
    formatVersion: 2,
    exportedAt: operationalNow,
    campaign: c,
    events: [
      {
        id: crypto.randomUUID(),
        campaignId: c.id,
        sourceCampaignId: null,
        timestamp: c.createdAt,
        actor: 'Test umpire',
        reason: 'Legacy historical setup fixture.',
        category: 'created',
        rulesetVersion: 'maurice_operational_v0.1',
        before: null,
        after: c,
      },
    ],
  });
}
