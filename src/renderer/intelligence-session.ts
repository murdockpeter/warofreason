import type { WaterlooCampaign } from '../domain/waterloo-schema';
import { canRequestScouting } from '../domain/simultaneous-intelligence';
import { useCampaigns } from './campaign-store';
export function beginScouting(c: WaterlooCampaign, corpsId: string) {
  const f = c.corps.find((f) => f.id === corpsId);
  if (!f || !canRequestScouting(c, f) || useCampaigns.getState().waterlooDraft)
    return;
  useCampaigns.setState({
    waterlooDraft: {
      kind: 'scout-request',
      input: { corpsId, hexId: f.hexId!, question: '' },
    },
    error: null,
  });
}
