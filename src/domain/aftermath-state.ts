import type { FontenoyCampaign } from './campaign';
import type { Declaration } from './tabletop-schema';

export function battleReviewed(campaign: FontenoyCampaign, battleId: string) {
  return !!campaign.aftermath?.reviews.some((r) => r.battleId === battleId);
}
export function engagementSettled(
  campaign: FontenoyCampaign,
  candidate: Declaration['candidate'],
) {
  return (campaign.tabletop?.battles ?? []).some(
    (b) =>
      battleReviewed(campaign, b.id) &&
      b.declaration.candidate.squareId === candidate.squareId &&
      b.declaration.candidate.turn === candidate.turn &&
      b.participants.some((p) => p.columnId === candidate.attackerId) &&
      b.participants.some((p) => p.columnId === candidate.defenderId),
  );
}
export function pendingCampaignReviews(campaign: FontenoyCampaign) {
  return (
    (campaign.tabletop?.battles ?? []).some(
      (b) => !battleReviewed(campaign, b.id),
    ) ||
    (campaign.operations?.engagements ?? []).some(
      (e) => !engagementSettled(campaign, e),
    )
  );
}
