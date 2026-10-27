import type { WaterlooCampaign } from '../domain/waterloo-schema';
import { canAdjudicate, newManualRuling } from '../domain/manual-adjudication';
import { useCampaigns } from './campaign-store';

export function beginAdjudication(
  c: WaterlooCampaign,
  corpsId?: string,
  correctsId: string | null = null,
) {
  if (useCampaigns.getState().waterlooDraft || !canAdjudicate(c)) return;
  useCampaigns.setState({
    waterlooDraft: {
      kind: 'adjudication',
      targetCorpsId: corpsId ?? null,
      input: { ...newManualRuling(c, corpsId), correctsId },
    },
    error: null,
  });
}

export function chooseAdjudicationHex(hexId: string) {
  const draft = useCampaigns.getState().waterlooDraft;
  if (draft?.kind !== 'adjudication' || !draft.targetCorpsId) return false;
  useCampaigns.setState({
    waterlooDraft: {
      ...draft,
      input: {
        ...draft.input,
        placements: draft.input.placements.map((p) =>
          p.corpsId === draft.targetCorpsId
            ? { ...p, hexId, status: 'ready' }
            : p,
        ),
      },
    },
  });
  return true;
}
